# States: the approved 404 and loaders

**Status:** approved set (2026-11-03). The owner picked these from the ten concepts in [`../concepts/states/`](../concepts/states/NOTES.md), which stays as the record of what was explored.

**Open:** `index.html` (one self-contained file, about 89 KB). Nothing else is needed except Google Fonts.

## What was chosen

| Where | Loader | What shows |
|---|---|---|
| 404 | Dot-grid lens (404 concept 4) | Exactly as built in the concepts |
| Buttons | Hold dial (loader 3) | The blue spinning arc, in the ink pill and the light pill |
| In a page, a multi-step wait the user is watching (search, availability, quotes) | Hold dial (loader 3) | The ring and the rolling status line |
| Cards and lists | Skeleton (loader 4) | The skeleton row |
| In a page, when the layout is known in advance (results, a listing, the dashboard) | Skeleton (loader 4) | Skeleton cards and the shimmer |
| Between pages, the main loading screen | Dot-grid ripple (loader 5) | The ripple splash, with the blade pulse |

Rotor spool (loader 1) and Blade index (loader 2) are retired.

## How to review

The dock at the bottom is a review tool, not part of the designs.

- **404** shows the lens page. Its **Desktop / Phone** switch shows the same page live inside a 390 × 844 phone frame: an iframe of this page at `#404&clean`, so it can be tried with the mouse. The frame scales down to fit short windows. On a real phone (600 px wide or less) there is no switch: the page is simply full screen.
- **Between pages** is the ripple splash with the blade pulse.
- **Where each loader goes** is one board laid out by scenario, with a short "use when" caption on each panel.
- **Still** shows the designed reduced-motion state. **Keys:** ← and →, U (Desktop / Phone), R (Still), H (hide the dock).
- **Links:** `#404`, `#404/phone`, `#between`, `#use`. Add `&clean` to hide the dock or `&still` to start still.

## The blade pulse (between pages)

- At rest the blades are pale grey, ink at 14 % (`rgba(13,15,18,.14)`).
- On one 72° index solid ink runs from the hub out to the tips and stays. On the next index it runs from the tips back to the hub, so the blades are pale again. Then out, back, out, back.
- **Timing:** the same 1.2 s ratchet clock as the rotation. With `k = floor((t + .9) / 1.2)` and `u` the time into that step, `p = inOutCubic(clamp(u / .45))`. Even `k`: the front runs from the hub to the tips; odd `k`: back.
- **Geometry:** the front runs between the mark's own hub and tip radii (`rHub` 21, `rTip` 100 in mark units; the small mark's hub is 27 and is used below 24 px), scaled to R. It starts 2 % of R inside the hub and ends 2 % past the tips, so the end states are fully pale and fully ink. The edge is feathered over 2 % of R, so the front reads as a clean band.
- **Drawing:** one fill per rotor with a radial gradient in the mark's units, ink inside the front and pale outside. That is the same picture as the pale mark with an ink copy clipped to a circle, in one pass.
- **Where:** the splash rotor and the rotor on the board's between-pages panel. The concepts page's mini rotors pulse too. The 5 × 5 button patches have no rotor.
- **Reduced motion:** the rotor rests as the solid ink logo and does not pulse.
- Only the fill changes. The blade path and rest angles are untouched, and `build.mjs` re-checks them on every build.

## Source

This page is built from the same source as the concepts page: `../concepts/states/src/template.html`, by `node build.mjs` in `../concepts/states/`. It reuses the same code for the lens (`SCENES['404-4']`), the ripple (`rippleScene`, used by `SCENES['load-5']`), the hold dial (`HoldDial`, `roller`, `SPIN`), the skeleton (`skCard`, `skRow`, `skSync`), the board pieces (`MOCK`, `PILLS`, `ROWS`, also used by `useBoard`) and the dock. The board (`SCENES['use']`) and the phone frame are the only code that exists just for this page. Edit the template and rebuild; don't hand-edit `index.html`, because the brand sprite is injected at build time.

**Design system.** `node ds-previews.mjs` (run after the build) turns this page into four live cards in the States group of the Studio design system: `NotFound`, `NotFoundPhone` (390 px layout), `PageLoader` and `Loaders`. It writes them to `../brand/studio/components/<Comp>/preview.html`, each one root element plus one script, routed by hash. The page's `.dark` rules are renamed to `.cxs-dark` there, because the card frame puts `dark` on the document in a dark viewer. Published to the design-system artifact on 2026-11-03 (versions 28–29).

## Stills

Captured in headless Chrome with the dock hidden (`node qa.mjs stills --approved`, run from `../concepts/states/`). Desktop is 1440 × 900, phone is 390 × 844 at 2×.

| File | Shows |
|---|---|
| `01-404-desktop.png` | The 404, mid-interaction: the lens glides onto the numerals, then a click sends a pulse |
| `02-404-desktop-still.png` | The 404's reduced-motion still |
| `03-404-phone.png`, `04-404-phone-still.png` | The same at 390 × 844 |
| `05-404-phone-frame.png` | The Phone view at 1440, the lens steered by the mouse over the frame |
| `06-between-filling.png` | The pulse filling out |
| `07-between-black.png` | Fully ink, holding before the next index |
| `08-between-draining.png` | The pulse draining back |
| `09-between-still.png` | The reduced-motion still |
| `10-board.png`, `11-board-mobile.png` | The usage board at 1440 and 390, full height |

The ripple stills are painted at exact times. Exactly mid-way, filling and draining are the same picture: the front is at the same radius and only its direction differs. So `06` and `08` are taken 40 % into each run, with the front 40 % of the way out while filling and 60 % while draining.

## Checks done

`node qa.mjs check [1440|390] [motion|still] --approved`, in headless Chrome over the DevTools protocol, a fresh tab per load. Results are in `qa-report.json`.

- **Coverage:** 404, 404 Phone view, Between pages and the board, at 1440 × 900 and 390 × 844, with motion and with `prefers-reduced-motion: reduce`. That is 16 loads.
- **Console:** no errors, warnings or exceptions in any of them.
- **Horizontal overflow:** none.
- **404 at 390 × 844:** it fits without scrolling. The board scrolls vertically, by design.
- **JS time per frame** (average / 95th percentile, ms, with motion):

  | View | 1440 | 390 |
  |---|---|---|
  | 404 | 3.3 / 4.7 | 3.5 / 7.7 |
  | 404, Phone view (the framed page's own loop) | 1.8 / 3.4 | no Phone view; same as 404 |
  | Between pages | 4.3 / 6.0 | 1.7 / 3.0 |
  | Where each loader goes | 2.5 / 3.9 | 1.1 / 1.7 |

  With reduced motion the 404 runs no loop at all; the ripple paints once and the board ticks only to change its status line (0.1 ms). These figures move by a few milliseconds from run to run.
- **Brand check:** `build.mjs` verifies the mark, wordmark, lockups and rest angles before it writes either page.

## Not verified

- Real frame rates on real devices: headless Chrome renders in software. JS time per frame is the only performance number measured.
- Safari, Firefox and real touch. The Phone view's iframe and the page's full-screen behaviour on a real phone were tried only in Chromium.
- Screen readers.
