import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { bindingCheck, cloudflare, currentDeployment } from "./hosted.js";
import { requireCondition, stagingOrigin } from "./contract.js";

// Only fixed status names/counts escape this harness. Responses/cookies remain private.
export function validateNegativeReceipt(
  receipt,
  sha,
  version,
  now = Date.now(),
) {
  const age = now - Date.parse(receipt?.verified_at);
  requireCondition(
    receipt?.version === 1 &&
      receipt.source_sha === sha &&
      receipt.version_id === version &&
      age >= 0 &&
      age <= 86400000,
    "Application negative receipt stale",
  );
  for (const name of ["signup", "resend", "recovery"]) {
    const c = receipt.checks?.[name];
    requireCondition(
      c?.status === "passed" &&
        c.auth_calls === 0 &&
        c.provider_calls === 0 &&
        /^[A-Za-z0-9_-]{8,128}$/.test(c.correlation_id ?? ""),
      "Application negative counts missing",
    );
  }
  return true;
}

export async function smoke(
  {
    origin,
    email,
    password,
    unapproved,
    settings,
    beforeNegative,
    afterNegative,
    negativeEvidence,
  },
  request = fetch,
) {
  stagingOrigin(origin);
  const checks = [];
  const jar = new Map();
  const check = async (name, action) => {
    try {
      await action();
      checks.push({ name, status: "passed" });
    } catch {
      checks.push({ name, status: "failed" });
    }
  };
  const send = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    if (jar.size)
      headers.set("Cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const response = await request(`${origin}${path}`, {
      ...init,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    for (const line of response.headers.getSetCookie()) {
      const pair = line.split(";", 1)[0];
      const at = pair.indexOf("=");
      if (at > 0) jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  };
  const noStore = (response, personal = true) => {
    const value = response.headers.get("Cache-Control") ?? "";
    requireCondition(
      /\bno-store\b/i.test(value) && (!personal || /\bprivate\b/i.test(value)),
      "Cache policy failed",
    );
  };
  await check("health", async () => {
    const response = await send("/healthz");
    requireCondition(response.status === 200, "Health failed");
    noStore(response, false);
    const value = await response.json();
    requireCondition(
      value.status === "ok" &&
        value.service === "carworx-web" &&
        Object.keys(value).length === 2,
      "Health body failed",
    );
  });
  await check("publishable_binding", async () => bindingCheck(settings));
  await check("anonymous_personal_cache", async () => {
    for (const path of ["/account", "/account.data", "/auth/sign-in"]) {
      const response = await send(path);
      noStore(response);
      requireCondition(
        path === "/auth/sign-in"
          ? response.status === 200
          : path === "/account.data" && response.status === 202
            ? (await response.text()).includes("/auth/sign-in")
            : [302, 401, 403].includes(response.status),
        "Anonymous route failed",
      );
    }
  });
  await check("synthetic_auth", async () => {
    requireCondition(
      typeof email === "string" &&
        typeof password === "string" &&
        password.length > 0 &&
        jar.has("__Host-cx-csrf"),
      "Owner synthetic identity missing",
    );
    const response = await send("/auth/sign-in", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email,
        password,
        csrf: jar.get("__Host-cx-csrf"),
        returnTo: "/account",
      }),
    });
    noStore(response);
    requireCondition(
      response.status === 302 &&
        response.headers.get("Location") === "/account",
      "Synthetic sign-in failed",
    );
  });
  await check("authenticated_personal_cache", async () => {
    for (const path of ["/account", "/account.data"]) {
      const response = await send(path);
      requireCondition(response.status === 200, "Authenticated route failed");
      noStore(response);
    }
  });
  await check("staging_dev_pages", async () => {
    const response = await send("/_dev/components");
    requireCondition(
      response.status === 200 &&
        /noindex/.test(response.headers.get("X-Robots-Tag") ?? ""),
      "Staging dev page failed",
    );
    noStore(response, false);
  });
  await check("application_recipient_negative", async () => {
    if (negativeEvidence) {
      requireCondition(
        negativeEvidence.validated === true,
        "Owner receipt not validated",
      );
      return;
    }
    requireCondition(
      typeof unapproved === "string" &&
        unapproved.length > 0 &&
        typeof beforeNegative === "function" &&
        typeof afterNegative === "function",
      "Provider counter evidence missing",
    );
    for (const path of ["sign-up", "check-email", "forgot-password"]) {
      const before = await beforeNegative();
      const response = await send(`/auth/${path}`, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: unapproved,
          password: `Synthetic-${crypto.randomUUID()}`,
          consent: "on",
          csrf: jar.get("__Host-cx-csrf") ?? "",
        }),
      });
      noStore(response);
      requireCondition(
        response.status === (path === "sign-up" ? 302 : 200),
        "Application negative response failed",
      );
      const after = await afterNegative();
      requireCondition(
        Number.isSafeInteger(before) && before >= 0 && after === before,
        "Unapproved provider dispatch detected",
      );
    }
  });
  await check("logout", async () => {
    const response = await send("/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf: jar.get("__Host-cx-csrf") ?? "" }),
    });
    noStore(response);
    requireCondition(response.status === 302, "Logout failed");
    const account = await send("/account");
    noStore(account);
    requireCondition(account.status === 302, "Session survived logout");
  });
  return {
    version: 1,
    status: checks.every((c) => c.status === "passed") ? "passed" : "failed",
    tests: checks.length,
    passed: checks.filter((c) => c.status === "passed").length,
    checks,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const summary = JSON.parse(
      readFileSync(process.env.STAGING_EVIDENCE, "utf8"),
    );
    requireCondition(
      summary.deployed === true && summary.version_id,
      "Matching deployed source required",
    );
    const current = await currentDeployment(summary.worker, process.env);
    requireCondition(
      current.version_id === summary.version_id,
      "Deployment changed before smoke",
    );
    const settings = await cloudflare(
      `workers/scripts/${summary.worker}/settings`,
      process.env,
    );
    // The workflow runs HTTP checks now. Counter evidence is completed by an
    // owner probe outside this job; missing counter receipts FAIL A2, never pass.
    let negativeEvidence;
    if (process.env.STAGING_APPLICATION_NEGATIVE_EVIDENCE_JSON) {
      const receipt = JSON.parse(
        process.env.STAGING_APPLICATION_NEGATIVE_EVIDENCE_JSON,
      );
      validateNegativeReceipt(
        receipt,
        summary.reviewed_sha,
        summary.version_id,
      );
      negativeEvidence = { validated: true };
    }
    const result = await smoke({
      origin: process.env.STAGING_APP_ORIGIN,
      email: process.env.STAGING_SMOKE_EMAIL,
      password: process.env.STAGING_SMOKE_PASSWORD,
      unapproved: process.env.STAGING_SMOKE_UNAPPROVED_EMAIL,
      settings,
      negativeEvidence,
    });
    summary.smoke = result;
    summary.a2 = result.status === "passed" ? "passed" : "open";
    writeFileSync(
      process.env.STAGING_EVIDENCE,
      JSON.stringify(summary, null, 2) + "\n",
    );
    requireCondition(
      result.status === "passed",
      "Staging smoke failed or owner counter evidence missing",
    );
    console.log("Staging smoke checks passed");
  } catch {
    console.error(
      "Staging smoke failed; A2 remains open. Inspect sanitized statuses only.",
    );
    process.exitCode = 1;
  }
}
