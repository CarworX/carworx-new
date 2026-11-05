# Codex 17 — K2 implementation review and replan

2026-11-05 UTC. Branch `codex/k2-environments`, draft [PR #23](https://github.com/CarworX/carworx-new/pull/23), [K2 #2](https://github.com/CarworX/carworx-new/issues/2). Base main: `f871fe34beb60401e0a24528b7b29413fd0427de`; prior proposal: `91eea3cc178f07c07f987dfb4c333a5d1f98df5b`. The final published head and matching CI run belong in the PR handoff comment, avoiding a self-referencing SHA in this file.

## Authority and status

The owner approved the names, separate HTTP hook Worker, token model and remaining build prerequisites, and directed Codex to build before Claude reviews/replans (D-068). Codex also implemented the small application consumer and coordinated local Auth config/tests. This supersedes the earlier pre-build Claude agreement and separate Claude app-PR sequence. No Claude folder was edited. Fresh reciprocal code review remains mandatory.

**Implemented for independent review; promotion blocked.** Approval at `dc7830d` covers the old skeleton only. No deployment, hosted hook activation, private settings, DNS, real messages or spending occurred. A2 and A1–A7 remain open.

## Review scope

| Area | Files | Contract to inspect |
| --- | --- | --- |
| Shared policy / app | `apps/web/app/server/security/{recipient-policy,config}.ts`, `auth/email-policy.server.ts`, signup/resend/reset actions and tests | Exact trim/lowercase matching; no alias/wildcard rewriting; malformed policy denies; local bypass requires actual/configured loopback origins; unapproved acknowledgement makes zero Auth calls; configuration failure is generic recoverable 503 |
| Signed hook | `scripts/ops/env/auth-email/{handler,index}.js`, separate Wrangler config | Exact `standardwebhooks` 1.1.1 lock pin; bounded raw-body signatures/timestamps; signup/recovery only; configured-origin token-hash links ignore caller redirect; fixed Resend URL/timeout/idempotency; no fallback |
| Genuine local boundary | `auth-email/direct-auth.js`, `supabase/config.toml`, `apps/web/integration/recipient.test.ts` | Linux CI Supabase -> HTTP hook -> synthetic capture; working positive links; direct signup/resend/recovery denials; unsupported magic-link/invite/change; invalid policy/provider/outage; zero SMTP fallback; config restored and stack stopped |
| Required CI | `scripts/ci/**`, `.github/workflows/ci.yml`, `env/reports.js` | Operations report nonzero/all passed; Auth-delivery stage required after integration; fixed exact-head coverage; missing/malformed/skipped/TODO reports fail; cleanup preserves primary failure |
| Readiness v2 | `env/{promotion.json,readiness,contract,verify}.js` | Content-addressed implementation/config/token-policy/hosted-hook receipts; code fingerprints/freshness; scoped token; hosted hook counters; exact reviewed head plus main merge SHA/CI; PR reviews only |
| Owner workflow / smoke | `deploy-staging.yml`, `env/{package,hosted,smoke}.js` | Repository inputs, no unavailable environment-protection claim; application-only Editor token identity; no hook credential; SHA tag/current deployment; health/no-store/key-binding/session/dev-page checks; absent negative receipt fails A2 |

Review the trust boundary explicitly: token scope is independently reviewed normalized owner evidence; the live verify endpoint proves token identity/activity, not its scope. Hook version/config/private-setting revisions are owner-attested receipts, not a live Supabase-management API verification. Changed settings, hook versions or credentials require new receipts; binding names cannot prove secret contents are unchanged.

The workflow supports `smoke_only` against an existing SHA-tagged version, without publishing another version. Initial publication may succeed while missing post-deployment evidence makes smoke fail and leaves A2 open. An owner receipt must bind signup/resend/recovery negatives to that exact source/version and show zero Auth/provider calls; an empty inbox is insufficient.

## Validation and limits

- Pinned Node 24.22.2/pnpm 12.16.1 used; dependency lockfile retained. Local TypeScript build, 166 unit tests and normal application build passed. Operations/CI focused tests passed; final results/run links are in the PR handoff.
- Required baseline: 168 pgTAP assertions and 45 Auth integration tests. Seven production-Worker cases were added, making 52 integration tests. Auth-delivery coverage is 12 fixed named checks. Reconcile any changed counts.
- Genuine Supabase-to-hook tests run on CI's disposable local stack. Workstation Docker is healthy, but C: capacity was approximately 0.6–1.3 GB; no new workstation stack was started. No unrelated files, images or WSL installations were removed. CI local-stack evidence is distinct from Windows execution and hosted staging delivery.
- Nonlocal production-shaped dev-page denial is automated without the flag, not a live production check. Real Google, physical-device/screen-reader checks, hosted CPU/recovery and D-060 remain separate.

## Claude's next turn

1. Read D-068, this handoff, the exact PR diff and matching CI artifacts; independently inspect/reproduce relevant app, hook, CI and shared Auth config checks.
2. Post a formal PR review: `REVIEW: CHANGES @<full-head-sha>` with file/line findings, or `REVIEW: APPROVE @<full-head-sha>`, plus `Agent: claude`. Old-head approval and issue comments do not satisfy preflight. Author checks are not independent review.
3. Replan from findings and actual owner receipts. Separate code fixes (Codex operations / Claude app follow-ups) from owner setup and hosted acceptance. Do not replace absent evidence with a passing Boolean.
4. Once approved and exact-head CI green, the reviewer may merge under Q-021. The owner separately bootstraps/enables the reviewed hook and proves direct Auth delivery. Reviewed receipts permit a readiness change, then owner application deployment and smoke acceptance.
5. Codex K3 can build local synthetic mobile measurements; hosted route/CPU p95/tail evidence needs staging. Codex K4 can build the synthetic DB/private-object isolated restore drill after capacity preflight; serialize Docker-heavy work. Hosted A7 still needs K2, private destination/second copy/operator and confirmed operating settings. Use separate subsequent branches; neither is completed by K2.

## Short owner checklist

- Existing staging Supabase organization/project connector access; owner executes hosted configuration.
- Cloudflare account, dedicated application/hook Workers, HTTPS origins/routes, application-Worker-only Editor token and redacted policy/token-ID evidence.
- Verified sending subdomain/bare sender; privately install hook-only `STAGING_RESEND_API_KEY`, `STAGING_AUTH_EMAIL_FROM`, `SEND_EMAIL_HOOK_SECRET`.
- Install `STAGING_APPROVED_RECIPIENTS_JSON` privately on both Workers, application publishable-key binding/origins, synthetic smoke identity and redacted receipts. No secret values in Git/chat/logs/artifacts.

Operational schema, deny-all procedure and primary sources: [K2 README](../../scripts/ops/env/README.md).
