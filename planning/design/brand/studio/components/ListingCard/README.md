# ListingCard

The business card used on the landing, category, search and customer-home rows: a tinted cover band, then name, rating, area, services and open-now.

**Until B-23 (reviews) ships, the rating row is left out entirely: no stars and no New chip.**

## Anatomy
1. Cover band, 148px (120px in rails): the cover photo when the business has one, otherwise the service object on one of four tints (`.t2`–`.t4`, chosen by listing id so the same business always looks the same).
2. Top-left badge: **Verified** (`.cx-badge.ok`) when checked. Top-right: distance ("1.2 km") or "Comes to you" in mono.
3. Name (17px semibold).
4. Rating row: stars, the average in ink, the count in brackets, then the area. A business with no reviews shows **New** (`.cx-new`) and "No reviews yet" instead of zero stars.
5. Services, up to three, joined with " · ".
6. Open-now line (green dot, "Open until 18:00" or "Opens 08:00 tomorrow") and a **Mobile** badge for mobile teams.

## States
with photo · object fallback · new (no reviews) · mobile · hover (lifts 2px)

## Tokens used
`--surface`, `--hair`, `--sh-1`, `--sky`, `--peach`, `--note`, `--ok-bg`, `--ok` (Verified and open), `--frost`, `--muted`, `--graphite`, `--rating` (proposed).

## Do / Don't
- Do make the whole card one link to `/p/<id>`.
- Do show "New" rather than empty stars; being new must never look like being bad.
- Don't show prices, fees or "Book" on directory-launch cards.
- Don't stack more than two badges.

## Screens
`planning/design/redesign-2026-11/A3-category/png/a3-1-category-1280.png`, `A8-reviews/png/a8-1-cards-*.png`.
