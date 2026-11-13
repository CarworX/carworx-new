# Staging deployment approval and preparation

2026-11-13 UTC. Owner approved deployment in chat and then said "proceed".
Treat this as standing approval to deploy the directory to its existing staging
target when access and readiness evidence are available; do not ask for the
same approval again. D-093 keeps Phase 3 as a separate release. This approval
does not establish production, legal, spending or live-payment readiness.

## Prepared and verified

- Source: `main` @`299150cb2bdb877a19249e42b5e9e9d0610fef49` in an isolated
  `codex/staging-deploy-approved` worktree. Original working trees preserved.
- Node 24.22.2 / pnpm 12.16.1 frozen installation passed.
- `CLOUDFLARE_ENV=staging pnpm build` passed. Build warnings included browser
  externalization of Node dependencies and a CSS source-map warning; no build
  failure. This is packaging evidence, not hosted acceptance.
- Project-local Wrangler 4.156.1 `deploy --dry-run --config
  build/server/wrangler.json --outdir .wrangler/staging-package --tag
  299150cb2bdb877a19249e42b5e9e9d0610fef49` passed. Worker name verified as
  `carworx-web-staging`; workers.dev and preview URLs disabled. Three configured
  Hyperdrive IDs match the source staging config. Remote resources themselves
  remain unverified this turn.
- #97 is now merged on main. #107 has passing recovery/performance/secrets
  checks but failed its integration stage. It remains separate from this
  directory deployment; #106 was not merged by Codex.

## Access and readiness blockers

- Cloudflare connector returns `UNAUTHORIZED`: connection requires
  reauthentication. Local `wrangler whoami` reports not authenticated. Requested
  that the owner reconnect Cloudflare; no credential value requested or read.
- GitHub repository secret/variable inventories are empty;
  `STAGING_APP_ORIGIN` is absent. The existing workflow also expects
  `STAGING_CLOUDFLARE_ACCOUNT_ID` and `STAGING_CLOUDFLARE_API_TOKEN`.
- `scripts/ops/env/promotion.json` remains blocked: runtime configuration,
  Worker-scoped token policy and hosted Auth-hook delivery evidence are null.
  Owner approval covers permission, not these missing verification facts.
  Do not flip the readiness flag or bypass the workflow checks.
- No upload, deployment, DNS change, real email, provider transaction or
  production operation occurred.

## Resume

After Cloudflare reconnects, verify the existing account, Worker, restricted
staging URL, bindings, private configuration revisions and Auth-hook evidence.
Complete the recorded readiness checks, deploy the pinned directory source,
and verify the deployed version with hosted A1–A7 checks. Keep approved
recipient values and credentials out of chat, Git and reports. Production
setup, legal sign-offs, backup operations and owner device/accessibility checks
remain G-PROD work; shared A23/A29/A35 E2E still waits for Phase 3 staging.
