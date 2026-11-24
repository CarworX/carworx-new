# Plan: finish the build

Approved by the owner on 2026-11-23 (SAST). Saved verbatim from the coordinator (session `session_01Mv3uQTAfjHAvYuJg7EzQgW`). Decision record: [D-098](../DECISIONS.md).

## Owner decisions (23 Nov)
1. Make all four real: cover photo, team management, notification settings, download my data / close account.
2. 1 cover photo per business, shown at once (no pre-approval). Admin can take it down.
3. Close account: disabled at once, data deleted after a 14-day grace period. Records the law requires (D-096 receipts/invoices, 5 years) are kept with the name removed.
4. Booking/quote/checkout screens on phase-3: Codex builds, Claude reviews (Codex's #134 plan).
5. Sign-off: screenshots (design vs ours, 1280 + 390) in each PR, then one staging walkthrough with test accounts.

## Inventory (preview #83 @ b88a8ca vs main 09a08bb)
- Team list: names show as "Team member {id}"; only Remove works (provider.tsx:324). Needs names, role change, cancel invite, leave team → PR 1
- Team sign-in security (setup s-mfa): missing → PR 1
- Notification switches: inert (account.$tab.tsx:332) → PR 2
- Cover photo: inert (provider.setup.$task.$step.tsx:505; Hub shows "Later") → PR 3
- Download my data / close account: inert, "contact support" (account.$tab.tsx:344) → PR 4a/4b
- Account Business tab (transfer ownership, close listing): missing → PR 5
- Account profile: email change, mobile, photo: only the display name exists → PR 6
- Claim inside get-listed: the tile links to /search (provider.get-listed.$step.tsx ~704) → PR 7
- Email invites: inert, waits on mail #93→#94 → PR 8
- Phase-3 booking screens, dashboard numbers, earnings, booking history, prices/travel tasks → Codex (not yours)

## Part 1: your PRs to main, in order
PR 1 Team management. Migration …_team_management.sql: private.revoke_invite, private.set_member_role, private.leave_team, plus a team-security policy setting (require two-step sign-in for the team), each with a public. wrapper (same pattern as create_invite in 20261112120000_onboarding.sql). Rules: only owners change roles; nobody removes or demotes the last owner; every change is written to the existing team history and calls private.bump_control_generation so access changes immediately. The team list shows real display names, only to members of that business. UI: the controls in #135/#136's screens.
PR 2 Notification settings. Migration …_notification_prefs.sql: one row per user, RLS "own row only". Security, receipt and booking-change messages are always sent (shown on the page, but not switchable). /account/notifications saves with a no-JS form + CSRF, like the profile tab. The mail producer (server/mail) skips optional emails a user has turned off.
PR 3 Cover photo. New R2 binding MEDIA (the bucket is created at deploy by Codex or the owner; list it in the PR body). Upload on /provider/setup/.../cover: JPEG/PNG/WebP up to 5 MB, re-encoded on the server (strips EXIF/GPS), random key, one per listing (replacing the old one). Migration …_listing_media.sql. Shown at once on /p/:id, the search cards and the home. Admin "Remove photo" on /admin/listings/:publicId, with an audit entry. The daily retention run (server/retention/run.ts) deletes replaced and removed files.
PR 4a Download my data. /account/privacy → "Request my data" → a JSON file (profile, enquiries sent, memberships, team history about them) kept 7 days in the private part of MEDIA, downloadable through a signed one-time link. Limit: 1 request per 24 h.
PR 4b Close account. Re-confirm with password or a two-step code → account disabled at once and signed out everywhere → personal data deleted or anonymised after 14 days by the retention run; signing in within those 14 days cancels it. A business owner must first transfer or close their business (PR 5). Legally required records are kept with the name removed. BEFORE MERGE: add the new rows to planning/legal/retention-schedule.md and message the coordinator, then wait for the owner's go.
PR 5 Account Business tab. Transfer ownership to another member (who must accept) and close a listing (unpublish, with an audit entry). Reuse PR 1's functions.
PR 6 Profile fields. Email change through Supabase Auth's confirm-both-addresses flow, an optional mobile number (validated, private), and a profile photo using PR 3's upload path.
PR 7 Claim inside get-listed. Search for your listing and upload proof inside the flow, feeding the existing claim backend (/provider/claim/:publicId and the admin claim review).
PR 8 Email invites, only after Codex's #93→#94 are merged; otherwise skip it and report.
Every PR: tests (route, plus pgTAP/RLS for migrations); design-vs-ours screenshots at 1280 + 390 with a pixel-diff table; merge on green exact-head CI. Security checks for every new action: wrong role, wrong business, signed-out direct URL, CSRF. Uploads: fake extension, too large, GPS in EXIF, wrong owner.
