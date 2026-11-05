// Disposable Linux CI stack only. No hosted API, SMTP or Resend credentials.
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { createAuthEmailHandler } from "./handler.js";
import { classifyLocalFailure } from "../reports.js";

const execute = promisify(execFile);
const checks = [];
const deliveries = [];
let invoked = 0;
let providerCalls = 0;
let authStatus = 0;
let hookStatus = 0;
let infraReason = "";
let activeEnv = process.env;
let mode = "capture";
let phase = "setup";
let server;
let original;
let changed = false;
const configPath = "supabase/config.toml";
const secret = `v1,whsec_${randomBytes(32).toString("base64")}`;
const tag = randomUUID();
const approved = [
  `signup-${tag}@example.test`,
  `reset-${tag}@example.test`,
  `unsupported-${tag}@example.test`,
  `invite-${tag}@example.test`,
  `change-${tag}@example.test`,
];
const denied = `denied-${tag}@example.test`;
const password = `Synthetic-${randomUUID()}`;
const hookEnv = {
  SEND_EMAIL_HOOK_SECRET: secret,
  APP_ORIGIN: "http://localhost:5173",
  STAGING_AUTH_EMAIL_FROM: "sender@example.test",
  STAGING_APPROVED_RECIPIENTS_JSON: JSON.stringify(approved),
};
const handler = createAuthEmailHandler(
  async (message) => {
    providerCalls++;
    if (mode === "provider_failure")
      throw new Error("synthetic provider failure");
    deliveries.push(message);
  },
  { allowLocalOrigin: true },
);

function requireSafe(ok) {
  if (!ok) throw new Error("boundary assertion failed");
}
async function command(file, args, env = process.env) {
  // Service output can contain local credentials. Never forward it to logs.
  try {
    return (
      await execute(file, args, {
        env,
        timeout: 300_000,
        maxBuffer: 8 * 1024 * 1024,
      })
    ).stdout;
  } catch (error) {
    infraReason ||= classifyLocalFailure(error);
    throw new Error("local infrastructure command failed", { cause: error });
  }
}
const supabase = (args, env) =>
  command("pnpm", ["exec", "supabase", ...args], env);
async function check(name, action) {
  phase = name;
  await action();
  checks.push({ name, status: "passed" });
}
function privateGateway(value) {
  return /^(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
    value,
  );
}

try {
  requireSafe(process.platform === "linux" && process.env.CI === "true");
  requireSafe(/^[a-f0-9]{40}$/.test(process.env.K1_HEAD_SHA ?? ""));
  requireSafe(
    process.env.CI_AUTH_EMAIL_REPORT &&
      !existsSync(process.env.CI_AUTH_EMAIL_REPORT),
  );
  original = readFileSync(configPath, "utf8");
  requireSafe(/^project_id = "carworx"$/m.test(original));
  requireSafe(/\[auth.hook.send_email\]\s*enabled = false/.test(original));
  // The project network can be removed/reallocated on stop/start. The host's
  // default bridge address is stable across this disposable stack restart.
  const network = JSON.parse(
    await command("docker", [
      "network",
      "inspect",
      "bridge",
      "--format",
      "{{json .IPAM.Config}}",
    ]),
  );
  const gateways = [
    ...new Set(
      network
        .map((n) => n.Gateway)
        .filter((g) => typeof g === "string" && privateGateway(g)),
    ),
  ];
  requireSafe(gateways.length === 1 && privateGateway(gateways[0]));
  server = createServer(async (req, res) => {
    try {
      invoked++;
      if (mode === "outage") {
        hookStatus = 503;
        req.resume();
        res.writeHead(503);
        res.end();
        return;
      }
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        requireSafe(length <= 65536);
        chunks.push(chunk);
      }
      const request = new Request("http://localhost/hook", {
        method: "POST",
        headers: req.headers,
        body: Buffer.concat(chunks),
      });
      const response = await handler(
        request,
        mode === "invalid_policy"
          ? { ...hookEnv, STAGING_APPROVED_RECIPIENTS_JSON: "[]" }
          : hookEnv,
      );
      hookStatus = response.status;
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      hookStatus = 503;
      res.writeHead(503);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  const port = server.address().port;
  const localEnv = {
    ...process.env,
    LOCAL_AUTH_EMAIL_HOOK_URI: `http://${gateways[0]}:${port}/hook`,
    LOCAL_AUTH_EMAIL_HOOK_SECRET: secret,
  };
  activeEnv = localEnv;
  phase = "hook_stack_stop";
  await supabase(["stop", "--no-backup"]);
  writeFileSync(
    configPath,
    original
      .replace(
        /(\[auth.hook.send_email\]\s*)enabled = false/,
        "$1enabled = true",
      )
      .replace('max_frequency = "60s"', 'max_frequency = "0s"')
      .replace(
        'uri = "env(LOCAL_AUTH_EMAIL_HOOK_URI)"',
        `uri = "${localEnv.LOCAL_AUTH_EMAIL_HOOK_URI}"`,
      ),
  );
  changed = true;
  phase = "hook_stack_startup";
  await supabase(["start"], localEnv);
  phase = "hook_stack_reset";
  await supabase(["db", "reset", "--local"], localEnv);
  phase = "hook_stack_status";
  const raw = await supabase(["status", "-o", "json"], localEnv);
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const api = status.API_URL;
  requireSafe(
    new URL(api).origin === api &&
      ["localhost", "127.0.0.1"].includes(new URL(api).hostname),
  );
  const anon = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const service = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
  requireSafe(anon && service);
  const call = async (path, body, token = anon, method = "POST") => {
    const response = await fetch(`${api}/auth/v1/${path}`, {
      method,
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    authStatus = response.status;
    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    return { ok: response.ok, status: response.status, data };
  };
  const create = async (email, confirmed = true) => {
    const result = await call(
      "admin/users",
      { email, password, email_confirm: confirmed },
      service,
    );
    requireSafe(result.ok);
    return result.data;
  };
  const absent = async (name, action) =>
    check(name, async () => {
      const before = deliveries.length;
      const beforeProvider = providerCalls;
      const calls = invoked;
      const response = await action();
      requireSafe(
        invoked > calls && deliveries.length === before && !response.ok,
      );
      requireSafe(
        name === "provider_failure"
          ? providerCalls > beforeProvider
          : providerCalls === beforeProvider,
      );
    });
  const verifyLast = async (type) => {
    const link = new URL(deliveries.at(-1).text.split("\n").at(-1));
    requireSafe(
      link.origin === hookEnv.APP_ORIGIN &&
        link.pathname === "/auth/confirm" &&
        link.searchParams.get("type") === type,
    );
    const response = await call("verify", {
      token_hash: link.searchParams.get("token_hash"),
      type,
    });
    requireSafe(response.ok && response.data.access_token);
  };
  await check("approved_confirmation_working_link", async () => {
    const before = deliveries.length;
    const result = await call("signup", {
      email: approved[0],
      password,
      data: {},
      email_redirect_to: "https://untrusted.example.test/",
    });
    requireSafe(result.ok && deliveries.length === before + 1);
    await verifyLast("email");
  });
  await create(approved[1]);
  await check("approved_reset_working_link", async () => {
    const before = deliveries.length;
    requireSafe(
      (await call("recover", { email: approved[1] })).ok &&
        deliveries.length === before + 1,
    );
    await verifyLast("recovery");
  });
  await absent("direct_unapproved_signup", () =>
    call("signup", { email: denied, password }),
  );
  // Failed signup may already create an unconfirmed identity. Ensure this case
  // exercises a real existing unconfirmed identity rather than enumeration hiding.
  const resendEmail = `resend-${tag}@example.test`;
  await create(resendEmail, false);
  await absent("direct_unapproved_resend", () =>
    call("resend", { email: resendEmail, type: "signup" }),
  );
  const recoveryEmail = `recovery-${tag}@example.test`;
  await create(recoveryEmail);
  await absent("direct_unapproved_recovery", () =>
    call("recover", { email: recoveryEmail }),
  );
  await create(approved[2]);
  await absent("unsupported_magiclink", () =>
    call("otp", { email: approved[2], create_user: false }),
  );
  await absent("unsupported_invite", () =>
    call("invite", { email: approved[3] }, service),
  );
  const login = await call("token?grant_type=password", {
    email: approved[2],
    password,
  });
  requireSafe(login.ok && login.data.access_token);
  await absent("unsupported_email_change", () =>
    call("user", { email: approved[4] }, login.data.access_token, "PUT"),
  );
  for (const fault of ["invalid_policy", "provider_failure", "outage"]) {
    mode = fault;
    await absent(fault, () => call("recover", { email: approved[1] }));
  }
  mode = "capture";
  // In addition to observing hook invocations and provider dispatch counts,
  // prove Auth did not use its synthetic SMTP/default delivery on rejection.
  await check("no_smtp_fallback", async () => {
    const mail =
      status.MAILPIT_URL ?? status.INBUCKET_URL ?? "http://127.0.0.1:54324";
    requireSafe(["localhost", "127.0.0.1"].includes(new URL(mail).hostname));
    const response = await fetch(`${mail}/api/v1/messages`, {
      signal: AbortSignal.timeout(5000),
    });
    requireSafe(response.ok && (await response.json()).total === 0);
  });
} catch {
  checks.push({ name: phase, status: "failed" });
  process.exitCode = 1;
} finally {
  if (changed) {
    try {
      await supabase(["stop", "--no-backup"], activeEnv);
    } catch {
      checks.push({ name: "cleanup", status: "failed" });
      process.exitCode = 1;
    }
    writeFileSync(configPath, original);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  const failed = checks.filter((c) => c.status === "failed").length;
  const report = {
    version: 1,
    source_sha: process.env.K1_HEAD_SHA,
    status: failed ? "failed" : "passed",
    tests: checks.length,
    passed: checks.length - failed,
    failed,
    skipped: 0,
    todo: 0,
    checks,
    observed: {
      hook_calls: invoked,
      provider_calls: providerCalls,
      auth_status: authStatus,
      hook_status: hookStatus,
      infra_reason: infraReason,
    },
  };
  if (
    process.env.CI_AUTH_EMAIL_REPORT &&
    !existsSync(process.env.CI_AUTH_EMAIL_REPORT)
  )
    writeFileSync(
      process.env.CI_AUTH_EMAIL_REPORT,
      JSON.stringify(report) + "\n",
    );
  console.log(
    `Auth email boundary: ${report.passed} passed, ${failed} failed; stage ${phase}`,
  );
}
