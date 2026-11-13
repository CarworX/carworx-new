# Status

Updated 2026-11-13 (SAST) by Claude. **Launch order (D-093): the directory goes live first; Phase 3 (bookings, quotes, payments, messaging) is a second release.** Both agents keep full build and merge authority, with reviews after merge (D-091). The launch plan is the [G-PROD checklist](runbooks/g-prod-checklist.md).

## Current work

- **main** (`7550b1a`) has Phases 1–2, onboarding (#84), the launch gaps (P-1 to P-3, R-1, R-2, BK-1, the no-JS forms) and the first O7 slice (#100, #101, #103: listing and removing authenticators).
- **Staging Supabase** `gdiyrdqfkthtcglgqnts` has all 12 migrations on main plus the synthetic seed. The `catalogue_server`, `forms_server` and `retention_server` logins are set. The three Hyperdrive configs are made, with caching off over a direct connection (#96). Backups (D2) and retention (E4) are only partly done.
- **The staging Worker is not deployed yet.** Owner approval persists; build and local Wrangler dry-run passed at `299150c`. Cloudflare is now connected and staging Hyperdrive targets verified. The staging Worker has no version, Auth hook/custom domain are missing and Access is not enabled; asked for the approved private staging hostname/application. GitHub deploy settings and promotion evidence remain incomplete. [Approval and resume record](codex/43-staging-deploy-approval.md).
- **ChatGPT Sites preview version 3 is published:** https://carworx.gerrardlewu.chatgpt.site — refreshed journeys and Progress page, with custom audience revision 2 and existing external viewer preserved. Future updates are at coherent completed-feature milestones. This does not replace the public coming-soon page.
- **Phase 3** is on the shared `phase-3` branch (draft #102 into main). Claude's bookings C1–C7 are merged there (#99), along with Codex's checkout and messaging. The bookings test round is running in its own Claude sub-session.
- **Codex drafts:** #93, #94 and #97 (the mail pipeline, which is needed for the launch Auth emails), #95 (the sign-in security backend, not a launch blocker) and #83 (Sites).

## External blockers and gates

- The owner's staging deploy and the hosted A1–A7 checks.
- Real Auth email: a verified sending domain and Codex's mail PRs.
- The production project, Hyperdrive and secrets (runbook).
- The legal approvals: E1–E3 and E5–E6, plus the owner questions OQ-L1, L2 and L4 to L7.
- Information Officer registration, and the D-060 device and accessibility checks.
- G-LIVEPAY for Phase 3. Payments are test mode only.

## Next

1. The owner deploys staging. Then the Claude smoke and A1–A7 checks run.
2. Claude: build the `/privacy` and `/terms` pages from `planning/legal/`, marked as drafts until the owner approves them.
3. Codex: the mail pipeline first (#97, then #93 and #94), then Phase 3.
4. The owner works through the G-PROD checklist in order; Claude guides each step.
