import assert from "node:assert/strict";
import test from "node:test";
import { validatePerf } from "./perf-gate.js";

const sha = "a".repeat(40);
const repository = "CarworX/carworx-new";
const fixture = {
  sha,
  repository,
  run: {
    path: ".github/workflows/perf.yml",
    head_repository: { full_name: repository },
    status: "completed",
    conclusion: "success",
    event: "pull_request",
    head_sha: sha,
  },
  jobs: [{ name: `perf-${sha}`, status: "completed", conclusion: "success" }],
};

test("only an exact-head passing K3 job can promote", () => {
  validatePerf(fixture);
  validatePerf({
    ...fixture,
    run: { ...fixture.run, event: "workflow_dispatch", head_branch: "main" },
  });
  for (const patch of [
    { run: { ...fixture.run, conclusion: "failure" } },
    { run: { ...fixture.run, head_sha: "b".repeat(40) } },
    {
      run: {
        ...fixture.run,
        event: "workflow_dispatch",
        head_branch: "feature",
      },
    },
    { jobs: [] },
    { jobs: [{ ...fixture.jobs[0], name: "perf-wrong-head" }] },
    { jobs: [{ ...fixture.jobs[0], conclusion: "cancelled" }] },
  ])
    assert.throws(() => validatePerf({ ...fixture, ...patch }));
});
