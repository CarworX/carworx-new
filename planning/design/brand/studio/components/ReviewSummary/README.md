# ReviewSummary

The rating block at the top of a business's reviews: the big average, stars, the count, a 5-to-1 bar breakdown, the review rule and the write action.

## Anatomy
1. Average (56px light), large stars, "126 reviews".
2. Five rows: "5 ★", a bar filled in `--rating` to that share, the count.
3. Under the card: a StatusNote with a shield: "Only customers who contacted this business through CarworX can review it."
4. *Write a review* (primary, full width). Signed out it goes to sign in; not eligible it opens the "Message them first." state.
5. Beside it (desktop) or under it (phone): sort chips *Most recent* · *Highest* · *Lowest* · *With a reply*, then ReviewItems and *Show more reviews*.

## States
has reviews · no reviews yet (EmptyState "No reviews yet." + *Send a message*) · not eligible to write

## Tokens used
`--surface`, `--hair`, `--sh-1`, `--rating`, `--canvas-2`, `--muted`.

## Do / Don't
- Do show the count next to every average.
- Do hide the bars until there are at least 3 reviews (show the list only).
- Don't let businesses choose which reviews show.

## Screens
`planning/design/redesign-2026-11/A8-reviews/png/a8-2-business-page-reviews-*.png`, `a8-8-no-reviews-*.png`, `a8-4-cannot-review-*.png`.
