# AdminReview

The admin's queue row and detail for ID checks that Didit sends for a second look: Didit's result as check bars, its warnings, a link to the session, and a decision with a fixed reason list.

## Anatomy
- **Queue** (`.cx-qtable`): tabs In review / Approved / Declined with counts; columns Person (initials, name, email, ID ••••0823), Didit result (badge), Why it needs a look (Didit's warning in plain words), Document, Waiting (`.cx-age`, red past the 1-business-day target), Review. Oldest first; the first row is highlighted. Phones: stacked cards.
- **Detail**: left, a card "Didit result" with `.cx-checkbar` rows (Document authentic, Liveness, Face match %, Document readable), a warn note listing Didit's warnings, the session reference and attempt ("attempt 1 of 3"), and *Open session in Didit ↗*; a note that photos live only in Didit and opening them is logged there. Right, "What Didit read" (name on document next to account name, document type, ID ••••0823, date of birth check) and **Decision**: *Approve* (`.cx-btn.approve`), "or decline with a reason", `.cx-radio` reasons, optional note, *Decline and tell them why* (`.cx-btn.danger`), "Declining uses one of their 3 tries."
- Reviewed-review moderation (A8) uses the same layout: list of reported reviews on the left, the review with "Enquiry on record", reporter and reason on the right, *Keep review* / *Hide review* with a required reason.

## States
queue with items · queue empty ("Nothing waiting for review.") · detail · decided (row moves to its tab; both sides emailed)

## Tokens used
`--surface`, `--hair`, `--canvas`, `--sky` (current row), `--ok`, `--warn`, `--err`, `--control-edge`, `--canvas-2`, `--muted`.

## Do / Don't
- Do require a reason for every decline and every hide; the person always learns why.
- Do keep the ID masked; CarworX has no reveal because it stores only the last 4 digits.
- Don't show or store the ID photo or selfie in CarworX.
- Don't let a low rating alone be a reason to hide a review.

## Screens
`planning/design/redesign-2026-11/A7-admin-id-review/png/a7-1-queue-1280.png`, `a7-2-detail-1280.png`, `a7-3-empty-1280.png`, `A8-reviews/png/a8-7-admin-moderation-1280.png`.
