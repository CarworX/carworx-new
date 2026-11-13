# O7/O8 shared security foundation

Updated 2026-11-13 UTC. INACTIVE foundation, not completed O7 or O8. No migration execution or activation.

## Contract now represented in source

- private.org_mfa_satisfied(org) reads the caller's current active membership and current policy. Owners, optional policies and uncovered staff pass. Covered callers need native aal2 or a valid private proof for the same user and session. Membership/role authorization remains separate.
- public.org_mfa_satisfied is a narrow own-JWT wrapper. orgMfaSatisfied in the Worker delegates to it without a second AAL rule and fails closed on errors.
- mfa_stepups is private, RLS-enabled and has no client or capability-role DML grants. A proof is bounded to twelve hours, a live matching Auth session and its not_after limit; revoked, future, expired, passwordless and administrator proofs are rejected. Later user changes or factor enrolment invalidate it conservatively. The follow-up migration adds the server-only email challenge issuer and verifier described below.
- primary_auth_receipts is private, RLS-enabled and bounded to five minutes. Only auth_security_server can stamp a receipt through record_primary_auth_receipt after its Worker has just completed a new password login or recovery-initiated Google code exchange. The capability validates the user/session pair and the corresponding identity; it is not a fresh-login detector by itself.
- revoke_mfa_stepups revokes a user's proofs for one/all sessions and removes matching receipts. It never changes native AAL or factors.

No native admin function changes. The existing set_team_settings not_yet_available guard is retained, so required team MFA cannot be enabled from this increment.

## Required before O7/O8 activation

1. Connect and verify the implemented email challenge service: ten minutes, five attempts, three sends per hour and one per minute per user, password recheck, admin/Google-only exclusion, and atomic durable alert on successful use. No route is connected yet.
2. Connect fresh receipt issuance to the Worker's own password and recovery-started Google callback results, using verified user/session claims. Check fresh password/oauth AMR when the pinned Auth supplies it. Never use refreshed iat, browser metadata or browser-provided times as freshness evidence.
3. Implement atomic single-use recovery redemption, audit and the isolated privileged factor-reset service. Recovery removes TOTP factors, then native reenrolment; it never grants aal2. No service-role key belongs in the web Worker.
4. Add the canonical predicate to every protected org RLS policy and RPC, and call the own-JWT wrapper from every org Worker loader/action. Only then remove the team policy write guard, in the same deploy.
5. Connect explicit revocation on sign-out, password changes, enrolment and recovery. The database session/user/factor checks are additional fail-closed protection.
6. Update Claude's BK-1 table/role inventories for both private tables and auth_security_server. Preserve schema, and invalidate security receipts/proofs after restoration; a backup must not resurrect a used receipt or revoked step-up.
7. Resume the agreed direct-RPC/RLS, Worker, session mismatch, replay, expiry, owner/uncovered-role and native-admin checks before activation.

## Evidence

Source inspection and Worker adapter formatting only. No tests, typecheck, SQL execution, privileged Auth API calls, credentials or deployment. Native Auth table fields are read only; no trigger or mutation is installed in the managed Auth schema. The proof's conservative user.updated_at check may invalidate it after unrelated profile edits; this intentionally errs toward another sign-in.

References: [approved plan §8](../claude/23-onboarding-redesign-build-plan.md), [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [native MFA](https://supabase.com/docs/guides/auth/auth-mfa), [sign-out](https://supabase.com/docs/guides/auth/signout).

## History

- 2026-11-13 UTC: prepared the shared predicate, own-JWT Worker adapter and private receipt/revocation capabilities independently of Claude's frontend/deployment. All O7/O8 activation remains pending.

## Email challenge follow-up

The subsequent migration adds private.mfa_email_challenges, server-only issue/verify capabilities and an append-only usage audit trigger. Plaintext digits never enter database columns. A 32-byte server pepper HMAC binds the code to user, session and challenge. The database consumes a fresh password receipt when issuing, and verifies the current user/session, password identity, recipient hash and factor/user state again before minting.

Wrong codes return normally after incrementing the attempt counter, so the increment commits. Used, expired, invalidated, mismatched and exhausted challenges fail closed. An alert is queued in the same transaction as proof creation and code consumption; mail failure rolls the transaction back. Revoke also invalidates pending challenges.

The Worker rechecks the password through Supabase, verifies the exact returned access token with getClaims and checks fresh password AMR when present. The route MUST return auth.headers on every outcome because password recheck creates a new session. No iat-based freshness, client timestamps, JWT promotion or native-factor changes.

Names only, opt-in staging: AUTH_SECURITY_ENABLED=1, AUTH_SECURITY_DB (Hyperdrive as auth_security_server, caching disabled), AUTH_CODE_PEPPER (32 random bytes as base64url), plus existing encrypted-mail configuration. Neither a service-role key nor an Auth signing secret belongs in this Worker. The pepper and encryption keys must be different.

The current source integrates the mail drafts #93/#94 into this branch. They remain separately reviewable, but no migration has run. Backup coverage must now include the third private table, mfa_email_challenges, and invalidate all transient security evidence on restore. Challenge metadata cleanup must preserve at least the last hour for the send limit; its longer retention needs the approved schedule.

- 2026-11-13 UTC: added the email-code backend and atomic alert template. Source formatting/inspection only; no tests, SQL execution or route activation. Full org Worker/RLS/RPC enforcement, O8 redemption/reset and runtime evidence remain open.

## Staging pool and restore follow-up

Claude's staging coordinator confirmed Hyperdrive's minimum origin cap is five. The separate #97 migration raises the existing mail_server pool limit; the security branch also raises mail_producer and auth_security_server to five without changing grants or credentials.

BK-1 now has an explicit three-table ephemeral exception for mfa_stepups, primary_auth_receipts and mfa_email_challenges. Ordinary app tables remain exported. The source drill seeds non-empty witnesses for active/revoked, unused/used and used/invalidated states, requires those witnesses, and asserts the restored tables are empty before sign-in verification. This preserves schema/role coverage while preventing security evidence from being resurrected. Coverage assertions and runbooks are updated. No backup drill or unit suite was run.

- 2026-11-13 UTC: prepared the bounded pool-limit and transient-security restore changes requested by Claude on #84. #96's staging bindings were independently source-reviewed and merged on existing green exact-head checks at f18eced111766cff8c2e0b7e4e0533c94e7a72f8. No deployment or tests launched by Codex.

## Mail scheduling follow-up

The staging Worker now has a minute mail drain separate from the daily 01:17 UTC retention job. Without this, ten-minute Auth and step-up envelopes could expire before the only daily dispatch. The scheduled handler dispatches by the exact cron string; the minute invocation does not run retention. Production keeps its daily retention-only schedule, and mail still requires the existing opt-in staging configuration and MAIL_DB binding.

One item is drained per minute, with security/Auth priority and the unchanged global daily cap. This is bounded pilot capacity, not a throughput or actual-delivery claim. The existing retention fixture supplies its real cron explicitly and the schedule contract records the two staging triggers. No suite, cron, network send or deployment was run by Codex. The dispatcher must be configured and observed before activating the queued Auth hook.

Reference checked 2026-11-13: [Cloudflare multiple cron triggers](https://developers.cloudflare.com/workers/examples/multiple-cron-triggers/).
