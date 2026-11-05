import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireCondition,
  validateEvidence,
  validatePolicy,
  validateRequest,
} from "./contract.js";
import {
  evidenceReader,
  fingerprints,
  matchReadinessSource,
  validateReadiness,
} from "./readiness.js";

const policy = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "promotion.json"),
    "utf8",
  ),
);
const operationsRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function get(path) {
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  requireCondition(response.ok, "GitHub evidence lookup failed");
  return response.json();
}

async function pages(path, field) {
  const all = [];
  for (let page = 1; page <= 100; page++) {
    const data = await get(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    const rows = field ? data[field] : data;
    requireCondition(Array.isArray(rows), "Malformed evidence page");
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw new Error("Evidence pagination limit reached");
}

try {
  requireCondition(
    process.env.GITHUB_REF === "refs/heads/main",
    "Run the trusted workflow from main only",
  );
  requireCondition(
    process.env.DRY_RUN === "true" || process.env.DRY_RUN === "false",
    "Explicit dry-run mode required",
  );
  const request = validateRequest({
    sha: process.env.REVIEWED_SHA,
    pr: process.env.SOURCE_PR,
    run: process.env.SOURCE_CI_RUN,
  });
  validatePolicy(policy, process.env.DRY_RUN === "true");
  const readiness =
    process.env.DRY_RUN === "true"
      ? undefined
      : validateReadiness(
          policy,
          evidenceReader(operationsRoot),
          fingerprints(operationsRoot),
        );
  if (readiness) matchReadinessSource(readiness, request);
  const [pr, run, jobs, reviews, file, comparison] = await Promise.all([
    get(`pulls/${request.pr}`),
    get(`actions/runs/${request.run}`),
    pages(`actions/runs/${request.run}/jobs?filter=latest`, "jobs"),
    pages(`pulls/${request.pr}/reviews`),
    get(`contents/scripts/ci/contract.json?ref=${request.sha}`),
    get(`compare/${request.sha}...main`),
  ]);
  const contract = JSON.parse(
    Buffer.from(file.content, "base64").toString("utf8"),
  );
  const summary = {
    ...validateEvidence(
      request,
      process.env.GITHUB_REPOSITORY,
      pr,
      run,
      jobs,
      reviews,
      contract,
      comparison,
      policy,
    ),
    workflow_sha: process.env.GITHUB_SHA,
    mode: process.env.DRY_RUN === "true" ? "dry-run" : "deploy",
    promotion: policy.promotion,
    readiness,
  };
  if (summary.review_mode === "owner-delegated-phase1") {
    const main = await get("git/ref/heads/main");
    requireCondition(
      main.object?.sha === process.env.GITHUB_SHA,
      "Delegated staging requires the current main policy",
    );
  }
  writeFileSync(
    process.env.STAGING_EVIDENCE,
    JSON.stringify(summary, null, 2) + "\n",
  );
  writeFileSync(process.env.GITHUB_OUTPUT, `sha=${request.sha}\n`, {
    flag: "a",
  });
  console.log("Exact reviewed source and applicable K1 evidence verified");
} catch {
  // Never print API payloads, credentials or input values.
  console.error(
    "Staging preflight failed: check reviewed SHA/PR/run, review or D-071 record, and promotion policy",
  );
  process.exitCode = 1;
}
