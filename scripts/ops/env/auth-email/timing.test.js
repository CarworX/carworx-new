import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, chmodSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createTimingTrace } from "./timing-trace.js";
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
function privateDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "carworx-timing-"));
  if (process.platform === "win32") {
    const code = `$ErrorActionPreference='Stop'; $me=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object Security.AccessControl.DirectorySecurity; $acl.SetOwner($me); $acl.SetAccessRuleProtection($true,$false); $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($me,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))); Set-Acl -LiteralPath $env:CARWORX_TEST_TRACE_DIRECTORY -AclObject $acl`;
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", code],
      {
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => key.toLowerCase() !== "psmodulepath",
            ),
          ),
          CARWORX_TEST_TRACE_DIRECTORY: directory,
        },
        stdio: "pipe",
        timeout: 5000,
      },
    );
    assert.equal(r.status, 0, "Secure test directory setup failed");
  }
  return directory;
}
function samples() {
  const ids = new Map();
  const identity = (flow, cooldown) => {
    const key = flow + cooldown;
    if (!ids.has(key)) ids.set(key, randomUUID());
    return ids.get(key);
  };
  return ["signup", "resend", "recovery"].flatMap((flow) =>
    ["fresh", "cooldown"].flatMap((cooldown) =>
      ["allowed", "denied"].flatMap((group) =>
        Array.from({ length: 20 }, (_, i) => ({
          correlation_id: identity(flow, cooldown),
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
  const directory = privateDirectory();
  const path = join(directory, "run.json");
  const report = await collectTimings(
    config,
    send,
    createTimingTrace(path, config),
  );
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(manifest.status, "completed");
  assert.equal(
    manifest.strata[0].correlation_id,
    report.cases[0].correlation_id,
  );
  assert.equal(manifest.samples.length, 40);
  assert.equal(
    manifest.samples.every(
      (s) =>
        s.correlation_id === report.cases[0].correlation_id &&
        s.started_at &&
        s.duration_ms >= 0 &&
        s.http_status === 200,
    ),
    true,
  );
  assert.doesNotMatch(
    JSON.stringify(manifest),
    /allowed@example|denied@example|private-key/,
  );
  assert.doesNotMatch(
    JSON.stringify(report),
    new RegExp(manifest.private_run_id),
  );
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
    collectTimings(
      config,
      async () => new Response(null, { status: 429 }),
      createTimingTrace(join(directory, "failed.json"), config),
    ),
  );
  assert.equal(
    JSON.parse(readFileSync(join(directory, "failed.json"), "utf8")).status,
    "failed",
  );
  const brokenPath = join(directory, "write-failure.json");
  const broken = createTimingTrace(brokenPath, config);
  let calls = 0;
  await assert.rejects(
    collectTimings(
      config,
      async () => {
        calls++;
        broken.close();
        return Response.json({ ok: true });
      },
      broken,
    ),
  );
  assert.equal(calls, 1);
  assert.notEqual(
    JSON.parse(readFileSync(brokenPath, "utf8")).status,
    "completed",
  );
});

test("private trace creation fails closed for existing, missing, Git or insecure paths", () => {
  const directory = privateDirectory();
  const path = join(directory, "existing.json");
  writeFileSync(path, "preserve");
  assert.throws(() => createTimingTrace(path, {}));
  assert.equal(readFileSync(path, "utf8"), "preserve");
  assert.throws(() => createTimingTrace(undefined, {}));
  assert.throws(() =>
    createTimingTrace(join(directory, "missing", "run.json"), {}),
  );
  writeFileSync(join(directory, ".git"), "gitdir: synthetic");
  assert.throws(() =>
    createTimingTrace(join(directory, "inside-git.json"), {}),
  );
  if (process.platform !== "win32") {
    const insecure = mkdtempSync(join(tmpdir(), "carworx-timing-insecure-"));
    chmodSync(insecure, 0o755);
    assert.throws(() => createTimingTrace(join(insecure, "run.json"), {}));
  }
});
