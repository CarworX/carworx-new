import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  databaseDiagnostic,
  rlsFailureSummary,
} from "./database-diagnostic.js";

test("database diagnostics expose only fixed labels from private service output", () => {
  assert.deepEqual(
    rlsFailureSummary({ stdout: "FAIL 00_secret.test.sql" }).files,
    [],
  );
  assert.deepEqual(
    rlsFailureSummary({
      stdout:
        "FAIL 40_catalogue_privacy.test.sql\nnot ok 3 - secret SQL text\nnot ok 3\naccess_token=secret",
    }),
    {
      files: ["40_catalogue_privacy.test.sql"],
      assertions: [3],
      diagnostic: "unclassified",
    },
  );
  assert.deepEqual(
    rlsFailureSummary({
      stdout:
        "FAIL 44_providers.test.sql\nFAIL 50_email_outbox.test.sql\nnot ok 7 - private values must stay private",
    }),
    {
      files: ["44_providers.test.sql", "50_email_outbox.test.sql"],
      assertions: [7],
      diagnostic: "unclassified",
    },
  );
  for (const [input, expected] of [
    ["must be able to SET ROLE secret-role", "database-role-switch"],
    ["must be owner of secret-table", "database-ownership"],
    ["ERROR SQLSTATE 42501 secret", "database-permission"],
    ["ERROR SQLSTATE 42601 secret", "database-syntax"],
    ['syntax error at or near "secret"', "database-syntax"],
    ['column reference "secret" is ambiguous', "database-ambiguous-column"],
    ['violates check constraint "secret"', "database-check-constraint"],
    ["permission denied for sequence secret", "database-permission"],
    ['schema "private-secret" does not exist', "database-missing-schema"],
    ["permission denied for function secret_function", "database-permission"],
    ["SQLSTATE 42710 secret", "database-duplicate-object"],
    ["SQLSTATE 42P01 secret", "database-missing-relation"],
    ["token=secret malformed SQLSTATE SEC12", "unclassified"],
  ]) {
    assert.equal(databaseDiagnostic({ stdout: input }), expected);
    assert.equal(databaseDiagnostic({ stderr: input }), expected);
    assert.doesNotMatch(databaseDiagnostic({ stderr: input }), /secret|token/i);
  }
});
import {
  isProseException,
  PROSE_DIGEST,
  sanitize,
  verifyChecksum,
} from "./secrets.js";
import {
  requiredSuites,
  validateContract,
  validateGate,
  validateTap,
  validateVitest,
} from "./core.js";

const bootstrap = { version: 1, rls: false, integration: false };

test("the manual prose exception cannot suppress another source, line, commit or credential", () => {
  const finding = {
    RuleID: "generic-api-key",
    File: "planning/research/codex-vendor-access.md",
    StartLine: 10,
    EndLine: 10,
    Commit: "668466e234e65c92dfceba3037a34a9ca9e5bcbc",
  };
  assert.equal(isProseException(finding, PROSE_DIGEST), true);
  assert.equal(
    isProseException({ ...finding, Commit: "" }, PROSE_DIGEST),
    true,
  );
  assert.equal(
    isProseException(finding, "changed line containing a credential"),
    false,
  );
  for (const change of [
    { File: "another.md" },
    { Commit: "another-commit" },
    { StartLine: 11 },
    { EndLine: 11 },
    { RuleID: "github-pat" },
  ])
    assert.equal(
      isProseException({ ...finding, ...change }, PROSE_DIGEST),
      false,
    );
});

test("scanner checksum mismatch fails and published findings exclude secret fields", () => {
  const bytes = Buffer.from("archive fixture");
  verifyChecksum(bytes, createHash("sha256").update(bytes).digest("hex"));
  assert.throws(() => verifyChecksum(bytes));
  const secret = "private fixture content";
  const result = sanitize([
    {
      RuleID: "fixture",
      File: "fixture.txt",
      StartLine: 3,
      Commit: "abc",
      Secret: secret,
      Match: secret,
      Entropy: 4,
    },
  ]);
  assert.deepEqual(result, [
    { rule: "fixture", file: "fixture.txt", line: 3, commit: "abc" },
  ]);
  assert.equal(JSON.stringify(result).includes(secret), false);
});
const vitest = {
  success: true,
  numTotalTests: 3,
  numPassedTests: 3,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [
    {
      assertionResults: Array.from({ length: 3 }, () => ({ status: "passed" })),
    },
  ],
};

test("valid real-shaped Vitest evidence is accepted; missing, empty, failed, skipped and malformed evidence fails", () => {
  assert.deepEqual(validateVitest(vitest), { tests: 3, passed: 3 });
  for (const bad of [
    null,
    {},
    { ...vitest, numTotalTests: 0 },
    { ...vitest, success: false },
    { ...vitest, numPendingTests: 1 },
    { ...vitest, numTodoTests: 1 },
    { ...vitest, testResults: [] },
    { ...vitest, numTotalTests: "3" },
  ])
    assert.throws(() => validateVitest(bad));
});

test("pgTAP requires complete nonzero plans without failures, skips, TODO or bailouts", () => {
  assert.deepEqual(
    validateTap(
      "TAP version 13\n1..2\nok 1 - anonymous denied\nok 2 - tenant isolated\n",
    ),
    { tests: 2, passed: 2 },
  );
  for (const bad of [
    "",
    "1..0",
    "1..1\nok 1 # SKIP",
    "1..1\nnot ok 1",
    "1..1\nok 1 # TODO",
    "Bail out!",
    "1..2\nok 1",
    "1..2\nok 1\nok 1",
    "1..1\nok 1\n1..1",
    "not TAP",
  ])
    assert.throws(() => validateTap(bad));
});

test("feature paths require activation; previously required suites cannot disappear", () => {
  assert.deepEqual(requiredSuites(bootstrap, bootstrap, [], []), bootstrap);
  for (const path of [
    "supabase/migrations/20260101_initial.sql",
    "apps/web/app/auth/session.ts",
    "apps/web/app/server/security/origin.ts",
    "apps/web/app/routes/auth.callback.tsx",
  ]) {
    assert.throws(() => requiredSuites(bootstrap, bootstrap, [path], []));
    assert.throws(() => requiredSuites(bootstrap, bootstrap, [], [path]));
  }
  assert.throws(() =>
    requiredSuites(bootstrap, { ...bootstrap, rls: true }, [], []),
  );
  assert.throws(() =>
    requiredSuites(bootstrap, { ...bootstrap, integration: true }, [], []),
  );
  assert.throws(() => validateContract({ ...bootstrap, bypass: true }));
  assert.throws(() => validateContract({ ...bootstrap, version: 2 }));
});

function gateFixture() {
  const status = (names) =>
    Object.fromEntries(names.map((n) => [n, { status: "passed", tests: 3 }]));
  return {
    checks: {
      context: { head_sha: "head" },
      status: "passed",
      contract: bootstrap,
      checks: {
        ...status([
          "install",
          "selftest",
          "operations",
          "lint",
          "format",
          "typecheck",
          "unit",
          "build",
          "adversarial",
        ]),
        rls: { status: "not_applicable", reason: "T2 not introduced" },
        integration: {
          status: "not_applicable",
          reason: "T3/T5 not introduced",
        },
      },
    },
    secrets: {
      context: { head_sha: "head" },
      status: "passed",
      checks: status(["scanner-selftest", "history", "checkout"]),
    },
  };
}

test("gate rejects stale head, failed/cancelled/skipped jobs and incomplete attestations", () => {
  const results = { checks: "success", secrets: "success" };
  validateGate(results, gateFixture(), "head", "head");
  assert.throws(() => validateGate(results, gateFixture(), "head", "new-head"));
  for (const state of ["failure", "cancelled", "skipped", undefined])
    assert.throws(() =>
      validateGate(
        { ...results, secrets: state },
        gateFixture(),
        "head",
        "head",
      ),
    );
  for (const field of ["lint", "unit", "build"]) {
    const reports = gateFixture();
    reports.checks.checks[field] = undefined;
    assert.throws(() => validateGate(results, reports, "head", "head"));
  }
  const reports = gateFixture();
  reports.checks.contract = { ...bootstrap, rls: true };
  assert.throws(() => validateGate(results, reports, "head", "head"));
  reports.checks.checks.rls = { status: "passed", tests: 1 };
  for (const stage of ["startup", "reset", "cleanup"]) {
    reports.checks.checks[stage] = { status: "passed" };
  }
  validateGate(results, reports, "head", "head");
  for (const stage of ["startup", "reset", "cleanup"]) {
    for (const status of [undefined, "failed", "not_applicable"]) {
      const bad = structuredClone(reports);
      bad.checks.checks[stage] = status ? { status } : undefined;
      assert.throws(() => validateGate(results, bad, "head", "head"));
    }
  }
  reports.checks.contract.integration = true;
  reports.checks.checks.integration = { status: "passed", tests: 1 };
  assert.throws(() => validateGate(results, reports, "head", "head"));
  reports.checks.checks.auth_delivery = { status: "passed", tests: 12 };
  validateGate(results, reports, "head", "head");
  reports.checks.checks.auth_delivery.tests = 0;
  assert.throws(() => validateGate(results, reports, "head", "head"));
});
