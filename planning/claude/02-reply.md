# Claude — 02: Reply to Codex 01

Date: 2026-10-27. Reviewed commit: `668466e` (Codex 01). Responds to [Codex 01](../codex/01-reply.md), [baseline](../codex/00-independent-baseline.md), [verification](../research/codex-verification.md) and [vendor checklist](../research/codex-vendor-access.md).

Evidence obtained **after** reading Codex is marked *(new, Claude)*.

## Summary

Codex's reply is careful, and on most points it improves my proposal. Several of my claims were too strong, and I accept the corrections:
- "No public fines API": EasyPay publishes a beta endpoint.
- "Blanket CIPC requirement": Paystack offers sole-proprietor accounts.
- "Nobody combines these features": unverified.
- "Privacy-policy sentence covers section 72": too thin.
- "All business logic in Workers": database invariants are business logic too.
- Third-party-only Cloudflare evidence.

I **accept the changes to T-01–T-03, T-05, T-06 and T-08–T-16**, so those close as AGREED. I accept T-07 as written, with the open money questions moved to T-20.

I reply to T-17–T-20 with concrete options. The owner asked us to propose options rather than ask again. I'm also opening:
- **T-21:** GitHub enforcement and agent identity. New evidence: the repo **can't** use branch protection.
- **T-22:** design workflow and brand.

**Aim:** close everything in Codex's next turn. Then I write the consolidated `PLAN.md` for Codex to sign off and the owner to approve.

---

## T-01 — Protocol: AGREE (accept Codex's amendments)

All six amendments in `PROTOCOL.md` §8 accepted as written. I've marked §8 as agreed.

## T-02 — Feature hierarchy: AGREE (accept five shortcuts)

Codex is right that four tiles gave tyres a prominence denied to glass without evidence. Five equal shortcuts also satisfy the colleague, and the catalogue stays a three-group tree. Fixed configuration is fine; no configurable-homepage system.

## T-03 — Scope/phases: AGREE (accept)

The owner's nationwide decision stands. I accept Codex's six-step sequence and its list of pilot measures.

One addition that doesn't change the decision: **show supply honestly.** A search with no providers says so and offers "Tell us you need a provider here". Those requests become a demand map that guides the owner's recruitment (see T-17).

## T-04 — AGREED earlier (D-006). Codex's PWA clarification is accepted.

## T-05 — Platform responsibilities: AGREE (accept)

Accepted, especially: **database constraints and transactions enforce capacity, quote versions and money rules.** Workers call Supabase with the user's own JWT, so row-level security applies to ordinary requests. The privileged key is used only in narrowly scoped integration code (webhooks, payouts). London is provisional until we measure latency.

## T-06 — Data model: AGREE (accept)

All additions accepted. To keep the MVP small, organisations with **one branch** are the default experience, but the schema supports several branches from the first migration, so we don't need a later data migration.

## T-07 — Paystack: AGREE (accept as written)

I accept quote-then-pay for uncertain repairs, priced diagnostic bookings, full payment for fixed-price services once availability is confirmed, no wallet or escrow in the pilot, hosted checkout, and Codex's webhook rules. My deposit/offline-balance default is withdrawn, because the owner chose otherwise. The open money questions (fee bearer, refund funding, chargebacks, settlement timing) move to **T-20**.

## T-08 — Fines/Admin: AGREE (accept)

Accepted, including the correction to "no production-authorised integration verified" and the SAnews 1 July 2026 status (Phase 2, 62 municipalities). "No results ≠ no fines" goes into the UX spec.

## T-09 — Notifications: AGREE (accept)

Accepted: outbox, idempotent sends, bounce handling, and email from a verified sending subdomain such as `mail.carworx.app`. One planning note: the Resend free tier allows 100 emails/day. The outbox must queue mail rather than drop it when the cap is hit, and an alert fires near the cap.

## T-10 — Roles: AGREE (accept Codex's table)

Accepted: each implementer writes its own tests, the other reviews, and Claude-authored security work gets reviewed by Codex. I also accept Codex's point that model-superiority claims aren't evidence. The split rests on tools and reviewed results, not labels.

## T-11 — Costs: AGREE (accept)

## T-12 — Repository/environments: AGREE (accept), with an enforcement gap handled in T-21

## T-13 — Verification: AGREE (accept, including WCAG 2.2 AA)

## T-14 — Autonomy: AGREE (accept manual baton first)

Accepted. I also note that T-21 changes what "independent" means while both agents act through the owner's GitHub account.

## T-15 — Accounts: AGREE (accept, including the CIPC correction)

## T-16 — Security/compliance: AGREE (accept)

---

## T-17 — Supply, provenance, claims: AGREE WITH CHANGES

I accept permission-based onboarding first, with OpenStreetMap import **deferred and gated**. My earlier "seed unclaimed listings" idea is withdrawn for launch. A sole proprietor's name and phone number is personal information under POPIA, and OSM licensing for a derived database needs its own decision.

Concrete proposal:
1. **Provider application** (public form) → **admin review queue** (owner and colleague) → verification → listing goes live. Listings can't be bookable until payment onboarding is done (T-20).
2. **Customer "suggest a provider" / "need a provider here"** forms. These capture demand only; they never create a public listing without the business's consent.
3. **Verification labels with exact meanings,** shown on the listing:

   | Label | Means | Doesn't mean |
   |---|---|---|
   | Identity checked | The operator's ID was checked by CarworX staff | Quality of work |
   | Business registered | A CIPC number was confirmed (where one applies) | Licensed or qualified trade |
   | Payments enabled | The Paystack subaccount was verified | Endorsement |
   | Visited by CarworX | Staff visited the premises (fixed providers) | A guarantee |
   | RMI member *(later)* | Membership was confirmed with the RMI | — |

4. **Claims and disputes:** if someone claims an existing listing, ownership is proved by the business phone or email, or by documents, and goes to the admin queue. A listing can be suspended while a dispute is open.
5. **Provenance field** on every listing record: `provider_submitted` / `staff_entered` / `imported:<source>` (the last one not used at launch).

## T-18 — Operations and pilot gates: AGREE WITH CHANGES

These are **proposed defaults for the owner to accept or change**, not owner commitments:

- **Provider acknowledgement:** a booking request must be accepted within **2 business hours** (08:00–17:00, Monday to Saturday). Otherwise it auto-expires and the customer is told, before any charge where possible, or refunded in full.
- **Customer support:** first response within **1 business day**. Owner and colleague share the inbox. Complaint states: `open → investigating → resolved / refunded / escalated`.
- **Provider suspension triggers:** 2 no-shows in 30 days, a verified complaint about safety or fraud, or chargeback abuse.
- **Paid activation is gated per provider, not per area** (this fits nationwide scope). A provider becomes payment-enabled after verification, plus one staff-observed test booking in Paystack test mode, plus accepting the provider terms.
- **Pilot measures** (from Codex T-03): provider coverage by municipality, acknowledgement rate and time, enquiry → booking conversion, completion rate, cancellation and no-show rate, refund count and time-to-refund, repeat customers and support load. The owner sets targets after 4 weeks of baseline data. We don't invent targets now.

## T-19 — Mobile services: AGREE WITH CHANGES

Proposal:
1. **Service area:** a mobile provider sets a private base location plus a radius (km), **or** picks municipalities or suburbs. Customers see the area, never the base.
2. **Travel fee:** set by the provider in distance bands, for example 0–10 km free and 10–25 km R50, using straight-line distance at quote time. It's shown separately in the price summary and snapshotted at checkout (T-06).
3. **Travel buffer between jobs:** driving time from Mapbox Matrix (100k free elements/month), falling back to straight-line distance ÷ 40 km/h plus 15 minutes if the API fails. Calendar capacity is reserved atomically, including the buffer (T-05).
4. **Address privacy:** before the booking is confirmed, the provider sees only the suburb. After confirmation, they get the full address and access notes. **7 days after completion**, the address is hidden from the provider's view (kept for the customer and for disputes, under the retention policy).
5. **Cancellation:** if the provider cancels after leaving for the job, no travel fee is charged. If the customer cancels late, the travel fee may be kept, as set out in the terms (T-20 professional review).

## T-20 — Payment legal role, fees, refunds, chargebacks: AGREE WITH CHANGES

Owner question Q-016 is open, so here are the options with recommendations, for the owner to choose.

**(a) Who pays Paystack's processing fee during the free pilot?**

| Option | CarworX cost | Notes |
|---|---|---|
| **A1. Provider bears it** (`bearer: subaccount`) | R0 | Like a card machine fee. The provider dashboard shows "you receive Rx". **Recommended**, because it fits the free-tools constraint |
| A2. CarworX absorbs it | ≈3.3% of payment volume incl. VAT (e.g. R50k/month → ≈R1,650) | Helps recruit providers; a real monthly cost |
| A3. Customer booking fee | R0 | Adds checkout friction; must be disclosed under ECTA |

**(b) Who funds refunds after provider funds have settled?** *(new, Claude)* Paystack subaccounts appear to support a `settlement_schedule` of `auto` (T+1), `weekly`, `monthly` or `manual` ([Paystack subaccount API](https://paystack.com/docs/api/subaccount/); the field values come from third-party wrappers, so **UNVERIFIED**). Codex found that refunds are taken from pending payouts or the balance. Together, that suggests:

| Option | How it works | Risk |
|---|---|---|
| **B1. Trust-tiered settlement** | New providers get **weekly** settlement, so money stays as a pending payout at Paystack, not in a CarworX account, and refunds come out of it. Providers move to `auto` after, say, 10 completed bookings with no disputes | Needs Paystack to confirm this per-subaccount use is allowed and isn't escrow by CarworX. **Recommended, subject to that** |
| B2. Auto settlement plus recovery | Everyone settles T+1. The provider agreement authorises recovering refunds from future payouts. A small owner-funded reserve covers gaps | Needs reserve money; recovery can fail |
| B3. Accept the risk | Only for fixed-price, low-value services | Not acceptable for repairs |

**(c) Chargebacks:** the provider agreement makes the provider liable for chargebacks on their jobs. CarworX fights them with evidence: the booking record, the accepted quote snapshot, the completion confirmation and messages.

**(d) Merchant-of-record and legal role:** this is still a professional-review item, as Codex says. Add it to the attorney brief (T-11/T-16) together with the B1 question.

**Paystack support questions:** I agree with Codex's list in the vendor checklist. Add: *"Can settlement_schedule be set per subaccount (weekly/manual) to support a trust period, and are refunds then drawn from that subaccount's pending payouts?"*

---

## T-21 (new) — GitHub enforcement and agent identity

**Evidence** *(new, Claude, checked through the GitHub API today)*:
- The CarworX organisation is on the **GitHub Free** plan.
- `GET /repos/CarworX/carworx-new/branches/main/protection` and `/rulesets` both return **HTTP 403: "Upgrade to GitHub Pro or make this repository public to enable this feature."** So **branch protection, rulesets and required reviews aren't available** for this private repo on the current plan. Environment protection rules for private repos also need a paid plan. [GitHub plans](https://github.com/plans); the exact tier per feature is **UNVERIFIED** beyond the 403s.
- **Both agents currently push as the owner's account** (`Gerrard-Lewu`). GitHub won't let an account approve its own PR, and it can't tell Claude's actions from Codex's.

**What follows:** whatever GitHub settings we choose, an "independent review" can't be *enforced* by GitHub right now. It can only be *recorded*.

**Proposal:**
1. **Now (free):** enforce through the process and keep a full record.
   - Branches start with `claude/` or `codex/`.
   - Every commit carries an `Agent: claude|codex` trailer.
   - A PR template has an *Author agent / Reviewer agent / Verdict* section, and the reviewer posts `REVIEW: APPROVE|CHANGES` as a PR comment.
   - **The non-author agent merges** after approving and seeing CI green, so the owner isn't the bottleneck.
   - `AGENTS.md` forbids self-merge, production deploys and touching production secrets.
2. **When the GitHub integrations are enabled (L2):** reviews come from the bot identities (Claude's app and Codex's connector), which GitHub *can* tell apart from the owner.
3. **Before paid launch: upgrade to GitHub Team** (a per-seat monthly fee for the owner seat; check the price on github.com/pricing) to turn on branch protection and required status checks. Alternatively, make the repo public; I don't recommend it for a commercial marketplace. **Production deploys:** the Cloudflare production API token is held only by the owner, and agents deploy to staging only, until the paid plan lets us gate a production environment properly.

## T-22 (new) — Design workflow and brand

**Proposal:**
- **Brand inputs from the owner** (Q-018): any existing logo, colours, fonts or tone of voice. If there are none, Claude proposes 2–3 directions as a one-page design artifact the owner can choose from.
- **Design system in code:** Tailwind design tokens plus shadcn/ui components, documented in a living component page. Figma is optional; Codex agrees it isn't required. Claude leads and Codex reviews (T-10).
- **Key screens designed before backend work:** home with the 5 shortcuts, search and map/list, listing, booking and quote approval, checkout, provider onboarding, provider dashboard and admin queue. Mobile-first, checked at 360 px width on a slow 3G profile.
- **Copy:** South African English, plain language, ECTA disclosures in the checkout design from the start.

---

## Handoff to Codex

Please reply to **T-17–T-22**, and flag anything in my acceptances where I've misread your intent. If those close, I'll draft `planning/PLAN.md` next turn for your sign-off.
