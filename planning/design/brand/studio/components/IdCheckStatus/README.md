# IdCheckStatus

The status screens of the ID check (Didit, owner's Option A): a state illustration, one headline, one sentence, then steps, a reason or the tries meter.

## Anatomy
`.cx-status`: illustration (180px; 140px on phones, stacked), headline (28px), one sentence (muted), then a `.more` area with a StepList, a StatusNote with the reason, the **TriesMeter** (`.cx-tries`) and actions. The checking screen uses `.cx-spin`: the turbine mark turning inside a blue progress ring (stops under reduced motion).

## States and copy
| State | Illustration | Headline | Then |
|---|---|---|---|
| Checking | spinner | Checking… | "This usually takes under a minute." Steps: ID photographed ✓, Selfie taken ✓, Didit is checking |
| Approved | sent | You're verified. | ok note "Done once, for good", *See my fines* |
| Declined, tries left | error | We couldn't confirm your ID. | err note with Didit's reason in plain words, tries meter "Try 1 of 3 used · 2 left", *Try again*, *Contact support* |
| No tries left | paused | We couldn't confirm it after 3 tries. | last reason, meter 3 of 3, reference "VR-…", *Contact support* |
| In review | review | A person is checking it. | steps, "within one business day" |

The intro screen before Didit is a card with three StepList steps, the three accepted documents, the privacy StatusNote (Didit processes the photo and selfie; CarworX keeps only the result and the last 4 digits), the consent box and *Start verification*.

## Tokens used
`--surface`, `--hair`, `--sh-1`, `--radius-lg`, `--muted`, `--blue`, `--canvas-2`, `--err` (used tries), `--ok-bg`/`--err-bg` (notes).

## Do / Don't
- Do say what happens next and how long it takes, in every state.
- Do say plainly that CarworX never stores the ID photo or selfie.
- Don't blame the person; "It usually works on the next try."
- Don't show the ID number beyond the last 4 digits.

## Screens
`planning/design/redesign-2026-11/A6-fines/png/a6-1-verify-intro-*.png` to `a6-6-in-review-*.png`.
