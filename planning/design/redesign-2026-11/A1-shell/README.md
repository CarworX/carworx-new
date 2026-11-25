# A1 · Shared header and footer

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-02, B-03, B-04, B-14 (see `planning/claude/BACKLOG.md` on `claude/backlog`, PR #163).

## States

| State | Source | Screenshots |
|---|---|---|
| Header signed out | [`a1-1-signed-out.html`](a1-1-signed-out.html) | [1280](png/a1-1-signed-out-1280.png) · [390](png/a1-1-signed-out-390.png) |
| Header signed in, avatar menu open | [`a1-2-signed-in-menu.html`](a1-2-signed-in-menu.html) | [1280](png/a1-2-signed-in-menu-1280.png) · [390](png/a1-2-signed-in-menu-390.png) |
| Mobile sheet, signed out | [`a1-3-mobile-sheet-signed-out.html`](a1-3-mobile-sheet-signed-out.html) | [1280](png/a1-3-mobile-sheet-signed-out-1280.png) · [390](png/a1-3-mobile-sheet-signed-out-390.png) |
| Mobile sheet, signed in | [`a1-4-mobile-sheet-signed-in.html`](a1-4-mobile-sheet-signed-in.html) | [1280](png/a1-4-mobile-sheet-signed-in-1280.png) · [390](png/a1-4-mobile-sheet-signed-in-390.png) |
| Scrolled, pinned pill | [`a1-5-scrolled.html`](a1-5-scrolled.html) | [1280](png/a1-5-scrolled-1280.png) · [390](png/a1-5-scrolled-390.png) |

## Design notes (why)

- **One header everywhere: the landing pill.** It is already the strongest, most recognisable piece of the brand, and it is fixed, so the menu never scrolls away (the B-02 category-page bug).
- **Signed-in aware.** Signed out: *Sign in* + *Sign up*. Signed in: an avatar button with the first name. The menu holds exactly *My fines* (with a count, because fines are time-sensitive), *Account*, *My business* and *Sign out*. Sign out is set apart and muted so it is never hit by accident.
- **Three links only: Find a service · Fines · For businesses.** All three scroll to landing sections (`/#services`, `/#fines`, `/#business`), so there is no separate find-a-service page and no "All services" link (B-04).
- **Phone:** the avatar (with a red dot when fines are open) sits beside the menu button; the sheet repeats the account actions as large pills. A signed-out phone keeps today's black *Sign in* pill.
- The sheet states are phone-only; their 1280 shots show the desktop header for the same person.
- **Scrolled:** the same pill, slightly more opaque with a deeper shadow, so content passing under it stays readable.
- **One footer** (the landing's big lockup) with one link row, on every public page including sign in and the fines pages (B-03).
