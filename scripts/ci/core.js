import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Missing or invalid JSON: ${path}`);
  }
}

export function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    stdio: "inherit",
    timeout: 20 * 60 * 1000,
    ...options,
  });
  invariant(!result.error && result.status === 0, "Required command failed");
  return result;
}

export function context() {
  const event = readJson(process.env.GITHUB_EVENT_PATH);
  const pr = event.pull_request;
  invariant(
    process.env.GITHUB_EVENT_NAME === "pull_request" && pr,
    "A pull_request event is required",
  );
  invariant(
    /^[a-f0-9]{40}$/.test(pr.head.sha) && /^[a-f0-9]{40}$/.test(pr.base.sha),
    "Invalid event SHAs",
  );
  invariant(
    git("rev-parse", "HEAD") === pr.head.sha,
    "Checkout does not match PR head",
  );
  return {
    head_sha: pr.head.sha,
    base_sha: pr.base.sha,
    merge_base_sha: git("merge-base", pr.base.sha, pr.head.sha),
    workflow_sha: process.env.GITHUB_WORKFLOW_SHA,
    run_id: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    repository: process.env.GITHUB_REPOSITORY,
    pr: event.number,
    node: process.version,
    runner: process.env.RUNNER_OS,
    image: process.env.ImageVersion,
  };
}

export function validateContract(contract) {
  invariant(contract?.version === 1, "Unsupported suite contract");
  invariant(
    typeof contract.rls === "boolean" &&
      typeof contract.integration === "boolean",
    "Invalid suite flags",
  );
  invariant(
    Object.keys(contract).sort().join() === "integration,rls,version",
    "Unknown suite contract fields",
  );
  return contract;
}

export function requiredSuites(current, previous, paths, previousPaths) {
  validateContract(current);
  validateContract(previous);
  const all = [...paths, ...previousPaths];
  const markers = {
    rls: all.some((p) => /^supabase\/migrations\/.*\.sql$/.test(p)),
    integration: all.some((p) =>
      /^apps\/web\/app\/(auth\/|server\/security\/|routes\/(auth|login|logout|sign[-_]?in|sign[-_]?up|register|reset|password|callback)([./_-]|$))/.test(
        p,
      ),
    ),
  };
  for (const suite of ["rls", "integration"]) {
    invariant(
      !(previous[suite] || markers[suite]) || current[suite],
      `Required suite cannot be disabled: ${suite}`,
    );
  }
  return current;
}

export function suiteContract(base) {
  const path = "scripts/ci/contract.json";
  const oldPaths = git("ls-tree", "-r", "--name-only", base).split("\n");
  const previous = oldPaths.includes(path)
    ? JSON.parse(git("show", `${base}:${path}`))
    : { version: 1, rls: false, integration: false };
  return requiredSuites(
    readJson(path),
    previous,
    git("ls-files").split("\n"),
    oldPaths,
  );
}

export function validateVitest(report) {
  invariant(report?.success === true, "Test report did not succeed");
  const keys = [
    "numTotalTests",
    "numPassedTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
  ];
  invariant(
    keys.every((k) => Number.isInteger(report[k]) && report[k] >= 0),
    "Invalid test counts",
  );
  invariant(
    report.numTotalTests > 0 && report.numPassedTests === report.numTotalTests,
    "Tests missing, failed or skipped",
  );
  invariant(
    report.numFailedTests + report.numPendingTests + report.numTodoTests === 0,
    "Tests failed, skipped or TODO",
  );
  const assertions = report.testResults?.flatMap(
    (suite) => suite.assertionResults ?? [],
  );
  invariant(
    Array.isArray(assertions) &&
      assertions.length === report.numTotalTests &&
      assertions.every((a) => a.status === "passed"),
    "Test assertion evidence missing or incomplete",
  );
  // Publish counts only, never assertion names, messages, stdout, stack traces or fixture data.
  return { tests: report.numTotalTests, passed: report.numPassedTests };
}

export function validateTap(text) {
  let planned;
  const numbers = [];
  for (const line of text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    invariant(!/^Bail out!/i.test(line), "TAP bailout");
    if (/^#|^TAP version 13$/.test(line)) continue;
    const plan = /^1\.\.(\d+)(.*)$/.exec(line);
    if (plan) {
      invariant(
        planned === undefined && !/#\s*(SKIP|TODO)/i.test(plan[2]),
        "Invalid or skipped TAP plan",
      );
      planned = Number(plan[1]);
      continue;
    }
    const assertion = /^(not ok|ok)\s+(\d+)\b(.*)$/.exec(line);
    invariant(
      assertion &&
        assertion[1] === "ok" &&
        !/#\s*(SKIP|TODO)/i.test(assertion[3]),
      "Failed, skipped or invalid TAP assertion",
    );
    numbers.push(Number(assertion[2]));
  }
  invariant(
    planned > 0 &&
      numbers.length === planned &&
      numbers.every((n, i) => n === i + 1),
    "Missing or incomplete TAP assertions",
  );
  return { tests: planned, passed: planned };
}

export function evidencePath(name) {
  invariant(process.env.RUNNER_TEMP, "RUNNER_TEMP is required");
  const dir = join(process.env.RUNNER_TEMP, "k1-evidence");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${name}.json`);
}

export function writeEvidence(name, report) {
  writeFileSync(evidencePath(name), `${JSON.stringify(report, null, 2)}\n`);
}

export function outputSummary(name, report) {
  writeEvidence(name, report);
  invariant(process.env.GITHUB_OUTPUT, "GITHUB_OUTPUT is required");
  writeFileSync(
    process.env.GITHUB_OUTPUT,
    `summary=${Buffer.from(JSON.stringify(report)).toString("base64")}\n`,
    { flag: "a" },
  );
}

export function validateGate(results, reports, expected, currentHead) {
  invariant(currentHead === expected, "PR head changed; rerun required");
  for (const job of ["checks", "secrets"]) {
    invariant(
      results[job] === "success",
      `Required job did not succeed: ${job}`,
    );
    const report = reports[job];
    invariant(
      report?.context?.head_sha === expected,
      "Evidence is for another head",
    );
    invariant(
      report.status === "passed",
      `Required evidence did not pass: ${job}`,
    );
    const required =
      job === "checks"
        ? [
            "install",
            "selftest",
            "operations",
            "lint",
            "format",
            "typecheck",
            "unit",
            "build",
            "adversarial",
          ]
        : ["scanner-selftest", "history", "checkout"];
    invariant(
      required.every((k) => report.checks?.[k]?.status === "passed"),
      "Required check evidence missing",
    );
    if (job === "checks") {
      validateContract(report.contract);
      if (report.contract.rls || report.contract.integration) {
        invariant(
          ["startup", "reset", "cleanup"].every(
            (stage) => report.checks[stage]?.status === "passed",
          ),
          "Required service stage evidence missing or failed",
        );
      }
      for (const suite of ["rls", "integration"]) {
        const check = report.checks[suite];
        invariant(
          report.contract[suite]
            ? check?.status === "passed" && check.tests > 0
            : check?.status === "not_applicable" &&
                typeof check.reason === "string" &&
                check.reason.length > 0,
          "Invalid suite disposition",
        );
      }
      invariant(report.checks.unit.tests > 0, "Unit test counts missing");
      invariant(
        report.checks.operations.tests > 0,
        "Operations test counts missing",
      );
      if (report.contract.integration)
        invariant(
          report.checks.auth_delivery?.status === "passed" &&
            report.checks.auth_delivery.tests > 0,
          "Auth delivery evidence missing",
        );
    }
  }
}
