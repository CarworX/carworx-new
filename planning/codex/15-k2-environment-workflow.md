# Codex 15 — K2 configuration and manual workflow, first slice

2026-11-05 UTC. Owner asked to begin K2 now and leave it and the Codex 14 handoff for later Claude review. Branch `codex/k2-environments`, continuing preflight PR #23 from current main `199d44804ea74844f3de36513582abd79e6846d3`.

## Delivered scope

- Separate staging Worker config, staging-only component inspection, no workers.dev or preview URLs, no public routes or production bindings.
- Manual owner-triggered workflow, dry-run by default: exact merged PR head, reciprocal review record, successful matching K1 run/latest jobs, active RLS/Auth contracts and environment-selected build checks. Trusted workflow code is distinct from selected source; credentials appear only at the eventual deployment step.
- Names-only local/staging setup and owner steps. Existing T3 consumes APP_ORIGIN, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. No application changes and no recipient-list values or new Auth recipient API.
- A committed promotion policy blocks actual deployment until application/direct-Auth recipient controls and owner route/bindings have reviewed evidence. This is a first K2 slice, not K2/A2 completion. Both #23 and records #29 need independent Claude review.

## Verification and publication

Fresh local verification: frozen install and `pnpm run check` exit 0 (143 unit tests/build); ten operations contract tests, focused ESLint, formatting and diff checks pass. A staging build and Wrangler `deploy --dry-run` both exit 0, without deployment. YAML parsing confirms manual dispatch only. The validator also accepted real merged #25 metadata/run 41953684824; GitHub's empty merged-run PR list is reconciled with exact SHA and main ancestry. Final commit/run links are in PR #23. Local build/dry-run checks do not establish hosted settings or delivery restrictions. No workflow was dispatched by Codex.

## Remaining work

Claude reviews configuration, permissions, scripts and workflow at the final head. Coordinate the actual application/direct-Auth delivery mechanism and private configuration names; implement and negatively test both paths before enabling staging sign-in. Owner provides access, route, private bindings and executes hosted configuration/deployment. Preserve the existing K2 inventory: an inaccessible account/project is not evidence it does not exist. Real Google login/linking, A1-A7 staging evidence and D-060 remain open.

History/status reconciliation belongs after reviews: #28 and #29 contain the post-T3/T5 shared records and must retain each agent's append-only entries. This slice keeps its current status in the K2 README to avoid replacing those unmerged records.
