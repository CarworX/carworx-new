import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  context,
  evidencePath,
  invariant,
  outputSummary,
  readJson,
  writeEvidence,
} from "./core.js";

export const VERSION = "8.30.1";
export const DIGEST =
  "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb";

export function verifyChecksum(bytes, digest = DIGEST) {
  invariant(
    createHash("sha256").update(bytes).digest("hex") === digest,
    "Gitleaks checksum mismatch",
  );
}

export function sanitize(findings) {
  invariant(Array.isArray(findings), "Invalid scanner report");
  return findings.map((finding) => ({
    rule: String(finding.RuleID),
    file: String(finding.File),
    line: Number(finding.StartLine),
    commit: String(finding.Commit ?? ""),
  }));
}

function scan(binary, kind, cwd, privateDir) {
  invariant(["history", "checkout"].includes(kind), "Invalid scanner mode");
  invariant(
    !existsSync(join(cwd, ".gitleaks.toml")),
    "Automatic repo scanner configuration is not allowed",
  );
  const path = join(privateDir, `${kind}.json`);
  invariant(!existsSync(path), "Refusing a stale scanner report");
  const ignore = join(privateDir, "empty.ignore");
  writeFileSync(ignore, "");
  const env = { ...process.env };
  delete env.GITLEAKS_CONFIG;
  delete env.GITLEAKS_CONFIG_TOML;
  const result = spawnSync(
    binary,
    [
      kind === "history" ? "git" : "dir",
      ".",
      ...(kind === "history" ? ["--log-opts=HEAD"] : []),
      "--redact=100",
      "--no-banner",
      "--no-color",
      "--log-level=fatal",
      "--ignore-gitleaks-allow",
      `--gitleaks-ignore-path=${ignore}`,
      "--exit-code=1",
      "--report-format=json",
      `--report-path=${path}`,
    ],
    { cwd, env, encoding: "utf8", stdio: "pipe", timeout: 8 * 60 * 1000 },
  );
  // Never print scanner stdout/stderr or publish its raw reports, even on errors.
  invariant(
    !result.error && [0, 1].includes(result.status),
    "Gitleaks execution failed",
  );
  const findings = readJson(path);
  const safe = sanitize(findings);
  invariant(
    (result.status === 0) === (safe.length === 0),
    "Gitleaks exit/report mismatch",
  );
  return safe;
}

function privateDir(prefix) {
  return mkdtempSync(join(process.env.RUNNER_TEMP, prefix));
}

async function install() {
  invariant(
    process.platform === "linux" && process.arch === "x64",
    "Scanner requires the standard Linux x64 runner",
  );
  const dir = join(process.env.RUNNER_TEMP, "k1-gitleaks");
  invariant(!existsSync(dir), "Refusing a stale scanner installation");
  mkdirSync(dir);
  const response = await fetch(
    `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz`,
    { signal: AbortSignal.timeout(60000) },
  );
  invariant(response.ok, "Gitleaks download failed");
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyChecksum(bytes);
  const archive = join(dir, "gitleaks.tar.gz");
  writeFileSync(archive, bytes);
  execFileSync("tar", ["-xzf", archive, "-C", dir, "gitleaks"], {
    stdio: "pipe",
  });
  const binary = join(dir, "gitleaks");
  chmodSync(binary, 0o755);
  invariant(
    execFileSync(binary, ["version"], {
      encoding: "utf8",
      stdio: "pipe",
    }).trim() === VERSION,
    "Gitleaks version mismatch",
  );
  return binary;
}

export function scannerFixtures(binary) {
  const root = privateDir("k1-scanner-fixtures-");
  const repo = join(root, "repo");
  mkdirSync(repo);
  const runGit = (...args) =>
    execFileSync("git", args, { cwd: repo, stdio: "pipe" });
  runGit("init");
  runGit("config", "user.name", "CI fixture");
  runGit("config", "user.email", "ci-fixture@example.invalid");
  const token = ["gh", "p_", "4kT8mP2rW6xC9qL3vN7bF1sD5hJ0zA8uE6yR"].join("");
  const fixture = join(repo, "fixture.txt");
  writeFileSync(fixture, `token=${token}\n`);
  runGit("add", "fixture.txt");
  runGit("-c", "core.hooksPath=/dev/null", "commit", "-m", "Synthetic fixture");
  const checkout = scan(
    binary,
    "checkout",
    repo,
    privateDir("k1-fixture-checkout-"),
  );
  invariant(checkout.length > 0, "Scanner did not detect checkout fixture");
  unlinkSync(fixture);
  runGit("add", "-u");
  runGit(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "Remove synthetic fixture",
  );
  const history = scan(
    binary,
    "history",
    repo,
    privateDir("k1-fixture-history-"),
  );
  invariant(
    history.length > 0,
    "Scanner did not detect removed fixture in history",
  );
  invariant(
    scan(binary, "checkout", repo, privateDir("k1-fixture-clean-")).length ===
      0,
    "Clean checkout fixture did not pass",
  );
  invariant(
    !JSON.stringify({ checkout, history }).includes(token),
    "Sanitized output contains credential fixture",
  );
  let rejected = false;
  try {
    verifyChecksum(Buffer.from("incorrect archive"));
  } catch {
    rejected = true;
  }
  invariant(rejected, "Incorrect checksum was accepted");
  return { cases: 5 };
}

async function main() {
  const operation = process.argv[2];
  const reportPath = evidencePath("secrets");
  if (operation === "setup") {
    const report = {
      context: context(),
      status: "incomplete",
      tool: { name: "gitleaks", version: VERSION, sha256: DIGEST },
      checks: {},
    };
    writeEvidence("secrets", report);
    const binary = await install();
    report.checks["scanner-selftest"] = {
      status: "passed",
      ...scannerFixtures(binary),
    };
    writeEvidence("secrets", report);
  } else if (["history", "checkout"].includes(operation)) {
    const report = readJson(reportPath);
    const findings = scan(
      join(process.env.RUNNER_TEMP, "k1-gitleaks", "gitleaks"),
      operation,
      process.cwd(),
      privateDir(`k1-private-${operation}-`),
    );
    report.checks[operation] = {
      status: findings.length === 0 ? "passed" : "failed",
      findings,
    };
    writeEvidence("secrets", report);
    invariant(
      findings.length === 0,
      "Secret scan failed; see sanitized metadata",
    );
  } else if (operation === "finish") {
    const report = existsSync(reportPath)
      ? readJson(reportPath)
      : { context: context(), checks: {} };
    report.status = ["scanner-selftest", "history", "checkout"].every(
      (k) => report.checks[k]?.status === "passed",
    )
      ? "passed"
      : "failed";
    outputSummary("secrets", report);
  } else throw new Error("Unknown secret scan operation");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    const safeMessages = new Set([
      "Gitleaks checksum mismatch",
      "Gitleaks download failed",
      "Gitleaks version mismatch",
      "Gitleaks execution failed",
      "Gitleaks exit/report mismatch",
      "Scanner did not detect checkout fixture",
      "Scanner did not detect removed fixture in history",
      "Clean checkout fixture did not pass",
      "Sanitized output contains credential fixture",
      "Secret scan failed; see sanitized metadata",
      "Invalid scanner report",
    ]);
    console.error(
      safeMessages.has(error.message)
        ? error.message
        : "Secret scanner failed; raw output withheld",
    );
    process.exitCode = 1;
  });
}
