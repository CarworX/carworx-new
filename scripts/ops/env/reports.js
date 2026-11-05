import { requireCondition } from "./contract.js";

export const OPERATIONS_TEST_FILES = [
  "contract.test.js",
  "hosted.test.js",
  "readiness.test.js",
  "reports.test.js",
  "smoke.test.js",
  "auth-email/handler.test.js",
].map((name) => `scripts/ops/env/${name}`);
export function validateOperationsFiles(paths) {
  const normalized = paths.map((path) => path.replaceAll("\\", "/"));
  requireCondition(
    OPERATIONS_TEST_FILES.every((path) => normalized.includes(path)),
    "Required operations test file missing",
  );
  return paths;
}

export const EMAIL_CHECKS = [
  "approved_confirmation_working_link",
  "approved_reset_working_link",
  "direct_unapproved_signup",
  "direct_unapproved_resend",
  "direct_unapproved_recovery",
  "unsupported_magiclink",
  "unsupported_invite",
  "unsupported_email_change",
  "invalid_policy",
  "provider_failure",
  "outage",
  "no_smtp_fallback",
];

export function emailFailureDetails(report, sha) {
  const allowed = [
    ...EMAIL_CHECKS,
    "setup",
    "hook_stack_startup",
    "hook_stack_stop",
    "hook_stack_reset",
    "hook_stack_status",
    "cleanup",
  ];
  if (
    report?.version !== 1 ||
    report.source_sha !== sha ||
    !Array.isArray(report.checks)
  )
    return { diagnostic: "missing_or_invalid_report" };
  const failed = report.checks
    .filter((c) => c.status === "failed")
    .map((c) => c.name);
  if (!failed.length || !failed.every((name) => allowed.includes(name)))
    return { diagnostic: "missing_or_invalid_report" };
  const result = { diagnostic: "auth_delivery_failure", stages: failed };
  for (const name of [
    "hook_calls",
    "provider_calls",
    "auth_status",
    "hook_status",
  ]) {
    const value = report.observed?.[name];
    if (Number.isSafeInteger(value) && value >= 0 && value <= 100000)
      result[name] = value;
  }
  return result;
}

export function validateEmailReport(report, sha) {
  requireCondition(
    report?.version === 1 &&
      report.source_sha === sha &&
      report.status === "passed",
    "Auth email report provenance failed",
  );
  requireCondition(
    report.tests === EMAIL_CHECKS.length &&
      report.passed === report.tests &&
      report.failed === 0 &&
      report.skipped === 0 &&
      report.todo === 0,
    "Auth email report counts failed",
  );
  requireCondition(
    Array.isArray(report.checks) &&
      report.checks.length === EMAIL_CHECKS.length &&
      EMAIL_CHECKS.every(
        (name) =>
          report.checks.filter((c) => c.name === name && c.status === "passed")
            .length === 1,
      ),
    "Auth email report coverage failed",
  );
  return { tests: report.tests };
}

export function validateNodeReport(output) {
  const fields = {};
  for (const name of [
    "tests",
    "pass",
    "fail",
    "cancelled",
    "skipped",
    "todo",
  ]) {
    const matches = [
      ...output.matchAll(new RegExp(`^# ${name} (\\d+)\\r?$`, "gm")),
    ];
    requireCondition(matches.length === 1, "Malformed operations report");
    fields[name] = Number(matches[0][1]);
  }
  requireCondition(
    fields.tests > 0 &&
      fields.tests === fields.pass &&
      ["fail", "cancelled", "skipped", "todo"].every((n) => fields[n] === 0),
    "Operations tests incomplete",
  );
  return { tests: fields.tests };
}
