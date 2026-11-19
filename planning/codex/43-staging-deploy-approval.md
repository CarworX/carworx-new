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

- Cloudflare reconnection verified 2026-11-13 19:45 UTC. Read-only API access
  works. The three recorded staging Hyperdrive configs have scoped logins,
  point at the intended Supabase host and have caching disabled.
- `carworx-web-staging` has no deployed version/settings; the Auth-email Worker
  does not exist. No staging custom domain is attached. Cloudflare Access API
  reports Access is not enabled. Asked for the approved staging hostname and
  Access application; no renewed deployment approval requested.
- GitHub repository secret/variable inventories are empty;
  `STAGING_APP_ORIGIN` is absent. The existing workflow also expects
  `STAGING_CLOUDFLARE_ACCOUNT_ID` and `STAGING_CLOUDFLARE_API_TOKEN`.
- `scripts/ops/env/promotion.json` remains blocked: runtime configuration,
  Worker-scoped token policy and hosted Auth-hook delivery evidence are null.
  Owner approval covers permission, not these missing verification facts.
  Do not flip the readiness flag or bypass the workflow checks.
- No directory Worker deployment, DNS change, real email, provider transaction
  or public-domain release occurred. The separate restricted ChatGPT Site
  was successfully updated to version 3; see the milestone note below.

## Resume

Complete the restricted staging URL/access setup, private configuration
revisions and Auth-hook evidence with the already verified account/bindings.
Complete the recorded readiness checks, deploy the pinned directory source,
and verify the deployed version with hosted A1–A7 checks. Keep approved
recipient values and credentials out of chat, Git and reports. Production
setup, legal sign-offs, backup operations and owner device/accessibility checks
remain G-PROD work; shared A23/A29/A35 E2E still waits for Phase 3 staging.

## Sites milestone refresh

Owner also requested a preview update now, then at meaningful completed-feature
milestones. Published CarworX ChatGPT Site version 3 at
https://carworx.gerrardlewu.chatgpt.site from Site source
`d3fa09df63f187add507c9c66b8f31073b83ff2b`; deployment
`appgdep_6af76baf46ec8191919aec47b6cabe60` succeeded. Readback confirms `custom`
access revision 2 and one existing external visitor unchanged. The preview
has refreshed journeys and a Progress page; actions remain simulated.

GitHub preview source: `codex/sites-finish-remote` @`b88a8ca` (#83).
Checks: 17 customer routes, 17 onboarding pages, 302 links/assets and
representative desktop/mobile browser QA. Future updates follow the committed
milestone policy; no timer or unattended monitoring service was created.
