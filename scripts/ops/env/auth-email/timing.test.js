import assert from "node:assert/strict";
import test from "node:test";
import {
  collectTimings,
  quantiles,
  summarizeTiming,
  validateTiming,
} from "./timing.js";
const metadata = {
  environment: "staging",
  source_sha: "a".repeat(40),
  hook_version: "hook-version-0001",
  configuration_revision: "config-0001",
};
function samples() {
  return ["signup", "resend", "recovery"].flatMap((flow) =>
    ["fresh", "cooldown"].flatMap((cooldown) =>
      ["allowed", "denied"].flatMap((group) =>
        Array.from({ length: 20 }, (_, i) => ({
          path: "direct",
          flow,
          cooldown,
          group,
          ms: i + 1,
          shape: "same",
          email: "private@example.test",
          token: "never-publish",
        })),
      ),
    ),
  );
}
test("nearest-rank quantiles preserve the tail and reject inadequate samples", () => {
  assert.deepEqual(quantiles(Array.from({ length: 100 }, (_, i) => i + 1)), {
    count: 100,
    p50_ms: 50,
    p95_ms: 95,
    p99_ms: 99,
    max_ms: 100,
  });
  assert.throws(() => quantiles([1]));
  assert.throws(() => quantiles(Array(20).fill(NaN)));
});
test("complete timing strata bind deployed versions without publishing raw private samples", () => {
  for (const override of [
    { hook_version: { email: "private@example.test" } },
    { configuration_revision: "private@example.test" },
    { source_sha: "private@example.test" },
  ])
    assert.throws(() =>
      summarizeTiming(samples(), { ...metadata, ...override }),
    );
  const report = summarizeTiming(samples(), {
    ...metadata,
    password: "private",
  });
  assert.equal(validateTiming(report, { ...metadata, path: "direct" }), true);
  assert.doesNotMatch(
    JSON.stringify(report),
    /private|never-publish|email|password/,
  );
  for (const change of [
    (r) => delete r.cases[0],
    (r) => (r.cases[0].allowed.count = 0),
    (r) => (r.cases[0].denied.p95_ms = NaN),
    (r) => (r.cases[0].response_shapes_match = false),
    (r) => (r.environment = "local"),
    (r) => (r.hook_version = "other"),
    (r) => (r.verified_at = "2000-01-01"),
  ]) {
    const copy = structuredClone(report);
    change(copy);
    assert.throws(() => validateTiming(copy, { ...metadata, path: "direct" }));
  }
});
test("HTTP collector invokes Auth, alternates cohorts, and rejects throttled fresh fixtures", async () => {
  const config = {
    ...metadata,
    app_origin: "https://staging.example.test",
    auth_origin: "https://project.supabase.co",
    publishable_key: "private-key",
    cases: [
      {
        path: "direct",
        flow: "signup",
        cooldown: "fresh",
        expected_status: 200,
        pairs: Array.from({ length: 20 }, () => ({
          allowed: { email: "allowed@example.test" },
          denied: { email: "denied@example.test" },
        })),
      },
    ],
  };
  const seen = [];
  const send = async (url, init) => {
    seen.push([url, JSON.parse(init.body).email]);
    return Response.json({ user: { email: JSON.parse(init.body).email } });
  };
  const report = await collectTimings(config, send);
  assert.equal(seen.length, 40);
  assert.deepEqual(
    seen.slice(0, 4).map((x) => x[1]),
    [
      "allowed@example.test",
      "denied@example.test",
      "denied@example.test",
      "allowed@example.test",
    ],
  );
  assert.equal(report.cases[0].allowed.count, 20);
  assert.equal(
    seen.every((x) => x[0].endsWith("/auth/v1/signup")),
    true,
  );
  await assert.rejects(
    collectTimings(config, async () => new Response(null, { status: 429 })),
  );
});
