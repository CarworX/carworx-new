# ReportDialog

A modal for reporting a review: fixed reasons, an optional note, and a promise that the reporter stays anonymous.

## Anatomy
`<dialog class="cx-dialog">`: title "Report this review", one line "Our team checks every report. The reviewer isn't told who reported it.", radio reasons (`.cx-radio`): Not about a real visit or enquiry · Rude, hateful or threatening · Shares personal details · Spam or advertising · Something else; "Anything else? (optional)"; *Send report* and *Cancel*.

## States
open · sending · sent (closes; the review shows "Reported. Our team will look at it." to the reporter only) · already reported (Report link hidden)

## Tokens used
`--surface`, `--radius-xl`, `--sh-3`, `--control-edge`, `--ink`, `--muted`; backdrop rgba(13,15,18,.45).

## Do / Don't
- Do use the native `<dialog>` with `showModal()`, so focus is trapped and Esc closes it.
- Do require a reason; "Something else" requires the note.
- Don't let a business report a review more than once.

## Screens
`planning/design/redesign-2026-11/A8-reviews/png/a8-6-report-review-*.png`.
