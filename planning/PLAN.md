# CarworX — Consolidated Plan

| | |
|---|---|
| Version | **Draft 2.1 — technically signed**, 2026-10-27 (draft 2 reviewed at `953fb08`; final clarifications in [Codex 04](codex/04-reply.md)) |
| Drafted by | Claude ([Claude 04](claude/04-reply.md)), incorporating [Codex 03](codex/03-reply.md) R1–R8 and T-23 |
| Codex sign-off | ☑ Codex, 2026-10-27: R1–R8 resolved; technical plan and §22 pack scope accepted with the recorded 2.1 clarifications. This is not owner approval or permission to build the application. |
| Colleague review | ☐ pending: the presentation pack (§22) is shown to the owner's two colleagues |
| Owner approval | ☐ pending. Approving authorises **Phase 1 only** (§3) |
| Sources | D-001–D-033 in [DECISIONS.md](DECISIONS.md) |

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
- Accounts: customer and provider (one person can be both); admin with server-enforced MFA.
- Provider application → admin review → verification labels (D-023) → live listing. Mobile providers set a radius around a private base.
- Enquiries. Private "need a provider here" demand capture.
- Fixed-price booking and quote-then-pay flows (§6) with resource-based capacity, holds and versioned quotes.
- Paystack hosted checkout with subaccount splits, **built and tested in test mode only**.
- Email (Resend) plus in-app notifications through an outbox.
- Reviews; admin tools for the application queue, claims, suspensions, bookings, refunds, disputes, support and the audit log.
- Fee snapshot fields: `fee_policy_version`, `fee_basis = 'none'`, `platform_fee_amount_minor = 0` (ZAR integer cents).

**Production before G-PAY:** discovery, applications, enquiries and fines referrals only. **Confirmed bookings without payment are switched off by default** (D-032). A binding unpaid-reservation mode would need its own owner decision and terms (Q-022).

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
| **0b. Presentation pack** | Brand directions plus layout mockups plus a plain-language summary (§22) | Owner has shown the colleagues; feedback folded in | Owner (planning artefacts, no app code) |
| **1. Foundations** | Repo scaffold, CI, local dev, staging, auth, the first tables with RLS, design system from the chosen direction, deploy to staging. Synthetic data only. **No Paystack or Mapbox needed** | A1–A6 and **A7 (restore drill: database plus storage objects)** pass on staging | **Owner approval of this plan**, plus the §15 Phase 1 prerequisites |
| **2. Discovery and applications** | Catalogue, search, listings, applications, admin review, enquiries, demand capture, fines referral pages. **Production launch of the free site** | A8–A17 pass; GATE G-PROD passed | Owner, at phase start; Q-017 budget **before** the production launch |
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

- One server runtime. **Postgres guarantees invariants:** exclusion constraints on resource intervals, unique constraints on idempotency keys, and transactions for holds, payments and refunds.
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
- Each slot belongs to a **resource** (bay, team or calendar). v1 allows **one job per resource**, using half-open UTC intervals `[start, end)` that include duration plus turnaround or travel buffer, enforced by an exclusion constraint. Times are shown in Africa/Johannesburg. Pooled capacity and overbooking are deferred.
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
Handled under published terms (an attorney reviews them before G-PAY). Admin refund tools record each refund as its own entry, with status updated by webhooks and reconciliation.

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
  - **Processing-fee bearer:** **A1, provider bears it, fully disclosed**, is the joint recommendation.
  - **Refund and chargeback funding:** an **owner-approved funded refund and chargeback process** (B2, a reserve plus provider recovery, or another mechanism validated by Paystack and a professional). It can *optionally* be combined with **B4** (pay closer to the service). B4 reduces exposure but **is not funding**.
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
- Admin MFA enforced on the server.
- Cookie sessions (§4); origin and CSRF checks on mutations; redirect allowlist; no shared caching of personal responses.
- Private storage buckets, upload type and size limits, **signed URLs that expire within 10 minutes** (PROPOSED DEFAULT).
- Rate limiting; log redaction (no addresses, access notes, coordinates or tokens); secret scanning in CI.

### 9.2 POPIA and consumer law
- Information Officer registered (owner); section 72 assessment; operator agreements; consent records.
- No ID numbers in v1.
- ECTA section 43 and CPA disclosures. **Attorney review** of the terms before G-PAY, plus a privacy notice and terms suitable for the free site before G-PROD.

### 9.3 Retention schedule (must be approved before G-PROD; synthetic data until then)

| Data | Purpose | Who can access | Deletion trigger → period |
|---|---|---|---|
| Profiles | Account | Self, admin | Account closure → **TBD (attorney)** |
| Customer addresses and access notes | Fulfilment | Customer, assigned staff (7 days), admin (audited) | Job completion → **TBD (attorney)**, kept longer only while a dispute is open |
| Mobile base location | Matching | Provider owner, admin | Listing removal → 30 days (PROPOSED) |
| Enquiries, demand requests | Service, recruitment | Parties, admin | Last activity → 12 months (PROPOSED) |
| Verification evidence | Trust labels | Admin | Label granted → method record kept; raw evidence deleted ≤30 days (PROPOSED) |
| Logs (redacted) | Operations | Operators | 30 days (PROPOSED) |
| Outbox, notifications | Delivery | System, admin | 90 days (PROPOSED) |
| Integration events (raw) | Reconciliation | System, admin | Reconciled → 90 days (PROPOSED) |
| Reviews, support cases | Trust, service | Per RLS | **TBD** |
| Financial records | Tax and accounting | Admin | **TBD (accountant; SA requirements)** |

Backups follow the provider's backup window. Legal-hold overrides are recorded. Implementers don't invent the TBD periods.

### 9.4 Readiness
Incident response plan; restore drill (A7); WCAG 2.2 AA.

## 10. Design and UX (D-028)

- **Brand:** no assets yet (Q-018). Claude proposes **2–3 provisional directions** in the presentation pack (§22). The owner chooses, with colleague feedback, before Phase 1 design-system work.
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
- **A3** Sign-up, login and logout work; the session is validated on the server; revoked membership stops access on the next request.
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
- **A18** Two customers race for one resource interval; exactly one hold succeeds.
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

**Later:**
- Mapbox token, restricted by URL (Phase 2)
- Supabase production project and budget (Q-017, before the Phase 2 production launch)
- Paystack account and test keys, plus the support questions in `research/codex-vendor-access.md` (Phase 3; live keys only at G-PAY)
- Information Officer registration (G-PROD)
- Attorney (terms for G-PROD, payment terms for G-PAY)
- Accountant (retention and VAT)
- Fines partner (G-FINES, Q-008)

Agents never create accounts, change DNS or handle production secrets.

## 16. Costs (D-016)

| Item | Phases 0–1 | Needed from | Notes |
|---|---|---|---|
| Supabase | Free (staging) | **Pro, from US$25/month, proposed as a G-PROD prerequisite** (backups, no pausing) | Q-017 approval **before the Phase 2 production launch** |
| Cloudflare Workers | Free | US$5/month **only if** the A6/A15 budget fails and the owner approves | No automatic upgrade |
| Resend | Free (3k/month, 100/day, shared with auth email) | US$20/month at volume | |
| Mapbox | Free | Usage-based | |
| Paystack | Test mode | Per transaction (SA cards 2.9% + R1 excl. VAT at research time), bearer per Q-016 | |
| Attorney / accountant | — | Before G-PROD / G-PAY | Quotes needed |
| Refund reserve | — | G-PAY, if B2 is chosen | Sized to outstanding paid obligations and dispute exposure |
| GitHub Team, automation | — | Optional (Q-019, G-AUTO) | |
| Marketing | Owner's budget | | |

Recheck prices before buying. **This plan approves no spending.**

## 17. Monetisation roadmap (T-23 as amended, D-029, D-031)

The pilot stays free. Each experiment needs G-REVENUE approval: payer, price, fee basis, refunds and stop criteria. The order below is a **test order of hypotheses**, not proof of willingness to pay.

1. **Commission on paid bookings.** Collected through the split at payment time, but it needs rules for *earned* versus *collected* fees, reversals on cancellation, refund or dispute, and reconciliation. That's real work. Capped repair commission is an experiment, not an agreed rate.
2. **Manual, labelled contextual sponsorship.** Within the D-029 boundaries. Data model and serving are built **in the experiment**, with eligibility, scope, labels, dates, suspension and reporting.
3. **Fleet / small-business scheduling and reporting.** A hypothesis worth testing early on supply value alone. **No dependency on integrated fines**; fines could become an optional later module behind G-FINES.
4. **Then:** Provider Pro (once tools show real value), affiliates, acquisition fee (an alternative to 1, never stacked with it), lead fees (deprioritised), programmatic ads on guides (lowest priority).

**Never:** selling personal data; pay-to-verify badges; ads on sensitive flows or in transactional email; regulated financial referrals without licensed partners.

Reporting keeps booked value, completed net value, fees billed, fees reversed and collected revenue separate. Get accounting advice on whether CarworX acts as principal or agent, and on VAT. Full options: [revenue-streams.md](research/revenue-streams.md).

## 18. Activation gates

| Gate | Guards | Requires |
|---|---|---|
| **G-PROD** | Free public production site (Phase 2) | Q-017 budget approved; production backups provisioned (Supabase Pro proposed); **A7 restore drill passed** (from Phase 1) and re-run if the schema changed; latency measured and region confirmed; section 72 assessment; retention schedule approved (§9.3); Information Officer registered; privacy notice and terms for the free site; incident plan; owner-run release |
| **G-PAY** | Any live collection | Paystack written confirmation of split, settlement, refund and chargeback mechanics; **owner-approved funded refund and chargeback process** (B4 optional, not a substitute); attorney-reviewed payment terms; A18–A36 passing; restore drill repeated; live keys only in the owner-held production environment |
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
| Q-009 | Colleague involvement | **Answered:** the two colleagues see the presentation pack (§22) before approval |
| Q-018 | Brand | **Answered:** none yet; choose from directions in §22 |
| Q-021 | Standing staging-merge permission | **Answered: yes** (merges only) |
| Q-005 | Business type and bank account for Paystack | Phase 3 test keys; G-PAY |
| Q-006 | Information Officer | G-PROD |
| Q-008 | Fines-partner outreach | G-FINES |
| Q-016 | Fee bearer (A1 recommended); funded refund process (B2 or validated alternative; B4 optional) | G-PAY |
| Q-017 | Production budget (Supabase Pro proposed) | **Before the Phase 2 production launch** |
| Q-019 | GitHub Team | Optional |
| Q-022 (new) | Binding *unpaid* reservations before G-PAY? Default: **no** | Phase 3, if wanted |
| Q-023 (new) | Allow each agent's own sub-agents or parallel tasks within assigned work (no extra spend)? | Phase 1 |
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
| 2. Brand directions | 2–3 provisional directions: name treatment, colour palette, type, tone of voice, sample app icon | Claude / Codex |
| 3. Layout mockups | Mobile-first images: home (5 shortcuts), search results (list and map), provider listing, booking with quote approval, checkout, provider dashboard, provider application, fines guidance. Each shown in the leading brand direction, with desktop variants for home and search | Claude / Codex (accessibility, state coverage) |
| 4. Journey walkthroughs | "Thandi books a wash" and "Pieter gets a repair quote", step by step through the mockups | Claude / Codex |
| 5. Roadmap and decisions | Phases, gates, and the decisions the business needs to make, in plain language | Claude / Codex |

**Format:** a self-contained local HTML presentation with bundled image/SVG assets and readable static exports, plus source files in `planning/design/`, suitable for the owner to present on a phone/computer or share as files. Mark mockups and copy **"concept, not final"**. Use fictional/demo names and ratings; no real endorsements, working checkout, vendor API calls, credentials, tracking or production data. Apply the required design skills for the authoring session. The pack is a planning artefact, not application UI code.

Publicly hosting the pack, changing DNS or publishing through a third-party site service requires separate explicit owner authorisation; technical sign-off does not grant it. Shareable file exports provide a fallback without public hosting. Claude creates the pack next, Codex reviews factual/state/accessibility coverage, then the owner gathers colleague feedback and chooses the brand before deciding on Phase 1. Do not reopen the whole technical plan for purely cosmetic pack feedback; record any actual scope/contract change for review.
