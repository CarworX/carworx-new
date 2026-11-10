import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { requireCondition, stagingOrigin } from "./contract.js";
import { validateEmailReport } from "./reports.js";
import { validateTiming } from "./auth-email/timing.js";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function files(root, path) {
  return readdirSync(join(root, path), { withFileTypes: true }).flatMap(
    (entry) =>
      entry.isDirectory()
        ? files(root, `${path}/${entry.name}`)
        : [`${path}/${entry.name}`],
  );
}
export function fingerprints(root) {
  const groups = {
    application: [
      ...files(root, "apps/web/app/auth"),
      ...files(root, "apps/web/app/server/security"),
      "apps/web/wrangler.jsonc",
      "pnpm-lock.yaml",
    ],
    hook: [
      "scripts/ops/env/auth-email/handler.js",
      "scripts/ops/env/auth-email/index.js",
      "scripts/ops/env/auth-email/wrangler.jsonc",
      "apps/web/app/server/security/recipient-policy.ts",
      "pnpm-lock.yaml",
    ],
    auth_config: ["supabase/config.toml"],
    operations: [
      ...files(root, "scripts/ops/env").filter(
        (p) => p !== "scripts/ops/env/promotion.json",
      ),
      ...files(root, "scripts/ci"),
      ".github/workflows/ci.yml",
      ".github/workflows/deploy-staging.yml",
    ],
  };
  return Object.fromEntries(
    Object.entries(groups).map(([name, paths]) => [
      name,
      hash(
        paths
          .sort()
          .map((p) => `${p}\0${hash(readFileSync(join(root, p)))}\n`)
          .join(""),
      ),
    ]),
  );
}
export function evidenceReader(root) {
  return (ref) => {
    requireCondition(
      ref &&
        /^planning\/evidence\/k2\/[a-z0-9-]+\.json$/.test(ref.path) &&
        /^[a-f0-9]{64}$/.test(ref.sha256),
      "Missing content-addressed K2 evidence",
    );
    const bytes = readFileSync(join(root, ref.path));
    requireCondition(hash(bytes) === ref.sha256, "K2 evidence hash mismatch");
    return JSON.parse(bytes);
  };
}
export function validateReadiness(policy, load, current, now = Date.now()) {
  requireCondition(
    policy.version === 2 &&
      policy.promotion === "ready" &&
      policy.blockers.length === 0,
    "K2 promotion remains blocked",
  );
  requireCondition(
    policy.recipient_control?.setting === "STAGING_APPROVED_RECIPIENTS_JSON" &&
      policy.recipient_control.matching === "exact-email-v1" &&
      policy.recipient_control.hook_worker === "carworx-auth-email-staging",
    "Recipient contract mismatch",
  );
  requireCondition(
    policy.token_guard?.mode === "worker-editor" &&
      policy.token_guard.worker === policy.worker,
    "Worker token guard required",
  );
  const proof = Object.fromEntries(
    ["implementation", "configuration", "token_policy", "hosted_hook"].map(
      (name) => [name, load(policy.evidence?.[name])],
    ),
  );
  for (const [name, report] of Object.entries(proof)) {
    requireCondition(
      report.version === 1 &&
        report.kind === name &&
        report.status === "passed",
      "Invalid readiness evidence",
    );
    const age = now - Date.parse(report.verified_at);
    requireCondition(
      Number.isFinite(age) && age >= 0 && age <= 7 * 86400000,
      "Readiness evidence expired",
    );
    requireCondition(
      report.fingerprints &&
        Object.entries(current).every(
          ([key, value]) =>
            /^[a-f0-9]{64}$/.test(value) && report.fingerprints[key] === value,
        ),
      "Relevant implementation/configuration changed",
    );
  }
  const {
    implementation,
    configuration: config,
    token_policy: token,
    hosted_hook: hook,
  } = proof;
  requireCondition(
    /^[a-f0-9]{40}$/.test(implementation.source_sha) &&
      /^https:\/\/github\.com\/CarworX\/carworx-new\/actions\/runs\/\d+$/.test(
        implementation.ci_run,
      ),
    "Implementation evidence references missing",
  );
  validateEmailReport(implementation.auth_delivery, implementation.source_sha);
  requireCondition(
    implementation.app_negative_tests > 0 &&
      implementation.hook_tests > 0 &&
      implementation.skipped === 0 &&
      implementation.todo === 0,
    "Recipient implementation checks missing",
  );
  stagingOrigin(config.app_origin);
  requireCondition(
    /^[a-f0-9]{32}$/.test(config.account_id) &&
      config.worker === policy.worker &&
      config.supabase_project_ref === policy.supabase_project_ref &&
      config.route_origin === config.app_origin,
    "Owner target evidence mismatch",
  );
  requireCondition(
    Array.isArray(config.binding_names) &&
      [
        "APP_ORIGIN",
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "CARWORX_ENV",
        "CARWORX_DEV_PAGES",
        "STAGING_APPROVED_RECIPIENTS_JSON",
        "STAGING_PROBE_EVENT_KEY",
        "STAGING_PROBE_ORIGIN",
        "STAGING_WORKER_VERSION",
      ].every((name) => config.binding_names.includes(name)),
    "Owner binding evidence missing",
  );
  const revision = (v) =>
    typeof v === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(v);
  requireCondition(
    revision(config.configuration_revision) &&
      revision(config.recipient_revision) &&
      revision(config.hook_secret_revision),
    "Private configuration revision evidence missing",
  );
  requireCondition(
    token.account_id === config.account_id &&
      revision(token.token_id) &&
      token.active === true &&
      Array.isArray(token.grants) &&
      token.grants.length > 0 &&
      token.grants.some((g) => g.role === "Editor") &&
      token.grants.every(
        (g) =>
          ["Editor", "Metadata Read-Only"].includes(g.role) &&
          g.scope === "worker" &&
          g.worker === policy.worker,
      ) &&
      /^https:\/\//.test(token.policy_reference ?? ""),
    "Broader or unverifiable deployment token scope",
  );
  requireCondition(
    hook.worker === policy.recipient_control.hook_worker &&
      revision(hook.version_id) &&
      /^[a-f0-9]{40}$/.test(hook.source_sha) &&
      hook.configuration_revision === config.configuration_revision &&
      hook.recipient_revision === config.recipient_revision &&
      hook.hook_secret_revision === config.hook_secret_revision &&
      hook.enabled === true,
    "Hosted hook version/configuration mismatch",
  );
  for (const key of [
    "approved_confirmation",
    "approved_recovery",
    "unapproved_signup",
    "unapproved_resend",
    "unapproved_recovery",
    "unsupported_action",
    "hook_failure_no_fallback",
  ]) {
    const result = hook.checks?.[key];
    requireCondition(
      result?.status === "passed" &&
        Number.isInteger(result.hook_calls) &&
        result.hook_calls > 0 &&
        Number.isInteger(result.provider_calls) &&
        (key.startsWith("approved_")
          ? result.provider_calls > 0
          : result.provider_calls === 0) &&
        typeof result.correlation_id === "string" &&
        /^[A-Za-z0-9_-]{8,128}$/.test(result.correlation_id),
      "Hosted Auth delivery evidence incomplete",
    );
  }
  validateTiming(
    hook.auth_timing,
    {
      path: "direct",
      source_sha: hook.source_sha,
      hook_version: hook.version_id,
      configuration_revision: config.configuration_revision,
    },
    now,
  );
  const requiredSmoke = [
    "health",
    "personal_cache",
    "publishable_binding",
    "synthetic_auth",
    "staging_dev_pages",
    "application_recipient_negative",
  ];
  requireCondition(
    Array.isArray(policy.post_deploy) &&
      requiredSmoke.every((s) => policy.post_deploy.includes(s)),
    "Post-deployment acceptance contract missing",
  );
  return {
    fingerprints: current,
    source_sha: implementation.source_sha,
    ci_run: implementation.ci_run,
    account_id: config.account_id,
    app_origin: config.app_origin,
    token_id: token.token_id,
    hook_version: hook.version_id,
    configuration_revision: config.configuration_revision,
    recipient_revision: config.recipient_revision,
    hook_secret_revision: config.hook_secret_revision,
  };
}

export function matchReadinessSource(readiness, request) {
  requireCondition(
    readiness.source_sha === request.sha &&
      readiness.ci_run ===
        `https://github.com/CarworX/carworx-new/actions/runs/${request.run}`,
    "Readiness must match the requested source and CI run",
  );
}
