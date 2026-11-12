import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Webhook } from "standardwebhooks";
import { validateVitest } from "../../ci/core.js";
import { validateEmailReport } from "../env/reports.js";
import {
  loopbackHttp,
  nativeMailConfig,
  nativeMessage,
} from "./mail-config.js";

const exec = promisify(execFile);
const serve = process.argv[2] === "--serve";
const secret = randomBytes(32).toString("base64");
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^(SUPABASE_|PG)/.test(key)),
);
const native = {
  ...env,
  SUPABASE_EXPERIMENTAL_STACK: "1",
  LOCAL_AUTH_EMAIL_HOOK_SECRET: "v1,whsec_" + secret,
  CARWORX_NATIVE_TEST_STACK: "native-auth",
};
const configPath = "supabase/config.toml";
const statusSummary = { runtime: "native", status: "failed" };
let phase = "setup";
let original;
let server;
let started = false;
let mail;
process.umask(0o077);

async function command(args, options = native) {
  const result = await exec("pnpm", args, {
    env: options,
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return result.stdout;
}

function capture(templates) {
  return createServer(async (request, response) => {
    try {
      if (request.method !== "POST" || request.url !== "/hook" || !mail)
        throw Error("Capture unavailable");
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 65_536) throw Error("Hook body too large");
        chunks.push(chunk);
      }
      const payload = new Webhook(secret).verify(
        Buffer.concat(chunks).toString("utf8"),
        request.headers,
      );
      const message = nativeMessage(
        payload,
        "http://localhost:5173",
        templates,
      );
      const result = await fetch(new URL("/api/v1/send", mail), {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(5_000),
      });
      await result.body?.cancel();
      if (!result.ok) throw Error("Local capture failed");
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
    } catch {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(
        '{"error":{"http_code":503,"message":"Local capture unavailable"}}',
      );
    }
  });
}

async function stop() {
  if (started) {
    await command(["exec", "supabase", "stop", "--stack", "native-auth"]);
    started = false;
  }
}

try {
  if (
    process.platform !== "linux" ||
    (serve
      ? process.env.WSL_DISTRO_NAME !== "CarworX-Native" ||
        process.env.USER !== "carworx"
      : process.env.GITHUB_ACTIONS !== "true")
  )
    throw Error("Use isolated native GitHub CI or CarworX WSL serve mode");
  if ((await command(["exec", "supabase", "--version"])).trim() !== "2.122.1")
    throw Error("Unexpected Supabase version");
  original = readFileSync(configPath, "utf8");
  server = capture(
    Object.fromEntries(
      ["confirmation", "recovery"].map((name) => [
        name,
        readFileSync(`supabase/templates/${name}.html`, "utf8"),
      ]),
    ),
  );
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  writeFileSync(
    configPath,
    nativeMailConfig(
      original,
      `http://127.0.0.1:${server.address().port}/hook`,
    ),
  );
  phase = "startup";
  started = true;
  const raw = await command([
    "exec",
    "supabase",
    "start",
    "--stack",
    "native-auth",
    "--runtime",
    "native",
    "--preparation",
    "on-demand",
    "--output-format",
    "json",
  ]);
  const info = JSON.parse(raw.slice(raw.indexOf("{")));
  if (info.runtime !== "native") throw Error("Unexpected runtime");
  mail = loopbackHttp(info.env.MAILPIT_URL ?? info.env.INBUCKET_URL);
  if (mail.pathname !== "/") throw Error("Unexpected capture path");
  phase = "capture";
  const ready = await fetch(new URL("/api/v1/messages", mail), {
    signal: AbortSignal.timeout(90_000),
    redirect: "error",
  });
  await ready.body?.cancel();
  if (!ready.ok) throw Error("Capture unavailable");
  if (serve) {
    console.log(
      "Native synthetic Auth capture is ready. Keep this process running.",
    );
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  } else {
    phase = "auth_integration";
    const privateDir = mkdtempSync(join(tmpdir(), "carworx-native-auth-"));
    const integration = join(privateDir, "integration.json");
    try {
      await command(["run", "test:integration"], {
        ...native,
        CI_INTEGRATION_REPORT: integration,
      });
    } catch {
      // Publish only source-file basenames and assertion indices, never messages.
      try {
        const report = JSON.parse(readFileSync(integration, "utf8"));
        statusSummary.integration_failures = report.testResults
          .map((file) => ({
            file:
              /(?:^|\/)([a-z0-9-]+\.test\.tsx?)$/.exec(file.name)?.[1] ??
              "unknown",
            source_locations: file.assertionResults.flatMap((test) =>
              test.status === "failed"
                ? (test.failureMessages ?? []).flatMap((message) =>
                    [
                      ...message.matchAll(
                        /integration\/([a-z0-9-]+\.test\.tsx?):(\d+):(\d+)/g,
                      ),
                    ].map((m) => `${m[1]}:${m[2]}:${m[3]}`),
                  )
                : [],
            ),
            failed_indices: file.assertionResults.flatMap((test, index) =>
              test.status === "failed" ? [index] : [],
            ),
          }))
          .filter((file) => file.failed_indices.length > 0);
      } catch {
        statusSummary.integration_report = "unavailable";
      }
      throw Error("Integration failed");
    }
    statusSummary.integration = validateVitest(
      JSON.parse(readFileSync(integration, "utf8")),
    );
    phase = "cleanup_auth";
    await stop();
    writeFileSync(configPath, original);
    phase = "auth_delivery";
    const delivery = join(privateDir, "delivery.json");
    await command(
      ["exec", "node", "scripts/ops/env/auth-email/direct-auth.js"],
      {
        ...native,
        CARWORX_NATIVE_TEST_STACK: "native-direct",
        CI_AUTH_EMAIL_REPORT: delivery,
      },
    );
    const report = JSON.parse(readFileSync(delivery, "utf8"));
    statusSummary.auth_delivery = validateEmailReport(
      report,
      process.env.K1_HEAD_SHA,
    );
  }
  statusSummary.status = "passed";
} catch {
  console.error("Native Auth parity failed at " + phase);
  process.exitCode = 1;
} finally {
  try {
    await stop();
  } catch {
    console.error("Native Auth cleanup failed");
    statusSummary.status = "failed";
    process.exitCode = 1;
  } finally {
    server?.close();
    if (original) writeFileSync(configPath, original);
  }
  if (!serve && process.env.NATIVE_AUTH_SUMMARY)
    writeFileSync(
      process.env.NATIVE_AUTH_SUMMARY,
      JSON.stringify({
        ...statusSummary,
        source_sha: process.env.K1_HEAD_SHA,
      }) + "\n",
    );
}
