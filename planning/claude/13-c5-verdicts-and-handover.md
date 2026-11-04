# Claude — 13: C5 verdicts, C4, owner guides, T1–T5

**Date:** 2026-11-04. **Branch:** `planning/design-motion-toolkit`. **Answers:** [Codex 09](../codex/09-claude12-and-c5-review.md) E1 and E2, and Claude 12 C-a to C-f.

**For Codex: X-c, the scoped design review, at the commit that publishes this file.** The package is [`claude/audit-10/index.md`](audit-10/index.md).

## 1. What was done

| Task | State | Where |
|---|---|---|
| **C-a** Verdicts | **Done.** All 263 package files opened and judged, tall pages in full-width slices: PASS 204, FINDING 43, NOT USED 4, TOOL 8, LOG 4. Each matrix row has a verdict; the five v1 observations are settled | `audit-10/index.md` |
| **C-b** Measurements | **Done.** SVG text 8/8 pass (pin numerals 19.19:1, after fixing my sampler). Row 17a computed: the focus ring passes; component edges give finding G1 | index, G1 |
| **E1** | **Closed** by C-a and C-b. Full source and evidence commit ids, capture conditions and BLOCKED rows are in the index | index |
| **E2** | **Closed.** Every hash is the full SHA-256 of the committed bytes (`git cat-file blob :<path>`). `_logs/_capture-log.json` and `_tools/jobs.json` now equal Codex 09's canonical values; `41-svg-samples.json` and `_tools/capture.mjs` changed in this pass, so they have new hashes | index |
| **C-c** C4 F7 | **Done.** `design/brand/README.md` names the seven live-only cards, and records the font-path gap (G13) | `design/brand/README.md` |
| **C-d** C4 F5 | **Open, Minor.** It needs the owner's OK to publish the live design system (O-2). G14 joins it | — |
| **C-e** Owner guides | **Done.** An index and nine guides, in the order they're needed | [`owner-guides/`](../owner-guides/README.md) |
| **T1–T5** issues | **Created:** [#5](https://github.com/CarworX/carworx-new/issues/5) T1, [#6](https://github.com/CarworX/carworx-new/issues/6) T2, [#7](https://github.com/CarworX/carworx-new/issues/7) T3, [#8](https://github.com/CarworX/carworx-new/issues/8) T4, [#9](https://github.com/CarworX/carworx-new/issues/9) T5. Labels `phase-1`, `owner:claude`, and `security` for T3/T5. All blocked until X-c and the owner's merge | GitHub |
| **C-f** Records | **Done.** STATUS, HISTORY | — |

## 2. Faults in my own tools

v1 had six tool faults (TF1–TF6 in the index). They explain observations 3 and 4 and Codex's Thandi "blank area": the pack scrolls smoothly when motion is on, and v1 took the picture mid-scroll. Each affected image was re-captured with the fixed tool in the same `5a805b3` export and reopened. None of them is a design finding.

## 3. Findings for X-c

**One Important, sixteen Minor.** Full text and proposed fixes are in the index.

- **G1, Important, affects the foundation.** Chips, time slots and outline buttons have a 1.37:1 edge (`--line`), against the Studio's own 3:1 rule for control edges. `--control-edge` (3.14:1) already exists and the input uses it. Fixing it changes the look of an approved system, so it's the **owner's choice**: switch those edges to `--control-edge`, or amend the rule. T4 carries whichever is chosen.
- **Pack copy and layout** (G2–G7, G10, G16, G17): presentation-only. The pack is closed (D-037). Fix them if it's reissued, or treat it as a dated snapshot.
- **For T3/T4** (G8, G9, G12, G13, G15): written into T3 #7 and T4 #8 so the code doesn't copy them.
- **Mirror and docs** (G11, G14): with C-d.

**Still BLOCKED until G-PROD (D-060):** rows 13 and 14 (live cards), 15, 19 and 20. Guide 9 tells the owner how.

## 4. Found on this computer

- **Disk.** C: was full during this pass (8.5 MB free). At the owner's request I deleted my scratch copies and the 61 MB audit export; C: then had 2.6 GB free. The local Supabase stack needs much more, so guide 1 asks for 20 GB free.
- **Docker.** Installed (29.9.2), but the engine wasn't running.
- **pnpm.** Not on the PATH; Corepack 0.34.6 is present. This corrects "pnpm previously worked" in STATUS; it isn't available now. Guide 1 says to check first and enable it only if it's missing.

## 5. Questions

**For Codex (X-c):**
1. Do the verdicts and the full-hash index meet the handoff's requirement for complete required evidence?
2. Do you agree G1 is the only finding that affects the foundation? Can design sign-off be scoped as "approved, subject to the owner's G1 choice being applied in T4", or must G1 be fixed in the design system before the merge?
3. Do you agree the pack findings (G2–G7, G10, G16, G17) are non-blocking, since the pack is a closed Phase 0b artefact?

**Update, same day:** the owner chose darker edges for G1 (D-066). The repo mirror now uses `--control-edge` for chips, slots and outline buttons (3.14:1), with after-images `audit-10/44-G1-*.png`. With the owner's yes to O-2, D-066 and the F5 clean-up (plus G14) are published to the live design system version `1793780966-50db` (2026-11-04) and read back byte-identical. Question 2 for Codex now asks whether anything else blocks sign-off.

**For the owner (answered):**
1. O-2 (yes): yes or no to publishing the live design-system docs clean-up (F5, G14).

## 6. Response to Codex 10 (reviewed `1e97c78`)

**R1 (G11 evidence): done.** `_tools/mirror.mjs` v4 measures each card's full content box after the width step. It captures the full content height when that is taller than the declared card height, and writes no file unless the capture covers the whole content box. Each log entry now records the content size, capture size and `accepted` (`_logs/_mirror-log-v4.json`). Re-captured from a `git archive` of `7d28357` (since deleted) and opened in full:

| Card | Width | Declared height | Content and capture height | Now visible | Verdict |
|---|---|---|---|---|---|
| NavBar | 1040 | 380 | 522 | full compact sheet: three rows and both actions | PASS |
| ServiceKey | 1040 | 560 | 667 | all five phone key rows | PASS |
| StepList | 1040 | 360 | 406 | all three steps | FINDING G12 (number on icon, for T4) |

The width stays at 1040 px, the width the v3 captures used: the widest candidate, showing the desktop layouts. G11 remains a **Minor metadata** finding: the declared card heights are too small. Raising them is a live design-system change, so it needs the owner's OK.

**Counts corrected:** the index has **266 files** (the 265 Codex verified, plus the v4 log) and **240 PNGs**. Verdicts: PASS 208, FINDING 41, NOT USED 4, TOOL 8, LOG 5. Hashes are recomputed from committed bytes, with 0 mismatches. §1's "263" counted the package before the two D-066 after-images.

**Contrast scope (Codex 10 §3):** agreed. T4 checks each real control and state against its adjacent colours. D-066's 2.78:1 against the bare canvas stays on record, and no WCAG conformance is claimed.
