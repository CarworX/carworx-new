export function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateRequest({ sha, pr, run }) {
  requireCondition(
    /^[a-f0-9]{40}$/.test(sha),
    "A full reviewed SHA is required",
  );
  for (const value of [pr, run]) {
    requireCondition(
      /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)),
      "Invalid PR or CI run identifier",
    );
  }
  return { sha, pr: Number(pr), run: Number(run) };
}

export function validateEvidence(
  request,
  repository,
  pr,
  run,
  jobs,
  reviews,
  contract,
  comparison,
  phase1,
) {
  requireCondition(
    pr.merged_at &&
      /^[a-f0-9]{40}$/.test(pr.merge_commit_sha ?? "") &&
      pr.base?.ref === "main" &&
      pr.base?.repo?.full_name === repository &&
      pr.head?.repo?.full_name === repository &&
      pr.head?.sha === request.sha,
    "Source must be the exact head of a merged main PR",
  );
  requireCondition(
    comparison?.merge_base_commit?.sha === request.sha,
    "Reviewed source must be in main history",
  );
  requireCondition(
    run.head_sha === request.sha &&
      run.event === "pull_request" &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.path === ".github/workflows/ci.yml" &&
      run.head_repository?.full_name === repository &&
      Array.isArray(run.pull_requests) &&
      (run.pull_requests.length === 0 ||
        run.pull_requests.some((p) => p.number === request.pr)),
    "Successful matching K1 PR run required",
  );
  requireCondition(
    jobs.length === 3 &&
      ["checks", "secrets", "ci"].every((name) =>
        jobs.some(
          (j) =>
            j.name === name &&
            j.status === "completed" &&
            j.conclusion === "success",
        ),
      ),
    "All three latest K1 jobs must succeed",
  );
  requireCondition(
    contract.version === 1 &&
      contract.rls === true &&
      contract.integration === true,
    "Phase 1 RLS and Auth suites must be required",
  );
  const author = /Agent:\s*(claude|codex)\b/i
    .exec(pr.body ?? "")?.[1]
    ?.toLowerCase();
  const reviewer =
    author === "claude" ? "codex" : author === "codex" ? "claude" : undefined;
  const latestReview = reviews
    .filter(
      (r) =>
        r.commit_id === request.sha &&
        ["COMMENTED", "APPROVED", "CHANGES_REQUESTED"].includes(r.state) &&
        new RegExp(`Agent:\\s*${reviewer}\\b`, "i").test(r.body ?? ""),
    )
    .at(-1);
  const approves =
    reviewer &&
    latestReview &&
    latestReview.state !== "CHANGES_REQUESTED" &&
    new RegExp(String.raw`REVIEW:\s*APPROVE\s*@${request.sha}\b`, "i").test(
      latestReview.body ?? "",
    );
  const opposingReview =
    latestReview?.state === "CHANGES_REQUESTED" ||
    /REVIEW:\s*CHANGES\b/i.test(latestReview?.body ?? "");
  const record = phase1?.phase1_self_check;
  const checked = Date.parse(record?.checked_at);
  const expires = Date.parse(record?.expires_at);
  const now = Date.now();
  const delegated =
    !opposingReview &&
    author === "codex" &&
    repository === "CarworX/carworx-new" &&
    phase1?.environment === "staging" &&
    phase1.worker === "carworx-web-staging" &&
    phase1.supabase_project_ref === "gdiyrdqfkthtcglgqnts" &&
    record?.decision === "D-071" &&
    record.status === "passed" &&
    record.source_sha === request.sha &&
    record.merge_sha === pr.merge_commit_sha &&
    record.pr === request.pr &&
    record.ci_run === request.run &&
    Number.isInteger(record.ci_attempt) &&
    record.ci_attempt > 0 &&
    record.ci_attempt === run.run_attempt &&
    checked <= now &&
    now < expires &&
    expires - checked <= 7 * 24 * 60 * 60 * 1000;
  requireCondition(
    approves || delegated,
    "Exact-head reciprocal review or D-071 staging self-check required",
  );
  return {
    reviewed_sha: request.sha,
    main_merge_sha: pr.merge_commit_sha,
    pr: request.pr,
    ci_run: request.run,
    required_suites: { rls: true, integration: true },
    jobs: "passed",
    review_mode: approves ? "reciprocal" : "owner-delegated-phase1",
    ...(approves
      ? { reciprocal_review_record: reviewer }
      : {
          owner_decision: record.decision,
          self_checked_at: record.checked_at,
        }),
  };
}

export function validatePolicy(policy, dryRun) {
  requireCondition(
    policy.version === 2 &&
      policy.environment === "staging" &&
      policy.worker === "carworx-web-staging" &&
      policy.supabase_project_ref === "gdiyrdqfkthtcglgqnts",
    "Unexpected staging target",
  );
  requireCondition(
    Array.isArray(policy.blockers) &&
      ["blocked", "ready"].includes(policy.promotion),
    "Invalid promotion policy",
  );
  if (!dryRun)
    requireCondition(
      policy.promotion === "ready" && policy.blockers.length === 0,
      "K2 promotion blocked: recipient controls and owner setup need reviewed evidence",
    );
}

export function validateBuild(config, policy) {
  requireCondition(
    config.name === policy.worker &&
      config.workers_dev === false &&
      config.preview_urls === false &&
      config.vars?.CARWORX_DEV_PAGES === "1" &&
      config.vars?.CARWORX_ENV === "staging",
    "Build did not select the isolated staging environment",
  );
}

export function stagingOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Missing or invalid STAGING_APP_ORIGIN");
  }
  requireCondition(
    url.protocol === "https:" &&
      url.origin === value &&
      !["carworx.app", "www.carworx.app", "localhost", "127.0.0.1"].includes(
        url.hostname,
      ),
    "STAGING_APP_ORIGIN must be a dedicated HTTPS origin",
  );
  return url.origin;
}
