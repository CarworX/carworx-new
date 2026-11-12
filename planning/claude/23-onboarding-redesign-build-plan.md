# Claude — 23: onboarding, admin, settings and money redesign (build plan)

**Date:** 2026-11-12 (SAST). **Author:** Claude (design sub-session). **Status:** plan for Codex review (D-073) and owner approval. Revised for **Codex 31** (`REVIEW: CHANGES @addb968`): see §2.0 and §7 to §10. No product code changes until both approve.

**Builds on:**
- the approved designs in `planning/design/onboarding/` (PR #72; Codex `REVIEW: APPROVE @949b420`; owner approval 2026-11-12);
- merged Bundle A (#61–#63: `provider.*` and `admin.*` routes, `20261111100000_p2_4_providers.sql`);
- merged Bundle B (#69–#73, #75: enquiries, demand, support, fines, `mailto.ts`);
- native TOTP (`auth/routes/mfa.tsx`, D-042);
- the T4 Studio components (`apps/web/app/ui/`).

**Rules:**
- A10 (never a mobile base, radius centre or base-derived distance in public), A8–A12, A17;
- D-023 (consent-based applications, recorded review method, human claim review);
- Claude 17 §3 labels; D-082 and D-084 (Mapbox: temporary geocoding, static image);
- D-014 (Resend outbox); POPIA; PLAN §9.1 redaction;
- the owner decisions D-088 to D-090.

**Order (owner, 2026-11-12):** the redesign is next, **after the Codex 30 gate (§2.0)**. The email outbox (O5) is built here for the first time, and Bundle B's forms can adopt it later.

## 1. What ships

| Who | Gets | Where (new or reworked) |
|---|---|---|
| New business | **Get approved**: a named-step flow with the rail (desktop) and the gliding segmented bar; the live listing preview; pick-don't-type (2 typed fields; 3 for premises, §9); server-saved draft | `/provider/get-listed/:step` (replaces the single form at `/provider/apply`) |
| Claimant | The same flow for claims: pick the listing, how we check it's yours, document type chips plus a calendar date (no typed reference) | `/provider/claim/:publicId` |
| Waiting business | Submitted ("what happens next"), waiting dashboard, then "You're live" with the earned labels | `/provider` |
| Owner, manager | **Finish setup** hub (5 tasks): Team invites, who gets the booking, what staff can see, team sign-in security, cover photo (deferred); plus Bundle B's Enquiries | `/provider` (hub), `/provider/setup/:task/:step` |
| Invited person | **Staff join**: one-time invite → own sign-in → services → days → first name (only when customers pick) → two-step setup (only when the owner requires it) → staff home | `/join/:token`, `/provider` (staff home) |
| Every user | **Profile and settings** (Profile, Security, Notifications, Privacy and data, plus Your work or Business by role); **Sign out** from the menu | `/account/:tab`, `NavBar` account menu |
| Every user | **Two-step sign-in** with their own authenticator app; CarworX-styled QR code; recovery codes; email-code fallback for non-admins | `/account/security`, `/auth/mfa` |
| Admin at `aal2` | **Console**: Today, Applications, Claims, Businesses (record: labels, suspend or restore, Remove access), Demand, Support, Audit log; guided application and claim review | `/admin`, existing `admin.*` routes reworked |
| Later (Phase 3) | Bookings History and Assignments, Earnings (owners and managers), admin Money, Requests, driver screens | Needs bookings and G-LIVEPAY |

## 2. Slices

### 2.0 Gate before any slice (Codex 31)

- **#77 stays unmerged until Codex 30** (the Bundle B review) is complete. The fact that Bundle B is merged doesn't mean its review is done.
- Then refresh this plan against the resulting `main`, keep its provider, forms and admin fixes and tests, and get a new exact-head review if the plan changes.
- **O3, O4 and O6 start only from that completed Bundle B baseline.**
- D-090 ("next") means next **after** this gate. It doesn't settle the contracts in §7 to §10.


Each slice gets its own `claude/*` branch and draft PR, marked ready for CI (D-086). It merges only after Codex's exact-head `REVIEW: APPROVE @sha`, green CI and the owner's OK (D-073, D-080). Everything stays local, CI and synthetic until G-PROD.

| Slice | Contents | Depends on |
|---|---|---|
| **O1 Components** | React ports of the prototype pieces, in `apps/web/app/ui/`:<br>• `SegmentedProgress`: gliding bar; `clip-path` fill; forward fills, back drains, jumps chain; reduced motion; `role=progressbar` with `aria-valuetext`<br>• `StepRail`: from `StepList.tsx`, with done and current states<br>• `FilterBar` and `TabBar`: one line, sideways scroll, edge fades, chosen item in view<br>• `ChoiceTiles` (single or multi), `PickChips` (wrapping), `Switch`, `DayToggles` with time selects, `StarterPhrases`<br>• `StatusScreen`<br>• the `NavBar.tsx` account menu (avatar dropdown on desktop, sheet on phone: Profile and settings, Security, Sign out)<br>New pairs go into `contrast-pairs.ts`. `_dev.components.tsx` shows each one | — |
| **O2 Data model** | One migration (§3), pgTAP, an extended A10 and anti-probing suite, and the RPCs | — |
| **O3 Get approved** | The stepped application and claim, with a server draft (`provider_save_draft`, `provider_submit`):<br>• live preview built from `ResultCard.tsx`<br>• map pin picker on the D-084 static image (a click maps to coordinates within the image's known bounds)<br>• address search through the D-082 server geocoder (quota-guarded), which **only recentres the map**; the business types its public address (§9)<br>• "Use my location" only after the CarworX permission card<br>• submitted, waiting and live states<br>The A12 Playwright tests are rewritten for the steps. The old `/provider/apply` redirects | O1, O2 |
| **O4 Admin console** | Today (counts, oldest first, disputes on top), queues with `FilterBar`, guided application review and claim review. They call the existing `admin_decide_claim` and `admin_resolve_dispute` unchanged, and `admin_decide_application` **with the O2 change in §7** (premises label for both). Plus the business record, Bundle B's Demand and Support in the same shell, and audit filters. The aal2 guard in `auth/routes/admin.tsx` stays as it is | O1, O2 (§7) |
| **O5 Email outbox** | D-014 on Resend: an outbox table, idempotent sends, retries with backoff, bounce handling, queueing at the free-tier daily cap, a verified sending subdomain (SPF, DKIM, DMARC). Mail bodies are never logged (§9.1). The first templates are the invite and the email sign-in code | **Owner:** a Resend sending subdomain |
| **O6 Finish setup and staff** | `/provider` becomes the hub:<br>• **invites:** role, then an email (O5) or a one-time link plus QR; 7 days; single use; token stored as a hash; owners and managers can invite<br>• **team settings:** who gets the booking (customer picks, optionally with "Anyone available", or the business assigns), and what staff can see (phone, first name, or booking only). The hub has **4 tasks** here. The team two-step task arrives with O7 (§8)<br>• **staff join and staff home**<br>• **History → Team changes**, from `audit_log`<br>Cover photo is deferred to a storage review (PLAN §9.1) | O1, O2, O5 |
| **O7 Accounts and security** | `/account` tabs. Two-step sign-in for every user through the existing Supabase TOTP enrolment (`mfa.tsx`):<br>• the QR is drawn **in the browser** from `totp.uri`, never from the default `qr_code` SVG<br>• a pinned QR encoder (version read from its official source at build time); error correction H; the CarworX mark in the centre<br>• the secret is never logged, stored by us or sent to a third party<br>Also: sign out of other devices (`signOut({ scope: "others" })`). **The "Team sign-in security" task and all `team_mfa_policy` writes ship here**, together with their enforcement, under the §8 contract. Admins are unchanged (native `aal2` only) | O1, O6 |
| **O8 Recovery and email fallback** | **Recovery codes:** hashed and single use. Redeeming one **resets the factors**, so the person must re-enrol; a code never grants aal2 (§8).<br>**Email-code step-up for non-admin password accounts only**, through O5. It is a session-bound proof under §8, never a native aal2 JWT. Not available to Google-only accounts (owner, 2026-11-12).<br>Codex security review required | O5, O7 |
| **Phase 3** | Bookings History and Assignments, Earnings and admin Money (the `planning/design/onboarding/_shared/money.js` contract: SAST day boundaries; past week, month, year or custom vs the previous period of the same length; a daily rollup view; owners and managers only), Requests, driver screens | Bookings, G-LIVEPAY |

**Order:** O1 and O2 in parallel → O3 and O4 → O5 → O6 → O7 → O8.

## 3. O2 migration (`2026111…_onboarding.sql`)

Nothing published changes shape: `listing_public` keeps its columns.

| Change | Detail |
|---|---|
| `listing_services (listing_public_id, service_slug, position)` | Pick all that apply. `position = 0` is the main service and stays mirrored in `listings.service_slug`, so search and `listing_public` are untouched |
| `listings.mode` adds `'both'` | A branch is required for fixed and both. `service_areas.listing_mode` allows mobile and both. Search follows the **§10 contract** |
| `private.admin_decide_application` | The premises-label check becomes `mode not in ('fixed','both')` (§7) |
| `listing_hours (listing_public_id, day, opens, closes)` | Day toggles plus time selects |
| `organisations` + `team_size_band`, `trading_since date`, `assign_mode`, `offer_anyone`, `staff_contact_visibility`, `team_mfa_policy` | Set only through `set_team_settings` (owner; managers for assignment). `team_mfa_policy` defaults to `optional`, and other values are refused until O7 (§8) |
| Drafts and branches | Location stores only a pin (`pin_lat`, `pin_lng`, `pin_source in ('tap','device')`) and a **typed** `public_address` (§9) |
| Application: `applicant_role`, `adult_attested_at` | An 18+ toggle, never a date of birth (D-088). The applicant still becomes the owner member; the role answer is context for the admin |
| `invites (organisation_id, role, token_hash, email, expires_at, used_at, created_by)` | RLS: owners and managers of that organisation. 7 days, single use |
| `staff_profiles (membership_id, services, days, first_name)` | `first_name` is public only when `assign_mode = customer` |
| RPCs | `provider_save_draft`, `provider_submit` (replacing `provider_apply`, which is kept for one release), `create_invite`, `accept_invite`, `set_team_settings`. Every write goes through `private.write_catalogue_audit` and is redacted (§9.1) |

## 4. Open items for review

Codex 31 closed the earlier open items into contracts: §7 (admin labels), §8 (team security), §9 (location) and §10 (both in search). What remains open is Codex's exact-head review of those contracts, after the §2.0 gate.

## 5. Owner prerequisites

- A Resend sending subdomain for O5 (free tier, D-000, D-014).
- No new paid services and no new accounts.

## 6. Verification (every slice)

- `pnpm run check`: lint, format, typecheck, unit tests including contrast, build.
- pgTAP for O2, O6 and O8: RLS, append-only audit, A10 for both, invite expiry and single use, team-policy enforcement.
- Playwright at 390 px and 1280 px against the approved prototype screens:
  - Next and Back, and Enter and Esc;
  - filter bars on one line, the gliding bar;
  - A12; no ID-number or date-of-birth field.
- Synthetic data only. CI runs once a PR is ready (D-086).

## 7. Admin labels for "both" (Codex 31 P1-1)

- **The fix:** `private.admin_decide_application` (`20261111100000_p2_4_providers.sql:385`) refuses `premises_visited` when `mode <> 'fixed'`. O2 changes that to `mode not in ('fixed','both')`.
- **Unchanged:** method validation, the evidence requirement, `listing_decisions`, claim-transfer protections and `private.require_admin()`/aal2.
- **Order:** O4's Checks step depends on this change.
- **pgTAP:**
  - fixed and both accept `premises_visited`;
  - mobile-only is refused with `bad_input`;
  - decision and audit rows are otherwise unchanged;
  - the claim-transfer tests stay green.

## 8. Team security and fallback contract (Codex 31 P1-2)

**Activation.** O6 ships 4 hub tasks. "Team sign-in security" and every `team_mfa_policy` write ship in **O7**, together with their enforcement, so a policy can't be switched on before it is enforced. Until then, `set_team_settings` refuses any value except `optional`.

**Scope.** The policy covers managers and/or staff. **Owners are always exempt** (D-089). A change takes effect on the next request.

**Enforcement, in two places, from one predicate:**
- **Worker:** organisation loaders and actions call the **same canonical predicate**, `private.org_mfa_satisfied(org)`, through an RPC under the signed-in user's own JWT. The Worker keeps **no second, stricter rule** (Codex 31 re-review). Membership and role authorisation stay a separate check (`private.has_org_role`). So an aal1 owner, a role the policy doesn't cover, and everyone under the `optional` policy pass in both layers.
- **Database (direct API and RPC):** `private.org_mfa_satisfied(org uuid)` is added beside `private.has_org_role` in org-scoped RLS policies and in every org RPC. It is true when any of these holds:
  - the caller is the owner;
  - the policy doesn't cover the caller's role;
  - `(select auth.jwt()->>'aal') = 'aal2'`;
  - a `private.mfa_stepups` row matches `auth.uid()` **and** `(auth.jwt()->>'session_id')::uuid`, with `expires_at > now()` and `revoked_at is null`.
- Reference: Supabase MFA and AAL, https://supabase.com/docs/guides/auth/auth-mfa .

**Fallback proof** (`private.mfa_stepups`: `user_id`, `session_id`, `issued_at`, `expires_at`, `revoked_at`):
- Created only by the Worker, through a `security definer` function, after an emailed code is verified.
- The code: 6 digits, stored hashed, single use, 10 minutes, 5 attempts, a send rate limit, and an alert email on use.
- Bound to the user **and session**; expires at 12 hours or at the session's end, whichever is sooner.
- Revoked on sign-out, password change, new factor enrolment or a recovery-code reset.
- Consulted **only** by `org_mfa_satisfied`. It is never a native aal2 JWT.

**Who may use the email fallback.** Only accounts with a **password** identity, after the correct password in the same session. **Google-only accounts may not** (owner, 2026-11-12). They use recovery codes, a second authenticator device, or the reset path below.

**Recovery codes (everyone).** Codes are hashed and single use. Redeeming one needs a **fresh first sign-in** in the same session:
- **Password accounts:** the password, re-entered now.
- **Google-only accounts:** a **fresh Google sign-in**, meaning a new OAuth round trip with the session's `auth_time` no more than 5 minutes old.

A code **only removes TOTP factors**, and that is audited. The person then re-enrols and reaches aal2 natively. A code never grants aal2.

**No codes left (documented reset path):**
- **Staff or manager:** an owner or manager of their organisation asks for a factor reset, and an admin completes it.
- **Owner:** an admin resets it after an out-of-band identity check.

Both paths are audited, and both end with native re-enrolment.

**Admins (native aal2 only).**
- `requireAdmin` and `private.require_admin()` read only the JWT `aal` and never consult `mfa_stepups`. Admins have no email fallback.
- **Admin recovery codes:** these follow the same rule, so they need a fresh first sign-in and only remove factors (server-side Supabase admin API, audited). They never grant aal2.
- **Another-admin reset:** an aal2 admin removes the locked-out admin's factors after an out-of-band identity check. The reset is audited, and the admin re-enrols.

**Tests:**
- Both layers (Worker and direct RPC/RLS): under the optional policy, allowed; owner exempt, allowed; uncovered role, allowed; covered role at aal1 with no proof, refused; covered role at aal2 or with a valid proof, allowed.
- Recovery: a password account redeems a code; a Google-only account redeems one after a fresh Google sign-in; a Google-only account with a stale `auth_time` is refused; the email fallback is refused for Google-only accounts; an admin's code resets factors but grants no aal2; a used code is refused on replay.
- pgTAP: direct RPC and RLS with an aal1 JWT under a policy are refused; a proof from another session, an expired proof, a revoked proof and a replayed code are each refused; a policy change applies at once; the owner exemption holds; admin functions ignore proofs.
- Worker integration: the same cases through the routes.

## 9. Location provenance (Codex 31 P2-3)

Mapbox temporary geocoding results may not be stored (https://docs.mapbox.com/api/search/geocoding/#storing-geocoding-results), and confirming a result doesn't change that.

- **Coordinates** come only from the user's own **pin tap** on the D-084 static map, or from **browser geolocation** (device supplied).
- **A search result only recentres the map view.** Its coordinates, text and IDs are discarded in memory. They never enter drafts, final rows, logs or caches. The request stays server-side (D-082).
- **The public address is typed by the business** (premises and both only), as the owner decided on 2026-11-12. That makes **3 typed fields** for premises businesses and 2 otherwise. A mobile base is a pin or device location only, with no address.
- **Tests:** no Mapbox response field reaches a draft, row or log.

## 10. "Both" in search (Codex 31 P2-4)

**Unchanged:**
- fixed-group 3-decimal and mobile-group 2-decimal rounding (`p2_2_search.sql`);
- the `catalogue_server` scoped capability (D-081);
- the limiter (30 a minute per IP, 60 per 10 minutes per cookie, fail closed);
- `private.mobile_eligible_ids` as **coarse discovery eligibility**: `api.search_listings` calls it with the mobile point already rounded to 2 decimals (`20261110190000_p2_3_category_search.sql`).

**Not an existing guard (Codex 31 re-review).** PLAN A9's **private exact-address recheck** (the customer's unrounded service address checked against the private radius before a quote or booking is accepted) is a **later booking dependency (Phase 3)**. The Phase 3 acceptance contract: a case that is in at the rounded point but out at the exact address is refused at booking, and there is no unrestricted public exact-eligibility endpoint.

**Membership** (deterministic and deduplicated):
- A both-listing is in the **fixed group** when its **premises** is within the selected radius, ranked in premises distance buckets as today.
- Otherwise, it is in the **mobile group** if the point is inside its private service area. It is ordered by `public_id` like mobile, with **no distance shown**. The card reads "Comes to you · also has premises in <suburb>".
- It never appears in both groups. The mobile query excludes both-listings whose premises qualifies for the fixed group, using the fixed group's own rounded point and radius.

**Cursors.** Each group keeps its own keyset cursor. Membership depends only on the rounded point, the radius and the data, so pages are stable.

**Tests (A8–A11):**
- premises exactly at the radius edge;
- no duplicates across groups or pages;
- the projection has no base fields;
- moving the base inside the radius gives byte-identical responses;
- the limiter still fails closed.

**Probing risk.** Add a both-listing row to `planning/legal/probing-risk.md` (the same residual risk as mobile). O3 keeps the existing probing-risk notice and recorded acknowledgement when it replaces `provider.apply`.
