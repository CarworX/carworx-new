# O7/O8 shared security foundation

Updated 2026-11-13 UTC. INACTIVE foundation, not completed O7 or O8. No migration execution or activation.

## Contract now represented in source

- private.org_mfa_satisfied(org) reads the caller's current active membership and current policy. Owners, optional policies and uncovered staff pass. Covered callers need native aal2 or a valid private proof for the same user and session. Membership/role authorization remains separate.
- public.org_mfa_satisfied is a narrow own-JWT wrapper. orgMfaSatisfied in the Worker delegates to it without a second AAL rule and fails closed on errors.
- mfa_stepups is private, RLS-enabled and has no client or capability-role DML grants. A proof is bounded to twelve hours, a live matching Auth session and its not_after limit; revoked, future, expired, passwordless and administrator proofs are rejected. Later user changes or factor enrolment invalidate it conservatively. No proof issuer exists yet.
- primary_auth_receipts is private, RLS-enabled and bounded to five minutes. Only auth_security_server can stamp a receipt through record_primary_auth_receipt after its Worker has just completed a new password login or recovery-initiated Google code exchange. The capability validates the user/session pair and the corresponding identity; it is not a fresh-login detector by itself.
- revoke_mfa_stepups revokes a user's proofs for one/all sessions and removes matching receipts. It never changes native AAL or factors.

No native admin function changes. The existing set_team_settings not_yet_available guard is retained, so required team MFA cannot be enabled from this increment.

## Required before O7/O8 activation

1. Implement hashed, single-use email challenges: ten minutes, five attempts, send limits, password recheck, admin/Google-only exclusion and an alert on successful use. Mint a session proof only after verification.
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
