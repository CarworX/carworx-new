import { pathToFileURL } from "node:url";
import { requireCondition } from "./contract.js";

export function validatePerf({ repository, sha, run, jobs }) {
  requireCondition(
    /^[a-f0-9]{40}$/.test(sha) &&
      run.path === ".github/workflows/perf.yml" &&
      run.head_repository?.full_name === repository &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      ((run.event === "pull_request" && run.head_sha === sha) ||
        (run.event === "workflow_dispatch" && run.head_branch === "main")) &&
      jobs.length === 1 &&
      jobs[0].name === `perf-${sha}` &&
      jobs[0].status === "completed" &&
      jobs[0].conclusion === "success",
    "Exact-head K3 lab evidence required",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const {
      GITHUB_REPOSITORY: repository,
      GITHUB_TOKEN,
      PERF_RUN,
      REVIEWED_SHA: sha,
    } = process.env;
    requireCondition(
      repository === "CarworX/carworx-new" && /^[1-9]\d*$/.test(PERF_RUN ?? ""),
      "Invalid K3 reference",
    );
    const get = async (suffix = "") => {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/actions/runs/${PERF_RUN}${suffix}`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      requireCondition(response.ok, "K3 evidence lookup failed");
      return response.json();
    };
    const [run, page] = await Promise.all([get(), get("/jobs?filter=latest")]);
    validatePerf({ repository, sha, run, jobs: page.jobs });
    console.log("Exact-head K3 lab gate passed");
  } catch {
    console.error(
      "Staging preflight failed: matching successful K3 run required",
    );
    process.exitCode = 1;
  }
}
