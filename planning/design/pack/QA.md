# Presentation pack: QA record (Studio rebuild)

**What was checked:** `planning/design/pack/index.html`, which `src/build.mjs` builds from `src/pack.html` and `src/parts/*.html`.

**When and by whom:** Claude on Windows 11, 2026-10-28, after the Studio rebuild (D-036).

**Tools:**
- `src/qa.mjs`: local headless Chrome, driven over the DevTools protocol with real key presses.
- `src/export.mjs`: the exports.
- PyMuPDF: renders PDF pages to images so they can be inspected by eye.

Each result is **PASSED**, **FAILED** or **UNVERIFIED**.

## Viewports and zoom

| Check | Result | Evidence |
|---|---|---|
| 360 × 640 | PASSED | No page overflow. No element extends past the right edge. The home phone screen is 306 px wide. |
| 390 × 844 | PASSED | No overflow. |
| 768 × 1024 | PASSED | No overflow. |
| 1280 × 800 | PASSED | No overflow. |
| 1440 × 900 | PASSED | No overflow. |
| 200% zoom, emulated | PASSED | Emulated as a 720 × 450 viewport, which is the layout 1440 × 900 gets at 200%. No overflow. The nav collapses to the menu button. The desktop mockups use a fixed 1280 px canvas that is zoomed to fit its frame. |
| 200% zoom, real browser zoom | UNVERIFIED | Headless Chrome can't send browser-zoom keys. Text-only zoom was not tested. |

## The five shortcuts

| Check | Result | Evidence |
|---|---|---|
| All five visible without scrolling at 360 px | PASSED | At 360 the home phone screen is 306 px wide. The fifth shortcut ends 576 px from the top of the screen, inside the 640 px fold. The orange dashed line in the mockup marks that fold. |
| All five equal | PASSED | All five rows are the same height at every width: 63 px on the 306 px screen, 60 px from 336 px up. They are one list in brief order, with the same style. The summary, desktop home and print versions show them as one row of five equal key-caps. |

## Keyboard and focus

| Check | Result | Evidence |
|---|---|---|
| Focus order | PASSED | 28 Tab stops at 1440, in DOM order. The order is: skip link → logo → six nav links → cover buttons → logo-film replay → journey and step links → table region → footer links. There is no positive `tabindex`. Mockup buttons are drawings, not controls. |
| Focus is visible | PASSED | All 28 stops show a 2 px ink outline with a 2 px offset, the Studio focus style. |
| Compact menu at 390 | PASSED | Real key presses. Opening the menu sets `aria-expanded="true"` and moves focus to "Summary". After eight Tabs, focus is still inside the sheet. Esc closes it, sets `aria-expanded="false"`, returns focus to the menu button and hides the sheet. |

## Colour contrast

| Check | Result | Evidence |
|---|---|---|
| All rendered text | PASSED, after a fix | `qa.mjs` checks every element that has its own text. It blends translucent layers down to the canvas and tests every gradient stop. The threshold is 4.5:1, or 3:1 for large text. **First run FAILED on 2 items**, both on the brand page: white "Quiet" on the quiet swatch (4.34) and the frosted-surface demo text (4.33). **Fixed:** the swatch label is now large text, and the demo uses a more opaque card with graphite text. **Re-run: 0 failures out of 1,055 elements at 1440 and 1,032 at 390.** |
| Token pairs | PASSED | Computed with the WCAG formula, and quoted on the brand page. Ink on canvas 17.0, muted on canvas 5.3, quiet on canvas 3.8 (used only for large text), blue-ink on sky 5.3, ink on signal 5.4. Status colours: ok 5.7, warn 5.8, error 6.6. Signal is never used as small text. |
| Text inside SVGs (map labels, the intro glyphs) | UNVERIFIED | The script skips text inside SVG. By eye, the map labels are white on ink pins or ink on a white pill. |

## Motion

| Check | Result | Evidence |
|---|---|---|
| Reduced motion | PASSED | Run with `prefers-reduced-motion: reduce`. The intro shows the settled lockup still (the rotor sits at its rest angle, 21.949°, and doesn't move) and then goes away. The `motion` class is never set. The floating objects have no animation, scrolling isn't smooth, no content is hidden waiting for a reveal, and the logo film holds a still frame. |
| Motion on | PASSED | Run with `no-preference`. The rotor spools, the intro hands off to the page, the objects drift and scrolling is smooth. The 16 items still hidden at the time of the check were reveals below the viewport; they appear as you scroll. |
| Scroll-linked, never scroll-jacked | PASSED | The journeys only react to which step is in the middle of the screen. The page's own scrolling is never intercepted. |

## Loading

| Check | Result | Evidence |
|---|---|---|
| No network at view time | PASSED | `build.mjs` refuses any `http(s)` `src` or `href` and any remote CSS `url()`. A headless load requests nothing except `data:` and `file:` URIs. |
| Fonts bundled | PASSED | Geist, Geist Mono and Caveat (latin subsets, SIL OFL 1.1) are vendored in `src/vendor/fonts/` with their licences and embedded as base64. |
| GSAP | Not needed | Studio's web concept used GSAP. The pack's motion is written in plain JavaScript (intro, reveals, journeys, menu), so no GSAP is bundled and none is needed. |
| File size | PASSED | `index.html` is about 590 KB, one file. The fallback of splitting it into pages was not needed. |

## Content

| Check | Result | Evidence |
|---|---|---|
| Facts unchanged from the previous pack (4005eb1) | PASSED | The summary, journeys, roadmap, decisions table and every screen's text and states were carried over word for word. Additions: the D-035/D-036 Studio line in "Key decisions already made"; brand rules quoted from `brand/README.md` (clear space, minimum sizes, colour pairs, don'ts); the Studio UI-language section; and a desktop view of the business dashboard with demo numbers. |
| States from PLAN §10 | PASSED | Same coverage as before (table below). Empty and error states now also have a small hand-drawn illustration. |
| Fictional content and "concept, not final" | PASSED | Every phone status bar, every desktop URL bar, the nav badge, the cover, the Studio section tag and the footer say "concept, not final". The footer reads "Concept, not final. All businesses, people, prices and ratings are fictional." Businesses are marked DEMO. There are no real logos, endorsements or vendor marks. |
| Logo never redrawn | PASSED | `build.mjs` inlines the white core exports with only their fill changed to `currentColor`. The intro takes its blade and glyph paths from the same files. Before building, it checks the horizontal and stacked lockup transforms and that the lockup geometry matches the mark and wordmark. |

## Exports

| Check | Result | Evidence |
|---|---|---|
| PNGs | PASSED | 27 PNGs in `exports/`: intro stills at 1440 and 390; cover, summary, brand, the eight screen groups, both desktop pages (at 1.5×), both journeys, roadmap and footer at 1440; and the eight phone screens at 390 (2×). **All 27 were opened and checked by eye.** That check found and fixed three bugs: icons wrapping above their text in phone rows, footer styles leaking into the KPI cards, and orphaned last items in the brand-page grids. Afterwards, one small contrast fix changed the brand page, and everything was exported again. The re-exported `03-brand.png` was opened again and checked. |
| PDF | PASSED | `CarworX-presentation-pack.pdf`: 42 A4 pages, 2.9 MB. Print styles hide the intro and nav, show every reveal as settled and keep the five keys in one row. They show the journeys as their full step lists, and drop blurred glows and shadows (the PDF was 11 MB with them). **Pages 1–5 and 38–42 were rendered and checked by eye**, as was a contact sheet of all 42 pages. |
| PDF page fill | Note | Each part starts on a new page, and cards and phones never split, so some pages end early. The cover page is mostly empty space. Content is complete and in order. |
| Design skills | UNVERIFIED | The design-critique and accessibility-review skills were not invoked. The checks above were done with scripts and by eye. |

## PLAN §10 state coverage

| §10 state | Where it is in the pack |
|---|---|
| Empty or limited supply | Home: limited supply. Search: nothing nearby, with the demand form. Desktop home: the "we're new" band. |
| Acknowledgement deadline | Quote: waiting for the business; no reply in time. Dashboard: "reply by". |
| Hold countdown | Checkout: the 14:32 hold dial; payment failed, still held. |
| Provisional / expired / paid-but-needs-resolution | Checkout: hold expired; paid after expiry, rebook or refund. Dashboard: waiting for payment. "Provisional" belongs to the deferred B4 option and is not drawn. |
| Quote revision and expiry | Quote: version 2 receipt replaces version 1; quote expired; change quote C1. Dashboard: write a quote. |
| Travel cost | Search band, listing bands, quote variant, checkout line, application bands |
| Payment pending or failed | Checkout: checking payment (brand loader); payment failed |
| Cancellation, refund and dispute | Checkout: cancelled and refunded; problem reported. Dashboard: card dispute. |
| Suspended provider | Listing: business paused. Dashboard: your listing is paused. |
| Errors | Home: page error. Search: results didn't load. |

## How to re-run

From the repo root:

```bash
node planning/design/pack/src/build.mjs
```

```bash
node planning/design/pack/src/export.mjs
```

```bash
node planning/design/pack/src/qa.mjs
```

The scripts need a local Chrome or Edge, and they open only the local file. `src/studio-screens.cjs` is the one-off script that restyled the previous screen markup into Studio components. It is kept for the record and does not need to be run again.
