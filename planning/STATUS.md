# Status

## 🟢 Baton: **CLAUDE**

Claude: read [Codex 03](codex/03-reply.md), the 21 section verdicts and **R1–R8**. Revise [PLAN.md](PLAN.md) to draft 2, accepting or explicitly replacing each concrete amendment. Codex reviewed draft 1 at `2a92499842dee1d7df16e1d404c51d5db8a3a3ca`. **CHANGES REQUIRED; Codex sign-off withheld.** Evidence: [round-03 verification](research/codex-round-03-verification.md).

**Phase: PLANNING.** No application code, accounts, deployments, outreach or paid automation. Owner decisions D-001–D-005 and D-022 are constraints.

## Open topics

| ID | Topic | State |
|---|---|---|
| T-20 | Fee bearer, refund funding | A1 joint recommendation; owner Q-016 open. B4 may mitigate exposure but cannot replace approved funding; optional/deferred from initial build |
| T-23 | Revenue portfolio | Codex changes: fleet not dependent on fines, commission recognition/reversals explicit, zero fee amount distinct from basis, no dormant sponsor fields in free core |
| PLAN | Draft 1 reviewed; draft 2 required | R1 phase/restore dependency; R2 search/private locations; R3 capacity/quote/timeouts; R4 payment/outbox effects; R5 funding; R6 retention/security/budgets; R7 revenue; R8 authority/dependencies |

**AGREED:** T-01–T-19, T-21, T-22, T-24 → D-006 to D-029 (T-20 partial: D-026). See [DECISIONS.md](DECISIONS.md).

## Waiting on the owner

See [OWNER-QUESTIONS.md](OWNER-QUESTIONS.md): Q-005, Q-006, Q-008, Q-009, Q-016, Q-017, Q-018 brand, Q-019 GitHub Team (optional), Q-021 optional standing staging-merge permission. Q-021 is not required for local/PR work; owner merges remain a fallback. Brand can begin with provisional directions. Confirm staging access/authority before remote setup; budget approval precedes any paid production gate. These questions do not block Claude's revision.

## Next step

Claude revises draft 2, correcting the gate/test map and T-20/T-23 treatment. Preserve explicit pending owner choices; do not tick Codex sign-off on Codex's behalf. Return an immutable revision for final Codex review, then separate owner approval for Phase 1 only. Current direction, platform and category decisions are not reopened. No application work, vendor calls with credentials, spending, outreach or deployment is authorised.

## Material review findings

- Phase 2 production currently depends on a restore test scheduled in Phase 3; fix before approval.
- Capacity resources, hold lifetime, immutable quotes and late-payment resolution need concrete contracts.
- Mobile bases need a private projection and protection from public spatial probing; hiding a field alone is insufficient.
- At-least-once payment events need idempotent business effects; Resend keys have a 24-hour window, not an unlimited delivery guarantee.
- B4 timing is not refund funding. Fleet scheduling can validate without integrated fines; no legal/demand claim substitutes for validation.

Detailed publication/check history: [HISTORY.md](HISTORY.md).

## Turn log

| # | Date | Agent | Summary |
|---|---|---|---|
| 1 | 2026-10-27 | Claude | Set up repo and protocol, wrote 7 research notes and an opening proposal covering T-01 to T-16. Baton to Codex. |
| 2 | 2026-10-27 | Codex | Preserved independent baseline, answered T-01–T-16, agreed T-04, proposed T-17–T-20, recorded owner clarifications and verification/access notes. Baton to Claude; no app code. |
| 3 | 2026-10-27 | Claude | Accepted Codex's changes to T-01–T-16 (D-007–D-021), answered T-17–T-20 with concrete options, opened T-21 (GitHub Free: no branch protection, shared identity, verified by API) and T-22 (design/brand). Baton to Codex. |
| 4 | 2026-10-27 | Codex | Responded to T-17–T-22; corrected settlement/refund and private-deployment assumptions; added T-23 revenue portfolio and T-24 advertising boundaries with sources/scenario arithmetic. Owner request D-022; changes pending. Baton to Claude. |
| 5 | 2026-10-27 | Claude | Accepted Codex's changes (D-023–D-029), added payment option B4, ranked the revenue streams, and published **PLAN.md draft 1**. Baton to Codex for plan review. |
| 6 | 2026-10-27 | Codex | Reviewed all 21 PLAN sections; withheld sign-off with R1–R8; proposed B4 and T-23 corrections; added primary-source verification. Draft 1 preserved with review notice; baton to Claude for draft 2. |
