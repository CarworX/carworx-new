# LocationChip

A white pill that always shows where results are for, and changes it in one tap.

## Anatomy
Pin icon, the place ("Rosebank, Johannesburg"), then either a blue **Change** (category page) or a chevron (customer home). Opens the existing `LocationPicker`.

## States
- set: place in ink, **Change** in `--blue-ink`
- unset (`.unset`): "Set your location" in muted text, chevron
- loading (after *Use my location*): "Finding you…" and the pin spins once
- error: the chip keeps the last place; the error appears as a StatusNote **under** the search bar, never inside it (B-05)

## Tokens used
`--surface`, `--sh-1`, `--radius-pill`, `--ink`, `--muted`, `--blue-ink`, `--space-2`.

## Do / Don't
- Do name a suburb and city, never coordinates.
- Don't save the exact location; say so where people set it.
- Don't put error text inside the chip or the search row.

## Screens
`planning/design/redesign-2026-11/A3-category/png/a3-1-category-1280.png`, `A4-customer-home/png/a4-1-home-*.png`, `a4-2-home-no-location-*.png`.
