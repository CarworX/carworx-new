import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fingerprints } from "../readiness.js";
import { stagingOrigin, requireCondition } from "../contract.js";
import { validateNegativeReceipt } from "../smoke.js";
import { canonicalEmail } from "../../../../apps/web/app/server/security/recipient-policy.ts";
import { probeSignature, recipientId } from "./probe-runtime.js";

const env = process.env;
const [command, flow, id] = process.argv.slice(2);
const confirm = ["approved_confirmation", "approved_recovery"];
const direct = [
  ...confirm,
  "unapproved_signup",
  "unapproved_resend",
  "unapproved_recovery",
  "unsupported_action",
  "hook_failure_no_fallback",
];
const sha = /^[a-f0-9]{40}$/;
const opaque = /^[A-Za-z0-9_-]{8,128}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

async function fetchPrivate(url, init) {
  return fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
}

async function operator(origin, recipient, message) {
  const body = JSON.stringify({ ...message, recipient });
  const stamp = String(Date.now());
  const signature = await probeSignature(
    env.STAGING_PROBE_ADMIN_KEY,
    `carworx-probe-v1\noperator\n${stamp}\n${body}`,
  );
  const response = await fetchPrivate(`${origin}/_ops/probe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-carworx-probe-role": "operator",
      "x-carworx-probe-time": stamp,
      "x-carworx-probe-signature": signature,
    },
    body,
  });
  requireCondition(response.ok, "Probe command failed");
  return response.json();
}

async function appNegative(hook, app, recipient, email) {
  const source = env.STAGING_APP_SOURCE_SHA;
  const version = env.STAGING_APP_VERSION_ID;
  requireCondition(
    sha.test(source) && uuid.test(version),
    "App version required",
  );
  const receipt = {
    version: 1,
    source_sha: source,
    version_id: version,
    verified_at: new Date().toISOString(),
    checks: {},
  };
  for (const [name, path] of [
    ["signup", "sign-up"],
    ["resend", "check-email"],
    ["recovery", "forgot-password"],
  ]) {
    const correlation = randomUUID();
    await operator(hook, recipient, {
      op: "register",
      id: correlation,
      version: env.STAGING_HOOK_SOURCE_SHA,
      flow: `app_${name}`,
      app_version: version,
    });
    const page = await fetchPrivate(`${app}/auth/${path}`);
    requireCondition(page.ok, "Cannot load app probe page");
    const csrfCookie = page.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .find((value) => value.startsWith("__Host-cx-csrf="));
    requireCondition(csrfCookie, "Missing probe cookie");
    await page.body?.cancel();
    const stamp = String(Date.now());
    const signature = await probeSignature(
      env.STAGING_PROBE_EVENT_KEY,
      `carworx-app-probe-v1\n${stamp}\n${name}\n${recipient}`,
    );
    const response = await fetchPrivate(`${app}/auth/${path}`, {
      method: "POST",
      headers: {
        Origin: app,
        Cookie: csrfCookie,
        "x-carworx-app-probe": `${stamp}.${signature}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email,
        password: `Synthetic-${randomUUID()}`,
        consent: "on",
        csrf: csrfCookie.slice("__Host-cx-csrf=".length),
      }),
    });
    requireCondition(
      response.status === (name === "signup" ? 302 : 200) &&
        /private/i.test(response.headers.get("Cache-Control") ?? "") &&
        /no-store/i.test(response.headers.get("Cache-Control") ?? ""),
      "Unexpected application probe response",
    );
    await response.body?.cancel();
    receipt.checks[name] = await operator(hook, recipient, {
      op: "seal",
      id: correlation,
    });
  }
  validateNegativeReceipt(receipt, source, version);
  return receipt;
}

async function confirmLink(app, email) {
  const link = new URL(env.STAGING_PROBE_LINK);
  const type = flow === "approved_confirmation" ? "email" : "recovery";
  requireCondition(
    link.origin === app &&
      link.pathname === "/auth/confirm" &&
      link.searchParams.get("type") === type,
    "Invalid confirmation link",
  );
  const token_hash = link.searchParams.get("token_hash");
  requireCondition(
    /^[A-Za-z0-9_-]{8,256}$/.test(token_hash ?? ""),
    "Missing token hash",
  );
  const endpoint = new URL(env.STAGING_SUPABASE_URL);
  requireCondition(
    endpoint.origin === "https://gdiyrdqfkthtcglgqnts.supabase.co" &&
      endpoint.href === endpoint.origin + "/",
    "Wrong staging project",
  );
  const response = await fetchPrivate(new URL("/auth/v1/verify", endpoint), {
    method: "POST",
    headers: {
      apikey: env.STAGING_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token_hash, type }),
  });
  requireCondition(response.ok, "Auth verification failed");
  const data = await response.json();
  requireCondition(
    typeof data.access_token === "string" &&
      canonicalEmail(data.user?.email) === email,
    "Unexpected verified user",
  );
}

function hookReceipt(path) {
  const checks = JSON.parse(readFileSync(path, "utf8"));
  const fields = [
    "configuration_revision",
    "recipient_revision",
    "hook_secret_revision",
  ];
  const revisions = Object.fromEntries(
    fields.map((name) => [name, env[`STAGING_${name.toUpperCase()}`]]),
  );
  requireCondition(
    sha.test(env.STAGING_HOOK_SOURCE_SHA) &&
      uuid.test(env.STAGING_HOOK_VERSION_ID) &&
      Object.values(revisions).every((value) => opaque.test(value ?? "")),
    "Hook deployment evidence missing",
  );
  requireCondition(
    Object.keys(checks).length === direct.length,
    "Incomplete hook checks",
  );
  const sanitized = Object.fromEntries(
    direct.map((name) => {
      const result = checks[name];
      requireCondition(
        result?.status === "passed" &&
          Number.isSafeInteger(result.hook_calls) &&
          result.hook_calls > 0 &&
          Number.isSafeInteger(result.provider_calls) &&
          (confirm.includes(name)
            ? result.provider_calls > 0
            : result.provider_calls === 0) &&
          uuid.test(result.correlation_id),
        "Incomplete hook check",
      );
      return [
        name,
        {
          status: "passed",
          hook_calls: result.hook_calls,
          provider_calls: result.provider_calls,
          correlation_id: result.correlation_id,
        },
      ];
    }),
  );
  return {
    version: 1,
    kind: "hosted_hook",
    status: "passed",
    verified_at: new Date().toISOString(),
    source_sha: env.STAGING_HOOK_SOURCE_SHA,
    worker: "carworx-auth-email-staging",
    version_id: env.STAGING_HOOK_VERSION_ID,
    enabled: true,
    ...revisions,
    checks: sanitized,
  };
}

try {
  if (command === "hook-receipt") {
    const receipt = hookReceipt(flow);
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    console.log(
      JSON.stringify({ ...receipt, fingerprints: fingerprints(root) }),
    );
  } else {
    const app = stagingOrigin(env.STAGING_APP_ORIGIN);
    const hook = stagingOrigin(env.STAGING_HOOK_ORIGIN);
    requireCondition(
      app !== hook && sha.test(env.STAGING_HOOK_SOURCE_SHA),
      "Staging hook source required",
    );
    const email = canonicalEmail(env.STAGING_PROBE_EMAIL);
    requireCondition(email, "Private probe address required");
    const recipient = await recipientId(env.STAGING_PROBE_EVENT_KEY, email);
    if (command === "app-negative") {
      console.log(
        JSON.stringify(await appNegative(hook, app, recipient, email)),
      );
    } else {
      requireCondition(
        direct.includes(flow) && uuid.test(id),
        "Valid probe case and correlation ID required",
      );
      if (command === "register") {
        console.log(
          JSON.stringify(
            await operator(hook, recipient, {
              op: "register",
              id,
              version: env.STAGING_HOOK_SOURCE_SHA,
              flow,
            }),
          ),
        );
      } else if (command === "seal") {
        if (confirm.includes(flow)) {
          await confirmLink(app, email);
          await operator(hook, recipient, {
            op: "event",
            id: randomUUID(),
            kind: "link_verified",
          });
        }
        console.log(
          JSON.stringify(await operator(hook, recipient, { op: "seal", id })),
        );
      } else {
        throw Error("Unsupported probe command");
      }
    }
  }
} catch {
  console.error(
    "Staging probe failed. Check target, private inputs, version and observations.",
  );
  process.exitCode = 1;
}
