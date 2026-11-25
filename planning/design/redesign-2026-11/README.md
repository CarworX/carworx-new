# Redesign 2026-11 · mockups for owner approval

Static HTML mockups and screenshots for the backlog in `planning/claude/BACKLOG.md` (PR #163), made by the Claude design session on 25 Nov 2026 (SAST). **Mockup images only; no app code changes.** Every name, ID number, email and fine is synthetic (`example.co.za`, ID numbers that fail the checksum).

| Folder | What | Backlog |
|---|---|---|
| [A1-shell](A1-shell/) | Shared header (signed out, signed in + avatar menu, phone sheet, scrolled) and the one footer | B-02 B-03 B-04 B-14 |
| [A2-landing](A2-landing/) | Landing: services anchor, new Fines section, "Free to list", dashboard glimpse from the real `/provider` | B-04 B-08 B-12 B-20 |
| [A3-category](A3-category/) | Category page with pinned header, hero, location chip, full-width grid, empty state | B-06 |
| [A4-customer-home](A4-customer-home/) | Signed-in customer home (location, search, icon row, rows, fines card, no-location state) | B-07 B-14 |
| [A5-auth](A5-auth/) | Sign up (consent unticked / ticked), sign in, Google first-time consent | B-10 B-11 |
| [A6-fines](A6-fines/) | Verify ID, pending, rejected, my fines (several / none / not payable), detail, pay handoff, awaiting issuer, receipt | B-20 B-21 B-22 · D-099 |
| [A7-admin-id-review](A7-admin-id-review/) | Admin ID queue, review detail (masked ID + reveal), empty | B-21 |

## How it is built

- `_shared/home.css` and `_shared/landing.css` are **verbatim copies** of `apps/web/app/home/` at `main` @ `fe6a955`; fonts, service objects, icons and state illustrations are copies of `planning/design/brand/exports/studio/`. The turbine sprite, hero objects and windscreen drawing are cut unchanged from `apps/web/app/home/preview.html` at build time.
- `_shared/redesign.css` holds only the **new** pieces (prefix `rd-`), built on the same custom properties (`--ink`, `--canvas`, `--blue`, `--sh-*`, 8 px rhythm). These are the candidates for the design-system update (Chunk B).
- Rebuild from the repo root:
  ```
  node planning/design/redesign-2026-11/_src/build.mjs     # writes the HTML
  node planning/design/redesign-2026-11/_src/shoot.cjs     # Playwright, 1280 and 390 wide, 2x, full page
  python3 planning/design/redesign-2026-11/_src/shrink.py  # 256-colour dithered PNGs
  ```

## Open points for the owner

- **O-2** payment partner (Pay@ or Electrum): the pay screens say "payment partner" until it is signed.
- **O-3 / B-21** ID photo is shown as required here; retention period and the Information Officer line in the privacy note need the legal answer.
- The app-glimpse phone carousel (booking, quotes, payment) is left off the landing until Phase 3.
