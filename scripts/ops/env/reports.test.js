import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_CHECKS,
  validateEmailReport,
  validateNodeReport,
} from "./reports.js";

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
