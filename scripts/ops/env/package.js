import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  evidenceReader,
  fingerprints,
  validateReadiness,
} from "./readiness.js";
import { currentDeployment, verifyOwnerTarget } from "./hosted.js";
import { fileURLToPath } from "node:url";
import {
  requireCondition,
  stagingOrigin,
  validateBuild,
  validatePolicy,
} from "./contract.js";

try {
  const policy = JSON.parse(
    readFileSync(new URL("./promotion.json", import.meta.url), "utf8"),
  );
  requireCondition(
    process.env.DRY_RUN === "true" || process.env.DRY_RUN === "false",
    "Explicit dry-run mode required",
  );
  const dryRun = process.env.DRY_RUN === "true";
  requireCondition(
    !(dryRun && process.env.SMOKE_ONLY === "true"),
    "Smoke-only mode requires deployment evidence",
  );
  validatePolicy(policy, dryRun);
  const origin = stagingOrigin(process.env.STAGING_APP_ORIGIN);
  const root = process.env.STAGING_SOURCE_DIR;
  requireCondition(
    typeof root === "string" && root.length > 0,
    "Source directory required",
  );
  const buildPath = join(root, "apps/web/build/server/wrangler.json");
  const raw = readFileSync(buildPath);
  validateBuild(JSON.parse(raw), policy);
  const summary = JSON.parse(
    readFileSync(process.env.STAGING_EVIDENCE, "utf8"),
  );
  requireCondition(
    /^[a-f0-9]{40}$/.test(process.env.REVIEWED_SHA ?? "") &&
      summary.reviewed_sha === process.env.REVIEWED_SHA &&
      summary.jobs === "passed",
    "Source evidence mismatch",
  );
  if (!dryRun)
    requireCondition(
      /^[a-f0-9]{32}$/.test(process.env.CLOUDFLARE_ACCOUNT_ID ?? "") &&
        process.env.CLOUDFLARE_API_TOKEN,
      "Owner staging credentials required",
    );
  if (!dryRun) {
    const readiness = validateReadiness(
      policy,
      evidenceReader(fileURLToPath(new URL("../../../", import.meta.url))),
      fingerprints(root),
    );
    requireCondition(
      JSON.stringify(readiness) === JSON.stringify(summary.readiness),
      "Readiness changed after preflight",
    );
    await verifyOwnerTarget(policy, readiness, process.env);
  }
  const args = [
    "--filter",
    "@carworx/web",
    "exec",
    "wrangler",
    "deploy",
    "--tag",
    process.env.REVIEWED_SHA,
    "--config",
    "build/server/wrangler.json",
    "--var",
    `APP_ORIGIN:${origin}`,
    "--var",
    `SUPABASE_URL:https://${policy.supabase_project_ref}.supabase.co`,
    "--var",
    "CARWORX_ENV:staging",
  ];
  if (dryRun)
    args.push(
      "--dry-run",
      "--outdir",
      join(process.env.RUNNER_TEMP, "k2-dry-run"),
    );
  // This entry point runs on the Ubuntu manual workflow, never through a shell.
  const result =
    process.env.SMOKE_ONLY === "true"
      ? { status: 0 }
      : spawnSync("pnpm", args, {
          cwd: root,
          stdio: "pipe",
          encoding: "utf8",
          timeout: 10 * 60 * 1000,
        });
  requireCondition(
    !result.error && result.status === 0,
    "Staging packaging command failed",
  );
  Object.assign(summary, {
    worker: policy.worker,
    app_origin: origin,
    supabase_project_ref: policy.supabase_project_ref,
    generated_config_sha256: createHash("sha256").update(raw).digest("hex"),
    packaging: "passed",
    operation: dryRun
      ? "package"
      : process.env.SMOKE_ONLY === "true"
        ? "verify_existing"
        : "deploy",
    deployed: !dryRun,
    ...(dryRun ? {} : await currentDeployment(policy.worker, process.env)),
  });
  writeFileSync(
    process.env.STAGING_EVIDENCE,
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(
    dryRun
      ? "Staging dry run passed; nothing deployed"
      : process.env.SMOKE_ONLY === "true"
        ? "Existing owner-deployed version verified; smoke acceptance still required"
        : "Owner-triggered staging deployment command succeeded; smoke acceptance still required",
  );
} catch {
  console.error(
    "Staging packaging failed: verify selected build, source evidence, target and owner configuration",
  );
  process.exitCode = 1;
}
