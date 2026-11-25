# CategoryHero

The top of a category page: the service object as a raised key, the category name, one line, and the location chip.

## Anatomy
1. Breadcrumb in mono caps: Home / Find a service / Wash & Detailing.
2. Key object: 128px key-cap (`--sh-key`) holding the 84px service object (84/54px on phones).
3. Name as display text and one sentence below it, muted.
4. LocationChip on the right (moves below on phones).
5. Filter bar under it (`.cx-filterbar`): sub-service chips (`.cx-chip`), *Comes to you*, *Open now*, and the result count on the right ("18 businesses · nearest first"). On phones the bar scrolls sideways and the count hides.
6. Below: the full-width ListingCard grid (3 / 2 / 1 columns), then *Show 9 more*.

## States
results · loading (cards as ghosts) · empty (EmptyState: "No wash businesses near Polokwane yet." with *Search within 100 km* and *Change location*)

## Tokens used
`--sh-key`, `--radius-xl`, `--radius-lg`, `--surface`, `--canvas`, `--frost`, `--hair`, `--muted`, `--space-6`, `--space-4`.

## Do / Don't
- Do use the full width; the old page left 40% empty (B-06).
- Don't show "Cost to search R0" or any fee line.
- Don't put more than six chips in the bar.

## Screens
`planning/design/redesign-2026-11/A3-category/png/a3-1-category-*.png`, `a3-2-category-empty-*.png`.
