# A2 · Landing

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-04, B-08, B-12, B-20 (also shows the B-01/B-09 single-intro fix by omission) (see `planning/claude/BACKLOG.md` on `claude/backlog`, PR #163).

## States

| State | Source | Screenshots |
|---|---|---|
| Landing, signed out | [`a2-1-landing-signed-out.html`](a2-1-landing-signed-out.html) | [1280](png/a2-1-landing-signed-out-1280.png) · [390](png/a2-1-landing-signed-out-390.png) |
| Landing fines section, signed in | [`a2-2-fines-section-signed-in.html`](a2-2-fines-section-signed-in.html) | [1280](png/a2-2-fines-section-signed-in-1280.png) · [390](png/a2-2-fines-section-signed-in-390.png) |
| For businesses with the redrawn dashboard | [`a2-3-for-businesses.html`](a2-3-for-businesses.html) | [1280](png/a2-3-for-businesses-1280.png) · [390](png/a2-3-for-businesses-390.png) |

## Design notes (why)

- **"Find a service" lands on the category section** (`id="services"`); the fifth tile, *Fines & Vehicle Admin*, scrolls down to the fines section instead of opening `/fines`.
- **New Fines section** replaces the separate `/fines` page (D-099). It keeps the existing windscreen drawing and explains the three honest steps (confirm ID once with a photo and selfie on the verification partner's screen, see fines, pay on the partner's checkout; "Paid" only after the issuer confirms). Signed out the button reads *Sign in to see your fines*; signed in (a2-2) the drawing is swapped for the person's own short list and *See my fines*.
- **"Free to list."** replaces every pilot / R0 line (owner decision O-1). The hero badge reads *Free to browse · Free to list*.
- **Dashboard glimpse redrawn from the real `/provider` screen:** listings with Live / In review, enquiries (name, time, message), people with access, and the *Finish setup* checklist with the same task names as `team/Hub.tsx`. No bookings, earnings or fee tiles, because the directory launch has none (B-08). When Phase 3 ships, both change together.
- **The app-glimpse phone carousel is left out**: it shows booking, quotes and payment, which the directory launch doesn't offer. The hero objects stay as approved.
- Only the brand intro remains (not drawn here), so the second "CarworX" splash after sign-out disappears.
