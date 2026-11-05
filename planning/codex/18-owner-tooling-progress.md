# Codex 18 — owner tooling implementation progress

2026-11-05 UTC. K2 #23 merged as `5b9590f9dd4c6406c8c56c31b3ae87fbcec76aed` following Claude review 5784282916 and exact-head CI 42017206105. Promotion remains blocked. Historical #14 merged as `e92aab6d226ff610a5f32fa1c4dc575ff5fa78da`. Formal CHANGES reviews were posted on #30 (token instructions), #28 (stale current status/conflicts), and #16 (history conflict; visual verdict still pending).

## Implemented in this draft

- Owner-only OAuth deployment helper, dry-run by default, requiring clean exact reviewed checkout, merged source PR, green CI, reciprocal review, explicit account and dedicated custom domain. API-token/global-key environments are rejected. Raw Wrangler/gh output stays private. No deployment was executed.
- Pure probe-ledger contract: required terminal observation before a zero-call negative can pass; Auth/provider attempts invalidate negative proof; duplicate event retries are idempotent; expired/sealed probes and freeform/private fields fail. This is not yet the hosted counter service.
- These tests are required operations files. Targeted tests passed 5/5 before final formatting/lint checks.

Owner command after the follow-up is independently approved and merged, from a clean isolated checkout of its reviewed head (values below are non-secret placeholders):

```powershell
# Remove Cloudflare API-token/global-key variables from this owner process first.
pnpm --filter @carworx/web exec wrangler login
node scripts/ops/env/auth-email/deploy.js --account <32-character-account-id> --domain auth-email.staging.carworx.app --origin https://staging.carworx.app --sha <full-reviewed-sha> --pr <merged-source-pr> --run <green-ci-run>
# Repeat with --execute only when the owner intends to deploy.
```

The two hostnames are examples until the owner confirms them. The helper does not change promotion readiness and is not an application deployment workflow.

## Remaining implementation — not acceptance evidence

1. Bind a staging-only SQLite Durable Object; implement authenticated register/read/seal endpoints, event persistence/expiry, keyed recipient correlation and signed app instrumentation. Owner chose one combined K2 PR with minimal app hooks for Claude review. The pure ledger is only the first part.
2. Build genuine owner Auth/app probe orchestration, positive/link controls, provider/failure observations and sanitized receipt export. Do not fabricate receipts from unconnected counters. No hosted receipt is produced by this draft.
3. Finish local DO/HTTP/Supabase integration tests and owner guide links after #30's token correction. Fresh Claude review is mandatory.
4. Start K3 on a separate branch with Lighthouse 13.6.0 and installed Chromium 153.0.8010.12: five serial mobile runs per foundation route; record all runs, enforce agreed budgets, distinguish local results from hosted CPU/WCAG acceptance. Current available RAM was below 1 GiB, so defensible scoring needs a fresh resource check.
5. K4 waits: C: approximately 3.5 GiB free and Docker engine unreachable. Planning minimum 10 GiB free (about 6.5 GiB more); refine using image/volume/export sizes plus margin once Docker is available. No unrelated cleanup is authorized.

## Security proposals — unchanged behavior

Propose signed unapproved-recipient silent success with durable deny counts separately; current 403 remains. Measure app-path timing before a response-time policy; never introduce dummy Auth calls. Design production email explicitly before G-PROD; unsupported environment modes still fail closed. No response-policy or production-mode changes are included here.
