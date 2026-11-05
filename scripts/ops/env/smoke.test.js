import assert from "node:assert/strict";
import test from "node:test";
import { smoke, validateNegativeReceipt } from "./smoke.js";

function fixture(fault) {
  let signedIn = false;
  const settings = {
    bindings: [
      "SUPABASE_PUBLISHABLE_KEY",
      "STAGING_APPROVED_RECIPIENTS_JSON",
    ].map((name) => ({ name, type: "secret_text" })),
  };
  const options = {
    origin: "https://staging.example.test",
    email: "approved@example.test",
    password: crypto.randomUUID(),
    unapproved: "unapproved@example.test",
    settings,
    beforeNegative: async () => 0,
    afterNegative: async () => (fault === "provider" ? 1 : 0),
  };
  const request = async (url, init) => {
    const path = new URL(url).pathname;
    const headers = new Headers({
      "Cache-Control":
        fault === "cache" ? "public, max-age=60" : "private, no-store",
    });
    let status = 200;
    let body = "synthetic";
    if (path === "/healthz")
      body = JSON.stringify({ status: "ok", service: "carworx-web" });
    if (path === "/auth/sign-in") {
      headers.append(
        "Set-Cookie",
        `__Host-cx-csrf=${"a".repeat(43)}; Path=/; Secure; HttpOnly; SameSite=Lax`,
      );
      if (init.method === "POST") {
        signedIn = fault !== "login";
        status = signedIn ? 302 : 400;
        if (signedIn) headers.set("Location", "/account");
      }
    }
    if (path.startsWith("/account") && !signedIn) {
      status = path === "/account.data" ? 202 : 302;
      if (status === 202) body = "synthetic encoded redirect /auth/sign-in";
      headers.set("Location", "/auth/sign-in");
    }
    if (path === "/_dev/components") {
      status = fault === "dev" ? 404 : 200;
      headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    if (path === "/auth/sign-up" && init.method === "POST") {
      status = 302;
      headers.set("Location", "/auth/check-email?sent=signup");
    }
    if (path === "/auth/sign-out") {
      signedIn = false;
      status = 302;
      headers.set("Location", "/");
    }
    return new Response(body, { status, headers });
  };
  return { options, request };
}
test("smoke exercises health, personal cache, key binding, session, dev pages and recipient counters", async () => {
  const f = fixture();
  const result = await smoke(f.options, f.request);
  assert.equal(result.status, "passed");
  assert.equal(result.tests, 8);
  assert.equal(JSON.stringify(result).includes(f.options.email), false);
  assert.equal(JSON.stringify(result).includes(f.options.password), false);
});
test("cache, login, dev-page and recipient dispatch faults leave A2 open", async () => {
  for (const fault of ["cache", "login", "dev", "provider"]) {
    const f = fixture(fault);
    assert.equal((await smoke(f.options, f.request)).status, "failed");
  }
  const f = fixture();
  f.options.beforeNegative = undefined;
  assert.equal((await smoke(f.options, f.request)).status, "failed");
});
test("hosted negative receipts need current version, head, counts and freshness", () => {
  const sha = "a".repeat(40);
  const version = "12345678-1234-1234-1234-123456789012";
  const now = Date.parse("2026-11-05T12:00:00Z");
  const receipt = {
    version: 1,
    source_sha: sha,
    version_id: version,
    verified_at: new Date(now).toISOString(),
    checks: Object.fromEntries(
      ["signup", "resend", "recovery"].map((name) => [
        name,
        {
          status: "passed",
          auth_calls: 0,
          provider_calls: 0,
          correlation_id: "probe-0001",
        },
      ]),
    ),
  };
  assert.equal(validateNegativeReceipt(receipt, sha, version, now), true);
  for (const change of [
    { source_sha: "b".repeat(40) },
    { version_id: "other" },
    { verified_at: "2026-11-01T00:00:00Z" },
    { checks: {} },
  ])
    assert.throws(() =>
      validateNegativeReceipt({ ...receipt, ...change }, sha, version, now),
    );
  const bad = structuredClone(receipt);
  bad.checks.signup.provider_calls = 1;
  assert.throws(() => validateNegativeReceipt(bad, sha, version, now));
});
