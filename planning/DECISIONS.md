# Decisions log

Only decisions that are **AGREED** by both agents, or decided by the owner, go here. See `PROTOCOL.md` rule 4.

| ID | Topic | Decision | Agreed by | Links |
|---|---|---|---|---|
| D-000 | — | Owner-fixed constraints: South Africa; Supabase; Cloudflare Workers; Resend; Mapbox; Paystack; carworx.app; customers book and pay in-app; free tiers first with paid items flagged. | Owner | Owner brief, 2026-10-27 |
| D-001 | T-03 | Nationwide availability; discovery/enquiries, bookings and payments; fixed and mobile providers; starting with no existing provider network. Availability and verification design remain proposed. | Owner | Codex chat answers, 2026-10-27; [owner record](OWNER-QUESTIONS.md) |
| D-002 | T-07, T-11 | Validate before charging platform fees; quote then pay for uncertain repairs. Processing fees and their allocation still need resolution. | Owner | Codex chat answers, 2026-10-27; [owner record](OWNER-QUESTIONS.md) |
| D-003 | T-08 | Official fines referrals may launch before integrated lookup; unavailable production fines access need not delay public launch. | Owner | Codex chat answers, 2026-10-27; [owner record](OWNER-QUESTIONS.md) |
| D-004 | T-18 | Owner and colleague handle provider recruitment/verification and complaints, cancellations and refunds during the pilot. Specific duties/procedures remain to be planned. | Owner | Codex chat answers, 2026-10-27; [owner record](OWNER-QUESTIONS.md) |
| D-005 | Planning publication | Publish the independent Codex baseline, response, evidence/checklist and shared planning updates; no application code, accounts, workflows, deployment or paid automation. Consolidated build plan still requires separate approval. | Owner | Approval in Codex chat: "Implement the proposed plan", 2026-10-27; [approved publication scope](codex/01-reply.md) |
| D-006 | T-04 | React Router v7 framework mode on Cloudflare Workers, TypeScript, Tailwind, shadcn/ui and an installable PWA. No offline payment capability is implied. | Claude proposal + Codex AGREE | [Claude 01 T-04](claude/01-opening-proposal.md), [Codex 01 T-04](codex/01-reply.md) |

| D-007 | T-01 | Protocol as written plus Codex's six amendments (PROTOCOL §8). | Claude proposal + Codex changes + Claude accept | [Codex 01](codex/01-reply.md), [Claude 02](claude/02-reply.md) |
| D-008 | T-02 | Catalogue has three groups (Wash & Detailing; Repairs & Maintenance incl. Glass and Tyres & Wheel Alignment; Fines & Vehicle Admin). Home shows **five equal shortcuts**: Wash & Detailing, Repairs & Maintenance, Glass Repair & Replacement, Tyres & Wheel Alignment, Fines & Vehicle Admin. Each subcategory has its own landing page. Fixed configuration, no configurable homepage. South African spelling ("tyre"). | Claude + Codex | as above |
| D-009 | T-03 | Codex's six-step sequence: plan and prerequisites → foundations/staging → nationwide discovery, applications, enquiries and fines referrals → verified bookings/quotes with test payments → paid activation behind gates → expand using pilot evidence. Supply shown honestly, with "need a provider here" demand capture. | Claude + Codex (+ owner scope D-001) | as above |
| D-010 | T-05 | Workers handle SSR, validation, orchestration, integrations, webhooks and background jobs. Supabase handles Postgres/PostGIS, Auth, Storage and RLS. Database constraints and transactions enforce capacity, quote-version and money rules. Ordinary requests use the user's JWT; the privileged key only in narrowly scoped integration code. No Supabase Edge Functions initially. Region provisionally London `eu-west-2`, pending latency measurement and a transfer assessment. | Claude + Codex | as above |
| D-011 | T-06 | Data model per Claude 01 plus Codex additions (organisations, branches, memberships, verification/claims, versioned quotes, capacity reservations, service areas/travel charges, payment attempts, refunds/disputes, deduplicated integration events; non-exclusive roles; separate quote/booking/fulfilment/payment states; checkout snapshots; minimal payment evidence with defined retention). One-branch organisations by default, multi-branch supported in the schema. | Claude + Codex | as above |
| D-012 | T-07 | Paystack hosted checkout with direct split settlement, subject to Paystack approval. No wallet or escrow in the pilot. Priced diagnostics and customer-approved quotes for uncertain repairs; full payment for fixed-price services once availability is confirmed. Webhook signature over raw bytes, amount/currency/reference checks, idempotency, server-side verification. Open money questions continue under T-20. | Claude + Codex (+ owner D-002) | as above |
| D-013 | T-08 | Launch with labelled official fines referrals and no ID collection; no scraping; integrated lookup separately gated (EasyPay beta, Syntell/PayCity, Fines SA as candidates; outreach needs owner permission). "No results" never shown as "no fines". | Claude + Codex (+ owner D-003) | as above |
| D-014 | T-09 | Resend plus in-app notifications; transactional outbox, idempotent sends, retries, bounce handling; queue instead of dropping mail at the free-tier daily cap; verified sending subdomain with SPF/DKIM/DMARC; provider acknowledgement required. SMS/WhatsApp deferred. | Claude + Codex | as above |
| D-015 | T-10 | Lead/reviewer table as in Codex 01 T-10. Each implementer writes its own tests; the other agent reviews every change, including Claude's security work. No extra agents for planning; scoped sub-agents later if authorised. | Claude + Codex | as above |
| D-016 | T-11 | Free-first development; Supabase Pro and Workers Paid are candidate launch costs, not approved spend; backup/restore and availability approved before paid activation; recheck live prices before any purchase. | Claude + Codex | as above |
| D-017 | T-12 | Small pnpm monorepo, strict TypeScript, local/staging/production isolation, application PRs, owner-controlled releases, separate agent branches; shared packages only where justified. Enforcement gap continues under T-21. | Claude + Codex | as above |
| D-018 | T-13 | Test scope as in Codex 01 T-13, including concurrency, RLS cross-tenant, payment event ordering, refunds, WCAG 2.2 AA, slow network, Worker CPU, secret scanning and a restore drill. | Claude + Codex | as above |
| D-019 | T-14 | Manual owner-triggered baton turns now. Automation only after an authorised documentation-only round trip with allowlisted identities, caps and stop labels. | Claude + Codex | as above |
| D-020 | T-15 | Vendor/account inventory per Codex's vendor checklist; no account creation, DNS, credentials, outreach or purchases without owner authorisation. Paystack sole-proprietor option exists; marketplace fit unverified. | Claude + Codex | as above |
| D-021 | T-16 | Security and compliance baseline per Claude 01 plus Codex's additions (tenant checks, admin MFA, private storage, log redaction, retention/deletion/export, incident and restore procedures, proper POPIA assessment, professional review of terms before paid launch; towing as a labelled referral only). | Claude + Codex | as above |

T-17 to T-22 remain open. Owner approval of publication is not permission to build.

## Round 02 owner direction

| ID | Topic | Decision | Agreed by | Links |
|---|---|---|---|---|
| D-022 | T-23, T-24 | Include a broad revenue assessment, including website advertising, in this planning round. Existing free validation remains; no pricing, ad activation, billing, outreach or data sales are approved. | Owner | Codex chat, 2026-10-27: "Your turn, include various revenue streams..."; [Codex 02](codex/02-reply.md) |

T-17–T-22 amendments and new T-23/T-24 proposals remain pending Claude acceptance and applicable owner activation decisions. No additional assistant agreement is claimed in this round.

## Round 03 agreements

| ID | Topic | Decision | Agreed by | Links |
|---|---|---|---|---|
| D-023 | T-17 | Consent-based applications, admin review, private demand capture, import deferred, provenance, claim review by a human, suspension. Labels: "Operator/contact checked" (method plus audit record, no raw ID stored just for a badge), "Business registration checked" only where relevant, "Payments enabled" as an operational state, "Visited by CarworX". Premises addresses need permission; mobile bases stay private. | Claude + Codex changes + Claude accept | [Codex 02](codex/02-reply.md), [Claude 03](claude/03-reply.md) |
| D-024 | T-18 | Provider acceptance and capacity hold before payment; expiry cancels holds, not paid bookings; deadline shown to customers, public holidays counted; late/duplicate payments reconciled, never lost; per-provider activation plus all global gates; safety/fraud means pause and investigate; service targets provisional for the owner. | Claude + Codex changes + Claude accept | as above |
| D-025 | T-19 | Radius-only service area in v1; straight-line travel bands labelled as such; provider-confirmed buffers; no automatic speed fallback (manual timing confirmation if routing fails); full address to assigned staff only after confirmation, provider view hidden 7 days after completion, separate from lawful retention; audited admin access. | Claude + Codex changes + Claude accept | as above |
| D-026 | T-20 (partial) | Planning default: no live collections until Paystack confirms split/settlement/refund/chargeback mechanics in writing and the owner approves a funded refund process. Weekly settlement (B1) is not a verified solution. Fee bearer and funding remain owner decision Q-016. | Claude + Codex | as above |
| D-027 | T-21 | Process controls (prefixed branches, `Agent:` trailers, review records tied to a commit), recorded rather than enforced. Merges and releases need owner permission. GitHub Team gives branch protection but not private-environment reviewers. Production credentials stay outside agent-accessible environments; production releases are run by the owner. | Claude + Codex changes + Claude accept | as above |
| D-028 | T-22 | Brand inputs or 2–3 directions; planning artefacts before UI code; contracts can proceed alongside design; full state coverage (supply, deadlines, quote revisions, travel, payment, refund, accessibility); five shortcuts; sponsored labels; no empty ad space during the pilot. | Claude + Codex changes + Claude accept | as above |
| D-029 | T-24 | Advertising boundaries as in Codex 02 T-24: max one sponsored card per results page plus one public-page banner in a future test, sensitive flows excluded, manual contextual first, no third-party tracking on sensitive flows, publisher-net measurement, no CPM sales from render counts. No activation approved. | Codex proposal + Claude AGREE | as above |

Still open: T-20 owner decision (Q-016, now including option B4); T-23 (Claude's ranking and v1 build boundary await Codex); review of PLAN.md draft 1.

## Round 03 Codex review state — not a new agreement

PLAN draft 1 reviewed at `2a92499842dee1d7df16e1d404c51d5db8a3a3ca`: **CHANGES REQUIRED** per [Codex 03](codex/03-reply.md), R1–R8. T-20 B4 cannot replace funded refunds; T-23 ranking/build-boundary amendments remain pending Claude acceptance. Proposed technical defaults and budgets are not owner-approved decisions. Existing D-001–D-029 remain the agreement/owner record; no consolidated build approval or additional consensus is claimed.

## Round 04

| ID | Topic | Decision | Agreed by | Links |
|---|---|---|---|---|
| D-030 | Q-009, Q-018, Q-021 | No brand assets yet: provisional directions, owner chooses. Standing permission for the reviewing agent to merge staging-only PRs after green CI and an approval recorded for the exact commit (merges only; production releases incl. Supabase migrations stay owner-run). Two non-technical colleagues see a presentation pack with brand directions and layout images before approval → Phase 0b, PLAN §22. | Owner | Claude chat 2026-10-27; [OWNER-QUESTIONS](OWNER-QUESTIONS.md) |
| D-031 | T-20 (B4), T-23 | B4 is optional exposure reduction, not funding, and deferred from the first build; if adopted, use a CarworX payment-due action initialising the normal hosted split transaction. Revenue as amended by Codex 03: test order of hypotheses; fleet without a fines dependency; earned vs collected commission rules; `fee_policy_version` + `fee_basis='none'` + `platform_fee_amount_minor=0`; no dormant sponsorship fields. | Codex changes + Claude accept | [Codex 03](codex/03-reply.md), [Claude 04](claude/04-reply.md) |
| D-032 | PLAN R1–R8 | PLAN draft 2 incorporates R1–R8 as specified in Codex 03 (restore drill in Phase 1, tables by phase, search/privacy defaults and public projection, resource/hold/quote contracts, unpaid confirmed bookings off by default, at-least-once events with at-most-once effects, Resend 24-hour window, funded-refund wording, retention/security/performance budgets, authority scope). The proposed defaults stay changeable by the owner. | Codex changes + Claude accept | as above |

PLAN draft 2 still needs **Codex sign-off**, then the presentation pack (§22), then owner approval.
