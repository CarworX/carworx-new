# Status

## 🟢 Baton: **CODEX**

Codex: please review on `planning/design-motion-toolkit`:
1. **The Claude 09 delta for [Codex 07](codex/07-claude09-review.md) R1–R3.** The new §4.4 gives each screenshot row a saved-image route or marks it BLOCKED. Row 17a adds control and non-text contrast. A current-state note sits under the status line.
2. **[Claude 10](claude/10-phase-1-build-plan.md), the Phase 1 build plan:** tasks T1–T5 (Claude) and K1–K4 (Codex), file ownership, order and the issue list. Questions for you are in §9.
3. **Owner decisions D-042 to D-056** (round 07), including the revenue choices in [Claude 11](claude/11-revenue-streams.md) and its proposed numbers, and the PLAN, OWNER-QUESTIONS and STATUS edits that follow from them. These are owner decisions: please check that the records are consistent, and raise any technical consequences.

The design work's full visual sign-off is still pending. Once Codex approves, the owner merges the branch to `main`, and Phase 1 starts local-only (D-038). No audit, live publication or application work is started by this turn.

**Phase: 1 approved (D-038), not started.** Phase 1 starts local-only with synthetic data once the design system is reviewed. No accounts, deployments, outreach or paid automation by agents.

## Open items

| ID | Item | State |
|---|---|---|
| PLAN | Version 2.1 | Technically signed (D-033) and **owner-approved for Phase 1 only** (D-038) |
| §22 | Presentation pack (Turbine + Studio) | Phase 0b closed (D-037). Expiry correction independently accepted by Codex 07 in source, assembled HTML, both checkout PNGs and PDF pages 22–23 |
| DS | Studio design system (D-040) and system states (D-041) | Built by Claude ([08](claude/08-design-system.md), [states](design/states/NOTES.md)) in the CarworX Design System project and mirrored into `design/brand/`. The same expiry-copy correction is live in version 32. Codex reviews |
| C09 | [Claude 09](claude/09-product-design-assessment.md): design review plan | Codex 07: AGREE WITH CHANGES. R1–R3 addressed (§4.4, row 17a, current-state note). Codex delta review next |
| C10 | [Claude 10](claude/10-phase-1-build-plan.md): Phase 1 build plan | Proposal; Codex agrees or changes it. GitHub issues are created only after agreement |
| R07 | Owner decisions D-042 to D-053 | Recorded in DECISIONS, PLAN and OWNER-QUESTIONS. Main changes: no attorney (D-045); production on the Supabase free plan, with a no-cost backup route (D-044); company registration after the build, test mode until then (D-049); book and pay now for price-list services (D-051) |
| REV | Revenue streams | Owner's choices recorded as D-054 to D-056; [Claude 11](claude/11-revenue-streams.md) holds the options, prices and proposed test numbers. Codex reviews. One bay or diary stays free (D-055) |
| T-20 | Q-016 | **Answered:** the provider pays the fee (D-048); reserve plus recovery (D-050). Paystack's written confirmation still needed at G-PAY (D-026) |

**AGREED:** T-01–T-19, T-21–T-24 and R1–R8; technical sign-off D-033 records the final 2.1 clarifications. See [DECISIONS.md](DECISIONS.md). T-20 fee/funding choices still require the owner before G-PAY.

## Waiting on the owner

**Answered this round (round 07):** sign-in (D-042); Q-006 (D-043); Q-017 for the database (D-044); legal documents (D-045); first supply (D-046); accounting research (D-047); Q-016 (D-048, D-050); Q-005 (D-049); Q-022 (D-051); Q-008 (D-052); retention (D-053).
**Phase 1 prerequisites (§15), owner:** Docker Desktop running and pnpm enabled (before coding); account inventory and who controls `carworx.app` DNS; staging Supabase project + Cloudflare route (Phase 1 starts local-only until then); Resend subdomain; CI minutes; Google OAuth client (D-042). (The GitHub login is back on the account with CarworX org access.)
**Owner backlog:** register as Information Officer before G-PROD (D-043); register the company with the cofounders before G-PAY (D-049).
**For the visual audit, when wanted (Claude 09 §4.2):**
- OK to run the pack scripts on an isolated copy
- zoom Chrome while Claude watches
- be signed in to claude.ai in the browser pane
- phones for the screen-reader and device checks
**Later:** Q-017's automation budget (G-AUTO); Q-019 (optional).

## Next steps

1. ~~Claude: Studio design system~~ Done: [Claude 08](claude/08-design-system.md).
2. ~~Claude: amend Claude 09 for Codex 07 R1–R3~~ Done (turn 17). **Codex:** review the delta, Claude 10 and D-042 to D-053. C4 and C5 keep their existing scope and permission limits.
3. **Owner:** merge `planning/design-motion-toolkit` to `main` after Codex approves; complete the §15 Phase 1 prerequisites.
4. **Phase 1 (approved, D-038):** per [Claude 10](claude/10-phase-1-build-plan.md) once agreed. The GitHub issues come first, then T1 (scaffold), then the tasks in parallel; exit A1–A7, including the restore drill from the no-cost backup route (D-044).
5. **Later proposals (not Phase 1):** the D-051 booking flows, the fines partner plan (D-052), the legal drafts (D-045), the retention schedule (D-053) and the revenue streams.

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
