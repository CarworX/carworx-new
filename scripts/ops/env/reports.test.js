import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_CHECKS,
  OPERATIONS_TEST_FILES,
  validateOperationsFiles,
  emailFailureDetails,
  classifyLocalFailure,
  validateEmailReport,
  validateNodeReport,
} from "./reports.js";

test("local infrastructure diagnostics map private command output to fixed labels", () => {
  assert.equal(
    classifyLocalFailure({
      stderr: "Invalid hook uri with private configuration",
    }),
    "hook_uri",
  );
  assert.equal(
    classifyLocalFailure({
      stderr: "hook secret invalid with private configuration",
    }),
    "hook_secret",
  );
  assert.equal(
    classifyLocalFailure({ killed: true, stderr: "private configuration" }),
    "command_timeout",
  );
  assert.equal(
    classifyLocalFailure({ stderr: "arbitrary private configuration" }),
    "local_command",
  );
});

test("failed email reports expose only fixed stage names and numeric observations", () => {
  const sha = "a".repeat(40);
  const report = {
    version: 1,
    source_sha: sha,
    checks: [{ name: "approved_confirmation_working_link", status: "failed" }],
    observed: {
      hook_calls: 0,
      provider_calls: 0,
      auth_status: 500,
      hook_status: 0,
      secret: "private output",
    },
    raw: "private output",
  };
  const safe = emailFailureDetails(report, sha);
  assert.deepEqual(safe.stages, ["approved_confirmation_working_link"]);
  assert.equal(safe.auth_status, 500);
  assert.equal(JSON.stringify(safe).includes("private output"), false);
  report.checks[0].name = "private output";
  assert.deepEqual(emailFailureDetails(report, sha), {
    diagnostic: "missing_or_invalid_report",
  });
  assert.deepEqual(emailFailureDetails(null, sha), {
    diagnostic: "missing_or_invalid_report",
  });
});

test("removing any required operations suite cannot leave the remaining suites green", () => {
  assert.deepEqual(
    validateOperationsFiles(OPERATIONS_TEST_FILES),
    OPERATIONS_TEST_FILES,
  );
  for (const removed of OPERATIONS_TEST_FILES)
    assert.throws(() =>
      validateOperationsFiles(
        OPERATIONS_TEST_FILES.filter((name) => name !== removed),
      ),
    );
});

test("email boundary requires exact-head nonzero complete fixed coverage", () => {
  const report = {
    version: 1,
    source_sha: "a".repeat(40),
    status: "passed",
    tests: EMAIL_CHECKS.length,
    passed: EMAIL_CHECKS.length,
    failed: 0,
    skipped: 0,
    todo: 0,
    checks: EMAIL_CHECKS.map((name) => ({ name, status: "passed" })),
  };
  assert.equal(
    validateEmailReport(report, report.source_sha).tests,
    EMAIL_CHECKS.length,
  );
  for (const patch of [
    { source_sha: "b".repeat(40) },
    { tests: 0 },
    { skipped: 1 },
    { todo: 1 },
    { failed: 1 },
    { checks: [] },
    { checks: report.checks.slice(1) },
    { status: "failed" },
  ])
    assert.throws(() =>
      validateEmailReport({ ...report, ...patch }, report.source_sha),
    );
  assert.throws(() => validateEmailReport(null, report.source_sha));
});
test("operations report rejects missing, malformed and skipped/TODO results", () => {
  const report =
    "# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
  assert.equal(validateNodeReport(report).tests, 3);
  for (const bad of [
    "",
    report.replace("# tests 3", "# tests 0"),
    report.replace("# skipped 0", "# skipped 1"),
    report.replace("# todo 0", "# todo 1"),
    report + "# pass 3\n",
    report.replace("# fail 0", "# fail nope"),
  ])
    assert.throws(() => validateNodeReport(bad));
});
