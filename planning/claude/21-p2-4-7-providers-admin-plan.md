# Claude — 21: P2-4 + P2-7 providers and admin (Bundle A)

**Date:** 2026-11-10 (SAST). **Author:** Claude sub-session, under D-080 and D-085. **Status:** plan; built straight after on stacked branches (no wait for plan approval). The coordinator and the owner review.
**Builds on:** `listings.status`, `verifications`, `listing_public` and `private.write_catalogue_audit` (P2-1, `20261110130000`), the admin guard in `auth/routes/admin.tsx`, T4 Studio components. **Rules:** D-023 (consent-based applications, review method recorded, human claim review, suspension), Claude 17 §3 (labels and claim rule), A10, A12, PLAN §6.1.

## 1. What ships

| Who | Can do | Where |
|---|---|---|
| Signed-in person | Apply to list a business → `submitted` | `/provider/apply` |
| Signed-in person | Claim a live listing (business-domain email **or** a document an admin reviews) | `/provider/claim/:publicId` (linked from `/p/:publicId`) |
| Provider owner or manager | See their listings, decisions and claims against them; dispute a claim; resubmit after a rejection | `/provider` |
| Provider owner | Revoke former staff | `/provider` |
| Admin at `aal2` | Review queue: approve (method + labels) or reject (reason) | `/admin/listings?status=submitted`, `/admin/listings/:publicId` |
| Admin at `aal2` | Suspend and reinstate; revoke an organisation's members | `/admin/listings/:publicId` |
| Admin at `aal2` | Claims: approve (transfers control) or reject; resolve disputes | `/admin/claims`, `/admin/claims/:id` |
| Admin at `aal2` | Audit-log view, newest first, keyset paged | `/admin/audit` |

## 2. Data model (one migration, `20261111100000_p2_4_providers.sql`)

Nothing published changes: `listing_public`, its columns and its owner stay exactly as they are.

| Table | Key columns | Notes |
|---|---|---|
| `listings` (existing) | + `submitted_at timestamptz` | Queue order. **`UPDATE(status)` is revoked from `authenticated`**, so status changes only through the functions in §4 |
| `listing_decisions` (new) | `listing_public_id`, `organisation_id`, `decision` (`approved`, `rejected`, `suspended`, `reinstated`), `review_method`, `labels text[]`, `reason`, `decided_by`, `decided_at` | Append-only (trigger rejects update, delete, truncate) |
| `listing_claims` (new) | `listing_public_id`, `organisation_id`, `claimant_id`, `evidence_kind` (`business_email`, `document`), `email_domain`, `document_reference`, `status`, `review_method`, `review_note`, `approved_at`, `displaced_user_ids`, `displaced_roles` (immutable snapshot of who a transfer displaced) | One open claim per listing and claimant |
| `claim_disputes` (new) | `claim_id`, `raised_by`, `reason`, `status` (`open`, `upheld`, `dismissed`), `resolved_by`, `resolution_note` | One open dispute per claim |

**Review methods (D-023):** `phone_call`, `video_call`, `document_check`, `registry_check`, `site_visit`. Approval needs one; the label grant records it.
**Labels (Claude 17 §3):** the admin ticks any of "Identity checked", "Business details checked", "Premises visited" (fixed premises only), with an evidence reference. These are the existing `verifications.method` values, so `listing_public.verification_labels` shows them unchanged.
**Documents:** a **synthetic local stub**. The claimant types a short reference to a document held outside CarworX; no file is uploaded or stored and no storage bucket or setting is touched. Real uploads (private bucket, 10-minute signed URLs, PLAN §9.1) come later behind their own review.

## 3. State machines

```
Listing:  draft ──resubmit──▶ submitted ──approve──▶ live ──suspend──▶ suspended
            ▲                    │                     ▲                  │
            └──────reject────────┘                     └────reinstate─────┘

Claim:    submitted ──approve──▶ approved          submitted ──reject──▶ rejected
          submitted|approved ──dispute──▶ disputed
          disputed ──dismiss──▶ (back to submitted | approved)
          disputed ──uphold───▶ rejected (was submitted) | reversed (was approved: transfer undone)
```

- **Apply** creates the organisation, the applicant's `owner` membership, a `provider_supplied` coordinate source, the branch (fixed) or the **private** service area (mobile), and the listing in `submitted`. One pending application per applicant.
- **Transfer of control** (claim approved): the claimant becomes an active `owner`; every other active membership of that organisation is revoked, and who they were (user and role) is snapshotted on the claim, out of reach of membership RLS, so that an upheld dispute restores them exactly. Ownership changes lock the organisation; a later transfer supersedes an earlier one, and no new transfer is approved while one is disputed. Nothing transfers before an admin approves.
- **Disputes** are raised by an active owner or manager of the listing's organisation (against a pending claim) or by someone the transfer displaced (against an approved claim). A pending claim can't be approved while a dispute is open.
- Any other transition is refused with `P0001` and a fixed message key; bad input is `22023`; not allowed is `42501`.

## 4. Privilege boundary

Same shape as T3: a `SECURITY INVOKER` wrapper in `public` (the only schema PostgREST exposes) calls a `SECURITY DEFINER` function in `private` with `search_path = ''`. `EXECUTE` goes to `authenticated` only, never `anon` or `PUBLIC`. The Worker calls them **with the user's own JWT**, so `auth.uid()` and the `aal` claim are the user's.

| Function | Caller check inside the definer |
|---|---|
| `provider_apply`, `claim_listing` | `auth.uid()` present; email confirmed (claim) |
| `provider_resubmit`, `dispute_claim` | Active owner/manager (or displaced member, for a dispute) |
| `admin_decide_application`, `admin_set_suspension`, `admin_decide_claim`, `admin_resolve_dispute` | `private.is_platform_admin()`, which requires the listed admin **and** `aal = aal2` |

**Defence in depth:** the Worker refuses non-admins with 404 and `aal1` admins with a redirect to `/auth/mfa` before any read; the definer checks `aal2` again; RLS on every new table checks `aal2` inline for admin reads. Revoking members uses the existing membership RLS (owner, or admin at `aal2`).

**RLS on the new tables** (no client `INSERT`, `UPDATE` or `DELETE` grant at all):

| Table | Admin `aal2` | Organisation member | Claimant / disputer | Anyone else |
|---|---|---|---|---|
| `listing_decisions` | read | read (own organisation) | — | nothing |
| `listing_claims` | read | owner/manager read (claims on their organisation) | read own; a member the transfer displaced reads that claim | nothing |
| `claim_disputes` | read | — | raiser and claimant read | nothing |

**A10:** no admin or provider page renders a mobile base, a radius centre or a radius. The admin page says "Comes to customers (service area kept private)". The audit details store status changes and decisions only, never reasons, addresses or coordinates (PLAN §9.1 log redaction).

## 5. Audit

`private.write_catalogue_audit` is unchanged (its details stay empty, as P2-1 tests require); each status change is audited through its `listing_decisions` row. The three new tables get triggers that log `status`/`decision` and the acting user. `/admin/audit` reads `audit_log` through RLS (admin `aal2`), 50 rows a page, keyset on `id`, optional table filter.

## 6. Tests

| Layer | What |
|---|---|
| pgTAP (new `44_providers.test.sql`, `45_providers_matrix.test.sql`) | Every transition, every refused transition; `aal1` admin and non-admin refused in every admin function; status not updatable directly; transfer and reversal of memberships; A4 matrix for the three tables (anonymous, self, member, other-org member, admin); grants and `EXECUTE`; append-only decisions; no geometry in any new function's result. The existing 412 assertions stay green |
| Unit (Vitest) | Form parsing and bounds for applications, claims, decisions; free-mail domain rule; error-key mapping |
| Integration (built Worker + local stack) | Apply → approve → `/p/:id` live with labels; reject → resubmit; non-admin 404 and `aal1` redirect on every admin route; `aal1` token refused at the database API; claim → dispute → resolve; transfer revokes the old owner on the next request; suspension hides the listing; revoke staff; audit view; no base or radius in any admin/provider HTML |
| A12 Playwright (`playwright` 1.63.0, already pinned) | Application → approval → live; a disputed claim; a suspension, in Chromium against the built Worker. Local evidence: K1 CI has no browser (same as `browser-audit.ts`) |
| Check | Lint, format, typecheck, build |

## 7. Stacked PRs (each under about 1,500 changed lines)

| # | Branch | Contents |
|---|---|---|
| 1 | `claude/p2-4-7-plan` | This plan |
| 2 | `claude/p2-4-7-db` | Migration and pgTAP |
| 3 | `claude/p2-4-7-provider` | Provider routes, form parsing, unit and integration tests |
| 4 | `claude/p2-4-7-admin` | Admin routes, audit view, integration tests, A12 Playwright, phone screenshots |

## 8. Not in this bundle

Real document uploads and storage; email notifications to applicants (no real mail); editing a live listing's details; Turnstile on the application form (P2-5 brings it with the other forms). The probing residual risk (§6.2) is unchanged: applications store the base privately, exactly like the P2-1 seed.

Agent: claude
