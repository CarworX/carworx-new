# Claude — 23: onboarding, admin, settings and money redesign (build plan)

**Date:** 2026-11-12 (SAST). **Author:** Claude (design sub-session). **Status:** plan for Codex review (D-073) and owner approval. No product code changes until both approve.

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

**Order (owner, 2026-11-12):** the redesign is next. Bundle B is already merged, so there is no rework. The email outbox (O5) is built here for the first time, and Bundle B's forms can adopt it later.

## 1. What ships

| Who | Gets | Where (new or reworked) |
|---|---|---|
| New business | **Get approved**: a named-step flow with the rail (desktop) and the gliding segmented bar; the live listing preview; pick-don't-type (2 typed fields); server-saved draft | `/provider/get-listed/:step` (replaces the single form at `/provider/apply`) |
| Claimant | The same flow for claims: pick the listing, how we check it's yours, document type chips plus a calendar date (no typed reference) | `/provider/claim/:publicId` |
| Waiting business | Submitted ("what happens next"), waiting dashboard, then "You're live" with the earned labels | `/provider` |
| Owner, manager | **Finish setup** hub (5 tasks): Team invites, who gets the booking, what staff can see, team sign-in security, cover photo (deferred); plus Bundle B's Enquiries | `/provider` (hub), `/provider/setup/:task/:step` |
| Invited person | **Staff join**: one-time invite → own sign-in → services → days → first name (only when customers pick) → two-step setup (only when the owner requires it) → staff home | `/join/:token`, `/provider` (staff home) |
| Every user | **Profile and settings** (Profile, Security, Notifications, Privacy and data, plus Your work or Business by role); **Sign out** from the menu | `/account/:tab`, `NavBar` account menu |
| Every user | **Two-step sign-in** with their own authenticator app; CarworX-styled QR code; recovery codes; email-code fallback for non-admins | `/account/security`, `/auth/mfa` |
| Admin at `aal2` | **Console**: Today, Applications, Claims, Businesses (record: labels, suspend or restore, Remove access), Demand, Support, Audit log; guided application and claim review | `/admin`, existing `admin.*` routes reworked |
| Later (Phase 3) | Bookings History and Assignments, Earnings (owners and managers), admin Money, Requests, driver screens | Needs bookings and G-LIVEPAY |

## 2. Slices

Each slice gets its own `claude/*` branch and draft PR, marked ready for CI (D-086). It merges only after Codex's exact-head `REVIEW: APPROVE @sha`, green CI and the owner's OK (D-073, D-080). Everything stays local, CI and synthetic until G-PROD.

| Slice | Contents | Depends on |
|---|---|---|
| **O1 Components** | React ports of the prototype pieces, in `apps/web/app/ui/`:<br>• `SegmentedProgress`: gliding bar; `clip-path` fill; forward fills, back drains, jumps chain; reduced motion; `role=progressbar` with `aria-valuetext`<br>• `StepRail`: from `StepList.tsx`, with done and current states<br>• `FilterBar` and `TabBar`: one line, sideways scroll, edge fades, chosen item in view<br>• `ChoiceTiles` (single or multi), `PickChips` (wrapping), `Switch`, `DayToggles` with time selects, `StarterPhrases`<br>• `StatusScreen`<br>• the `NavBar.tsx` account menu (avatar dropdown on desktop, sheet on phone: Profile and settings, Security, Sign out)<br>New pairs go into `contrast-pairs.ts`. `_dev.components.tsx` shows each one | — |
| **O2 Data model** | One migration (§3), pgTAP, an extended A10 and anti-probing suite, and the RPCs | — |
| **O3 Get approved** | The stepped application and claim, with a server draft (`provider_save_draft`, `provider_submit`):<br>• live preview built from `ResultCard.tsx`<br>• map pin picker on the D-084 static image (a click maps to coordinates within the image's known bounds)<br>• address search through the D-082 server geocoder (quota-guarded)<br>• "Use my location" only after the CarworX permission card<br>• submitted, waiting and live states<br>The A12 Playwright tests are rewritten for the steps. The old `/provider/apply` redirects | O1, O2 |
| **O4 Admin console** | Today (counts, oldest first, disputes on top), queues with `FilterBar`, guided application review and claim review. They call the existing `admin_decide_application`, `admin_decide_claim` and `admin_resolve_dispute` unchanged. Plus the business record, Bundle B's Demand and Support in the same shell, and audit filters. The aal2 guard in `auth/routes/admin.tsx` stays as it is | O1 |
| **O5 Email outbox** | D-014 on Resend: an outbox table, idempotent sends, retries with backoff, bounce handling, queueing at the free-tier daily cap, a verified sending subdomain (SPF, DKIM, DMARC). Mail bodies are never logged (§9.1). The first templates are the invite and the email sign-in code | **Owner:** a Resend sending subdomain |
| **O6 Finish setup and staff** | `/provider` becomes the hub:<br>• **invites:** role, then an email (O5) or a one-time link plus QR; 7 days; single use; token stored as a hash; owners and managers can invite<br>• **team settings:** who gets the booking (customer picks, optionally with "Anyone available", or the business assigns), what staff can see (phone, first name, or booking only), team two-step policy (optional, required for managers, or required for everyone)<br>• **staff join and staff home**<br>• **History → Team changes**, from `audit_log`<br>Cover photo is deferred to a storage review (PLAN §9.1) | O1, O2, O5 |
| **O7 Accounts and security** | `/account` tabs. Two-step sign-in for every user through the existing Supabase TOTP enrolment (`mfa.tsx`):<br>• the QR is drawn **in the browser** from `totp.uri`, never from the default `qr_code` SVG<br>• a pinned QR encoder (version read from its official source at build time); error correction H; the CarworX mark in the centre<br>• the secret is never logged, stored by us or sent to a third party<br>Also: sign out of other devices (`signOut({ scope: "others" })`), and **server enforcement of the owner's team policy** (organisation routes need `aal2` for the roles it covers). Admins are unchanged (`aal2` always) | O1, O6 |
| **O8 Recovery and email fallback** | **Recovery codes:** hashed, single use; required for admins, optional for others.<br>**Email-code step-up for non-admins only**, through O5:<br>• only after the correct password<br>• a 10-minute single-use code, rate limited<br>• an alert email on every use<br>• recorded server-side as meeting the team policy<br>Supabase's MFA factors don't include email, so this is custom. Codex security review required | O5, O7 |
| **Phase 3** | Bookings History and Assignments, Earnings and admin Money (the `planning/design/onboarding/_shared/money.js` contract: SAST day boundaries; past week, month, year or custom vs the previous period of the same length; a daily rollup view; owners and managers only), Requests, driver screens | Bookings, G-LIVEPAY |

**Order:** O1 and O2 in parallel → O3 and O4 → O5 → O6 → O7 → O8.

## 3. O2 migration (`2026111…_onboarding.sql`)

Nothing published changes shape: `listing_public` keeps its columns.

| Change | Detail |
|---|---|
| `listing_services (listing_public_id, service_slug, position)` | Pick all that apply. `position = 0` is the main service and stays mirrored in `listings.service_slug`, so search and `listing_public` are untouched |
| `listings.mode` adds `'both'` | A branch is required for fixed and both. `service_areas.listing_mode` allows mobile and both. Search treats both as **premises** for distance and ranking, with the private radius used only for inclusion. A both-listing included through the radius shows the **premises** distance, never a base-derived figure (A10). Codex reviews this against A8–A11 and the D-081 anti-probing rules |
| `listing_hours (listing_public_id, day, opens, closes)` | Day toggles plus time selects |
| `organisations` + `team_size_band`, `trading_since date`, `assign_mode`, `offer_anyone`, `staff_contact_visibility`, `team_mfa_policy` | The last four are set only through `set_team_settings` (owner; managers for assignment) |
| Application: `applicant_role`, `adult_attested_at` | An 18+ toggle, never a date of birth (D-088). The applicant still becomes the owner member; the role answer is context for the admin |
| `invites (organisation_id, role, token_hash, email, expires_at, used_at, created_by)` | RLS: owners and managers of that organisation. 7 days, single use |
| `staff_profiles (membership_id, services, days, first_name)` | `first_name` is public only when `assign_mode = customer` |
| RPCs | `provider_save_draft`, `provider_submit` (replacing `provider_apply`, which is kept for one release), `create_invite`, `accept_invite`, `set_team_settings`. Every write goes through `private.write_catalogue_audit` and is redacted (§9.1) |

## 4. Open items for review

1. **Address storage vs Mapbox terms.** A branch needs `public_address`, but D-082 forbids storing temporary geocoding results. Proposal: prefill the search result, and have the owner confirm or edit it as their own entry before it is saved. This needs a terms check before O3 merges.
2. **"Both" in search.** Does premises-only distance with radius inclusion keep A8 and the D-081 anti-probing guarantees? (Codex)
3. **Email fallback strength.** An email code makes the second step only as strong as the email account. The O8 mitigations apply. (Codex security review)

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
