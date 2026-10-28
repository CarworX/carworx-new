# Presentation pack: QA record

Pack: `planning/design/pack/index.html` (built from `src/pack.html` by `src/build.mjs`). Checked 2026-10-28 by Claude on Windows 11.

**Tools**
- **Built-in browser pane** (Claude desktop app): viewport emulation, keyboard and JS inspection. The pane shows local files as a `data:` snapshot.
- **Local headless Chrome** via `src/qa.mjs`: repeats the layout checks, plus contrast, reduced motion and network.

Each result is **PASSED**, **FAILED** or **UNVERIFIED**.

## Results

### Viewports

| Check | Result | Evidence |
|---|---|---|
| 360 × 640 | PASSED | Pane and headless: no page overflow, no element past the right edge. The phone screen is 312 px wide inside the pack. |
| 390 × 844 | PASSED | Pane and headless: no overflow. |
| 768 × 1024 | PASSED | Pane and headless: no overflow. The decisions table scrolls inside its own box (687 = 687, so it fits with no scroll). |
| 1440 × 900 | PASSED | Pane and headless: no overflow. The home mockup screen is exactly 360 px wide, and the header is sticky. |

### Zoom

| Check | Result | Evidence |
|---|---|---|
| 200% zoom, emulated | PASSED | Emulated as a 720 × 450 CSS viewport, which is the layout 1440 × 900 gets at 200%. No overflow. Sections stack. The header stops being sticky, so it doesn't cover content. |
| 200% zoom, real browser zoom | UNVERIFIED | The pane can't send browser-zoom keys. Text zoom alone (not page zoom) was not tested. |

### The five shortcuts

| Check | Result | Evidence |
|---|---|---|
| All five visible without scrolling at 360 px | PASSED | Pack at 360 (312 px screen): the last shortcut ends 600 px from the top of the screen, inside a 640 px fold. Screen at full 360 px: it ends at 545 px. The orange dashed line in the mockup marks the fold. |
| All five equal | PASSED | All five rows have the same height at every width: 69 px at a 312 px screen, 58 px at 342–360 px. They are in one list, with the same size and style. Desktop shows them as one row of five equal cards. |

### Keyboard and focus

| Check | Result | Evidence |
|---|---|---|
| Focus order | PASSED | Pane, keyboard Tab: skip link → logo → six nav links → cover buttons → replay button → journey links → footer links. DOM order matches what you see. No positive `tabindex`. The hero iframe has nothing to interact with, so it is taken out of the tab order. Mockup "buttons" are pictures, not controls, so they don't add fake tab stops. |
| Focus is visible | PASSED, after a fix | **First run FAILED:** the focus ring was ink on the ink header. **Fixed:** a 3 px `signal-soft` ring on dark areas, 6.7:1 on ink. Re-checked in the pane on the "Brand" nav link. |
| Skip link and section links | PASSED | Headless Chrome from `file://`: every nav link moves to its section (target top = 0), with a scroll margin under the sticky header. In the pane, fragment links don't move the `data:` snapshot. That is a limit of the pane, not the file. |

### Colour contrast

| Check | Result | Evidence |
|---|---|---|
| Token pairs | PASSED | Computed from `tokens.json`. Ink/white 19.2, paper/ink 16.8, muted/paper 5.2, muted/white 6.0, ink/signal 5.4. Concept status colours: ok 5.7, warn 5.8, error 6.6, each on its own background. Signal is never used as text on paper (that would be 3.1). |
| All rendered text | PASSED, after fixes | `qa.mjs` checks every element with its own text against its nearest opaque background (806 elements), at 4.5:1, or 3:1 for large text. **First run FAILED on 2 elements:** white text on the signal cover button (3.57) and a struck-out time slot (3.10). Both fixed: ink on signal, and muted on paper-2. The re-run found 0 failures. |
| Contrast inside SVG mockup maps | UNVERIFIED | The script skips text inside SVG. By eye, the map labels are ink on light paper. |

### Motion and loading

| Check | Result | Evidence |
|---|---|---|
| Reduced motion | PASSED | Headless, with `prefers-reduced-motion: reduce`: the hero iframe shows the same still frame at 2.2 s and 2.7 s, and smooth scrolling is off. With `no-preference`, the frames differ and smooth scrolling is on. The loader SVG and the hero switch themselves off (checked by reading their code). The pane can't emulate this media feature, so it was checked headless only. |
| No network at view time | PASSED | `build.mjs` refuses any `http(s)` `src` or `href`. A headless load requests no resource other than `data:` and `file:` URIs. Sora is embedded. Space Grotesk and JetBrains Mono are not bundled, so the system fonts are used. |
| Images have alt text | PASSED | All `<img>` have `alt`. Decorative ones use an empty `alt`. |

### Content

| Check | Result | Evidence |
|---|---|---|
| States from PLAN §10 | PASSED, with one note | See the table below. **Note:** "provisional" belongs to the deferred B4 pay-later option, so it isn't drawn. The nearest live state, "waiting for payment" on a hold, is shown. |
| Fictional content and "concept, not final" | PASSED | Every phone has a "Concept, not final" status bar. Desktop frames say so in the URL bar. The header, cover and footer carry the label. Businesses are marked DEMO, and ratings say "demo". There are no real business names, endorsements or vendor logos. The payment partner and fines sources are generic. |

### Exports

| Check | Result | Evidence |
|---|---|---|
| PNG exports | PASSED | 16 PNGs in `exports/`, 1216–1824 px wide. The phone home is at 2×. Reviewed by eye: summary, brand, home, checkout, desktop search, roadmap, phone home. |
| PNG exports not opened | UNVERIFIED | The other 9 PNGs (search, listing, quote, dashboard, application, fines, desktop home, both journeys) were not opened after the last export. They come from the same verified page. |
| PDF export | UNVERIFIED for layout | `CarworX-presentation-pack.pdf`: 34 A4 pages, about 0.8 MB, print styles on. No PDF renderer is available here, so the page breaks were not looked at. |
| Design skills | UNVERIFIED | The design-critique and accessibility-review skills were **not invoked**. The checks above were done with scripts and the pane instead. |

## PLAN §10 state coverage

| §10 state | Where it is in the pack |
|---|---|
| Empty or limited supply | Home: limited supply. Search: nothing nearby, with the demand form. |
| Acknowledgement deadline | Quote: waiting for the business; no reply in time. Dashboard: "reply by". |
| Hold countdown | Checkout: 14:32 held. Payment failed, still held. |
| Provisional / expired / paid-but-needs-resolution | Checkout: hold expired; paid after expiry, rebook or refund. Dashboard: waiting for payment. |
| Quote revision and expiry | Quote: version 2 replaces version 1; quote expired; change quote C1. Dashboard: write a quote. |
| Travel cost | Search band, listing bands, quote variant, checkout line, application bands |
| Payment pending or failed | Checkout: checking payment; payment failed |
| Cancellation, refund and dispute | Checkout: cancelled and refunded; problem reported. Dashboard: card dispute. |
| Suspended provider | Listing: business paused. Dashboard: your listing is paused. |
| Errors | Home: page error. Search: results didn't load. |

## How to re-run

From the repo root, run these in order:

1. `node planning/design/pack/src/build.mjs`
2. `node planning/design/pack/src/export.mjs`
3. `node planning/design/pack/src/qa.mjs`

They need a local Chrome or Edge, and they open only the local file.
