# A3 · Category page

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-06, B-02, B-12 (see `planning/claude/BACKLOG.md` on `claude/backlog`, PR #163).

## States

| State | Source | Screenshots |
|---|---|---|
| Category: Wash & Detailing | [`a3-1-category.html`](a3-1-category.html) | [1280](png/a3-1-category-1280.png) · [390](png/a3-1-category-390.png) |
| Category: empty for this area | [`a3-2-category-empty.html`](a3-2-category-empty.html) | [1280](png/a3-2-category-empty-1280.png) · [390](png/a3-2-category-empty-390.png) |

## Design notes (why)

- **Pinned shared header** (no more scrolling-away Sites header).
- **Category hero:** the service object as a raised key (the same 3D key-cap as the landing tiles), the name, one line, and the **location chip** on the right, so you always see *where* results are for and can change it in one tap.
- **Full-width grid:** 3 columns at desktop, 2 at tablet, 1 on phones, so there is no empty right-hand 40% (B-06).
- **Cards** get a soft cover band (cover photo when the business has one, the service object on a tint when not), distance or *Comes to you* in the corner, rating, area, services and open-now.
- **Sub-filter chips** in a frosted bar; the result count sits at the end so it updates without moving the layout. No "Cost to search R0".
- **Empty state:** says plainly there is nothing *near this place yet*, and offers the two useful next steps (widen to 100 km, change location).
