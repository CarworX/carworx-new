# Status

Updated 2026-11-13 (SAST) by Claude. **Launch order (D-093): the directory goes live first; Phase 3 (bookings, quotes, payments, messaging) is a second release.** Both agents keep full build and merge authority, with reviews after merge (D-091). The launch plan is the [G-PROD checklist](runbooks/g-prod-checklist.md).

## Current work

- Directory notification settings implementation is in review. The account form stores an optional-email preference, and optional producers can use the recipient-scoped mail gate. Team-invite delivery and hosted acceptance follow separately.

- **main** (`7550b1a`) has Phases 1–2, onboarding (#84), the launch gaps (P-1 to P-3, R-1, R-2, BK-1, the no-JS forms) and the first O7 slice (#100, #101, #103: listing and removing authenticators).
- **Staging Supabase** `gdiyrdqfkthtcglgqnts` has all 12 migrations on main plus the synthetic seed. The `catalogue_server`, `forms_server` and `retention_server` logins are set. The three Hyperdrive configs are made, with caching off over a direct connection (#96). Backups (D2) and retention (E4) are only partly done.
- **The staging Worker is not deployed yet.** The cloud proxy rewrites the Authorization header on Cloudflare's asset upload, so the owner deploys from their own machine.
- **Phase 3** is on the shared `phase-3` branch (draft #102 into main). Claude's bookings C1–C7 are merged there (#99), along with Codex's checkout and messaging. The bookings test round is running in its own Claude sub-session.
- **Codex drafts:** #93, #94 and #97 (the mail pipeline, which is needed for the launch Auth emails), #95 (the sign-in security backend, not a launch blocker) and #83 (Sites).

## Sites port: not wired yet

The Sites preview (#83 @ `b88a8ca`) is being ported screen by screen, exactly, onto the real backend. Where the preview shows something the backend can't do yet, the look is kept and the screen says it is unavailable; nothing pretends to work. Updated 2026-11-23 (SAST).

- **Home (#122):** the booking timeline, quote card, phone carousel and business dashboard are illustrations, not live data. Their real screens belong to `phase-3`.
- **Search, listing, category (#123, #125):** per-service prices have no backend in the directory launch, so they read "Free to enquire" / "Ask for a price". "Request a booking" is on `phase-3`; the listing's side card is the real enquiry form.
- **Business application (get-listed):** the preview's in-flow claim path (choose your listing, upload proof) is not wired; its tile links to search, and claims go through each listing's existing claim form. Different hours per day are set after approval on the hours page.
- **Ported since (#135–#138):** business setup, staff, account and admin. What those screens still can't do (preview #83 @ `b88a8ca` vs main `09a08bb`, 2026-11-23, SAST), and the [finish-build plan](claude/finish-build-plan.md) PR that makes it real (D-098):
  - Team list shows "Team member {id}" and only Remove works (`provider.tsx:324`); team sign-in security is missing → Claude PR 1.
  - Notification switches are inert (`account.$tab.tsx:332`) → PR 2.
  - Cover photo upload is inert; the Hub shows "Later" (`provider.setup.$task.$step.tsx:505`) → PR 3.
  - Download my data and close account say "contact support" (`account.$tab.tsx:344`) → PR 4a, 4b.
  - The account Business tab (transfer ownership, close listing) is missing → PR 5.
  - The profile has only the display name (no email change, mobile or photo) → PR 6.
  - The get-listed claim tile links to search (`provider.get-listed.$step.tsx` ~704) → PR 7.
  - Email invites: the team invite now also emails the link to the address typed, through the mail outbox and its approved-recipient rule (PR 8, 25 Nov); the link is still shown on the page.
- **On `phase-3` (Codex builds, Claude reviews):** booking, quote, checkout, the booking dashboard numbers, earnings, booking history and the prices and travel setup tasks.

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
