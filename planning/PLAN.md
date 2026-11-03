# CarworX — Consolidated Plan

| | |
|---|---|
| Version | **Draft 2.1 — technically signed**, 2026-10-27 (draft 2 reviewed at `953fb08`; final clarifications in [Codex 04](codex/04-reply.md)) |
| Drafted by | Claude ([Claude 04](claude/04-reply.md)), incorporating [Codex 03](codex/03-reply.md) R1–R8 and T-23 |
| Codex sign-off | ☑ Codex, 2026-10-27: R1–R8 resolved; technical plan and §22 pack scope accepted with the recorded 2.1 clarifications. This is not owner approval or permission to build the application. |
| Colleague review | ☑ 2026-11-02: the owner's two colleagues saw the presentation pack (§22) and asked for no changes (D-037) |
| Owner approval | ☑ 2026-11-02: approved for **Phase 1 only** (§3), starting local-only (D-038). Every later phase, gate, spend and production release needs separate approval (§21) |
| Sources | D-001–D-033 in [DECISIONS.md](DECISIONS.md); owner decisions since then: D-034–D-059 |

**OWNER DECISION** = not decided yet. **GATE** = must be satisfied before the step it guards. **PROPOSED DEFAULT** = a technical or operating default both agents recommend; the owner can change it.

---

## 1. Product

**CarworX** (carworx.app) is a South African marketplace where drivers find, enquire with, book and pay providers for car services, and get honest guidance on traffic fines and vehicle admin.

- **Who it's for:** drivers anywhere in South Africa (D-001); fixed-premises and mobile providers. Fleets are a later hypothesis (§17).
- **Catalogue (D-008):** three groups.
  - Wash & Detailing
  - Repairs & Maintenance: servicing and mechanical, **Glass Repair & Replacement**, **Tyres & Wheel Alignment**
  - Fines & Vehicle Admin: official fines referrals, plus listed admin services; towing as a labelled referral only
- **Home page:** five equal shortcuts: Wash & Detailing · Repairs & Maintenance · Glass Repair & Replacement · Tyres & Wheel Alignment · Fines & Vehicle Admin.
- **Customer flows (D-001):** discovery and enquiry; confirmed booking; payment.
- **Money (D-002):** free pilot, so the platform fee amount is zero. Repairs use quote-then-pay.
- **Supply:** starts at zero. Owner and colleague recruit, verify and run support (D-004).

## 2. v1 scope

**In scope (built across Phases 1–3):**
- Public site: home, category and subcategory pages, search (list first, map optional), listings, fines and admin guidance, legal pages.
- Accounts: customer and provider (one person can be both); admin with server-enforced MFA. **Sign-in (D-042):** Google, or email and password. Admins also need a TOTP code. No SMS or WhatsApp sign-in in v1.
- Provider application → admin review → verification labels (D-023) → live listing. Mobile providers set a radius around a private base.
- Enquiries. Private "need a provider here" demand capture.
- Fixed-price booking and quote-then-pay flows (§6) with resource-based capacity, holds and versioned quotes.
- Paystack hosted checkout with subaccount splits, **built and tested in test mode only**.
- Email (Resend) plus in-app notifications through an outbox.
- Reviews; admin tools for the application queue, claims, suspensions, bookings, refunds, disputes, support and the audit log.
- Fee snapshot fields: `fee_policy_version`, `fee_basis = 'none'`, `platform_fee_amount_minor = 0` (ZAR integer cents).

**Production before G-PAY:** discovery, applications, enquiries and fines referrals only. **Confirmed bookings without payment are switched off by default** (D-032). The owner decided against binding unpaid reservations (Q-022, D-051). Once G-PAY passes, price-list services book and pay immediately, and other services go enquiry → range → in-person quote → pay in the app.

**Out of scope for v1:**
- native apps
- WhatsApp/SMS
- integrated fines lookup
- bulk imports
- wallets or escrow
- B4 deferred payment (deferred, §7)
- subscriptions
- any sponsorship or ad data or serving (no dormant fields)
- affiliate tracking
- lead credits
- insurer claims
- roadside dispatch
- multiple languages

## 3. Phases and exit criteria

| Phase | What happens | Exit criteria | Authorised by |
|---|---|---|---|
| **0a. Technical plan** | This document | Codex sign-off | — |
| **0b. Presentation pack** | Turbine brand (D-034) plus layout mockups plus a plain-language summary (§22) | Owner has shown the colleagues; feedback folded in | Owner (planning artefacts, no app code) |
| **1. Foundations** | Repo scaffold, CI, local dev, staging, auth, the first tables with RLS, design system from the chosen direction, deploy to staging. Synthetic data only. **No Paystack or Mapbox needed** | A1–A6 and **A7 (restore drill: database plus storage objects)** pass on staging | **Owner approval of this plan**, plus the §15 Phase 1 prerequisites |
| **2. Discovery and applications** | Catalogue, search, listings, applications, admin review, enquiries, demand capture, fines referral pages. **Production launch of the free site** | A8–A17 pass; GATE G-PROD passed | Owner, at phase start; launches on the Supabase free plan with a no-cost backup route (D-044) |
| **3. Bookings and quotes (test payments)** | Resources, holds, quotes, mobile travel, notifications, Paystack test mode, reviews, refunds and disputes tooling. Staging only | A18–A36 pass on staging | Owner, at phase start |
| **4. Paid activation** | Live collections, per provider | GATE G-PAY, then G-PROVIDER per provider; restore drill repeated | Owner, explicitly |
| **5. Expand** | Supply growth, owner-approved revenue experiments (§17) | Owner sets targets after 4 weeks of baseline data | Owner, per experiment |

The restore drill (A7) is **repeated** after material schema or storage changes and before G-PAY. Integrated fines runs as a separate track behind G-FINES.

## 4. Architecture (D-006, D-010)

```
Browser / installable PWA
        │  HTTPS (Cloudflare edge: JNB / CPT / DUR)
        ▼
Cloudflare Worker — React Router v7 (SSR + static assets)
  ├─ session: Supabase Auth via httpOnly cookies, validated server-side every request
  ├─ validation (Zod), origin/CSRF checks on cookie-authenticated mutations
  ├─ orchestration: bookings, holds, quotes, payments, notifications
  ├─ Paystack webhook endpoint (raw-body HMAC; durable store before 200 OK)
  ├─ Cron Triggers: hold expiry, quote expiry, outbox retries, reconciliation
  └─ search endpoint: bounded, rate-limited, server-side radius matching
        │  user JWT → RLS                  │ scoped privileged key (webhooks, reconciliation only)
        ▼                                   ▼
Supabase (London eu-west-2, provisional): Postgres + PostGIS, Auth, private Storage, RLS
External: Paystack · Resend (transactional + Auth SMTP) · Mapbox (maps; temporary geocoding for search input only)
```

- One server runtime. **Postgres guarantees invariants:** resource capacity enforced atomically for provider-set simultaneous capacity (D-057; the contract is proposed before Phase 3), unique constraints on idempotency keys, and transactions for holds, payments and refunds.
- **Auth boundary:** deny by default. Authorisation uses a **membership lookup in the database**, never the role claimed in the token or mutable user metadata. Personal responses carry `Cache-Control: private, no-store`. Redirects are checked against an allowlist. Cookies are `Secure; HttpOnly; SameSite=Lax`.
- **Region:** London is provisional. GATE G-PROD needs measured latency (London vs Frankfurt, from JNB and CPT) and a POPIA section 72 assessment.
- **Stack:** TypeScript strict, pnpm, React Router v7, Tailwind, shadcn/ui, Zod, Vitest, Playwright, pgTAP, Supabase CLI, Wrangler. Pin versions at the start of Phase 1.
- **PWA:** offline mode for public content only. No offline payments or private data cached.

## 5. Data model (D-011)

Tables arrive **by feature, in the phase that needs them**, each with RLS policies and tests in the same migration.

| Phase | Entities |
|---|---|
| 1 | `profiles`, `organisations`, `memberships`, `audit_log` (+ whatever auth needs) |
| 2 | `branches`, `listings` (provenance), `categories`, `services`, `service_areas` (private base + radius), `listing_public` (public projection, §6.2), `verifications`, `claims`, `enquiries`, `demand_requests` (private), `consents`, `support_cases`, `coordinate_sources` |
| 3 | `resources`, `availability`, `holds`, `bookings`, `quotes`, `quote_versions` (immutable once issued), `change_quotes`, `payment_attempts`, `payments`, `refunds`, `disputes`, `integration_events`, `outbox`, `notifications`, `reviews`, `travel_fee_bands` |

**State machines** (each kept separate):
- **Quote version:** `issued → approved | declined | expired | superseded`. Immutable once issued.
- **Booking:** `requested → accepted (hold) → confirmed → in_progress → completed | cancelled | expired | no_show`
- **Payment attempt:** `initialised → succeeded | failed | abandoned`
- **Payment:** a record of money that succeeded, with an immutable amount
- **Refund:** `requested → processing → succeeded | failed`
- **Dispute:** `open → evidence_submitted → won | lost`

Refunds and disputes can exist together on one payment. Money is stored as integer cents (`*_minor`).

**Coordinate provenance (R2):** every stored coordinate has a source: `provider_pin`, `customer_entered_address` or `staff_entered_with_permission`. **Temporary Mapbox geocoding results are never stored**, under any field name.

## 6. Key flows (proposed defaults where marked)

### 6.1 Provider onboarding (D-023)
Application → admin review with the method recorded → labels granted → live. Claims and transfers of control get a human review, and former staff access is revoked.

### 6.2 Search and location privacy (R2, PROPOSED DEFAULTS)
- **Fixed-premises:** providers within **25 km** of the selected point, with the customer able to choose 5/10/25/50 km. Results are paginated in a deterministic order (distance, then a stable ID). The search never widens silently; any widening is shown to the user. Distances are labelled "straight-line".
- **Mobile:** a provider is included if **the customer's selected point lies inside the provider's radius**. No distance to a mobile provider is shown, and none is used for ranking, because it would reveal the base.
- Mobile discovery uses the coarse point described below, so displayed results are **approximate service-area candidates**, not a guarantee of exact-address coverage. The server rechecks the customer-supplied exact service point privately before a provider accepts a quote/booking; show any coverage mismatch and never charge an ineligible booking. Do not offer an unrestricted public exact-address eligibility endpoint.
- **Public projection** (`listing_public`): it **never** contains base or radius-centre coordinates, base-derived distances, or private row IDs that link to them. A mobile provider's public map shows at most a coarse, separately approved service-area representation, never the base pin.
- **Anti-probing:** radius matching runs only in the server search endpoint, never through an anonymous RPC. Inputs are bounded (coordinates rounded to about 1 km for mobile discovery), and requests are rate-limited per IP and session. **Remaining risk:** repeated coarse probes can still narrow down where a base is. Record it in the pre-production privacy assessment and obtain approval of the mitigation before G-PROD; do not claim anonymity or assume the owner's/providers' risk acceptance. Explain the limitation during provider onboarding.
- **Empty supply** → private demand capture.

### 6.3 Fixed-price booking (D-024, R3, PROPOSED DEFAULTS)
- Each slot belongs to a **resource** (bay, team or calendar), using half-open UTC intervals `[start, end)` that include duration plus turnaround or travel buffer. Times are shown in Africa/Johannesburg.
- **Capacity is set by the business (D-057).** Each resource has a provider-set number of customers it can serve at the same time (default 1). Holds and bookings may overlap on a resource only up to that number, enforced atomically in Postgres. This **replaces** the earlier "one job per resource, exclusion constraint" rule: with capacity 1 the behaviour is unchanged. The design (count-based check under a lock, or per-seat rows that keep an exclusion constraint) is for Claude to propose and Codex to review. Overbooking beyond the set number stays out of scope.
- A **request** doesn't promise capacity. The provider must acknowledge it within **2 business hours** (08:00–17:00 Mon–Sat, SA public holidays excluded; provisional). Slots that start before acceptance plus payment could finish aren't offered.
- **Acceptance** atomically checks the service, price and resource and creates a **15-minute payment hold**.
- A **payment attempt** is tied to the hold, booking, quote version (if any) and the cent amount calculated on the server. Initialising again reuses the same hold; it never creates a second payable job.
- **When a hold expires,** the capacity is released. A payment that succeeds *after* expiry goes to reconciliation, and the customer chooses rebook-if-available or a refund. It's **never confirmed silently**.
- **Rescheduling:** the new interval is reserved before the old one is released. Any price or travel difference is shown and needs acceptance. No hidden second charge.

### 6.4 Quote-then-pay (D-002, R3)
Optional priced diagnostic booking (a fixed-price booking) → provider issues an immutable **quote version** with a visible expiry (**default 7 days**, PROPOSED DEFAULT) → customer approves that exact version → hold and payment (§6.3).
- Approving after expiry is rejected.
- Revising before payment supersedes earlier versions and their payment eligibility.
- Work added after payment needs a separate **change quote**, with its own approval and payment or refund adjustment. A paid version is never relabelled.

### 6.5 Mobile jobs (D-025)
- Radius-only service area; straight-line travel bands, labelled as such.
- Provider-confirmed travel buffer, included in the resource interval.
- If routing is unavailable, instant acceptance is off and timing is confirmed manually.
- Provider sees only the suburb before confirmation, and the full address afterwards (assigned staff only, admin access audited). The provider's view is hidden 7 days after completion; deletion follows §9.3.

### 6.6 Cancellation and refunds
Handled under published terms, drafted by the agents and cross-referenced against the CPA and ECTA before G-PAY (D-045). Admin refund tools record each refund as its own entry, with status updated by webhooks and reconciliation.

### 6.7 Fines (D-013)
Guidance pages plus labelled official referrals. No ID number collected. "No results" never means "no fines".

## 7. Payments (D-012, D-026, D-031)

- Hosted checkout, initialised on the server with a subaccount split. No wallet or escrow.
- **Events (R4):** delivered at least once.
  - The Worker verifies the HMAC over raw bytes and **stores the event durably before responding 200**. Deduplicate the same logical event using a stable provider event identifier where supplied, otherwise a documented key including event type, affected provider object/reference and lifecycle transition. A transaction reference alone must not suppress distinct payment, refund or dispute events.
  - The same business effect applies **at most once per logical operation**, enforced by unique constraints and transactions. Distinct refunds/disputes on the same payment remain processable.
  - If Paystack's verification call fails temporarily, the stored event is retried, not discarded. Bad signatures are rejected.
  - Amount, currency and reference must match the attempt.
  - A **scheduled reconciliation** checks Paystack's transaction, refund and settlement records and shows mismatches to operators.
  - Browser redirects are never proof of payment.
- **Fees:** `fee_basis = 'none'`, `platform_fee_amount_minor = 0` during the pilot. No non-zero split percentage until an approved experiment (G-REVENUE).
- **OWNER DECISION Q-016:**
  - **Processing-fee bearer:** **A1, provider bears it, fully disclosed**. Chosen by the owner (D-048).
  - **Refund and chargeback funding:** **B2, a reserve plus provider recovery**, chosen by the owner (D-050), subject to Paystack's written confirmation at G-PAY. It can *optionally* be combined with **B4** (pay closer to the service). B4 reduces exposure but **is not funding**.
  - **B4 is deferred** from the first build. If chosen later, a CarworX "payment due" action rechecks ownership, quote, capacity, price and status, then initialises the normal hosted split transaction. Reservation expiry, reminders, release for non-payment, short-notice rules and a visible "provisional" status must be specified first.
- **GATE G-PAY** blocks live collection.

## 8. Notifications (D-014, R4)

- Resend from a verified sending subdomain (SPF, DKIM, DMARC). Transactional and marketing consent are kept separate. No tracking in auth emails.
- **Outbox:** every message is a row with a stable ID, which is used as the Resend idempotency key.
  - Retries reuse the same payload and key **within Resend's 24-hour key window**.
  - If an outcome is still unknown after that window, the message is flagged for operator investigation, **not resent blindly**.
  - Delivery is never promised to be exactly once.
- **Stale messages are suppressed:** a deadline or action email isn't sent once its action has expired. The in-app event stays, and operators are alerted.
- **In-app status is the source of truth.** Alerts fire near the Resend daily cap.
- **Auth email** (Supabase Auth through Resend SMTP) **shares the same Resend quota** and has its own visible failure and recovery path: a resend button, an admin alert and documented manual recovery.

## 9. Security, privacy, compliance (D-021, R6)

### 9.1 Controls
- RLS on every table.
- Database membership lookups for any access that must stop the moment someone is removed.
- Admin MFA (TOTP) enforced on the server.
- **Google sign-in (D-042):**
  - Request only the basic `openid email profile` scopes, and store only name, email and avatar.
  - A Google account and an email-and-password account with the same verified email are linked, never duplicated.
  - Membership and roles still come only from the database (§4), never from Google.
  - The privacy notice names Google as a sign-in provider.
- Cookie sessions (§4); origin and CSRF checks on mutations; redirect allowlist; no shared caching of personal responses.
- Private storage buckets, upload type and size limits, **signed URLs that expire within 10 minutes** (PROPOSED DEFAULT).
- Rate limiting; log redaction (no addresses, access notes, coordinates or tokens); secret scanning in CI.

### 9.2 POPIA and consumer law
- Information Officer registered (owner, D-043); section 72 assessment; operator agreements; consent records.
- No ID numbers in v1.
- ECTA section 43 and CPA disclosures. **No attorney (D-045):** the agents draft a privacy notice and terms for the free site before G-PROD, and payment terms before G-PAY. Each is cross-referenced against the primary law with section-level citations and reviewed by the other agent.

### 9.3 Retention schedule (must be approved before G-PROD; synthetic data until then)

TBD periods are set by the agents from SA law with citations; the owner's accountant colleague reviews financial records; the owner approves (D-053).

| Data | Purpose | Who can access | Deletion trigger → period |
|---|---|---|---|
| Profiles | Account | Self, admin | Account closure → **TBD (agents, from SA law; D-045)** |
| Customer addresses and access notes | Fulfilment | Customer, assigned staff (7 days), admin (audited) | Job completion → **TBD (agents, from SA law; D-045)**, kept longer only while a dispute is open |
| Mobile base location | Matching | Provider owner, admin | Listing removal → 30 days (PROPOSED) |
| Enquiries, demand requests | Service, recruitment | Parties, admin | Last activity → 12 months (PROPOSED) |
| Verification evidence | Trust labels | Admin | Label granted → method record kept; raw evidence deleted ≤30 days (PROPOSED) |
| Logs (redacted) | Operations | Operators | 30 days (PROPOSED) |
| Outbox, notifications | Delivery | System, admin | 90 days (PROPOSED) |
| Integration events (raw) | Reconciliation | System, admin | Reconciled → 90 days (PROPOSED) |
| Reviews, support cases | Trust, service | Per RLS | **TBD** |
| Financial records | Tax and accounting | Admin | **TBD (agents research SA requirements; the owner's accountant colleague reviews; D-047)** |

Backups follow the retention of the agreed no-cost backup route (D-044). Legal-hold overrides are recorded. Implementers don't invent the TBD periods.

### 9.4 Readiness
Incident response plan; restore drill (A7); WCAG 2.2 AA.

## 10. Design and UX (D-028)

- **Brand:** the owner locked the **Turbine** logo on 2026-10-27 (D-034); files in [design/brand/](design/brand/README.md). The rest of the brand (UI palette, type scale, imagery, tone, app icon) is refined in Claude Design and shown in the presentation pack (§22) as concept, not final, before Phase 1 design-system work.
- **Every state is designed,** including:
  - empty or limited supply
  - acknowledgement deadline
  - hold countdown
  - **provisional / expired / paid-but-needs-resolution**
  - quote revision and expiry
  - travel cost
  - payment pending or failed
  - cancellation, refund and dispute
  - suspended provider
  - errors
- Design system in code (Tailwind tokens, shadcn/ui), with a living component page. Figma optional.
- Mobile-first: 360 px, slow 3G, list without map. South African English.
- No ad or sponsor placeholders. Layouts must be able to take an accessible "Sponsored" label later without reserved blank space.

## 11. Acceptance tests (corrected map, R1–R6)

CI unless marked *manual* or *sandbox*. "Every table" means **every table migrated so far**.

**Phase 1:**
- **A1** CI runs lint, typecheck, unit tests, RLS tests and the build on every PR, and tests the exact head commit.
- **A2** Staging deploy succeeds.
- **A3** Sign-up, login and logout work for **email and password and for Google** (D-042). Admin sign-in requires TOTP. The session is validated on the server, and revoked membership stops access on the next request. **Real Google sign-in is blocked, locally and on staging, until the owner's Google OAuth client exists**, because Supabase needs the client for local development too. Until then, only callback, error and session contract tests run, on fixtures labelled as such, and A3 doesn't pass on fixtures. After set-up, the tests cover the redirect and code exchange, logout, account linking in both directions (verified identity linking only) and denied consent. Admins with an `aal1` session are refused both at the Worker and at the database API. Confirmation, reset, expired-link and email-failure states are recoverable.
- **A4** RLS matrix for every table so far: anonymous, self, member, member of another organisation, admin.
- **A5** Secret scan passes; no personal responses are cacheable.
- **A6** Foundation routes meet the **performance budget**: Worker CPU p95 ≤ 8 ms (to stay within the free 10 ms limit), Lighthouse mobile performance ≥ 90 and accessibility ≥ 95, CLS ≤ 0.1, lab LCP ≤ 2.5 s, using a pinned profile and repeated runs. **A failure blocks promotion.** Owner-approved paid runtime can replace the free-tier CPU ceiling with a recorded tested budget; it cannot waive accessibility, CLS, LCP or frontend performance checks. A p95 observation does not prove that no individual invocation exceeds a runtime limit; inspect the sampled tail and failures as well.
- **A7** *Manual:* **restore drill.** Database **and** storage objects are restored into an isolated environment, access controls are checked, and the steps are documented.

**Phase 2:**
- **A8** Fixed search: radius boundary (inside/outside at 25 km and at the chosen radius), pagination, deterministic order.
- **A9** Mobile discovery matches the coarse query point against the radius and labels results approximate; test boundary false positives/negatives from rounding. Exact coverage is rechecked privately before quote/booking acceptance; an ineligible address cannot proceed to payment.
- **A10** **No mobile base, radius centre or base-derived distance** in public JSON, SSR HTML, map data, logs or cached responses.
- **A11** Search is rate-limited and inputs are bounded; there is no anonymous RPC that can be used for probing.
- **A12** Application → approval → live (Playwright); claim dispute; suspension.
- **A13** Demand capture is never public.
- **A14** Fines pages have no ID field; "no results" copy is correct.
- **A15** New routes meet the A6 budget.
- **A16** *Manual:* keyboard and screen-reader pass.
- **A17** No temporary geocoding result is stored (code check plus a test).

**Phase 3:**
- **A18** Two customers race for one resource interval; exactly one hold succeeds. With capacity N (D-057), N + 1 concurrent holds on the same interval give exactly N successes.
- **A19** Adjacent intervals `[a,b)` and `[b,c)` both succeed; buffers prevent overlap.
- **A20** Multiple resources at one branch allow parallel jobs.
- **A21** A repeated request or payment initialisation creates no second hold or attempt.
- **A22** Hold expiry releases capacity.
- **A23** Payment succeeds after expiry → reconciliation → customer resolution; never confirmed silently.
- **A24** Webhook replay plus concurrency: **at-least-once reception, the same effect applied at most once**; distinct refund/dispute transitions sharing a transaction reference are not dropped.
- **A25** Bad signature, amount, currency or reference is rejected; verification outage → stored event retried.
- **A26** Recovery after a crash between storing an event and applying its effect.
- **A27** Quote expiry rejects approval; revision supersedes earlier versions; a paid version is immutable; a change quote is required for extra work.
- **A28** Reschedule fails → the original booking is kept.
- **A29** Cancellation while payment is pending; partial refund **plus** dispute on one payment; duplicate refund requests.
- **A30** Mobile buffer prevents overlap; routing off → manual timing confirmation.
- **A31** Address visible only to assigned staff after confirmation; hidden after 7 days.
- **A32** Outbox: provider times out after accepting → retry with the same key; retry after the 24-hour window → flagged, not resent; stale action emails suppressed; quota alert fires.
- **A33** Auth email failure path is visible and recoverable.
- **A34** Membership removal revokes access immediately.
- **A35** *Sandbox:* full Paystack test-mode flow.
- **A36** *Manual:* restore drill repeated after the Phase 3 schema.

## 12. Repository, CI/CD, releases (D-017, D-027, R8)

- **Monorepo:** `apps/web`, `supabase/` (migrations, seed, pgTAP), `packages/shared` (only once shared), `planning/`.
- **Environments:**
  - local
  - **staging:** `staging.carworx.app`, Supabase free project, Paystack test keys, email recipients limited to an allowlist
  - **production:** `carworx.app`
- **Process controls** (GitHub Free can't enforce them): branches `claude/*` and `codex/*`; an `Agent:` trailer; a PR template; the reviewer records `REVIEW: APPROVE|CHANGES @<sha>`; nobody approves their own work.
- **Merges:** **standing owner permission (Q-021, granted)** lets the reviewing agent merge **staging-only** PRs once CI is green on the exact head and approval is recorded for that commit. Otherwise the owner merges.
- **Production releases are run by the owner,** covering the Worker deploy **and Supabase production migrations** and any other production change. The production Cloudflare token, Supabase production credentials and Paystack live keys are never in an environment an agent can access.
- GitHub Team (Q-019, optional) adds branch protection and required checks, but not private-environment reviewers.

## 13. Who does what (D-015)

| Area | Lead | Reviewer |
|---|---|---|
| Product flows, `PLAN.md` editor, presentation pack (§22) | Claude | Codex |
| Architecture and contracts | Claude drafts, both approve | Codex |
| Schema, migrations, RLS | Claude | Codex |
| Brand directions, design system, UI, accessibility, copy | Claude | Codex |
| Workers: payments, holds/booking orchestration, email, cron, reconciliation | Codex | Claude |
| CI, environments, deployment scripts, restore drill | Codex | Claude |
| Integration, concurrency and adversarial test strategy | Codex | Claude |
| Tests for each change | Its author | The other agent |
| Security-sensitive changes | Assigned author | The other agent (always) |
| Recruitment, contracts, support and refund decisions | Owner + colleague | Agents prepare material |

**Delegation (R8):** each agent uses internal sub-agents or parallel tasks **only with explicit owner authorisation** (Q-023), with file ownership scoped per task and the other agent still doing the review. Q-021 covers merges only.

## 14. Working autonomously (D-019, R8)

| Level | Owner's role | Status |
|---|---|---|
| **L1** | Says "your turn" to the agent named in `STATUS.md` | Now |
| **L1+** | Q-021 granted: agents merge reviewed staging PRs themselves; the owner does production releases and phase approvals. **The owner still triggers each turn.** Standing permission doesn't wake anyone | From Phase 1 |
| **L2** | GitHub-triggered handoffs (Claude GitHub App/Action, Codex review/cloud) | Only after G-AUTO. Each tool's real identity, permissions, billing and secret boundaries verified, plus one documentation-only round trip. No general issue-comment handoff is assumed |

The phase backlog becomes GitHub issues (`phase-N`, `owner:claude|codex`) with acceptance criteria that reference §11.

## 15. Prerequisites and accounts (D-020, R8)

**Phase 1 prerequisites** (separate from plan approval):
1. Owner inventories existing accounts and confirms who controls the `carworx.app` DNS.
2. Owner creates a **staging** Supabase project (free) and a Cloudflare staging Worker route, and gives agents **staging-scoped** credentials as GitHub secrets. *Alternatively, Phase 1 can start local-only and add staging later.*
3. Resend sending subdomain verified, with **staging recipients restricted** to an allowlist.
4. CI can run (GitHub Actions minutes on the Free plan).
5. **Google sign-in (D-042):** the owner creates a Google Cloud project and OAuth client (web).
   - It has redirect URLs for local and staging, with production added at G-PROD. **It's needed for real Google tests locally too** (Codex 08 B1).
   - The client ID and secret are given to agents as staging-scoped secrets.
   - Needed before A3's Google path can pass on staging. The owner also sets up Google's consent screen, including whether brand verification is needed: **UNVERIFIED** until set-up.
6. **This computer:** Docker Desktop running (Supabase runs locally in Docker, through WSL2), and pnpm enabled. Needed before coding.

**Later:**
- Mapbox token, restricted by URL (Phase 2)
- Supabase production project on the free plan (D-044), before the Phase 2 production launch
- Paystack test-mode account and test keys (Phase 3). The support questions in `research/codex-vendor-access.md` and live keys wait until the business is registered (D-049), before G-PAY
- Company registration (CIPC) and business bank account, with the cofounders (D-049), after the build and before G-PAY
- Information Officer registration (G-PROD)
- No attorney (D-045): agent-drafted terms for G-PROD and payment terms for G-PAY
- The owner's accountant colleague reviews the agents' tax, VAT and retention research (D-047)
- Fines partner (G-FINES, Q-008)

Agents never create accounts, change DNS or handle production secrets.

## 16. Costs (D-016)

| Item | Phases 0–1 | Needed from | Notes |
|---|---|---|---|
| Supabase | Free (staging) | **Free plan for the production launch too (D-044).** Pro (from US$25/month: daily backups, no pausing) is not approved for now | Free plan limits: pauses after a week of inactivity; two active projects. Backups come from the no-cost route in D-044 |
| Cloudflare Workers | Free | US$5/month **only if** the A6/A15 budget fails and the owner approves | No automatic upgrade |
| Resend | Free (3k/month, 100/day, shared with auth email) | US$20/month at volume | |
| Google sign-in (D-042) | Free | — | No charge for basic sign-in at research time; recheck when the owner sets it up |
| Mapbox | Free | Usage-based | |
| Paystack | Test mode | Per transaction (SA cards 2.9% + R1 excl. VAT at research time), bearer per Q-016 | |
| Attorney / accountant | — | — | None: no attorney (D-045); the owner's colleague reviews accounting (D-047) |
| Refund reserve | — | G-PAY (B2 chosen, D-050) | Sized to outstanding paid obligations and dispute exposure |
| GitHub Team, automation | — | Optional (Q-019, G-AUTO) | |
| Marketing | Owner's budget | | |

Recheck prices before buying. **This plan approves no spending.**

## 17. Monetisation roadmap (T-23 as amended, D-029, D-031)

The pilot stays free. Each experiment needs G-REVENUE approval: payer, price, fee basis, refunds and stop criteria. The order below is a **test order of hypotheses**, not proof of willingness to pay.

**Owner's choices (2026-11-03):** see D-054 to D-056 and [Claude 11](claude/11-revenue-streams.md).
- First: commission of 10%, capped at R500 a job, provider-paid, with no lead fees and no customer fees.
- Second: Provider Pro at about R149–R199 a month.
- Later: the sponsored card, fleets, and guide or newsletter sponsors.
- Not pursued: affiliates and Google ads.

**Current test order (D-054 to D-056).** It replaces the earlier T-23 ranking; the old text is in Git history. Every step needs its own G-REVENUE approval. The entry and stop numbers in Claude 11 §7 are **exploratory hypotheses**, measured on fee-exposed cohorts (Claude 11 §10, V1).

0. **Free pilot with live payments at 0%,** once the company is registered (D-049) and G-PAY has passed.
1. **Commission on bookings paid in the app:** 10%, capped at R500 a job, paid by the provider through the split. Founding providers get 3 months free after charging starts. This needs rules for earned, collected and reversed fees and for reconciliation (Claude 11 §10, V2).
2. **Provider Pro:** about R149–R199 a month, separate from the commission. One bay or diary stays free, with provider-set capacity (D-055, D-057). It starts only after three months of observed fee-paying provider experience.
3. **Manual, labelled sponsored provider card** within D-029, once an area's traffic is proven.
4. **Small fleet and small-business test** after launch, with no dependency on fines.
5. **Later:** brand sponsors on guides, and sponsored newsletter slots. A free booking button stays a growth hypothesis. Parts-supplier deals need the owner's explicit approval first.

**Not pursued (owner):** affiliates, Google or programmatic ads, customer booking fees or memberships, lead fees, and acquisition fees.

**Never:** selling personal data; pay-to-verify badges; ads on sensitive flows or in transactional email; regulated financial referrals without licensed partners.

Reporting keeps booked value, completed net value, fees billed, fees reversed and collected revenue separate. Get accounting advice on whether CarworX acts as principal or agent, and on VAT. Full options: [revenue-streams.md](research/revenue-streams.md).

## 18. Activation gates

| Gate | Guards | Requires |
|---|---|---|
| **G-PROD** | Free public production site (Phase 2) | production on the Supabase free plan (D-044), with the agreed no-cost backup route running and a plan for pausing; **A7 restore drill passed** (from Phase 1) and re-run if the schema changed; latency measured and region confirmed; section 72 assessment; retention schedule approved (§9.3); Information Officer registered; privacy notice and terms for the free site; incident plan; owner-run release |
| **G-PAY** | Any live collection | Paystack written confirmation of split, settlement, refund and chargeback mechanics; **registered company and business bank account (D-049)**; **the D-050 reserve-plus-recovery process actually funded**, with Paystack confirming that recovery from future payouts works (B4 optional, not a substitute); payment terms cross-referenced against the CPA and ECTA and reviewed by both agents (D-045); A18–A36 passing; restore drill repeated; live keys only in the owner-held production environment |
| **G-PROVIDER** | Each provider taking live payments | G-PAY; production subaccount verified; provider terms accepted; honest services, resources and capacity; observed test booking |
| **G-FINES** | Integrated fines lookup | Owner-authorised outreach; production entitlement; coverage and freshness; current legal sources; POPIA (incl. section 57); DPA and security review |
| **G-REVENUE** | Each revenue experiment | Owner approval of payer, price, terms and stop criteria |
| **G-AUTO** | L2 automation | Q-017 budget; verified identities, permissions and billing; caps; stop labels; documentation-only round trip |

## 19. Main risks

1. **Zero supply nationwide.** Honest coverage, demand map, fast applications.
2. **Payment liability** (refunds and chargebacks after settlement). G-PAY with funded refunds; B4 only reduces exposure.
3. **Privacy inference** of mobile bases through search probing. Public projection, coarse inputs, rate limits, accepted remaining risk (§6.2).
4. **Capacity contention** and late payments. Exclusion constraints, holds, reconciliation (A18–A23).
5. **Fines data and legal risk.** Referrals only until G-FINES.
6. **Latency** from an EU-hosted database. Measure; cache public pages.
7. **Free-tier ceilings.** Budgets in A6/A15; Resend quota shared with auth email.
8. **Revenue demand unvalidated** (fleet, ads, Pro). Experiments behind G-REVENUE.
9. **Shared GitHub identity.** Process controls, owner-run production releases.

## 20. Owner decisions

| ID | Decision | Status / needed by |
|---|---|---|
| Q-009 | Colleague involvement | **Answered:** the two colleagues saw the presentation pack (§22); no changes (D-037) |
| Q-018 | Brand | **Answered:** Turbine logo (D-034); Studio UI direction (D-035, D-036) |
| Q-021 | Standing staging-merge permission | **Answered: yes** (merges only) |
| Q-005 | Business type and bank account for Paystack | **Answered:** company registration with cofounders, on the owner's backlog after the build; test mode until then (D-049). Needed by G-PAY |
| Q-006 | Information Officer | **Answered:** the owner (D-043); registration still due before G-PROD |
| Q-008 | Fines-partner outreach | **Answered (D-052):** referral links at launch; agents plan a partner lookup; the owner contacts partners later. G-FINES |
| Q-016 | Fee bearer **answered: A1, provider pays (D-048)**; refund funding **answered: B2, reserve plus recovery (D-050)** (B2 or validated alternative; B4 optional) | G-PAY |
| Q-017 | Production budget | **Answered for the database:** free plan, no Supabase Pro for now (D-044). Automation budget still open (G-AUTO) |
| Q-019 | GitHub Team | Optional |
| Q-022 | Binding *unpaid* reservations before G-PAY? | **Answered: no (D-051).** Price-list services book and pay now; others go enquiry → range → in-person quote → pay in app |
| Q-023 | Allow each agent's own sub-agents or parallel tasks within assigned work (no extra spend)? | **Answered: yes** (D-039) |
| — | Proposed defaults: 2-business-hour acknowledgement, 1-business-day support response, 25 km search, 15-minute hold, 7-day quote expiry, retention periods marked PROPOSED | Phase 3 / G-PROD |

## 21. What approval means

Owner approval (after Codex sign-off and colleague review) authorises:
1. The scope, architecture and roles above.
2. **Phase 1 only:** foundations on local and staging with synthetic data, subject to the §15 prerequisites.

Every later phase, gate, spending item and production release needs separate explicit owner approval.

## 22. Presentation pack for the colleagues (Phase 0b, Q-009)

A non-technical pack the owner can show the two colleagues. **Planning artefacts only, not app code.**

| Part | Content | Lead / reviewer |
|---|---|---|
| 1. One-page summary | What CarworX is, the five shortcuts, how booking and payment work, what launches first, what it costs, what's needed from the business | Claude / Codex |
| 2. Brand | The locked Turbine logo (D-034) expanded: name treatment, colour palette, type, tone of voice, sample app icon | Claude / Codex |
| 3. Layout mockups | Mobile-first images: home (5 shortcuts), search results (list and map), provider listing, booking with quote approval, checkout, provider dashboard, provider application, fines guidance. Each shown in the leading brand direction, with desktop variants for home and search | Claude / Codex (accessibility, state coverage) |
| 4. Journey walkthroughs | "Thandi books a wash" and "Pieter gets a repair quote", step by step through the mockups | Claude / Codex |
| 5. Roadmap and decisions | Phases, gates, and the decisions the business needs to make, in plain language | Claude / Codex |

**Format:** a self-contained local HTML presentation with bundled image/SVG assets and readable static exports, plus source files in `planning/design/`, suitable for the owner to present on a phone/computer or share as files. Mark mockups and copy **"concept, not final"**. Use fictional/demo names and ratings; no real endorsements, working checkout, vendor API calls, credentials, tracking or production data. Apply the required design skills for the authoring session. The pack is a planning artefact, not application UI code.

Publicly hosting the pack, changing DNS or publishing through a third-party site service requires separate explicit owner authorisation; technical sign-off does not grant it. Shareable file exports provide a fallback without public hosting. Claude creates the pack next, Codex reviews factual/state/accessibility coverage, then the owner gathers colleague feedback on the Turbine brand and layouts before deciding on Phase 1. Do not reopen the whole technical plan for purely cosmetic pack feedback; record any actual scope/contract change for review.
