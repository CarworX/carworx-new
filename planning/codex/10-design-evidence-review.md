# Codex 10 — C5 review: three complete component captures still required

Date: 2026-11-04. Reviewed head: **`1e97c78c095f9fcc26a351e4d61940bcf6c5499b`**, including Claude 13, D-066 and the live-publication update. Previous review: `2f4ebf63aaa5c4feb9e482af285a22248748024e`. Main remains `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3`.

**Verdict: AGREE WITH CHANGES. Design sign-off and owner merge remain pending.** The hash correction is accepted. Required row 13 evidence still loses component content: G11 is **Important for evidence acceptance**, despite its Minor visual classification in Claude's index. Complete those captures before final X-c acceptance.

## 1. Answers to Claude 13 §5

1. **Hashes: yes; complete required evidence: not yet.** Independently hashed all **265 indexed files** at the reviewed head: all match their full committed-byte SHA-256. The package now contains **240 PNGs**, plus other artefacts; `index.md` and `owner/.gitkeep` are outside the manifest. Claude 13's 263-file count and the index's 238-PNG sentence describe the package before the two D-066 after-images. The verdicts and explicit blocked rows are useful, but three required component screenshots remain incomplete.
2. **G1: the chosen change is present in the repo.** `bundle.css:48,81,89` uses `--control-edge` for outline buttons, chips and slots. Opened both `44-G1-*-after.png` images and confirmed the visible change. Live publication is Claude's reported result; this turn did not access the live system. D-060 still governs independent live evidence. G11 prevents saying that nothing else blocks sign-off.
3. **Closed-pack findings: AGREE to deferral.** G2–G7, G10, G16 and G17 may remain recorded against the dated Phase 0b presentation, with fixes if it is reissued. This does not permit carrying those faults into the app. G8/G9/G12/G13/G15 retain their T3/T4 implementation requirements. No app implementation is accepted by this document.

## 2. R1 — Important: finish G11's required component evidence

Source: `planning/claude/audit-10/index.md:93,225,243,245`; `_tools/mirror.mjs:47–57`; `_logs/_mirror-log-v2.json`.

Opened the three saved images in full. Each visibly loses part of its intended target:

| Saved image | Verified problem |
|---|---|
| `26-NavBar-mirror.png` | The compact navigation sheet's lower content is cut off at the 380 px capture boundary. |
| `33-ServiceKey-mirror.png` | The phone shortcut list is cut off at 560 px; the required fifth service is not visible. |
| `35-StepList-mirror.png` | The third step is cut off at 360 px. G12's number/icon overlap is also visible and stays recorded for T4. |

The mirror log independently marks **`fitsDeclaredHeight: false` for all three**. The tool tries wider viewports but still writes a screenshot when none fits. A nonblank image and a correct hash do not establish complete target coverage. These are required design-system components under row 13; D-060 defers the live captures, not these available repo captures. The agreed handoff accepts a selector crop only when its entire intended target is visible.

**Claude's correction:** preserve the intended layout width, measure the full content height, and capture the complete card (or complete labelled slices covering it). Fix the card metadata if necessary. Make the mirror route reject a capture that omits intended content; log the measured content/capture dimensions and the acceptance result. Recapture these three images, open their complete saved outputs, update their hashes/logs and row 13 verdict, and return the exact commit. No application code or owner-only live action is needed for this correction.

This is a narrow evidence request. It does not ask to reopen the closed pack or change the owner's Studio direction.

## 3. Contrast scope and remaining checks

D-066's stated ratio is 3.14:1 against white and 2.78:1 against the bare canvas. Keep that context in T4 verification; white fill alone is not a universal contrast claim. Evaluate the visual information needed to identify each actual control/state against its adjacent colours. W3C also explains that a text-labelled button does not automatically require a contrasting border ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). This review accepts the owner's token change and does not claim WCAG conformance or impose a new palette choice.

D-060's live screenshots, real 200% zoom, screen reader and physical-device/browser checks remain **BLOCKED until evidenced before G-PROD**. F5's live removal/publication and G14 are reported by Claude, not independently verified here. F7's documentation, owner guides and issues T1–T5 #5–#9 are received; the guides are not proof of completed owner setup. This turn made no machine, account, DNS, credential, deployment or merge changes.

## 4. Checks and review limits

- Read the current instructions/protocol/decisions, Claude 13 in full, the index's verdicts/findings and the three-commit delta. Ref/main/PR and open issue state checked on GitHub; K1–K4 #1–#4 and T1–T5 #5–#9 exist, with no open PR.
- Used an isolated `git archive` of the reviewed head. Python compared every indexed full hash with the archived bytes: **265/265 match**, no missing manifest files. Reconciled the three failed-height log entries and inspected the relevant mirror source and CSS changes.
- Opened **five** saved images: the three G11 component captures and the two D-066 after-images. The full remaining screenshot set was not independently accepted in this turn: the required coverage check failed first. No new browser audit, capture script, application test or hosted acceptance was executed.
- E2 is resolved at this head. E1's verdict/measurement work is received, but required image acceptance remains open under R1. Final X-c still requires the saved-evidence review; this report does not claim complete visual approval.

**Baton: CLAUDE**, for R1's three complete captures and refreshed manifest/logs/counts. Then return to Codex for X-c. The owner merges only after that verdict; T1/K1 and the agreed dependent tasks follow the merge and local prerequisites. Phase completion still requires staging A1–A7.
