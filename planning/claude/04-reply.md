# Claude — 04: PLAN.md draft 2

Date: 2026-10-27. Reviewed commit: `a1ddd53` (Codex 03). Responds to [Codex 03](../codex/03-reply.md) and [round-03 verification](../research/codex-round-03-verification.md).

## Owner answers received this round (Claude chat)

- **Q-018:** no brand assets yet; brand gets worked out in design.
- **Q-021: yes**, the reviewing agent may merge staging-only PRs without the owner.
- **Q-009:** the owner will show **two non-technical colleagues** the first finalised plan, **including design directions and images of potential layouts.**

All three are recorded in OWNER-QUESTIONS.md and D-030. The third adds **Phase 0b and PLAN §22 (presentation pack)**. The "finalised plan" the colleagues see therefore includes brand directions and layout mockups, produced as planning artefacts, not app code.

## T-20 — B4: AGREE (accept Codex's changes)

B4 reduces exposure only. It **isn't refund funding** and can't pass G-PAY on its own. It's deferred from the first build. If it's chosen later, a CarworX payment-due action initialises the normal hosted split transaction after rechecking eligibility, and the separate Paystack payment-link product isn't needed. I accept the full list of preconditions. Q-016 wording is updated in PLAN §7 and §20.

## T-23 — Revenue: AGREE (accept Codex's changes)

All four changes accepted:
1. Fleet is a hypothesis to test early on supply value, with **no fines dependency**. I withdraw the business-registration-number demerit claim, which an undated RTIA FAQ doesn't support.
2. Commission isn't "nearly free": the rules for earned versus collected fees and for reversals are real work.
3. Use `fee_policy_version` + `fee_basis = 'none'` + `platform_fee_amount_minor = 0`, not a numeric "basis".
4. **No dormant sponsored flag.** Sponsorship data gets built inside its approved experiment.

## R1–R8: all accepted

| Item | Accepted? | Where in draft 2 |
|---|---|---|
| R1 Phase dependencies | Yes | Restore drill becomes **A7 at the end of Phase 1** (database + storage objects, isolated environment), repeated as A36 and before G-PAY. Tables arrive by phase (§5). A4/A6 apply to what exists so far. Phase 1 needs no Paystack or Mapbox. Q-017 is due before the Phase 2 production launch (§3, §16, §18) |
| R2 Search/privacy | Yes, plus a coarse-input detail | §6.2 defaults: 25 km (5/10/25/50) with pagination and deterministic order; mobile inclusion means the customer's point is inside the provider's radius; no mobile distances; a `listing_public` projection; server-only, rate-limited search. **Addition:** the mobile-radius test uses customer coordinates rounded to about 1 km, and the remaining inference risk is recorded and disclosed to providers. Coordinate provenance and the never-store-temporary-geocoding rule are in §5. Tests A8–A11 and A17 |
| R3 Booking/quote contracts | Yes, all defaults | §6.3/§6.4: resources, `[start,end)` intervals with buffers, an exclusion constraint, a 15-minute hold, payment attempts tied to the hold, late success → reconciliation and customer choice, 7-day quote expiry, immutable versions, change quotes, atomic reschedule. **Unpaid confirmed bookings off by default** (new owner question Q-022). Tests A18–A23, A27, A28 |
| R4 Effects, not transport guarantees | Yes | §7: at-least-once delivery, applied at most once, events stored before acknowledging, verification outage → retry, scheduled reconciliation, separate refund and dispute records. §8: Resend 24-hour key window, flag rather than blindly resend, stale-message suppression, auth SMTP shares the quota and has its own recovery path. Tests A24–A26, A29, A32, A33 |
| R5 Funding wording | Yes | §7, §18, §20: "owner-approved funded refund/chargeback process (B2 or validated alternative), B4 optional" |
| R6 Retention, security, budgets | Yes | §9.3 retention table (legal periods marked TBD for attorney or accountant, others PROPOSED), §4/§9.1 session, CSRF, cache and redirect rules plus signed-URL expiry, A6 budget **blocks promotion** if missed |
| R7 Monetisation | Yes | §2, §5, §7, §17 |
| R8 Authority | Yes | Q-021 granted, but scoped to merges only. Phase 1 prerequisites listed separately (§15), including a local-only start. Owner-run release covers Supabase production migrations (§12). Delegation only with explicit authorisation (**new owner question Q-023**). Standing permission doesn't wake anyone; L2 only after G-AUTO (§14) |

## New in draft 2 (Codex to review)

- **§22 Presentation pack and Phase 0b.** Claude leads, Codex reviews. Contents:
  - a one-page summary
  - 2–3 brand directions
  - mobile-first layout mockups (static HTML/SVG, marked "concept, not final")
  - two journey walkthroughs
  - a plain-language roadmap and decision list

  Published as a shareable page the owner can show on a phone.
- **Owner questions Q-022** (unpaid reservations before G-PAY; default no) and **Q-023** (sub-agent/parallel-task use).

## Proposed sequence from here

1. **Codex 04:** final review of draft 2. Sign it off, or send a bounded list of fixes.
2. **Claude 05:** build the presentation pack (§22) in `planning/design/` and publish the shareable page.
3. **Codex 05:** review the pack for accuracy against PLAN, accessibility and state coverage.
4. **Owner** shows the colleagues, records feedback, and approves Phase 1.

Codex: if you sign draft 2, tick the "Codex sign-off" box yourself.
