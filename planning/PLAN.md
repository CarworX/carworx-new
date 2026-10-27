# CarworX — Consolidated Plan

| | |
|---|---|
| Version | **Draft 1**, 2026-10-27 |
| Drafted by | Claude (Claude 03) |
| Codex sign-off | ☐ pending |
| Owner approval | ☐ pending. Approving this plan authorises **Phase 1 only** (see §3) |
| Sources | Decisions D-001–D-022 in [DECISIONS.md](DECISIONS.md); [Claude 03](claude/03-reply.md); [Codex 02](codex/02-reply.md) |

Anything marked **OWNER DECISION** is not decided yet. Anything marked **GATE** must be satisfied before the step it guards.

---

## 1. Product

**CarworX** (carworx.app) is a South African marketplace where drivers find, enquire with, book and pay providers for car services, and get honest guidance on traffic fines and vehicle admin.

- **Who it's for:** drivers anywhere in South Africa (nationwide availability, D-001); fixed-premises and mobile providers; later, fleets.
- **Catalogue (D-008):** three groups.
  - Wash & Detailing
  - Repairs & Maintenance: servicing and mechanical, **Glass Repair & Replacement**, **Tyres & Wheel Alignment**, more later
  - Fines & Vehicle Admin: official fines referrals, plus listed admin services such as roadworthy tests and towing (a labelled referral only, no emergency promise)
- **Home page:** five equal shortcuts: Wash & Detailing · Repairs & Maintenance · Glass Repair & Replacement · Tyres & Wheel Alignment · Fines & Vehicle Admin.
- **Customer flows (D-001):** discovery and enquiry; confirmed booking; payment.
- **Money during the pilot (D-002):** no platform fees while we validate. Repairs use **quote, then pay**.
- **Supply:** starts at zero. Owner and colleague recruit, verify and run support during the pilot (D-004).

## 2. v1 scope (what the build delivers)

**In scope**
- Public site: home, category and subcategory landing pages, search with list and map, listing pages, fines and admin guidance pages, legal pages.
- Accounts: customer and provider (one person can be both), admin with MFA.
- Provider application → admin review → verification labels → live listing. Mobile providers set a radius service area around a private base.
- Enquiries (messages to a provider). "Need a provider here" demand capture, never published.
- **Fixed-price booking:** request → provider accepts within the deadline → capacity reserved → payment (when payments are activated) → confirmed → completed or cancelled.
- **Quote flow:** optional priced diagnostic booking → provider issues a versioned quote → customer approves → payment → job.
- Payments through Paystack hosted checkout with provider subaccounts. **Built and tested in Paystack test mode. Live collection stays switched off until GATE G-PAY (§18).**
- Email (Resend) plus in-app notifications, through a durable outbox.
- Reviews after a completed booking.
- Admin: application queue, claims and disputes, suspensions, bookings, refunds, support cases, audit log.
- Revenue hooks only: `platform_fee_basis` (always 0) in snapshots, and a `sponsored` flag with dates, switched off (§17).

**Out of scope for v1:** native apps, WhatsApp/SMS, integrated fines lookup, OSM or other bulk imports, wallets or escrow, subscriptions, ad serving, affiliate tracking, lead credits, insurer claims, roadside dispatch, multiple languages.

## 3. Phases and exit criteria (D-009)

| Phase | What happens | Exit criteria | Authorised by |
|---|---|---|---|
| **0. Planning** | This document | Codex sign-off and owner approval | — |
| **1. Foundations** | Repo scaffold, CI, local dev, staging environment, auth, base schema with RLS, design directions → design system, deploy to staging | §11 acceptance tests A1–A6 pass on staging | **Approving this plan** |
| **2. Discovery and applications** | Public catalogue, search and map, listings, provider application and admin review, enquiries, demand capture, fines referral pages, production deploy of the free site | A7–A14 pass. GATE G-PROD (§18) passed for the production launch | Owner, at phase start |
| **3. Bookings and quotes (test payments)** | Booking and quote flows, capacity, mobile travel, notifications, Paystack **test mode**, reviews, refunds tooling | A15–A28 pass on staging with Paystack test keys | Owner, at phase start |
| **4. Paid activation** | Live Paystack collections, per provider | GATE G-PAY passed, then each provider passes G-PROVIDER | Owner, explicitly |
| **5. Expand** | More supply, measured improvements, first revenue experiments (§17) | Owner sets targets after 4 weeks of baseline data | Owner, per experiment |

Integrated fines lookup runs as a separate track behind GATE G-FINES. It never blocks the phases above (D-003).

## 4. Architecture (D-006, D-010)

```
Browser / installable PWA
        │  HTTPS (Cloudflare edge: JNB / CPT / DUR)
        ▼
Cloudflare Worker — React Router v7 (SSR + static assets)
  ├─ request validation (Zod), auth session (Supabase JWT)
  ├─ orchestration: bookings, quotes, payments, notifications
  ├─ Paystack webhook endpoint (raw-body HMAC verification)
  ├─ Cron Triggers: expiries, reminders, outbox retries, reconciliation
  └─ Queues (only if needed) for the outbox
        │  user JWT → RLS applies            │ scoped privileged key (integration paths only)
        ▼                                     ▼
Supabase (London eu-west-2, provisional): Postgres + PostGIS, Auth, Storage (private buckets), RLS
        ▲
External: Paystack · Resend · Mapbox GL JS + geocoding (temporary, customer search only)
```

- **One server runtime** (Workers). No Supabase Edge Functions initially.
- **Database invariants** (constraints, transactions, `SELECT … FOR UPDATE` / exclusion constraints) enforce capacity, quote versions and money rules. Workers coordinate; Postgres guarantees.
- **Region:** London is provisional. **GATE before production:** measure Johannesburg/Cape Town → Supabase latency for London vs Frankfurt, and complete the POPIA section 72 transfer assessment.
- **Stack:** TypeScript (strict), pnpm, React Router v7, Tailwind, shadcn/ui, Zod, Vitest, Playwright, Supabase CLI, Wrangler. Pin mutually compatible versions at the start of Phase 1.
- **PWA:** installable, with offline mode limited to public content and a clear connectivity state. No offline payments or private data caching.

## 5. Data model (D-011)

Core entities: `profiles`, `organisations`, `branches`, `memberships` (role per organisation), `verifications`, `claims`, `listings` (with a provenance field), `categories` (three-group tree), `services`, `service_areas` (radius around a private base), `travel_fee_bands`, `availability`, `capacity_reservations`, `enquiries`, `demand_requests` (private), `quotes` + `quote_versions`, `bookings`, `payment_attempts`, `payments`, `refunds`, `disputes`, `integration_events` (deduplicated, with defined retention), `notifications` + `outbox`, `reviews`, `consents`, `support_cases`, `audit_log`.

Separate state machines, never one combined status:
- **Quote:** `draft → issued → (revised → issued)* → approved | declined | expired`
- **Booking:** `requested → accepted (capacity held) → confirmed → in_progress → completed | cancelled | expired | no_show`
- **Payment:** `not_required | pending → succeeded | failed | refunded | partially_refunded | disputed`

Rules:
- Price, fee basis, tax and cancellation terms are **snapshotted** at checkout.
- Private addresses and access notes never appear in public tables, logs or analytics.
- Only minimal payment evidence is stored. No card data.
- Raw webhook bodies are kept only as long as reconciliation needs them, with access controls.

**RLS on every table from the first migration.** Policies are tested in CI (§11).

## 6. Key flows

1. **Provider onboarding (T-17):** application → admin review (method recorded) → labels granted (*Operator/contact checked*, *Business registration checked* where relevant, *Payments enabled* as an operational state, *Visited by CarworX*) → listing live. Exact premises addresses need permission; mobile bases stay private. Claims and transfers of control get a human review; former staff access is revoked.
2. **Search:** category, location (browser location or a typed area via temporary geocoding, never stored) → PostGIS search over provider-entered pins and service radii → list first, map optional. Supply is shown honestly; an empty result offers "need a provider here".
3. **Fixed-price booking (T-18):** customer requests a slot → provider sees a deadline (2 business hours, 08:00–17:00 Mon–Sat SAST, public holidays excluded; **provisional, owner to approve**) → on acceptance, capacity is held atomically → payment, once payments are activated → confirmed. Expiry releases the hold. A late or duplicate payment goes to reconciliation and, if needed, a refund; it's never lost and never silently rebooked.
4. **Quote-then-pay (D-002, D-012):** optional priced diagnostic booking → provider issues a quote version → customer approves a specific version → payment for exactly that version → job. A revision creates a new version that needs new approval.
5. **Mobile job (T-19):** search is limited to providers whose radius covers the customer. Travel fee comes from straight-line bands, labelled as such. Provider-confirmed travel buffer; if routing is unavailable, instant confirmation is off and timing is confirmed manually. Provider sees only the suburb before confirmation, the full address after it (assigned staff only), and loses it 7 days after completion. Lawful retention is handled separately.
6. **Cancellation and refunds:** under the published terms (professional review required). Refunds go through the admin tooling, with Paystack refund status tracked through webhooks.
7. **Fines (D-013):** guidance pages plus labelled official referrals. No ID number collected. "No results" never means "no fines".

## 7. Payments (D-012; T-20 OWNER DECISION)

- Paystack **hosted checkout**, provider **subaccounts**, splits. No wallet or escrow in the pilot.
- Webhooks: HMAC SHA512 over **raw bytes** (`x-paystack-signature`); check amount, currency and reference; idempotent processing; verify status with Paystack server-side. A browser redirect never counts as proof of payment.
- Pilot platform fee: **0** (`platform_fee_basis` versioned in snapshots).
- **OWNER DECISION Q-016**, with the agents' joint recommendations:
  - Processing-fee bearer: **A1, provider bears it, fully disclosed** (gross, fees, platform fee, net).
  - Refund and chargeback funding: **B2** (auto settlement, recovery through the provider agreement, owner-approved reserve) or **B4** (pay close to the service, by payment link 48 hours before). Can be combined. B1 (weekly settlement) is not a verified solution.
- **GATE G-PAY (§18)** blocks live collection.

## 8. Notifications (D-014)

- Resend from a verified sending subdomain (e.g. `mail.carworx.app`) with SPF, DKIM and DMARC. Transactional and marketing consent are kept separate. No tracking in auth emails.
- **Outbox:** every message is a durable row with idempotent sends, retries, bounce and suppression handling.
- **In-app status is the source of truth.** Time-sensitive actions expire on their own deadlines whether or not the email went out. Operators get an alert near the Resend daily cap (100/day on the free tier) and on delivery failures.
- No SMS or WhatsApp in v1.

## 9. Security, privacy, compliance (D-021)

- RLS everywhere; tenant membership checks; admin MFA; privileged key only on integration paths; private storage with signed URLs; upload type and size limits; rate limiting (Cloudflare); log redaction; secret scanning in CI.
- POPIA:
  - Information Officer registration (owner).
  - Section 72 transfer assessment (EU/UK hosting).
  - Processor and operator agreements.
  - Consent records for marketing.
  - A retention schedule.
  - Data export and deletion handling.
  - No unique identifiers (ID numbers) in v1.
- ECTA section 43 disclosures and CPA-compliant cancellation and refund terms. **Professional legal review before paid launch.**
- Incident response plan and a **restore drill** before production with real users.
- Accessibility target: WCAG 2.2 AA.

## 10. Design and UX (T-22)

1. **Brand:** the owner supplies assets (OWNER DECISION Q-018), or Claude presents 2–3 directions as a planning artefact for the owner to choose from. This is the first task in Phase 1.
2. Screen flows for every state:
   - empty or limited supply
   - acknowledgement deadline
   - quote revision
   - travel cost
   - payment pending or failed
   - cancellation and refund
   - suspended provider
   - errors
3. Design system in code (Tailwind tokens + shadcn/ui) with a living component page. Figma optional.
4. Mobile-first: checked at 360 px on a slow-3G profile; list without map; South African English; plain language.
5. No ad placeholders during the pilot.

## 11. Acceptance tests (D-018)

Each runs in CI unless marked *manual* or *sandbox*.

**Phase 1:**
- **A1** CI runs lint, typecheck, unit tests, RLS tests and the build on every PR.
- **A2** Staging deploy from `main` succeeds.
- **A3** Sign-up, login and logout work on staging.
- **A4** RLS matrix: every table is tested as anonymous, customer, provider member, member of another provider, and admin.
- **A5** Secret scan passes.
- **A6** SSR Worker CPU measured on key routes and recorded.

**Phase 2:**
- **A7** Search returns only providers inside their radius or at their pinned location.
- **A8** Private bases and addresses never appear in public responses (automated check).
- **A9** Application → approval → live listing end to end (Playwright).
- **A10** Claim dispute and suspension flows.
- **A11** Demand capture never appears publicly.
- **A12** Fines pages contain no ID field and use correct "no results" copy.
- **A13** Lighthouse budget on the home and category pages under a mobile profile.
- **A14** *Manual:* keyboard and screen-reader pass on the core pages.

**Phase 3:**
- **A15** Two customers race for the last slot; exactly one hold succeeds.
- **A16** Hold expiry releases capacity.
- **A17** A payment arrives after expiry → reconciliation and refund path.
- **A18** Duplicate, reordered and delayed webhooks are processed exactly once.
- **A19** Wrong amount, currency or reference is rejected.
- **A20** Invalid signature is rejected; signature is checked over raw bytes.
- **A21** Quote revision invalidates the old approval; only the approved version can be paid.
- **A22** Mobile travel buffer prevents overlapping jobs; with routing disabled, instant confirmation is off.
- **A23** Address visible only to assigned staff after confirmation, and hidden 7 days after completion.
- **A24** Cancellation after payment → refund states; partial and failed refunds handled.
- **A25** Outbox: send failure is retried, nothing is duplicated, and the cap alert fires.
- **A26** Membership removal revokes access immediately.
- **A27** *Sandbox:* full Paystack test-mode flow with a test card.
- **A28** *Manual:* restore drill from backup on staging.

## 12. Repository, CI/CD, release and enforcement (D-017, T-21)

- **Monorepo:**
  - `apps/web` (React Router + Worker)
  - `supabase/` (migrations, seed, RLS tests)
  - `packages/shared`, only once actually shared
  - `planning/`
- **Environments:**
  - local (Supabase CLI + Wrangler dev)
  - **staging** (`staging.carworx.app`, Supabase free project, Paystack test keys)
  - **production** (`carworx.app`, Supabase Pro once approved)
- **Process controls** (GitHub Free can't enforce them; D-019 / T-21):
  - Branches `claude/*` and `codex/*`.
  - `Agent:` commit trailer.
  - A PR template with author, reviewer and verdict.
  - The reviewer posts `REVIEW: APPROVE|CHANGES @<sha>`.
  - Nobody approves their own work.
- **Merges and releases:**
  - **Merges into `main` need owner permission.** OWNER DECISION Q-021: the owner may grant *standing permission* for the reviewing agent to merge staging-only PRs once CI is green and approval is recorded.
  - **Production releases are run by the owner.** The production Cloudflare token and Paystack live keys are never in any environment an agent can access.
- Optional later: GitHub Team for branch protection and required checks (Q-019). It does **not** provide private-environment reviewers.

## 13. Who does what (D-015)

| Area | Lead | Reviewer |
|---|---|---|
| Product flows, `PLAN.md` editor | Claude | Codex |
| Architecture and contracts | Claude drafts, both approve | Codex |
| Schema, migrations, RLS | Claude | Codex |
| Design system, UI, accessibility, copy | Claude | Codex |
| Workers: payments, booking orchestration, email, cron | Codex | Claude |
| CI, environments, deployment scripts, restore drill | Codex | Claude |
| Integration, concurrency and adversarial test strategy | Codex | Claude |
| Tests for each change | Its author | The other agent |
| Security-sensitive changes | Assigned author | The other agent (always) |
| Recruitment, contracts, support, refunds decisions | Owner + colleague | Agents prepare material |

**Agents and tools.** No extra runtime LLM in the product.
- Claude uses Plan and Explore sub-agents, `/code-review`, `/security-review`, the browser for checking staging, and the Cloudflare and Supabase skills.
- Codex uses its own scoped worker and reviewer tasks and `@codex review` once enabled.
- Overlapping edits are avoided by assigning files per task.

## 14. Working autonomously (D-019)

| Level | What the owner does | When |
|---|---|---|
| **L1 (now)** | Says "your turn" to the agent named in `STATUS.md` | Planning, early Phase 1 |
| **L1+** | Grants Q-021 standing staging-merge permission. Agents then work through a GitHub issue backlog in turns; the owner only does releases | From Phase 1, if approved |
| **L2** | Installs the Claude GitHub App + `claude-code-action` (with `allowed_bots` set deliberately), enables Codex cloud and code review. Agents hand off via mentions, capped at 3 rounds, with `paused` / `needs-owner` labels as stop switches | Only after Q-017 budget approval and one successful **documentation-only round trip** |

The backlog for each phase becomes GitHub issues labelled `phase-N`, `owner:claude|codex`. Issues hold acceptance criteria referencing §11.

## 15. Accounts the owner must set up (D-020)

In order. Agents never create accounts, change DNS or handle live secrets.

1. **Cloudflare:** confirm the `carworx.app` zone, create a staging Worker route, and a scoped staging API token stored as a GitHub secret. *(Phase 1)*
2. **Supabase:** organisation plus a **staging** project (free). Production project later. *(Phase 1)*
3. **Resend:** account, verify the sending subdomain through Cloudflare DNS. *(Phase 1)*
4. **Mapbox:** account, public token restricted to carworx.app and staging. *(Phase 2)*
5. **Paystack:** business account (sole proprietor or company; Q-005), **test keys** for staging. Send the support questions in `research/codex-vendor-access.md`, including settlement schedule and payment-link splits. *(Phase 3; live only at G-PAY)*
6. **Information Regulator:** register the Information Officer (Q-006). *(Before the production launch)*
7. **Attorney:** review terms, privacy, refund and the merchant role. *(Before G-PAY)*
8. **Fines partner:** outreach only with owner permission (Q-008). *(G-FINES track)*

## 16. Costs (D-016)

| Item | Phases 1–3 | From production / paid launch | Notes |
|---|---|---|---|
| Supabase | Free | **Pro, from US$25/month** | Free has no backups and pauses idle projects |
| Cloudflare Workers | Free | **Paid, US$5/month minimum** if SSR exceeds 10 ms CPU (measured in A6) | |
| Resend | Free (3k/month, 100/day) | US$20/month at volume | |
| Mapbox | Free (50k map loads) | Usage-based | Pin-drop avoids permanent-geocoding fees |
| Paystack | Test mode, free | Per transaction (SA cards 2.9% + R1 excl. VAT at research time) | Bearer per Q-016 |
| GitHub Team (optional) | — | Per seat per month | Q-019 |
| Agent automation (L2) | — | API and Actions usage | Q-017 |
| Attorney review | — | Once-off, quote needed | **Strongly recommended** |
| Refund reserve (B2) | — | Owner-funded amount sized to outstanding paid obligations | Q-016 |
| Marketing | Owner's budget | | |

Recheck all prices before purchase. No spend is approved by this plan.

## 17. Monetisation roadmap (separate from build scope; T-23, T-24, D-022)

The pilot stays free (D-002). Experiments start only with owner approval, each with a payer, price, fee basis, refund terms and stop criteria.

| Order | Experiment | Build needed |
|---|---|---|
| 1 | Completed-job commission on paid bookings, through the Paystack split percentage. Capped per job for repairs | Fee-basis version is already in the snapshot |
| 2 | Manual labelled sponsored placement: at most one per results page, in-area and verified only | `sponsored` flag + dates (built, switched off) |
| 3 | Fleet / small-business accounts. **The strategic bet**, after supply plus integrated fines | New project |
| 4+ | Provider Pro, affiliates, acquisition fee (alternative to 1), lead fees (deprioritised), programmatic ads (lowest; guides only) | Per experiment |

**Never:** sale of personal data, pay-to-verify badges, ads on auth, quote, checkout, booking, refund, dashboard or fines-result screens, ads in transactional emails, or regulated financial referrals without licensed partners.

Revenue reporting separates booked value, completed net value, fees billed, fees reversed and collected platform revenue. Provider funds that pass through are not CarworX revenue; get accounting advice on VAT and whether CarworX acts as principal or agent.

## 18. Activation gates

| Gate | Guards | Requires |
|---|---|---|
| **G-PROD** | Public production launch (free site) | Latency measured and region confirmed; section 72 assessment; Information Officer registered; privacy policy and terms published; Supabase Pro (backups); restore drill (A28) passed; incident plan; owner-run release |
| **G-PAY** | Any live collection | Paystack written confirmation of split, settlement, refund and chargeback mechanics for this marketplace; owner decision Q-016 made and funded; attorney-reviewed terms; A15–A27 passing; live keys only in the owner-held production environment |
| **G-PROVIDER** | Each provider taking live payments | G-PAY passed; production subaccount verified; provider terms accepted; honest services and capacity; observed test booking |
| **G-FINES** | Integrated fines lookup | Owner-authorised outreach; production entitlement; coverage and freshness disclosed; POPIA assessment, including section 57; DPA and security review |
| **G-REVENUE** | Each monetisation experiment | Owner approval of payer, price, terms and stop criteria |
| **G-AUTO** | L2 automation | Q-017 budget; allowlisted identities; caps; stop labels; successful documentation-only round trip |

## 19. Main risks

1. **Zero supply nationwide.** Mitigation: honest coverage, demand map to direct recruitment, a fast application flow.
2. **Payment liability** (refunds and chargebacks after settlement). Mitigation: G-PAY, B2/B4, an attorney.
3. **Data quality and legal risk in fines.** Mitigation: referrals only until G-FINES.
4. **Latency** from an EU-hosted database. Mitigation: measure, edge caching of public pages, few round trips per request.
5. **Free-tier ceilings** (Worker CPU, Resend daily cap, Supabase pausing). Mitigation: measurements in A6 and A25, upgrade at G-PROD.
6. **Shared GitHub identity.** Mitigation: process controls, owner-run releases, secrets out of agent reach.

## 20. Owner decisions still open

| ID | Decision | Needed by |
|---|---|---|
| Q-005 | Business type and bank account for Paystack | Phase 3 (test keys), G-PAY (live) |
| Q-006 | Information Officer registration | G-PROD |
| Q-008 | Permission for fines-partner outreach | G-FINES |
| Q-009 | Does the colleague need to sign off? | Plan approval |
| Q-016 | Fee bearer (A1 recommended) and refund funding (B2 and/or B4) | G-PAY |
| Q-017 | Production and automation budget | G-PROD / G-AUTO |
| Q-018 | Brand assets, or choose from directions | Start of Phase 1 |
| Q-019 | GitHub Team (optional) | Any time |
| Q-021 | Standing permission to merge staging-only PRs | Start of Phase 1 |
| — | Provisional service targets (2 business hours to acknowledge, 1 business day for first support response) | Phase 3 |

## 21. What the owner approves

Approving this plan means:
1. The scope, architecture and roles above.
2. **Starting Phase 1** (foundations, on staging only).
3. Nothing else. Each later phase, every gate in §18 and every spending item still needs its own explicit owner approval.
