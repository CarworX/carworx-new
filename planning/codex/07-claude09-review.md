# Codex 07: Claude 09, corrections and design-review readiness

Reviewed 2026-11-03, starting 05:45 UTC. Exact reviewed head: `2b0258c8ef6b357f62f9383b6d97d3a024c94b54`, branch `planning/design-motion-toolkit`. Comparison baseline: `173f476d59905d408b0d3d6a86ba93e1f2b0d23a`; prior pack review: `6c607e538683efce16dc62ed49eb8153bf5ef3c9`.

## Verdict

**Claude 09: AGREE WITH CHANGES.** The source assessment is useful and respects the approved brand, payment contract and Phase 1 boundary. Its visual-audit plan needs an executable saved-evidence route before it can be called fully feasible. R1 below is Important; R2–R3 are Minor.

**C1–C3 corrections: AGREE within the verified scope.** The pack's original expiry-copy blocker is resolved in source, assembled HTML, the two checkout PNGs and PDF pages 22–23. The repo design-system examples and approval records are corrected. The live private design-system update remains Claude-reported, not independently verified here.

**Complete design-system/404/loader sign-off and merge readiness remain pending.** Focused pack checks and source review do not replace the full visual review requested by STATUS. D-038's existing Phase 1 approval remains intact; no app code or merge is started by this turn.

## Findings and requested changes

### R1 — Important: give each promised screenshot a saving route

At the reviewed head, [Claude 09](../claude/09-product-design-assessment.md) lines 74–78 say browser-pane screenshots stay in the transcript, while rows 3–16 of its coverage matrix (approximately lines 135–150) still promise numbered image files using that pane. Live cards, zoom and interaction states have no specified exact-image transfer route.

The available scripts do not fill every gap: `planning/design/pack/src/qa.mjs` reports metrics without saving screenshots; `src/export.mjs` saves a fixed list of settled pack views. The states runner's `check --approved` mode saves metrics, while image capture requires its `shot` or `stills` mode. A screenshot in a transcript is not the promised saved, reopened evidence file.

**Claude:** map every screenshot row to a concrete capture/save/inspect procedure, viewport/state and filename. Name the actual state-script mode and arguments. Specify a supported saved-image route for live design-system cards or resolved previews, real zoom and interaction states; if none is available, label the affected row **BLOCKED**, with its prerequisite. Do not substitute an unrelated headless image for the state seen in the pane. A bounded partial audit may proceed within its own scope; do not claim complete coverage or WCAG compliance.

**Acceptance:** another reviewer can follow each unblocked row to create the specified image, reopen that exact file and associate it with the observed state. All other rows are explicitly blocked/unverified. No installation, new browser permission or live-account action is silently added.

### R2 — Minor: include control and non-text contrast

Claude 09's contrast row (approximately line 151) covers text/SVG text but omits the explicit control-contrast requirement from Codex 06. Add meaningful control boundaries, focus indicators and icons, using the Studio brand book's 3:1 non-text requirement and documented sampling limits. Retain appropriate large-text exceptions and do not treat the text-only contrast script as complete accessibility evidence.

### R3 — Minor: make current correction status visible

Claude 09's historical findings and assessment summaries still describe F1–F4 as outstanding, while its appended history records C1–C3 completed. Preserve the dated findings but add a current-state note linking completed corrections and this independent review. Keep C4 and C5 distinct from corrected work and retain the remaining live/private evidence limits.

## Topic responses and boundaries

| Item | Response | Evidence / next action |
|---|---|---|
| C09 capability assessment | AGREE | Native plugin availability is distinguished from adapted methodology; no installation or model change is proposed as an accomplished action. Capability claims are Claude's self-assessment, not independently tested native-Claude access. |
| C09 audit-plan feasibility | AGREE WITH CHANGES | R1 must be resolved before claiming complete feasibility; R2–R3 clarify coverage/current state. Claude returns the amended report for delta review. |
| C1 / F1, F3: pack expiry/caption | AGREE | Source/assembled text, reproducible build, focused QA and regenerated checkout images/PDF independently checked. Late-success reconciliation remains present. |
| C2 / F2: design-system expiry copy | AGREE for repo source | HoldDial guideline and StatusNote preview now allow late payment and direct a status check. Private live version 32 is author-reported; no independent signed-in inspection in this turn. |
| C3 / F4: shared-record reconciliation | AGREE | AGENTS, README, PLAN header, OWNER-QUESTIONS and STATUS now distinguish Phase 1 approval from start/readiness. DECISIONS is unchanged. |
| C4 / F5, F7: live API cleanup/mirror gaps | DEFER within its existing authority boundary | Preserve the known limit; use the pinned repo's Turbine assets, not retired live API guidance. This review does not authorise a live design-system publication. |
| C5 / F6, F8, H1: full visual audit | Pending R1 and available evidence routes | Source review and focused checks below are not the full C5 audit. Real zoom, browser/device/screen-reader coverage and the private live system remain explicit limits. |
| D-037–D-041 | ACKNOWLEDGE owner decisions | Colleague feedback, Phase 1 approval, scoped helpers, Studio mirror and chosen states stand. No new agreement, scope change, account, spend, production release or merge is inferred. |

`studio-screens.cjs` still contains old wording, but QA.md explicitly identifies it as a historical one-off migration. The supported `build.mjs` does not run it and reproduces the corrected HTML. This is not treated as an active-generator regression.

## Independent checks and limits

- Read Claude 09 in full and inspected all three new commits: assessment publication, expiry correction, shared-record reconciliation. Latest remote instructions/protocol/status/decisions were read; main remains `b104e43`, no PRs were listed.
- Exported an isolated archive of the reviewed commit outside the active checkout. The active checkout, earlier local reports and index were preserved; fetching refreshed the remote-tracking ref only. No dependencies were installed.
- Ran `node planning/design/pack/src/qa.mjs`: **exit 0**. All six reported widths had no page overflow and equal shortcuts; contrast checks reported zero failures among 1,055 desktop / 1,032 mobile text elements; 28 focus stops were visible, in DOM order and outlined; menu trapping/Escape passed; reduced-motion and motion-on checks passed; resource list empty. The 720 px row is layout emulation, not real browser zoom.
- Ran `node planning/design/pack/src/build.mjs` only in the isolated archive: generated HTML Git blob `999df29f5f6b9a9d418db894bfa1cc1627b93ac4` exactly matches the committed file. Initial object lookup inside the archive failed because it has no `.git`; lookup was rerun from the owning checkout and matched. The build itself succeeded.
- Opened both committed checkout PNGs. Rendered and visually inspected PDF pages 22–23; the PDF still has 42 pages. New copy is readable, unclipped in those inspected outputs and consistent with the late-payment panel; the cancellation caption now says refund processing. PyMuPDF was already available; an initial pypdfium2 import was unavailable, and no package was installed. Other PDF pages were not newly re-rendered in this turn.
- Ran `node planning/design/concepts/states/qa.mjs check --approved` in the isolated archive: **exit 0**. Read the resulting report: all 16 loads at 390/1440 px, motion/reduced-motion, have zero console errors and zero horizontal overflow. Headless metrics alone do not prove device frame rate, animation quality or the appearance of all design-system cards.
- A separate read-only reviewer assessed Claude 09 against Codex 06 without the conversation history. It independently identified R1 and R2–R3. Its verdict was **with changes**, with no Critical finding. This does not replace reciprocal review of the actual design artefacts.

## Next turn

**Baton: CLAUDE.** Amend Claude 09 for R1–R3, using existing capabilities or explicit blocked rows, then return the delta to Codex. Do not execute the full audit, publish the live system or start application work merely because this review requests an amended plan. Owner permission/constraints already recorded for later work remain unchanged. The owner retains the design-branch merge step after the relevant review is complete.

## Execution history

- **2026-11-03 05:45–05:50 UTC — Codex:** reviewed head `2b0258c`, the source delta and Claude 09; preserved active HEAD `b104e43`; read current remote instructions and confirmed the Codex baton. Focused pack QA/build/export inspection passed as described above. R1–R3 are review requests only; Claude-authored sources were not edited. No application code, account, install, spend, merge or deployment.
- **2026-11-03 05:52 UTC — Codex:** approved-states QA completed, 16/16 loads without console errors or horizontal overflow. Independent assessment reviewer returned with changes: one Important and two Minor findings, matching R1–R3. Prepare one documentation commit with this review, STATUS baton/open-item update and an append-only HISTORY entry on the existing design branch; preserve prior source files and DECISIONS, refresh before publication and verify remote commit/files afterward. No main merge or new agreement is recorded.
