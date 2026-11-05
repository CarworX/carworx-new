# Codex 19 — Phase 1 staging completion under D-071

D-069 and D-070 keep native Supabase on the workstation and move the heavy
verification runs to standard GitHub-hosted runners. D-071 authorizes Codex to
complete the remaining Phase 1 repository and staging work within the $0 cap.
An exact-head self-check is the owner-delegated merge record for Codex work.
The original Claude 16 handoff is retained in #35.

## Staging access and release order

1. Connect the recorded CarworX App project and the approved Cloudflare account.
   The Supabase connection currently sees CarworX MVP Dev. The Cloudflare
   connection requires reauthentication. Verify the project ref, migration
   history and synthetic-only scope before applying staging migrations.
2. Verify the app and hook Worker routes, the scoped Editor token, binding names
   and verified sending subdomain. Put private credentials in provider or
   GitHub secret fields. Stage the approved hook with a deny-all policy until
   its installed version and permitted test recipients are verified.
3. Collect exact-head K1 and K3 evidence, configuration and token receipts,
   and the hosted hook receipt. Enable promotion only on a complete fresh set.
   Run a package dry run and then deploy. Record the app version, smoke and
   post-deploy application recipient negatives. Keep sign-in restricted if
   a critical smoke or delivery check fails.
4. Verify real Google sign-in and linking, admin TOTP, revocation, the staging
   tenant matrix and no-store. Measure staging Lighthouse and hosted CPU
   separately. Restore actual synthetic staging records and private objects
   from an encrypted backup in an isolated target. Use two existing private
   destinations and owner-held recovery keys. Confirm capacity, retention
   and the recovery-key procedure before export.
5. Retire the D-071 staging record at Phase 1 closeout. Record each A1–A7 result
   against the exact staged version. Phase 2 is a separate proposal and owner
   approval gate.

## K2 hardening

The staging hook should acknowledge valid signed, unapproved-recipient
requests without provider delivery and record a private denial observation
for registered probes. Invalid policy, unsupported actions, signature failure
and delivery failure stay fail-closed. Compare response shape and timing
in repeated synthetic allowed and denied requests, separately for each app
flow and cooldown state. Record quantiles and outliers. Fix a reproducible
membership disclosure without calling Auth for denied recipients. Test direct
Auth as well as the app path, since app-only tests miss the direct boundary.

Production email is a G-PROD proposal. Define a separate production mode with
a dedicated sender, exact application origin and independently scoped
credentials. Preserve signature verification, supported actions, bounded
inputs and sanitized telemetry. Require positive and negative delivery
evidence, staged rollback and an explicit owner release decision before
enabling that mode.
