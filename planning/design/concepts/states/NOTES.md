# States: 404 and loading concepts

**Status:** concept, not final (2026-11-02). Five 404 pages and five loading screens for CarworX in the approved Studio language. Built for the owner to look at quickly and pick favourites.

**Chosen (2026-11-03, D-041):** 404 · 4 Dot-grid lens; loaders 3 Hold dial (buttons, multi-step waits in a page), 4 Skeleton (cards and lists, known layouts in a page) and 5 Dot-grid ripple (between pages, with the blade pulse). Rotor spool and Blade index are retired. The approved set lives in [`../../states/`](../../states/NOTES.md); this page stays as the record of what was explored.

**Open:** `index.html` (one self-contained file, 135 KB). Nothing else is needed except Google Fonts.

## How to review

A frosted switcher (the dock) sits at the bottom of the screen. It is a review tool, not part of the designs.

- **404 · 1–5** and **Loading · 1–5** jump straight to a concept. On a phone the inactive set collapses to its label; tap it to switch.
- **Splash / In use** (loading only): the full-screen splash, or a board showing the loader in a page, in a button and on a card or list.
- **Still** shows the designed reduced-motion state without changing your OS setting.
- **Keys:** ← and → step through all ten, U toggles Splash / In use, R toggles Still, H hides the dock.
- **Links:** `#404-3`, `#load-2/use`. Add `&clean` to hide the dock or `&still` to start in the still state, for example `index.html#load-1&clean`.

Only the active concept is initialised and stepped. There is one `requestAnimationFrame` loop for the whole page, and it stops when the tab is hidden.

## Shared 404 page

All five 404s carry the same page, so they compare fairly:

- the horizontal lockup at the top left, linking home
- eyebrow: "Error 404 · page not found"
- headline: "We can't find that page." with the grey second line "It may have moved."
- line: "Check the address for a typo, or start again from home."
- the ink pill **Back to home** and the secondary link **Find a service**
- "Or go straight to" and the five services as quiet frosted chips, in brief order and full wording, each with its Studio object. On phones the chips drop their objects and wrap into three rows.

On dark grounds the pill turns white, and the chips become smoked glass.

## 404 concepts

### 1 · Ink in water (light)

- **Idea:** the canvas is a tray of still water. Your pointer pours Studio colour into it, and the colour blooms, curls and slowly diffuses like ink.
- **The 404:** a large Geist "404" whose 0 is the Turbine rotor. The rotor is a free impeller: pour across it and it spins the way the flow pushes it. Then friction slows it and it indexes, mechanically, onto the nearest resting angle, so it always comes to rest as the logo.
- **Interaction:**
  - Moving pours a dense stream along your path. The pigment laid down scales with distance travelled, so it is equally rich at any frame rate.
  - A click or tap drops a bead of the current colour that blooms outward in a ring.
  - With nobody touching it, a slow hand pours a wide loop round the copy, so the page is never dead.
- **Colour:** the colour moves on as you pour, one ink per ~900 px of travel: blue, a lighter blue, apricot, **signal**, apricot, then back to blue. You and the idle hand share the same cycle.
  - Signal only ever sits next to apricot in the cycle, so it never mixes to mud with blue.
  - Each ink's strength is balanced by eye. Blue absorbs less light than signal, so it is poured denser.
  - Ink is stored as absorbance and shown multiplied over the canvas, so where inks overlap they darken the way real pigment does. A light chroma lift keeps the blooms clean.
  - Old ink fades over a few seconds, so the fresh pour near the pointer is always the richest colour on screen.
  - The dot grid is drawn in the same pass, so ink settles over the dots like paper.
- **Clean zone:** the ink thins to 3 % under the copy: the eyebrow, headline, line, buttons and the "Or go straight to" label, with a 72 px feather. Text keeps the same contrast it has on bare canvas (see *Checks done*). Colour still flows right up to the copy and through the big 404.
- **Build:** a WebGL2 stable-fluids solver: advection, curl-noise drift, vorticity confinement and a 20-step pressure solve. It runs on a 128 px simulation grid, with dye at up to 560 px and the screen at most 1.5× DPR.
- **Still:** four composed drops around the copy, two blue, one apricot and one signal, simulated for about a second and then frozen.
- **Where:** the web 404 on light pages. It is the closest to the Studio desk.

### 2 · Aurora over water (dark, ink ground)

- **Idea:** the owner's "aurora of glowing colours poured in water", taken literally. Three aurora curtains hang over a still lake, and the lake mirrors them.
- **The 404:** a thin Geist 200 "404" stands on the horizon line with a soft reflection under it. The water line is read from the numeral's real position, so the two always meet.
- **Interaction:**
  - The curtains' folds lean toward your pointer, their hem dips to meet it, and they brighten where you are. Moving faster brightens them more.
  - Moving over the water, or tapping it, sends ripples that ring outward and bend the reflection.
  - When idle, an invisible hand drifts slowly across the sky.
- **Colour:** additive light on `ink`, in three curtains:
  - front: a white-blue hem fading through blue to blue-soft
  - middle: blue-soft through blue to apricot
  - back: apricot and peach, with a thin signal fringe at the very top. Signal is never a fill here and never near text.

  A soft shoulder curve keeps the overlaps from clipping to white.
- **Build:** one WebGL2 fragment shader, rendered at 0.8 × min(DPR, 1.5) and scaled up, since aurora is soft by nature.
- **Still:** one frame of the shader at a fixed time.
- **Where:** a dark-mode 404, or a 404 for the app's night theme. It is the most atmospheric of the five.

### 3 · Fireworks (dark)

- **Idea:** a small celebration of being lost. Every burst is the Turbine.
- **Interaction:**
  - Moving leaves a short sparkle trail in Studio colours, with a soft glow at the pointer.
  - A click or tap launches a **five-armed spiral burst**. Each spark is placed on a blade, using the mark's own geometry from `motion/shape.mjs` (the log-spiral centreline and the blade thickness curve). So the burst draws the five blades in light: full near the hub and a needle at the tip.
  - The rotor turns as it opens, then the sparks fall and crackle out.
  - When idle, rockets rise either side of the copy and burst on their own.
- **Throttle:** at most 6,000 sparks, and a new burst needs at least 120 ms since the last. The emission rate drops when frames run long (over 19 ms, then over 24 ms).
- **Colour:** each burst pairs a root colour with a tip colour: white with blue-soft, peach with apricot, sky with blue, or note with apricot. The ground is `ink` with a 7 % white dot grid. Sparks are drawn additively, with motion trails from a translucent ink wash.
- **Build:** Canvas 2D with pre-rendered glow sprites, DPR capped at 1.5.
- **Still:** three bursts frozen at full bloom, with no trails.
- **Where:** a dark 404. It could also double as the celebration after a first booking.

### 4 · Dot-grid lens (light)

- **Idea:** the Studio dot grid is the material. A glass loupe sits on the desk.
- **The 404:** set in dots. The grid densifies to a 12 px sub-grid, which still lines up with the 24 px grid, and the numerals light in ink with each dot sized by how much of the glyph covers it. The 0 is the rotor, and every few seconds it indexes 72° like a dot-matrix display, re-lighting its dots as it turns.
- **Interaction:**
  - The loupe follows your pointer on a spring.
  - Dots under the loupe swell and push outward. The ones in the numerals turn blue, the grid dots turn a soft blue-ink, and every dot is on its own spring, so the grid wobbles like jelly as the loupe passes.
  - A click or tap sends a pressure wave across the grid.
  - When idle, the loupe drifts along the numerals.
- **Colour:** ink, blue and blue-ink on the canvas, with a sky-tinted glass, a white highlight and a soft shadow.
- **Build:** Canvas 2D. About 5,000 dots on springs, drawn as four batched paths.
- **Still:** the loupe parked over the rotor, with the grid settled under it.
- **Where:** the web 404 on light pages. It is the most "Studio" of the five, and the grid behaviour could become the brand's general hover texture.

### 5 · Lost objects (light)

- **Idea:** the objects of a booking, scattered on the desk.
- **The objects:**
  - a sticky note in Caveat: "Page not found", with "try home, or pick a service" under it
  - a receipt headed "404 · NOT FOUND", with Page "not found", Path "/old-link", Charged "R 0", a big 404 and a NOT FOUND stamp
  - the hold timer at 00:00, its signal ring spent
  - the key fob
- **The rotor:** sits in a frosted hub above the headline and **turns so one blade tip points at you**. It is a mechanical servo with a slight overshoot.
- **Interaction:**
  - The objects drift and lean toward the pointer with depth parallax. Each sits at its own depth.
  - You can pick any object up: it lifts, its shadow deepens and it tilts into the direction you move. Fling it and it flies, bounces off the edge of the desk and springs home.
- **Colour:** Studio objects on the canvas grid. Signal appears only in the spent timer ring, which is counting down.
- **Build:** DOM and transforms, with springs in JS. Shadows lift by fading a layer, never by animating `box-shadow`.
- **Header:** at rest every object stays below the header. Its resting spot allows for its tilt, idle drift and the most the parallax can lift it. The header, copy and shortcuts sit above the objects in stacking order, so a flung object passes under the logo, not over it.
- **Phones:** the note, the timer and the rotor stay. The receipt and fob are hidden, because there is no clear space for them that doesn't sit on the shortcuts.
- **Still:** objects at home, no drift, rotor at rest. You can still drag them, and they stay where you drop them.
- **Where:** the web 404 on light pages. It is the most playful and the one that tells a story.

## Loading concepts

Each loader has a **splash** and an **In use** board. The board always shows the same three places, so they compare fairly:

- **In a page:** a results panel, "Wash & Detailing near Ferndale"
- **In a button:** the ink pill "Sending request" and the light pill "Loading more results"
- **On a card or list:** a result list with one row still loading

Businesses are DEMO, and distances say straight-line.

### 1 · Rotor spool

- **Idea:** the hero film's physics as a loader.
- **Motion:**
  - The rotor spools up on the brand curve, v(u) = u^2.2 (1 − u)^1.3: turbo lag, then surge.
  - It holds speed while loading.
  - When loading finishes, it plans a brake on the same curve so it lands exactly on rest + 72°·k, overshoots 1.8° and settles on the brand's damped spring.
  - The splash then lets the wordmark rise into the **stacked lockup**, drawn from the real glyph paths at the official transforms, holds and starts again.
- **Motion blur:** real, from averaged sub-frames across a 180° shutter, up to 16 per frame, as the brand renders do.
- **Progress:** a mono percentage and a ring of 60 housing ticks that light with progress. The ring dissolves as the rotor locks, as in the hero film. The progress moves unevenly, as real loading does.
- **In use:**
  - a page loader with ticks and percentage
  - a 20 px rotor in each button, white on the ink pill and ink on the light pill
  - a blue rotor on the loading card, with its percentage
- **Still:** the rotor rests on the logo. Only the number and the ticks change.
- **Where:** the app splash, and long waits with known progress, such as uploading photos or sending a quote request.

### 2 · Blade index

- **Idea:** the brand loader as specified: one lit blade, indexing 72° every 1.2 s like a ratchet.
- **Motion:** each step is a quick 0.3 s index, a hard stop and a 1.8° overshoot that settles. Because the rotor has five-fold symmetry, it is the exact logo at every rest, and the lit blade steps round like a clock hand.
- **Colour:** the lit blade is `ink` and the others are ink at 14 %. On the ink pill it is white and white at 28 %.
- **Sizes:** 16, 20, 24, 32, 48, 64 and 96 px. Below 48 px it switches to the small optical mark (heavier blades, bigger hub). The minimum is 16 px.
- **In use:** the page at 72 px, the buttons at 20 px and the card at 28 px.
- **Still:** the rotor stays at rest and the light moves to the next blade every 1.2 s, with no rotation.
- **Where:** the default loader everywhere: buttons, inline, cards and short waits.

### 3 · Hold dial

- **Idea:** Studio's tactile hold dial, used to be honest about what is happening.
- **Motion:**
  - A frosted dial whose ring fills one step at a time, with a status line that rolls up out of a mask:
    1. "Finding businesses near Ferndale…"
    2. "Checking who's open Saturday…"
    3. "Sorting by straight-line distance…"
    4. "Loading listed prices…"
  - It ends with "Done. Showing results."
  - Inside a step, the ring creeps toward the step's end and slows as it gets close, rather than pretending to know exactly when it will finish.
  - The centre reads "2/4 · STEPS", and four small bars repeat the progress.
- **Colour:** **blue**, not signal. Signal means counting down, and loading is not a countdown.
- **In use:**
  - The page and the card keep the ring and the rolling line.
  - The buttons show a plain spinning arc, because there is no room for steps and it shouldn't pretend to count them.
- **Accessibility:** the status line is a polite live region.
- **Still:** the line swaps without sliding, and the ring shows the current step without animating.
- **Where:** search and any multi-step wait the user is watching: search results, availability checks and quote comparisons.

### 4 · Skeleton screens

- **Idea:** the page arrives in its real shape, then fills in.
- **The splash:** a full results page in skeleton:
  - the frosted nav with the real lockup
  - the real query: "Wash & Detailing · Ferndale, Randburg" and "SEARCHING"
  - the **five key-caps pressing in turn**, a 120 ms wave every 1.6 s, as if someone is drumming the keys
  - frosted result-card skeletons
  - a map skeleton with pins and a blue "you are here" dot
- **Shimmer:** one soft white sheen crosses the whole page. Each block's sheen is delayed by its x position, so it reads as one sweep, not many. It is transform-only.
- **In use:**
  - two skeleton cards in the page
  - five tiny keys pressing inside each button
  - a skeleton row in the list
- **Still:** no shimmer and no pressing. The skeleton itself says "loading".
- **Where:** first loads of search results, listings and the business dashboard. Use it where the layout is known in advance.

### 5 · Dot-grid ripple

- **Idea:** the canvas itself carries the wait.
- **Motion:** the rotor sits in the middle of the dot grid and indexes one blade every 1.2 s. Each index sends a pressure wave, with a smaller echo behind it, across the grid. Dots swell, turn blue and push outward as the crest passes. It echoes the boost ring in the hero film.
- **Blade pulse (added 2026-11-03, the owner's request):** at rest the blades are pale (ink at 14 %). On one index solid ink runs from the hub out to the tips and stays; on the next it runs from the tips back to the hub, so the blades are pale again; then out, back, out. The front moves on the ratchet clock, `p = inOutCubic(u / .45)` into each 1.2 s step, with a 2 %-of-R feathered edge, and uses the small mark's hub below 24 px. It is one fill with a radial gradient in the mark's own units, which gives exactly the pale mark plus an ink copy clipped to a circle. It runs on the splash rotor and both mini rotors on the In use board; the button patches have no rotor. With reduced motion the rotor rests as the solid ink logo. Only the fill changes, never the path or the rest angle.
- **In use:**
  - a rippling dot panel in the page
  - a 5 × 5 dot patch with no rotor in each button
  - a small rippling thumbnail with a mini rotor on the card
- **Still:** one frozen wave around the rotor at rest.
- **Where:** the app splash on light grounds, and empty states that are waiting for something, such as "Looking for businesses near you".

## Brand handling

- **The logo is never redrawn or retyped.** `build.mjs` reads `brand/exports/core/` and checks it before it writes `index.html`. It checks that:
  - the five blades of the full mark and of the small mark are one path at 0/72/144/216/288°
  - the rest angles are 21.9494° and 39.9698°, recomputed from `motion/shape.mjs`
  - the seven wordmark glyphs are identical in the wordmark and in both lockups
  - the horizontal lockup uses `translate(92,92) scale(0.92) rotate(21.9494)` and `translate(246,142)`, and the stacked lockup uses `translate(303.18,160) scale(1.6) rotate(21.9494)` and `translate(0,480)`

  It then injects one sprite. Canvas concepts draw the same path data through `Path2D`.
- **Studio objects** are lifted from `concepts/studio/index.html` with their ids prefixed: the five service objects and the key fob.
- **Motion:** the logo moves mechanically everywhere: the spool curve, ratchet indexes, servos and the 1.8° overshoot. Objects use springs.
- **The name** is written CarworX throughout. Signal never touches the mark.

## Files

| File | What it is |
|---|---|
| `index.html` | The built page. Open this. |
| `src/template.html` | Source for this page and the approved page, with placeholders for the brand sprite. Blocks marked `<!--@concepts-->` / `/*@approved*/` … `@end` belong to one page only. |
| `build.mjs` | `node build.mjs` verifies the logo files and writes both `index.html` here and `../../states/index.html`. |
| `qa.mjs` | `node qa.mjs check [1440|390] [motion|still]`, `contrast`, `objects`, `stills [prefix]`, `shot <hash> <w> <h> <file> [act]`. Add `--approved` to run `check` or `stills` on the approved page. It needs a local Chrome or Edge. Run `check` one width and setting at a time: one long run of software WebGL wore the headless browser out. |
| `qa-report.json` | The last `check` run. |
| `qa-contrast.json`, `qa-objects.json` | The last `contrast` and `objects` runs. |
| `stills/` | 35 PNGs, listed below. |

## Stills

All stills were captured in headless Chrome with the dock hidden. Desktop stills are 1440 × 900. Phone stills are 390 × 844 at 2×.

For the 404s, `qa.mjs` drives a simulated pointer path first:
- **Ink:** a 4.8 s horseshoe pour round the copy, which never doubles back, then a drop where it ends. The still is taken while the ink is fresh.
- **Aurora:** a sweep across the sky, then over the water and a tap.
- **Fireworks:** a trail, then two bursts.
- **Lens:** a glide onto the numerals.
- **Lost objects:** the note is dragged and flung, then the pointer moves.

| File | Shows |
|---|---|
| `01`–`05` | The five 404s on desktop, mid-interaction |
| `06`–`15` | Each loader's splash and its In use board, on desktop. `09` is 1440 × 1100, so the sizes row fits. |
| `21`–`25` | The five 404s at 390 px |
| `26`–`30` | The five loader splashes at 390 px |
| `41`–`50` | All ten designed still states (prefers-reduced-motion) on desktop |

## Checks done

All checks ran in headless Chrome 156 through the DevTools protocol (`node qa.mjs check`). Each load used a fresh tab.

- **Coverage:** all 15 views (five 404s, five splashes and five In use boards) at 1440 × 900 and 390 × 844, each with motion and with `prefers-reduced-motion: reduce`. That is 60 loads. Each 404 ran its pointer choreography before measuring.
- **Console:** no errors, warnings or exceptions in any of the 60.
- **Horizontal overflow:** none. The page and scene scroll widths equal the viewport width every time.
- **Vertical fit:** every 404 fits 390 × 844 without scrolling, so its touch tracking can safely take the whole screen. The In use boards scroll vertically on phones, by design.
- **Frame rate:** the loop ran at 50–60 fps in headless, which renders in software, at both widths.
- **JS time per frame** (average / 95th percentile, ms), measured over 1.5 s after interacting, on the final build (2026-11-03):

  | View | 1440 | 390 |
  |---|---|---|
  | 404 · ink (WebGL) | 0.8 / 2.8 | 1.4 / 4.0 |
  | 404 · aurora (WebGL) | 0.1 / 0.5 | 0.1 / 0.3 |
  | 404 · fireworks | 4.3 / 7.9 | 4.8 / 9.1 |
  | 404 · dot lens | 6.4 / 10.8 | 3.6 / 8.7 |
  | 404 · lost objects | 0.6 / 1.3 | 0.8 / 2.5 |
  | Rotor spool, splash / in use | 1.3 / 2.2, 1.9 / 6.3 | 1.1 / 2.9, 2.1 / 4.8 |
  | Blade index, splash / in use | 0.1 / 0.2, 0.2 / 0.6 | 0.1 / 0.4, 0.2 / 0.5 |
  | Hold dial, splash / in use | 0.4 / 1.1, 0.4 / 1.4 | 0.4 / 1.2, 0.4 / 1.1 |
  | Skeleton (CSS only) | 0 / 0 | 0 / 0 |
  | Dot ripple, splash / in use (with the blade pulse, re-measured 2026-11-03) | 3.7 / 5.3, 2.5 / 3.6 | 1.3 / 2.0, 1.2 / 1.7 |

  - The dot ripple caches its grid geometry, which halved its cost.
  - The dot lens re-rasterises only the rotor's dots, from one reused canvas, while the rotor indexes. Before that, its index spikes reached 30–40 ms.
  - These numbers move by a few milliseconds from run to run. Every view stays inside the 16 ms budget at the 95th percentile.
- **Text contrast on the ink concept** (`node qa.mjs contrast`):
  - **Method:** after the 4.8 s pour, the copy is hidden, the page is screenshotted, and every pixel behind each line is rated against that line's colour. This runs at 1280, 1440 and 390 px. Results are in `qa-contrast.json`.
  - **Result:** at the 2nd percentile, every line keeps the contrast it has on bare canvas. The headline is 16.7:1. The grey line is 3.8:1 (large text, needs 3). The eyebrow, sub-line and shortcuts label are 4.9–5.3:1 (need 4.5). The link is 10:1 or better.
  - **The worst pixels** are the 1 px grid dots, which are canvas mixed with 12 % ink. Against them the eyebrow and sub-line give 4.1:1 and the grey line gives 3.0:1. That is the same dot grid the approved Studio canvas has under its text, and the figures match the formula, so the check passes on the 2nd percentile.
- **Lost objects and the header** (`node qa.mjs objects`, at 1280, 1440 and 390, results in `qa-objects.json`):
  - At rest, every visible object sits below the header and clear of the lockup.
  - Dragging the note onto the lockup leaves the lockup topmost at that point. The flung object passes under it.
- **Reduced motion:** the 404s run no loop at all. The loaders tick only to change a number, a lit blade or a status line.
- **Re-run after the blade pulse and the shared shell (2026-11-03):** all 60 loads again, with no errors, no overflow, every 404 fitting 390 × 844, and no view over 12 ms at the 95th percentile. Stills `14`, `15`, `30` and `50` were recaptured.
- **Size:** `index.html` is 135 KB. The stills total 8.3 MB and are separate files.
- **Brand check:** `build.mjs` checks the paths and transforms listed under *Brand handling* on every build.

## Not verified

- **Real frame rates.** Headless Chrome renders WebGL on SwiftShader (software), so its frame times say nothing about a GPU. The JS time per frame above is the only performance number measured. The ink and aurora shaders should be profiled on a mid-range Android phone. Both have obvious levers: the dye resolution and pressure iterations for ink, and the render scale for aurora.
- **Safari and Firefox.** Only Chromium was used. The ink needs WebGL2 with `EXT_color_buffer_float`, which current Safari has. If WebGL2 is missing, ink and aurora fall back to a static CSS gradient. That fallback is designed but has not been seen in a real browser without WebGL2.
- **Real touch.** Touch goes through pointer events and the 404 scenes set `touch-action: none` when they fit the screen. Only mouse events were simulated.
- **Screen readers.** The status lines are live regions and the decorative canvases are `aria-hidden`, but this was not tried with VoiceOver, TalkBack or NVDA.
- **The claude.ai Artifact viewer.**
