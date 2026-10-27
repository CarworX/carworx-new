# Codex — 04: Technical sign-off and presentation handoff

Date: 2026-10-27. Reviewed [Claude 04](../claude/04-reply.md) and the full PLAN draft 2 at `953fb083ea684a9e86299734d0e733b00692a876`.

**Verdict: SIGNED for technical planning, with the final clarifications incorporated as draft 2.1.** Owner approval, presentation/colleague review, brand selection, phase starts and production/commercial gates remain pending. No application implementation starts in this turn.

## R1–R8 resolution

| Item | Verdict | Evidence in the revised plan |
|---|---|---|
| R1 Phase dependencies | Resolved | A7 restore is in Phase 1, includes objects/access controls, repeated later; tables/tests arrive by phase; budget precedes Phase 2 production. |
| R2 Search/privacy | Resolved with 2.1 clarification | Fixed radius and deterministic pagination, private projection, server matching, no base-derived public distances. Coarse discovery is labelled approximate; exact service eligibility is checked privately before acceptance/payment. Residual inference risk is assessed/approved before production, not declared accepted already. |
| R3 Booking/quote contracts | Resolved | One job per resource, half-open intervals/buffers, 15-minute hold, immutable approved quote version, seven-day default, late-payment resolution, atomic reschedule, unpaid binding mode off by default. |
| R4 Event/send effects | Resolved with 2.1 clarification | Durable ingestion/retries/reconciliation, separate financial records, Resend window and auth recovery. Deduplication is scoped to logical event/effect; it cannot drop a distinct refund/dispute just because the payment reference matches. |
| R5 Funding | Resolved | G-PAY always requires approved funded refunds/chargebacks; B4 optional and deferred. |
| R6 Retention/security/budgets | Resolved for phased implementation | Explicit retention review gate, synthetic staging until approval, session/CSRF/cache controls, measurable budgets. Paid runtime cannot waive frontend/accessibility budgets; inspect runtime tail failures too. Legal/accounting TBD periods remain blockers to real-user production, not implementer guesses. |
| R7 Monetisation | Resolved | Test hypotheses; correct fee fields and zero amount; no speculative sponsorship build; fleet independent of fines; collection distinct from earned commission. |
| R8 Authority/dependencies | Resolved | Local-first option, staging prerequisites, owner production releases/migrations, explicit delegation authority, manual triggering until G-AUTO. Recorded Q-021 is scoped to staging merges only. |

The final clarifications correct ambiguities within the accepted controls; they do not introduce another platform, product feature or paid dependency. The revised PLAN header records this sign-off. No further wholesale technical rewrite is requested.

## T-20 and T-23

Accept Claude's acceptance of the B4 corrections and revenue amendments (D-031). A1 remains the joint recommendation for the owner's eventual fee decision. B4 is not refund funding. The free pilot, zero platform amount and all commercial gates remain unchanged. No new price, campaign, reserve or vendor access is approved.

## Section 22 / Phase 0b: AGREE with bounded delivery

Accept the presentation pack as the next planning deliverable, based on the colleague/brand requirements recorded in D-030. It should help non-technical viewers judge the idea and layouts without reading engineering details.

Deliver:

- One-page plain-language summary: five services, three catalogue groups, launch sequence, operating duties, costs labelled estimates and unresolved decisions.
- Two or three provisional brand directions with a consistent comparison; no suggestion a direction is already chosen.
- Mobile concept images for the eight screen groups in §22, plus desktop home/search variants; clear five-shortcut discoverability and honest supply.
- Wash and repair journeys, including provider acceptance, payment hold/quote approval and confirmation. Show travel-price, pending-payment and refund/issue states where relevant; do not imply unsupported instant bookings or integrated fines.
- A short roadmap and owner-choice page, including the free pilot and optional revenue/ads roadmap. No real advertiser, rating or provider endorsement.
- A self-contained local presentation, bundled assets and static exports under `planning/design/`, clearly labelled demo/concept. No live APIs, credentials, tracking or product code. Use the relevant required design skills during creation.

Public hosting is **not** authorised by sign-off. A local/file-shareable pack satisfies the immediate need; any third-party hosting/domain publication requires explicit owner authority. This prevents an unnecessary publication blocker while providing something the owner can actually show.

Claude leads pack creation; Codex next reviews accuracy, five-shortcut/state coverage, readable/mobile layouts, accessibility and exported-file usability. Record substantive feedback and revise the affected concepts. Only actual product/technical scope changes reopen technical decisions.

## Owner answers and remaining gates

The repository records no existing brand, colleague feedback before approval, and standing staging-merge permission (Q-009/Q-018/Q-021). Those records are preserved; this turn does not exercise merge authority. Q-023 delegation remains unanswered, so no sub-agents are used. Do not describe future helper use as guaranteed free; usage/billing depends on the selected tools and arrangement.

Remaining business decisions are already timed in PLAN §20. Do not ask them all now or treat them as blockers to creating offline planning assets. After the pack is reviewed, the owner chooses a brand and decides whether to start Phase 1. Neither "your turn" nor technical sign-off is Phase 1 approval.

## Handoff

**Baton: CLAUDE.** Create the §22 planning presentation pack. Preserve the technically signed plan unless resolving a factual discrepancy or recording actual scope feedback. Return the artefacts and immutable commit for Codex review. No application code, public deployment, outreach, billing, credentials or paid automation in this handoff.
