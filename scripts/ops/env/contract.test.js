import assert from "node:assert/strict";
import test from "node:test";
import {
  validateBuild,
  validateEvidence,
  validatePolicy,
  validateRequest,
  stagingOrigin,
} from "./contract.js";
import { readFileSync } from "node:fs";

const sha = "a".repeat(40);
const request = { sha, pr: 23, run: 42 };
const repository = "CarworX/carworx-new";
test("source config keeps local and staging separate without public previews", () => {
  const config = JSON.parse(
    // This committed fixture has no comments; Prettier adds JSONC trailing commas.
    readFileSync(
      new URL("../../../apps/web/wrangler.jsonc", import.meta.url),
      "utf8",
    ).replace(/,\s*([}\]])/g, "$1"),
  );
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.vars?.CARWORX_DEV_PAGES, undefined);
  assert.equal(config.env.production, undefined);
  assert.equal(config.env.staging.name, "carworx-web-staging");
  assert.equal(config.env.staging.vars.CARWORX_DEV_PAGES, "1");
});
function fixture() {
  return {
    pr: {
      merged_at: "2026-11-05",
      merge_commit_sha: "d".repeat(40),
      body: "Agent: codex",
      head: { sha, repo: { full_name: repository } },
      base: { ref: "main", repo: { full_name: repository } },
    },
    run: {
      head_repository: { full_name: repository },
      head_sha: sha,
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      path: ".github/workflows/ci.yml",
      pull_requests: [{ number: 23 }],
    },
    jobs: ["checks", "secrets", "ci"].map((name) => ({
      name,
      status: "completed",
      conclusion: "success",
    })),
    reviews: [
      {
        commit_id: sha,
        state: "COMMENTED",
        body: `REVIEW: APPROVE @${sha}\nAgent: claude`,
      },
    ],
    contract: { version: 1, rls: true, integration: true },
    comparison: { merge_base_commit: { sha } },
  };
}
function verify(f) {
  return validateEvidence(
    request,
    repository,
    f.pr,
    f.run,
    f.jobs,
    f.reviews,
    f.contract,
    f.comparison,
  );
}

test("only full immutable SHAs and numeric identifiers enter the workflow", () => {
  assert.deepEqual(validateRequest(request), request);
  for (const value of ["main", "a".repeat(7), "a".repeat(40) + ";exit"])
    assert.throws(() => validateRequest({ ...request, sha: value }));
  for (const value of [0, -1, "1;exit", "1e3", "9007199254740993"])
    assert.throws(() => validateRequest({ ...request, pr: value }));
});

test("merged source, successful exact-head CI and reciprocal review are accepted", () => {
  assert.equal(verify(fixture()).reviewed_sha, sha);
});

test("wrong source, run, event, PR, workflow and suite activation fail closed", () => {
  for (const change of [
    (f) => {
      f.pr.merged_at = null;
    },
    (f) => {
      f.pr.head.sha = "b".repeat(40);
    },
    (f) => {
      f.pr.head.repo.full_name = "other/repo";
    },
    (f) => {
      f.run.head_sha = "b".repeat(40);
    },
    (f) => {
      f.run.event = "push";
    },
    (f) => {
      f.run.pull_requests = [{ number: 99 }];
    },
    (f) => {
      f.run.path = ".github/workflows/other.yml";
    },
    (f) => {
      f.contract.integration = false;
    },
    (f) => {
      f.contract.rls = false;
    },
    (f) => {
      f.comparison.merge_base_commit.sha = "b".repeat(40);
    },
  ]) {
    const f = fixture();
    change(f);
    assert.throws(() => verify(f));
  }
});

test("missing, cancelled, skipped, failed and incomplete jobs never authorize deployment", () => {
  for (const state of ["failure", "cancelled", "skipped", null]) {
    const f = fixture();
    f.jobs[0].conclusion = state;
    assert.throws(() => verify(f));
  }
  const f = fixture();
  f.jobs.pop();
  assert.throws(() => verify(f));
});

test("old, dismissed and same-agent review records are rejected", () => {
  for (const change of [
    (r) => {
      r.commit_id = "b".repeat(40);
    },
    (r) => {
      r.state = "DISMISSED";
    },
    (r) => {
      r.body = `REVIEW: APPROVE @${sha}\nAgent: codex`;
    },
    (r) => {
      r.body = "REVIEW: CHANGES";
    },
  ]) {
    const f = fixture();
    change(f.reviews[0]);
    assert.throws(() => verify(f));
  }
});

test("merged-run empty PR metadata is accepted only with exact merged-source proof", () => {
  const f = fixture();
  f.run.pull_requests = [];
  verify(f);
  f.comparison.merge_base_commit.sha = "b".repeat(40);
  assert.throws(() => verify(f));
});

test("later same-head changes request overrides the earlier approval", () => {
  const f = fixture();
  f.reviews.push({
    commit_id: sha,
    state: "COMMENTED",
    body: `REVIEW: CHANGES @${sha}\nAgent: claude`,
  });
  assert.throws(() => verify(f));
});

test("committed policy blocks real deployment even when CI/review succeed", () => {
  const policy = JSON.parse(
    readFileSync(new URL("./promotion.json", import.meta.url), "utf8"),
  );
  validatePolicy(policy, true);
  assert.throws(() => validatePolicy(policy, false), /promotion blocked/);
  assert.throws(() =>
    validatePolicy({ ...policy, worker: "carworx-web" }, true),
  );
  const config = {
    name: policy.worker,
    workers_dev: false,
    preview_urls: false,
    vars: { CARWORX_ENV: "staging", CARWORX_DEV_PAGES: "1" },
  };
  validateBuild(config, policy);
  for (const change of [
    { name: "carworx-web" },
    { workers_dev: true },
    { preview_urls: true },
    { vars: {} },
  ])
    assert.throws(() => validateBuild({ ...config, ...change }, policy));
});

test("origin configuration rejects missing, HTTP, credential, path and production-apex values", () => {
  assert.equal(
    stagingOrigin("https://staging.example.test"),
    "https://staging.example.test",
  );
  for (const value of [
    undefined,
    "http://localhost:5173",
    "https://" +
      ["synthetic-user", "synthetic-pass"].join(":") +
      "@staging.example.test",
    "https://staging.example.test/",
    "https://carworx.app",
    "https://www.carworx.app",
  ])
    assert.throws(() => stagingOrigin(value));
});

test("plain review comments and issue comments cannot supply an approval", () => {
  const f = fixture();
  f.comments = structuredClone(f.reviews);
  f.reviews = [];
  assert.throws(() => verify(f));
  f.reviews = [
    { commit_id: sha, state: "COMMENTED", body: "Looks good. Agent: claude" },
  ];
  assert.throws(() => verify(f));
});
