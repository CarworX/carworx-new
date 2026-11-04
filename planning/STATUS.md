# Status

## 🟢 Baton: **CODEX**

**For Codex now: X-c, the scoped design review.** [Claude 13](claude/13-c5-verdicts-and-handover.md) completes C-a/C-b (E1) and the full committed-byte hashes (E2) in [`claude/audit-10/index.md`](claude/audit-10/index.md): 263 files opened and judged, every matrix row with a verdict. One **Important** finding (G1, control edges 1.37:1 against the Studio 3:1 rule; the owner chooses the fix) and sixteen Minor. C4 F7 is documented; F5 stays Minor pending the owner's O-2. Owner guides are in [`owner-guides/`](owner-guides/README.md). Claude's T1–T5 are issues #5–#9.

1. **Codex:** review the package at the commit that publishes Claude 13, and answer Claude 13 §5.
2. **Owner:** choose G1's fix; answer O-2; work through guide 1 (C: needs about 20 GB free, Docker isn't running, pnpm isn't on the PATH).
3. After Codex's sign-off: the **owner merges the design branch** (guide 2), then T1 with K1.

**Phase: 1 approved (D-038), not started.** Local synthetic coding follows design review, owner merge and the §15 local prerequisites. Phase 1 finishes only with recorded staging evidence for A1–A7. D-060 defers live design-system screenshots, real 200% zoom, phone screen-reader and real-device/browser checks until **G-PROD**; they remain open, never passed by screenshots. PLAN's release checklist now includes them. The Coming Soon page is scrapped (D-063).

## Open items

| ID | Item | State |
|---|---|---|
| PLAN | Version 2.1 | Technically signed D-033; owner-approved for Phase 1 only D-038. Task contracts agreed D-064/D-065 |
| §22 | Presentation pack (Turbine + Studio) | Phase 0b closed D-037; expiry correction accepted within Codex 07's verified scope |
| DS / C4 | Studio design system and system states | F7 documented in `design/brand/README.md`; F5 open Minor (needs owner O-2). G1 (control edges) needs the owner's choice. Scoped verdict pending X-c |
| C5 | Package at `claude/audit-10/` | **Verdicts complete** (Claude 13): 263 files, full committed-byte SHA-256, E1/E2 closed; G1 Important, G2–G17 Minor; rows 13/14 live, 15, 19, 20 BLOCKED to G-PROD. Awaiting Codex X-c |
| C09 | Claude 09 review plan | R1/R2/R3 accepted at planning level. Capture acceptance and contrast remain C5 work |
| C10 / C12 | Phase 1 plan and remaining work | **AGREED** D-064/D-065. Claude T1–T5; Codex [K1 #1](https://github.com/CarworX/carworx-new/issues/1), [K2 #2](https://github.com/CarworX/carworx-new/issues/2), [K3 #3](https://github.com/CarworX/carworx-new/issues/3), [K4 #4](https://github.com/CarworX/carworx-new/issues/4). Implementation blocked on the design/owner-merge gate and dependencies |
| REV / S1 | Revenue records and proposed experiments | Codex 08 S1/V1/V2 resolved in the written plan. D-054–D-057 remain binding; fee-exposed evidence, later contracts and G-REVENUE/G-PAY remain required |
| T-20 / G-PAY | Fee bearer and funded recovery | Owner chose provider-paid fee D-048 and reserve plus recovery D-050. Paystack confirmation, company/bank readiness and funded process still required |

## Owner prerequisites

- **Before coding:** merge the design branch after X-c; free about 20 GB on C:, start Docker's engine and enable pnpm ([guide 1](owner-guides/01-docker-and-pnpm.md)). On 2026-11-04 C: had 2.6 GB free, Docker's engine was not running and pnpm was not on the PATH (Corepack present).
- **K1:** confirm Actions allowance.
- **T3/K2:** D-062 identifies “CarworX App” as synthetic staging; Claude reports Google enabled. Real login remains unverified. Complete local Google provider/callback configuration, account/DNS inventory, Cloudflare staging route, scoped secrets and restricted Resend/Auth SMTP. Claude supplies the guides; deployment execution stays owner-controlled.
- **K4 hosted:** choose an existing private destination, a separate copy and operator; confirm proposed frequency, retention and measured cost/capacity. The local synthetic drill comes first (D-059).
- **Before G-PROD:** complete D-060's owner-only design checks and the remaining PLAN release requirements, including Information Officer/retention/privacy and recovery evidence.
- **Later:** company/business bank and funded reserve before G-PAY; optional automation budget under G-AUTO. No provider outreach or production action is authorised here.

## Next steps

**Claude completes the evidence and guides → Codex X-c → owner design merge → T1 with K1 → dependent Phase 1 tasks and reciprocal review → staging A1–A7.** Later writers are agreed in D-065; later phases retain their own proposals and owner gates.

Detailed history: [HISTORY.md](HISTORY.md).

## Turn log

| # | Date | Agent | Summary |
|---|---|---|---|
| 1 | 2026-10-27 | Claude | Set up repo and protocol, wrote 7 research notes and an opening proposal covering T-01 to T-16. Baton to Codex. |
| 2 | 2026-10-27 | Codex | Preserved independent baseline, answered T-01–T-16, agreed T-04, proposed T-17–T-20, recorded owner clarifications and verification/access notes. Baton to Claude; no app code. |
| 3 | 2026-10-27 | Claude | Accepted Codex's changes to T-01–T-16 (D-007–D-021), answered T-17–T-20 with concrete options, opened T-21 (GitHub Free: no branch protection, shared identity, verified by API) and T-22 (design/brand). Baton to Codex. |
| 4 | 2026-10-27 | Codex | Responded to T-17–T-22; corrected settlement/refund and private-deployment assumptions; added T-23 revenue portfolio and T-24 advertising boundaries with sources/scenario arithmetic. Owner request D-022; changes pending. Baton to Claude. |
| 5 | 2026-10-27 | Claude | Accepted Codex's changes (D-023–D-029), added payment option B4, ranked the revenue streams, and published **PLAN.md draft 1**. Baton to Codex for plan review. |
| 6 | 2026-10-27 | Codex | Reviewed all 21 PLAN sections; withheld sign-off with R1–R8; proposed B4 and T-23 corrections; added primary-source verification. Draft 1 preserved with review notice; baton to Claude for draft 2. |
| 7 | 2026-10-27 | Claude | Recorded owner answers (Q-009, Q-018, Q-021); accepted all R1–R8 and T-23 changes (D-030–D-032); published **PLAN.md draft 2** with Phase 0b and the §22 presentation pack. Baton to Codex for sign-off. |
| 8 | 2026-10-27 | Codex | Signed technical PLAN 2.1 with final search/event/performance/sharing clarifications; accepted §22 pack scope. Owner approval remains pending. Baton to Claude for local presentation artefacts, then Codex review. |
| 9 | 2026-10-28 | Claude | Built the §22 pack (Stage A) in `design/pack/`: one offline HTML with the Turbine brand and hero motion, 8 phone screen groups with §10 states, desktop home/search, Thandi and Pieter journeys, roadmap/decisions, summary, 16 PNG + PDF exports and QA.md (UNVERIFIED items listed). Branch `planning/design-motion-toolkit`. Baton to Codex for review. |
| 10 | 2026-10-28 | Claude | Owner chose then approved the Studio web direction (D-035, D-036) after two refinement passes. Rebuilt the §22 pack in Studio: Studio intro, Turbine rules + Studio UI language, 8 screen groups with §10 states, desktop home/search, scroll-linked journeys, roadmap; fonts bundled offline; 27 PNG + 42-page PDF checked by eye; QA.md rewritten. Baton to Codex for review. |
| 11 | 2026-11-02 | Claude | Recorded owner decisions: Phase 0b closed, no colleague changes (D-037); PLAN 2.1 approved for Phase 1 only, local-only start (D-038); Q-023 yes (D-039); Studio design system built in Claude Design first (D-040). Baton stays with Claude for the design system, then Codex reviews. |
| 12 | 2026-11-02 | Claude | Built the Studio design system (D-040) in the CarworX Design System project in Claude: tokens v4, Geist/Geist Mono/Caveat, 15 components with bundle.css, objects, illustrations, glyphs, brand book and cover; mirrored into `design/brand/`. Baton to Codex to review pack, design system and D-037–D-040. |
| 13 | 2026-11-03 | Claude | Built five 404 and five loading concepts (`cd6160d`). The owner chose the Dot-grid lens 404, plus the hold dial, skeleton and dot-grid ripple loaders by scenario, with the ripple's blade pulse (D-041). Built the approved states page and four design-system cards (`e189775`). Baton stays with Codex. |
| 14 | 2026-11-03 | Codex | Published [Codex 06](codex/06-product-design-review-handoff.md), asking Claude for an assessment only, and the historical [Codex 05](codex/05-pack-review.md) pack review (`173f476`). STATUS was not updated in that commit; Claude recorded this row in turn 15. |
| 15 | 2026-11-03 | Claude | Published [Claude 09](claude/09-product-design-assessment.md) (`c24ea44`), which an independent subagent review answered Yes. At the owner's request: corrected the hold-expiry copy in the pack and the design system (`ac5fcce`, live version 32), and brought AGENTS, README, the PLAN header, OWNER-QUESTIONS and STATUS up to date with D-037–D-041. Baton to Codex. |
| 16 | 2026-11-03 | Codex | Published Codex 07: C1–C3 accepted within verified scope; pack QA/build/checkout PNGs/PDF checked; approved-states QA 16/16 clean. Claude 09 AGREE WITH CHANGES for R1 saved evidence, R2 contrast coverage, R3 summary. Baton to Claude; complete design/merge sign-off remains pending. |
| 17 | 2026-11-03 | Claude | Recorded owner decisions D-042 to D-053 (round 07: sign-in, Information Officer, Supabase free plan, no attorney, supply focus, accounting research, fee bearer, company registration, refund funding, booking modes, fines plan, retention). Amended Claude 09 for Codex 07 R1–R3 and published [Claude 10](claude/10-phase-1-build-plan.md), the Phase 1 build plan. Revenue streams are being discussed in a separate session. Baton to Codex. |
| 18 | 2026-11-03 | Claude | Published [Claude 11](claude/11-revenue-streams.md), the revenue discussion from a separate Claude session (20 owner answers, SA prices with sources, a testing order), and recorded the owner's choices as D-054 to D-056. Baton stays with Codex. |
| 19 | 2026-11-03 | Codex | Reviewed `280373e`: Claude 09 R2/R3 accepted, R1 state selectors remain; Claude 10/11 AGREE WITH CHANGES for Google prerequisites, security/backup evidence, current PLAN records and fee-exposed revenue cohorts. Published [Codex 08](codex/08-phase1-and-revenue-review.md); baton to Claude. Full visual/merge sign-off pending. |
| 19 | 2026-11-03 | Claude | Responded to Codex 08: Claude 09 R1 (31 state panels, count checks), Claude 10 B1–B3, ownership and CI bootstrap agreed (§10), Claude 11 V1/V2 (§10), PLAN S1 reconciled; recorded D-058 and D-059. C4 and C5 still to do; baton stays with Claude. |
| 20 | 2026-11-04 | Claude | Built the C5 evidence package in `claude/audit-10/` from `git archive 5a805b3` (routes E, S1, S3, Q, C, M, P; 259 files with SHA-256). Counts matched (8 phones, 31 state panels), the blank check was clean and all 41 mirror blob ids resolved. Five observations and the BLOCKED rows are listed. Baton to Codex for review. |
| 21 | 2026-11-04 | Claude | Published [Claude 12](claude/12-remaining-work-and-next-phase.md): what's left before Phase 1 by Claude, Codex and the owner; Phase 1 under the agreed split; later work with proposed writers. Recorded D-060–D-063 (owner checks before G-PROD, split kept, "CarworX App" is staging with Google on, owner guides, Coming Soon scrapped). Baton to Codex for approval. |
| 22 | 2026-11-04 | Codex | Reviewed `95637fb`: Codex 08 planning corrections resolved; Claude 12/task split agreed D-064/D-065. C5 receipt verified counts and found four CRLF hash mismatches; image acceptance/contrast remain open. Created K1–K4 issues #1–#4, retained D-060 in G-PROD, baton to Claude for C-a/C-b/C4/guides and T1–T5. |
| 23 | 2026-11-04 | Claude | Completed C5 verdicts ([Claude 13](claude/13-c5-verdicts-and-handover.md)): all 263 files opened, PASS 204 / FINDING 43 / NOT USED 4, full committed-byte hashes (E2), six own-tool faults fixed and re-captured; G1 Important, G2–G17 Minor. C4 F7 documented; nine owner guides; T1–T5 issues #5–#9. Baton to Codex for X-c. |
