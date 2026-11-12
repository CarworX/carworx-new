# Status

**2026-11-12 (SAST) — onboarding redesign:** the owner approved the onboarding, admin, settings and money designs (#72; Codex `REVIEW: APPROVE @949b420`) and decided D-088 to D-090. [Claude 23](claude/23-onboarding-redesign-build-plan.md) is the build plan (slices O1–O8). Revised for Codex 31 (`REVIEW: CHANGES @addb968`): admin "both" labels, the team two-step and fallback contract, location provenance, and "both" in search. It is held unmerged until Codex 30 is complete, then needs a new exact-head review. No product code yet.

**2026-11-11 UTC — Codex 23 follow-up:** Claude's #57 locking correction
`d2390c2` independently checked with four real concurrency cases and 572
pgTAP assertions. Codex adds rollback, lock-wait and membership/snapshot
assertions in a separate PR targeting #57; Claude review is required before
incorporation. #58 legal re-review and guide 13 correction are separate.
Workflow trimming belongs to #64; no workflow files changed here. Draft CI
skips do not pass any gate. Bundle A remains held for final-head bot review
and subsequent exact-head approvals. See [Codex 23](codex/23-claim-concurrency.md).

## Baton: Claude builds Phase 2 under interim authority (D-080); Codex reviews later

**2026-11-10 (SAST), bundles (D-085):** P2-1, P2-2 (#52), P2-3 and the maps (#53, `419e9da`; D-082 to D-084) are merged. The rest of Phase 2 runs as three bundles:
- **Bundle A, providers and admin** (P2-4 plus P2-7) and **Bundle C, launch readiness** (P2-9) run now, in parallel Claude sub-sessions.
- **Bundle B, visitor forms and fines** (P2-5 plus P2-6) follows once the owner has inspected and approved A and C.
- This session coordinates and reviews. Every merge needs the owner's OK at the exact head (D-080).

**2026-11-10 (SAST), P2-3:** public pages with Mapbox (D-082) and the design's categories (D-083) merged as #53. The map is a server-fetched static image (D-084), so no Mapbox token reaches the browser.

**2026-11-10 (SAST):** Codex is unavailable. Claude reviewed #48 (CHANGES: lint), fixed it in #49, and wrote the P2-2 plan ([Claude 19](claude/19-p2-2-search-plan.md)). The credential is Hyperdrive with a scoped login and the limiter is a Durable Object (D-081). Claude merges its own PRs only after green CI, a self-check and the owner's OK (D-080).

**2026-11-10:** reciprocal formal review restored (D-073). Phase 2 runs in parallel, local/CI and synthetic only: Claude writes the Phase 2 proposal (Claude 17) and the Paystack vs Yoco comparison (Claude 18), Codex reviews, the owner approves. Maps deferred (D-075); G-PAY renamed G-LIVEPAY (D-076).

**Phase 1 in progress.** Design #10, T1–T5, K1 and K2 #23 are merged. K4 #34
passed the native WSL synthetic restore drill with 168 RLS assertions, two
private objects and genuine TOTP, then merged after Claude's exact-head
approval. Hosted A7 and the remaining A1–A7 evidence are open. D-060 remains
open until G-PROD.

- **Repository:** D-071 gate #36, native Auth #33, K2 #31, K3 #32 and K4 CI
  #37 are merged. The combined K2 head `024ab0a` passed K1, 52 native Auth
  integration tests, 12 direct Auth checks and 25 Lighthouse measurements.
  K4 CI passed 168 TAP assertions and restored both private objects.
- **Staging:** Promotion is blocked. CarworX App is absent from the connected
  Supabase projects, Cloudflare requires reauthentication, and no staging
  GitHub secrets or variables are installed. Once access is available, verify
  the scoped token, hook, bindings and approved inboxes against
  [guide 11](owner-guides/11-staging-bootstrap.md). Live timing, delivery,
  OAuth, hosted performance and A1–A7 receipts remain open.
- **Phase 2:** Claude 17 is reviewed and merged (#40). The owner authorised
  P2-1 with its §3 defaults; #47 is merged after Claude approval, with 349 database
  assertions and recovery checks. #45 is also merged. Codex 22 hands P2-2 planning
  and implementation to Claude. Under D-079, Claude continues now on a separate
  stacked branch without waiting for Codex's plan review. Codex reviews later;
  new Claude-authored work stays unmerged. Staging A1–A7 and G-PROD remain open.
- **BLOCKER — application-path timing:** hosted app timing has not been measured.
  It follows the first app deployment and must pass independent review before
  broader staging acceptance. Direct Auth timing is also unmeasured; promotion
  stays blocked. Local/synthetic measurements cannot substitute for either path.

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

- **Local Supabase:** The WSL synthetic restore passed. Native Linux CI on #33 passed 52 Auth integration tests and 12 Auth-to-hook checks. Workstation Auth parity was not rerun.
- **K1:** owner confirmed included Actions minutes/$0 cap. Both fixture repairs are Claude-approved and merged; Auth integration remains mandatory as T3/T5 arrives.
- **T3/K2:** The recorded synthetic target is CarworX App. Restore connector access and verify real Google login and linking, the approved sender and both recipient paths. D-071 delegates staging execution to Codex.
- **K4 hosted:** Owner-only Drive and a separate Windows folder are prepared for encrypted copies (D-072). Verify quota and owner-held key procedure before export. Staging-sourced restore and A7 remain open.
- **Before G-PROD:** complete D-060's owner-only design checks and the remaining PLAN release requirements, including Information Officer/retention/privacy and recovery evidence.
- **Later:** company/business bank and funded reserve before G-PAY; optional automation budget under G-AUTO. No provider outreach or production action is authorised here.

## Next steps

**Foundation code merged:** Codex approved T2 `95476d5` and merged #15 as `38f1852`; all 154 pgTAP assertions and 24 REST probes also passed on the workstation. Codex approved T4 `f6f82cb` after combined CI (78 unit tests + 154 RLS assertions), the local check/build and 3 focused menu browser checks; #17 merged as `888bc5d`. Claude approved and merged K1 Auth fixture #22 (`994d09d`, merge `8066700`). These are code-review results, not staging A1–A7 completion.

**Prior foundation handoff:** [Codex 14](codex/14-t3-t5-review-and-k1-diagnostics.md) records four resolved T3/T5 findings, K1's reviewed diagnostics repair, exact-head hosted results (143 unit / 168 RLS / 45 integration), independent local/browser evidence and K2 inputs. #25 is approved at `91e7e44` and merged as `199d448`; #27 is Claude-approved and merged as `0961c98`. #21 is merged; #23 is re-approved at `7911d48`. Superseded #24 and verification-only #26 are closed unmerged. Staging remains blocked on access, owner configuration and demonstrated application plus direct-Auth recipient restrictions. Confirmations off/custom SMTP unset do not establish that Auth mail is disabled.

**Current handoff:** [Codex 19](codex/19-phase1-staging-completion.md) applies D-071. Promotion stays blocked on verified staging access and exact-version evidence.

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
| 29 | 2026-11-04 | Claude (T2) | Opened draft [PR #15](https://github.com/CarworX/carworx-new/pull/15): Supabase CLI 2.122.1, Phase 1 schema (`profiles`, `organisations`, `memberships`, `audit_log`, `private.platform_admins`) with RLS deny-by-default, admin = server-controlled list + `aal2` in RLS, append-only audit; 154 pgTAP assertions and `test:rls`; `contract.json` `rls: true` as a labelled K1-file commit. No local Supabase (image pulls blocked); real pgTAP run is K1 CI. Codex reviews. |
| 30 | 2026-11-04 | Claude (T2) | K1 fixture blocked PR #15's CI (pgTAP stage skipped); Codex reviewed CHANGES @`b823b03` with no schema/RLS defect and accepted `rls: true`. After K1 repair #18 merged (`ec7d658`), merged main into T2 for fresh CI and Codex's re-review. |
| 31 | 2026-11-05 | Codex | Final T2/T4 reviews and Q-021 merges; local 154 pgTAP/24 REST and 78 unit/3 browser checks passed. K1 Auth fixture #22 Claude-approved/merged; K2 inventory #23 published and behavioral contract agreed. Records #21 refreshed after main 888bc5d; staging acceptance remains open. |
| 32 | 2026-11-05 | Claude (T3+T5) | Superseded #24 by a clean-history branch `claude/t3-auth-2` from main `99efccf`, after the test password literal in #24's history failed the secrets scan. Local `pnpm run check` passes; Gitleaks over the commit range is clean. CI and review pending. |
| 33 | 2026-11-05 | Codex | Reproduced T3 TAP failure; four findings fixed by Claude and rechecked. K1 diagnostics #27 Claude-approved/merged; #25 approved @91e7e44 after green 143 unit/168 RLS/45 integration evidence, local refresh/boundary/browser checks, merged as 199d448. Codex 14 hands off to K2; staging gates remain open. |
| 34 | 2026-11-05 | Codex | Owner authorized K2 build before Claude review (D-068). Recipient app/hook controls, required local-stack CI coverage, readiness v2 and owner smoke contracts implemented in #23; Codex 17 requests exact-head review/replan. Hosted evidence and A2 remain open. |
| 35 | 2026-11-05 | Claude (phase1-master) | T3+T5 #25 merged (`199d448`); issues #5–#9 closed, so T1–T5 are all merged. Merged as reviewer: Codex records #21 (`99efccf`) and #29 (`f871fe3`), K1 diagnostics #27 (`0961c98`). Formal PR review APPROVE of K2 @`b1a4f72` (merged `5b9590f`, promotion blocked). Wrote owner guide 11 (#30) for staging setup to A2. Baton to the owner and Codex. |
| 36 | 2026-11-10 | Claude | Recorded owner directions D-073–D-076: reciprocal review restored (D-071 self-merges stand), Phase 2 in parallel with staging, maps after G-PROD, Paystack vs Yoco only and G-PAY renamed G-LIVEPAY. Next: post-merge security review of #31/#36/#33/#37/#32, Claude 17 Phase 2 proposal, Claude 18 payments comparison. |
| 37 | 2026-11-10 | Claude | Reviewed Codex #48 @`0a6c3a6` (CHANGES: two ESLint errors; secrets failed on a Gitleaks download). Fix in #49. Recorded D-080 (interim Claude authority) and D-081 (Hyperdrive scoped login and Durable Object limiter, with $0 links). Wrote Claude 19 (P2-2 plan). |
| 38 | 2026-11-10 | Claude | Merged #49 and #51 (D-080, owner OK) and #48 as reviewer. Built P2-3: home, search, category, listing and fines placeholder pages, plus server geocoding and an optional map behind fail-closed daily quotas (D-082; static image per D-084). Aligned the catalogue to the design's service keys (D-083). |
| 39 | 2026-11-10 | Claude | Fixed the #52 cursor binding and merged #52, and fixed alternating pagination plus two bot findings on #53. Merged #53 (`419e9da`) on the owner's OK at `5053dcf`. Recorded D-085: bundles A and C in parallel sub-sessions, then B. |
