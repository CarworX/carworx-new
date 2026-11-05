import assert from "node:assert/strict";
import test from "node:test";
import { evidenceReader, validateReadiness } from "./readiness.js";
import { EMAIL_CHECKS } from "./reports.js";

const now = Date.parse("2026-11-05T12:00:00Z");
const sha = "a".repeat(40);
const current = {
  application: "b".repeat(64),
  hook: "c".repeat(64),
  auth_config: "d".repeat(64),
  operations: "e".repeat(64),
};
function fixture() {
  const policy = {
    version: 2,
    promotion: "ready",
    blockers: [],
    worker: "carworx-web-staging",
    supabase_project_ref: "gdiyrdqfkthtcglgqnts",
    recipient_control: {
      setting: "STAGING_APPROVED_RECIPIENTS_JSON",
      matching: "exact-email-v1",
      hook_worker: "carworx-auth-email-staging",
    },
    token_guard: { mode: "worker-editor", worker: "carworx-web-staging" },
    evidence: Object.fromEntries(
      ["implementation", "configuration", "token_policy", "hosted_hook"].map(
        (name) => [name, name],
      ),
    ),
    post_deploy: [
      "health",
      "personal_cache",
      "publishable_binding",
      "synthetic_auth",
      "staging_dev_pages",
      "application_recipient_negative",
    ],
  };
  const base = {
    version: 1,
    status: "passed",
    verified_at: new Date(now).toISOString(),
    fingerprints: current,
  };
  const configuration = {
    ...base,
    kind: "configuration",
    app_origin: "https://staging.example.test",
    route_origin: "https://staging.example.test",
    worker: policy.worker,
    account_id: "f".repeat(32),
    supabase_project_ref: policy.supabase_project_ref,
    binding_names: [
      "APP_ORIGIN",
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "CARWORX_ENV",
      "CARWORX_DEV_PAGES",
      "STAGING_APPROVED_RECIPIENTS_JSON",
    ],
    configuration_revision: "config-0001",
    recipient_revision: "recipients-0001",
    hook_secret_revision: "hook-secret-0001",
  };
  const proof = {
    implementation: {
      ...base,
      kind: "implementation",
      source_sha: sha,
      ci_run: "https://github.com/CarworX/carworx-new/actions/runs/42",
      app_negative_tests: 12,
      hook_tests: 8,
      skipped: 0,
      todo: 0,
      auth_delivery: {
        version: 1,
        source_sha: sha,
        status: "passed",
        tests: EMAIL_CHECKS.length,
        passed: EMAIL_CHECKS.length,
        failed: 0,
        skipped: 0,
        todo: 0,
        checks: EMAIL_CHECKS.map((name) => ({ name, status: "passed" })),
      },
    },
    configuration,
    token_policy: {
      ...base,
      kind: "token_policy",
      account_id: configuration.account_id,
      token_id: "token-0001",
      active: true,
      grants: [{ role: "Editor", scope: "worker", worker: policy.worker }],
      policy_reference: "https://example.test/redacted-policy",
    },
    hosted_hook: {
      ...base,
      kind: "hosted_hook",
      worker: "carworx-auth-email-staging",
      version_id: "hook-version-0001",
      source_sha: sha,
      enabled: true,
      configuration_revision: configuration.configuration_revision,
      recipient_revision: configuration.recipient_revision,
      hook_secret_revision: configuration.hook_secret_revision,
      checks: Object.fromEntries(
        [
          "approved_confirmation",
          "approved_recovery",
          "unapproved_signup",
          "unapproved_resend",
          "unapproved_recovery",
          "unsupported_action",
          "hook_failure_no_fallback",
        ].map((name) => [
          name,
          {
            status: "passed",
            hook_calls: 1,
            provider_calls: name.startsWith("approved_") ? 1 : 0,
            correlation_id: "probe-0001",
          },
        ]),
      ),
    },
  };
  return {
    policy,
    proof,
    verify: () =>
      validateReadiness(
        policy,
        (ref) => {
          assert.ok(proof[ref]);
          return proof[ref];
        },
        current,
        now,
      ),
  };
}
test("complete fresh reviewed evidence yields an attempt-ready contract", () => {
  assert.equal(fixture().verify().hook_version, "hook-version-0001");
});
test("flipping ready/deleting blocker text never substitutes for evidence", () => {
  const f = fixture();
  f.policy.evidence = {};
  assert.throws(f.verify);
});
test("policy, code, credentials, scope and hosted delivery drift fail readiness", () => {
  for (const change of [
    (f) => {
      f.policy.promotion = "blocked";
    },
    (f) => {
      f.policy.blockers = ["open"];
    },
    (f) => {
      f.policy.recipient_control.matching = "domain-wildcard";
    },
    (f) => {
      f.policy.token_guard.mode = "main-script-only";
    },
    (f) => {
      f.proof.implementation.auth_delivery.checks.pop();
    },
    (f) => {
      f.proof.implementation.auth_delivery.skipped = 1;
    },
    (f) => {
      f.proof.configuration.fingerprints = {
        ...current,
        application: "0".repeat(64),
      };
    },
    (f) => {
      f.proof.configuration.verified_at = "2026-10-01T00:00:00Z";
    },
    (f) => {
      f.proof.configuration.binding_names = [];
    },
    (f) => {
      f.proof.configuration.recipient_revision = "new-revision";
    },
    (f) => {
      f.proof.token_policy.grants[0].scope = "account";
    },
    (f) => {
      f.proof.token_policy.grants[0].worker = "carworx-auth-email-staging";
    },
    (f) => {
      f.proof.token_policy.grants[0].role = "Workers Scripts Edit";
    },
    (f) => {
      f.proof.token_policy.active = false;
    },
    (f) => {
      f.proof.token_policy.token_id = "";
    },
    (f) => {
      f.proof.hosted_hook.enabled = false;
    },
    (f) => {
      f.proof.hosted_hook.checks.unapproved_signup.provider_calls = 1;
    },
    (f) => {
      f.proof.hosted_hook.checks.unapproved_resend.hook_calls = 0;
    },
    (f) => {
      f.proof.hosted_hook.checks.hook_failure_no_fallback = undefined;
    },
    (f) => {
      f.policy.post_deploy = [];
    },
  ]) {
    const f = fixture();
    change(f);
    assert.throws(f.verify);
  }
});
test("evidence references cannot load arbitrary private files or omit integrity", () => {
  const load = evidenceReader(process.cwd());
  for (const ref of [
    null,
    true,
    { path: ".env", sha256: "a".repeat(64) },
    { path: "planning/evidence/k2/../../secret.json", sha256: "a".repeat(64) },
    { path: "planning/evidence/k2/receipt.json" },
  ])
    assert.throws(() => load(ref));
});
