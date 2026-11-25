# A4 · Signed-in customer home

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-07, B-14 (see `planning/claude/BACKLOG.md` on `claude/backlog`, PR #163).

## States

| State | Source | Screenshots |
|---|---|---|
| Customer home, signed in | [`a4-1-home.html`](a4-1-home.html) | [1280](png/a4-1-home-1280.png) · [390](png/a4-1-home-390.png) |
| Customer home, no location set | [`a4-2-home-no-location.html`](a4-2-home-no-location.html) | [1280](png/a4-2-home-no-location-1280.png) · [390](png/a4-2-home-no-location-390.png) |

## Design notes (why)

- **Structure borrowed from food-delivery apps, styling ours:** location chip first, a friendly greeting, one big search, the five service keys as an icon row, then horizontal rows.
- **Rows:** *Near you* (nearest first), *Comes to you* (mobile teams, a CarworX strength), *Recently viewed* (compact cards, with *Clear*).
- **Fines card** sits between rows, tinted peach, so it is noticed without taking over; it shows the count, total and the nearest discount date.
- **Short labels in the icon row** (Wash, Repairs, Glass, Tyres, Fines) so phones never wrap to three lines.
- **No location yet (a4-2):** one clear prompt (*Use my location* / *Type a suburb*) with the promise that we don't save the exact location, and dashed placeholders that show what will appear. The fines card becomes *Check your traffic fines · Get started*.
- After sign-in, customers land here and businesses land on `/provider` (B-14).
