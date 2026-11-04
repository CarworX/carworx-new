# Status

## 🟢 Baton: **Claude reviews K1 repair**, then Codex final feature review

**Design gate closed by the owner (D-067):** the design baseline is approved at `495e448`, and Codex's final X-c sign-off is waived for this gate. Codex still reviews every Phase 1 pull request. See [Claude 14](claude/14-phase1-kickoff.md).

1. **Claude:** independently review [K1 repair #18](https://github.com/CarworX/carworx-new/pull/18), then incorporate the approved repair into T2 #15 and T4 #17. Preserve both branches' records and regenerate the shared lockfile as needed.
2. **Codex:** review the updated feature heads and fresh CI. Verification-only PRs #19/#20 do not approve or merge the original feature PRs. See [Codex 12](codex/12-takeover-review.md) for evidence and receiving-agent steps.
3. **Next tasks:** K2 configuration/recipient-control agreement; K4 local drill after T2 acceptance and Docker availability; K3 measurements after T4 acceptance. Claude starts T3/T5 after T2 merges. Owner executes staging deployments.

**Phase: 1 in progress (D-038).** Design #10, T1 #11 and K1 #13 are merged; main baseline `18cfedc`. T2/T4 remain unmerged. Phase 1 finishes only with recorded staging evidence for A1–A7. D-060's live design-system, real 200% zoom, screen-reader and physical-device/browser checks remain open until G-PROD. The Coming Soon page is scrapped (D-063).

## Open items

| ID | Item | State |
|---|---|---|
| PLAN | Version 2.1 | Technically signed D-033; owner-approved for Phase 1 only D-038. Task contracts agreed D-064/D-065 |
| §22 | Presentation pack (Turbine + Studio) | Phase 0b closed D-037; expiry correction accepted within Codex 07's verified scope |
| DS / C4 | Studio design system and system states | Owner approved baseline `495e448` under D-067. T4 implementation review is separate; D-066 remains binding |
| C5 | Package at `claude/audit-10/` | Historical capture findings were addressed by Claude; owner waived final X-c for this gate (D-067). D-060 owner acceptance remains open |
| C09 | Claude 09 review plan | Historical planning/design record; no longer a Phase 1 start blocker under D-067 |
| C10 / C12 | Phase 1 plan and remaining work | **AGREED** D-064/D-065. Claude T1–T5; Codex K1–K4 (#1–#4). Start gates satisfied; remaining dependencies and evidence are in Codex 12 |
| REV / S1 | Revenue records and proposed experiments | Codex 08 S1/V1/V2 resolved in the written plan. D-054–D-057 remain binding; fee-exposed evidence, later contracts and G-REVENUE/G-PAY remain required |
| T-20 / G-PAY | Fee bearer and funded recovery | Owner chose provider-paid fee D-048 and reserve plus recovery D-050. Paystack confirmation, company/bank readiness and funded process still required |

## Owner prerequisites

- **Local Supabase:** Docker Desktop was started from its existing user installation, but its engine returns HTTP 500; Ubuntu WSL also reports a missing registered VHDX. Workstation database/restore checks remain blocked. C: had about 30 GB free this turn. Pinned Node 24.22.2 and pnpm 12.16.1 ran T4 checks successfully from temporary tooling.
- **K1:** owner confirmed included Actions minutes with a $0 spending cap. Repair #18 requires Claude review.
- **T3/K2:** D-062 identifies “CarworX App” as synthetic staging; Claude reports Google enabled. Real login remains unverified. Complete local Google provider/callback configuration, account/DNS inventory, Cloudflare staging route, scoped secrets and restricted Resend/Auth SMTP. Claude supplies the guides; deployment execution stays owner-controlled.
- **K4 hosted:** choose an existing private destination, a separate copy and operator; confirm proposed frequency, retention and measured cost/capacity. The local synthetic drill comes first (D-059).
- **Before G-PROD:** complete D-060's owner-only design checks and the remaining PLAN release requirements, including Information Officer/retention/privacy and recovery evidence.
- **Later:** company/business bank and funded reserve before G-PAY; optional automation budget under G-AUTO. No provider outreach or production action is authorised here.

## Next steps

**Foundation landed:** T1 #11 merged at `c87ba46`; Claude-approved K1 follow-up #13 merged at `18cfedc`. K1 repair #18 corrects two feature-suite fixture assumptions and restores scratch state after each fault. Scaffold run 41870256432 and isolated T4 candidate run 41870373184 passed. Isolated T2 run 41870352422 passed all 154 pgTAP assertions; additional REST verification is recorded in Codex 12.

**Feature approval pending:** T2 #15 and T4 #17 still need the independently reviewed CI repair incorporated and green CI on their resulting heads. T2's corrected candidate run 41877829916 has exact-head passed check/secret/gate artifacts: 154 pgTAP assertions plus 24 REST probes. Its workflow metadata still says queued despite completed logs/artifacts; reconcile status before merge. T4 passed Codex's pinned local check (75 tests/build), 13/13 saved hashes and independent browser audit (27 checks, zero failed). D11 staging flag accepted; no A6 or D-060 acceptance is implied. No Codex merge or deployment this turn.

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
| 24 | 2026-11-04 | Codex | Reviewed `1e97c78`: all 265 manifest hashes match; D-066 repo change inspected. Design sign-off withheld for three clipped required mirror cards (R1/G11); baton to Claude for complete captures and updated logs/manifest. Main/owner-merge and Phase 1 gates retained. |
| 25 | 2026-11-04 | Claude | Answered Codex 10 R1: mirror v4 (full content height, rejects incomplete captures); NavBar, ServiceKey and StepList re-captured complete and opened; index 266 files / 240 PNGs, hashes refreshed, counts corrected. Baton to Codex for X-c. |
| 26 | 2026-11-04 | Owner/Claude | Owner approved the design baseline at `495e448` and waived X-c (D-067). Claude 14 and guide 10 written; design-branch PR opened for the owner to merge; Phase 1 to run in the cloud environment "CarworX Cloud". |
| 27 | 2026-11-04 | Claude (T1) | Built the T1 scaffold on `claude/t1-scaffold` and opened draft [PR #11](https://github.com/CarworX/carworx-new/pull/11): pnpm 12.16.1 workspace, `apps/web` on React Router 7.18.5 with `@cloudflare/vite-plugin`, TypeScript 6.0.3 strict, ESLint + Prettier, Vitest, `/healthz` (`no-store`), PR template; versions from the npm registry and nodejs.org. `pnpm run check` passes offline on Node 24.22.2. Waiting on K1; Codex reviews. |
| 28 | 2026-11-04 | Claude (T1) | Reviewed K1 PR #12: CHANGES @`1b476aa` (C1–C4, each reproduced locally), then APPROVE @`4b25bf0` after Codex's fixes (hosted CI green; prose-exception scope checked locally). Merged K1 into T1 at `e5c393c`; T1 ready for Codex's review of the combined head. |
