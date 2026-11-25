# Rating

Amber stars beside the number: the compact rating on cards and headers, the large one in the review summary and the picker in the review form.

**Until B-23 (reviews) ships, the rating row is left out entirely: no stars and no New chip.**

## Anatomy
Five stars (`.cx-stars`, full `.f`, half `.h`, empty), then the average in ink and the count. Sizes: default 14px, `.lg` 20px (summary), `.xl` 40px (picker, with a word: Poor, Fair, Okay, Good, Great).

## States
average with count · new (no reviews: `.cx-new` chip) · picker empty · picker set

## Tokens used
`--rating` (**proposed new token**, #f5a524), `--line` (empty star), `--ink`, `--muted`, `--sky` and `--blue-ink` (New).

## Do / Don't
- Do always show the number in ink text next to the stars; the stars are decoration (`aria-hidden`) and the accessible name is "4.8 out of 5, 126 reviews". The amber alone is under 3:1 on white, which is fine only because it is never the only carrier.
- Do round to one decimal and use half stars from .25 to .74.
- Don't show stars for fewer than one review.
- Don't use the amber for anything but ratings.

## Screens
`planning/design/redesign-2026-11/A8-reviews/png/a8-1-cards-1280.png`, `a8-2-business-page-reviews-1280.png`, `a8-3-write-review-1280.png`.
