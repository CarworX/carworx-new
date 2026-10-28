# Studio: CarworX web design concept

**Status:** concept, not final. This is refinement pass 2 (2026-10-28), built to `../BRIEF.md`. Earlier versions are kept for comparison:
- `v1/index.html` and `v1/stills/`: the original
- `v2-pass1/index.html` and `v2-pass1/stills/`: pass 1, as committed in a1c9b42

**One-line idea:** a calm, light studio desk where the objects of a booking float in soft depth: a sticky note, a key fob, a quote receipt and a hold timer. Every screen tells you what happens next.

## Pass 2 changes

This pass is polish only. Every idea, section and object from pass 1 is kept.

**Hero**
- The quote receipt has clear air from the key row. The keys are 172 px wide at 1440 instead of 180, and the receipt is tilted less (−3° to −5°).
- Measured horizontal gap between the receipt and the nearest key:

  | Width | Gap |
  |---|---|
  | 1280 | 43 px |
  | 1366 | 85 px |
  | 1440 | 32 px |

- "APPROVED" now sits on its own row under "Valid 7 days", rotated −8°, so "R 3 480" is fully readable.
- When a key is hovered, the other objects dim to 0.75 opacity. There is no blur and no desaturation.
- `text-wrap: balance` is on all headings and key labels, and `text-wrap: pretty` on paragraphs, list items and small text.
- An automated check found no single-word last lines in visible copy at 1280, 1440, 768 or 390.
- Key labels keep "&" with the word before it, using a non-breaking space, so a line never starts with "&". "A fine on the windscreen?" keeps "the windscreen?" together.
- The booking tile reads "Paid to the business". Its date is shortened to "Sat, 09:00" so the row fits on one line.

**Intro**
- Each rolling line now reads "For [service]" and is centred as one block under the tagline, so "For" no longer hangs left.
- On phones the lockup and tagline group sits slightly above true centre.
- The tagline has a proper gap under the stacked wordmark. Two margins were collapsing into each other.
- The tagline words now rise out of a mask, like the page headlines. Every word shares one size and baseline, and they differ only in position while revealing.

**Carousel**
- The filter-chip row fades out at its right edge with a mask, so a cut chip looks intentional.
- The whole stage fades into the canvas at both edges instead of clipping the outermost phones.

**Mobile nav (900 px and below)**
- The nav shows the lockup on the left and a round menu button on the right. Its two bars turn into an X when open.
- The button opens a frosted sheet with the four section links, "Find a service near you" as the primary button and "List your business" as the secondary.
- The sheet is `role="dialog"` with `aria-modal`. The button carries `aria-expanded`, `aria-controls` and an "Open menu" / "Close menu" label.
- Focus is trapped between the button and the sheet's links. Esc and the scrim close the sheet and return focus to the button.
- Tested by keyboard in headless Edge: open, Tab through every item and wrap, Shift+Tab, and Esc.

**Craft**
- **Focus rings:** one style everywhere, a 2 px ink outline with a 2 px offset that follows each element's radius. This covers keys, CTAs, nav links, the menu button, carousel tabs, dashboard tabs and the carousel region.
- **Carousel semantics:**
  - The carousel is `role="region"` with `aria-roledescription="carousel"` and a label that mentions the arrow keys. It is focusable.
  - Each phone is a `group` with `aria-roledescription="slide"` and a label like "2 of 5: Business listing".
  - The tabs point at their slide with `aria-controls`.
- **Timeline:** a polite live region announces "Step 3 of 4. Held for 15 minutes. …" whenever the active step changes.
- **Closing band:** a frosted card before the footer. It holds:
  - one line in the hero's voice, "Your car's next visit, booked properly."
  - the "Find a service near you" pill and a quieter "List your business free" link
  - the full mark at 64 px idling through one turn every 32 s (still under reduced motion)

**Performance**
- **Transform and opacity only:**
  - The booking timeline no longer animates width, height, border radius or `left`. Each of its four faces now has its own true size and shape. While the booking travels, the faces cross-fade and scale toward a shared size, and each face's content is counter-scaled so text never stretches.
  - Hover shadows on the keys and pills are an opacity layer, where they used to be `box-shadow` transitions.
  - The timeline dots fade an ink layer in, where they used to transition colour.
  - Carousel and dashboard tabs no longer transition colours.
  - The intro's pressure ring scales instead of changing its radius.
- **Writes only on change:** per-frame style, attribute and text writes go through small helpers that skip the DOM when a value hasn't changed. In pass 1 the carousel rewrote `aria-hidden`, `z-index` and `filter` on all five phones every frame, and the timeline rewrote its clock text.
- **Dashboard:** it no longer uses `backdrop-filter`. The glow behind it moves with scroll, so the blur was recomputed on every scroll frame. A layered translucent gradient now gives the same frosted look.
- **Off-screen loops pause:**
  - An IntersectionObserver pauses the CSS loops of the hero, the fines illustration, the marquee, the quote's sheen and the closing rotor while they are off screen.
  - The single rAF loop sleeps when nothing it drives is visible or moving. Scroll, pointer and visibility changes wake it.
  - The hero's live timer skips DOM writes while the hero is off screen.
- **Not changed, by design:** a few things still update SVG paint attributes, which costs paint but not layout:
  - stroke draws (the intro's housing ring, the chart line, the hold rings)
  - the chart's path morph between Week and Month
  - text swaps (the intro scramble and the countdowns)

## Pass 1 changes

1. **The intro is now a moment.**
   - The glyph scramble resolves at full scale: the lockup spans 78% of the viewport width on desktop.
   - The rotor spools up beside it at the same scale and follows the brand timeline physics: lag, surge, brake, a 1.8° overshoot and a damped spring.
   - The rotor now grows inside its own housing ring and tick dial. Ring and rotor share one SVG group, so they stay concentric at every frame. This fixes the v1 still where the rotor sat outside the ring.
   - On phones (under 600 px) the intro uses the official stacked lockup, mapped from `carworx-lockup-stacked-*.svg`. During the FLIP hand-off it rearranges into the horizontal lockup while it shrinks into the nav.
   - The FLIP takes 0.9 s. The hero objects spring in from the left and right edges as the logo lands.
   - Total length is about 3.9 s. Skip and reduced-motion behaviour are unchanged.
2. **The five services are hero-weight key-caps.**
   - They are 180 × 184 px soft-3D keys with a key-side edge and real shadows. They are equal size, in brief order and use the full wording.
   - Each key carries its own soft-3D object instead of a line icon:
     - Wash & Detailing: a sponge with foam bubbles
     - Repairs & Maintenance: a metal spanner
     - Glass Repair & Replacement: a windscreen with a chip and a wiper
     - Tyres & Wheel Alignment: a tyre on a rim
     - Fines & Vehicle Admin: a licence disc with a fine slip behind it
   - On hover or focus the key lifts on a spring, and pressing it pushes it down. The key's own object also moves: the tyre rolls, the spanner turns, the bubbles rise, a glint crosses the glass and the disc tilts.
   - The matching floating object reacts and the other objects dim:
     - Tyres swings the gauge needle up the scale.
     - Wash lifts the sticky note.
     - Repairs lifts the quote and re-stamps "APPROVED".
     - Glass nudges the booking tile.
     - Fines nudges the hold timer.
   - At 390 px the keys form a tidy 3 + 2 grid. All five are fully visible without scrolling: the bottom of the grid is at 775 px on an 844 px screen. From 600 to 900 px they sit in a 5-up row.
3. **The product carousel reads as depth, not fog.**
   - Neighbour blur dropped from 4.5/9 px to 1.2/2.4 px, and opacity no longer falls below 0.7.
   - The phone glass is more opaque, so the screens stay readable.
   - The flat gradient thumbnails are replaced with small hand-drawn line illustrations on tinted tiles: a car with sparkles, a van with bubbles, a spray bottle, and a bucket with a sponge.
   - The heading is on one line on desktop. Every section has `scroll-margin-top: 96px`, so the fixed nav never covers a heading when you use the nav links.
   - Result rows were shortened so they no longer wrap into five lines.
4. **Signature scroll moment: the booking timeline.** This replaces v1's step list and status card in "How it works".
   - One booking object travels along a four-stop rail. It morphs from the sticky note ("Request sent") into the accepted tile ("within 2 business hours"), then into the 15-minute hold timer, and finally into a paid receipt ("To Shine Studio, CarworX fee R 0, CarworX never holds the money", with the small optical mark).
   - Between stops it lifts off the rail on an arc, and its ground shadow shrinks and fades.
   - The timer counts down as you scroll through step 3, and the receipt prints line by line on arrival.
   - It is scroll-linked through a CSS-sticky stage and a 420 vh section. The browser's scroll is never hijacked.
   - With reduced motion it snaps between whole steps with no travel or lift.
   - From 900 px down, the object stays centred, only the rail moves, and the step copy cross-fades.
5. **Mobile craft at 390 px.**
   - The hero objects are curated down to the sticky note and the hold timer. They sit either side of the badge and keep clear of the headline and nav.
   - The intro uses the stacked lockup.
   - The dashboard becomes stacked KPI rows with the label on the left and the number on the right. The chart is full width, and queue items become cards.
   - The carousel turns a card on a short swipe (more than 40 px), as well as by dragging.
   - Tablet widths have their own layout: two objects and a 5-up key row.
6. **Polish.**
   - Spacing tokens use an 8 px rhythm (`--s1` to `--s12`).
   - There is one shadow scale, `--sh-1`, `--sh-2` and `--sh-3`, with matching `--ds-2` and `--ds-3` drop-shadow forms for SVG and masked objects.
   - No CSS text is under 12 px. Receipt text, dial labels, phone status bars, chips, chart axes and the gauge's "BAR" were raised.
   - The grey second headline line was darkened from `#7a828d` (3.44:1) to `#727a85`. It now has 3.84:1 contrast on the canvas and 4.34:1 on white. It is only used at 32 px and above (40 px at 390), so it passes AA for large text with margin.
   - Small grey labels that used `--quiet` (key numbers, intro roller) now use `--muted` (5.3:1).

## Palette

The canvas is a soft off-white with a 24 px dot grid. Colour comes only from accents and soft gradients.

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#f2f1ee` | Page ground, with the dot grid at `rgba(13,15,18,.12)` |
| `--ink` | `#0d0f12` | Logo, headlines, the pill CTA |
| `--graphite` | `#1c2128` | Key fob, strong secondary text |
| `--muted` | `#5b6470` | Body, captions and all small grey labels (5.3:1 on canvas) |
| `--quiet` | `#727a85` | Grey second headline lines and the marquee, display sizes only (3.84:1, AA large) |
| `--blue` / `--blue-soft` | `#3d6dff` / `#a9c0ff` | Confirmations, the cool end of gradients |
| `--signal` | `#ff3b0a` | The 15-minute hold ring, live dots, the warm end of the rail. Never small text, never part of the mark |
| `--apricot` / `--peach` | `#ffb08a` / `#ffe3d4` | Soft orange in the EquipFlow-style gradients |
| `--note` | `#ffe9a6` | The sticky note |

## Type

- **Geist** is used for display and text. Headlines are weight 500 with -0.045em tracking. Dashboard numerals are weight 200.
- **Geist Mono** is used for timers, prices, receipts, metadata labels and the intro's scramble glyphs.
- **Caveat** is used only for the sticky note (in the hero and in the timeline) and the fines question marks.

## Sections

1. **Intro**, about 3.9 s. It is described under pass 1 above. `#skip` jumps past it, and `#intro=<seconds>` freezes it at that time, which is how the stills were made.
2. **Hero.**
   - Badge, headline with a grey second line, sub-line and one ink pill CTA.
   - The five key-caps.
   - Six floating objects (note, booking tile, tyre gauge, live hold timer, key fob, quote receipt) with idle drift, pointer parallax and scroll parallax.
   - From 1200 to 1439 px the objects scale to 0.8. From 901 to 1199 px they scale to 0.72 and the fob and receipt are hidden. From 900 px down there are two objects.
3. **How it works:** the booking timeline described above.
4. **Repairs quote.**
   - Pieter's written brake quote. Its 7-day validity strip fills as you scroll.
   - "Approve this exact quote", and a line saying extra work needs a new approved quote.
5. **Fines & Vehicle Admin.** The hand-drawn car with sweeping wipers, a fluttering fine and a bobbing question mark.
6. **The app.**
   - The five-phone carousel: search, listing, quote approval, payment hold and fines guidance.
   - It runs on a spring, autoplays while visible and can be dragged or swiped. You can also use the arrow keys or the tabs.
   - A marquee of the service names runs below it.
7. **For businesses.**
   - Perks and an EquipFlow-style dashboard on a blue-to-orange glow.
   - Request, quote and payment tabs.
   - KPIs that count up (38 requests, R 18 420 paid directly, 1h07 average reply against 2 h, R0 CarworX fee), a week/month chart morph and a request queue.
8. **Closing band.** The idling mark, "Your car's next visit, booked properly.", the driver CTA and a quieter link for businesses.
9. **Footer.** The lockup, "Concept, not final", and a line saying all businesses, people, prices and ratings are fictional.

**Nav:** a frosted pill fixed at the top. Above 900 px it shows the four section links and "List your business". From 900 px down it shows the lockup and a menu button, which opens the sheet described under pass 2.

## Brand handling

- The mark and wordmark are never redrawn. The sprite (one blade used five times at 72°, the small-mark blade, and the seven wordmark glyphs) is injected by a build script. Before writing, the script checks every path and transform against `brand/exports/core`:
  - the horizontal lockup: `translate(92,92) scale(0.92) rotate(21.9494)` and `translate(246,142)`
  - the stacked lockup: `translate(303.18,160) scale(1.6) rotate(21.9494)` and `translate(0,480)`
  - the small mark at its own rest angle, 39.9698°
- The intro only animates between those two official arrangements. The housing ring and tick dial are separate graphics around the mark, and they fade out before the logo settles.
- The small optical mark appears once, at 28 px, on the timeline's receipt.
- The name is always written CarworX. Signal orange is only an accent.

## References and where they show up

| Reference | Where |
|---|---|
| Apple Mac mini | The intro: full-scale glyph resolve, the product (the rotor) spooling into alignment in its housing, the tagline and the rolling service names, then the FLIP into the nav |
| ChronoTask | The dotted canvas, the floating tactile objects, the soft-3D service key-caps, the big sans headline with a grey second line, and the single pill CTA |
| Lightspark | The app carousel (crisp focus, softly blurred drifting neighbours) and the marquee |
| EquipFlow | The business dashboard: large thin numerals, frosted cards, the blue-to-orange glow and pill tabs |
| Notion | The hand-drawn car, plus the carousel's line-drawn thumbnails |
| Apple iMac | Soft-shadow product staging, with UI shown as physical objects. The booking timeline turns those objects into the product story |

## What it would mean for the app screens

- **Ground:** a light, near-white UI with frosted cards and one ink primary button per screen. Signal orange is kept for anything that is counting down.
- **One booking object:** the app can reuse the timeline idea. The same card changes form as the booking moves from request, to accepted, to held, to paid, so status is always one glance.
- **Numbers:** prices, timers and quote lines are set in Geist Mono, and big totals in thin Geist.
- **Quotes:** clean receipts with a visible 7-day validity strip and a single "Approve this exact quote" action.
- **Services:** the five key-cap objects can double as the app's category icons.

## Stills

All are in `stills/` and were recaptured for pass 2. Desktop stills are 1440 × 900. Mobile stills are 390 × 844 at 2× pixel density. All were captured in headless Edge.

| File | Shows |
|---|---|
| `01-intro-settled-desktop.png` | The intro at 2.85 s: the full-scale lockup with the tagline and the centred "For [service]" line |
| `02-intro-settled-mobile.png` | The phone intro, using the stacked lockup, with the group just above centre |
| `03-hero-settled.png` | The hero after the intro: the receipt has clear air and the stamp is under the total |
| `04-hero-tyres-hover.png` | Hovering the Tyres key: the key lifts, the tyre rolls, the gauge needle swings and the other objects dim to 0.75 |
| `05-booking-timeline.png` | The signature moment at step 3, the hold timer |
| `06-carousel.png` | The carousel: the chip row fades out and the stage fades at both edges |
| `07-business-dashboard.png` | The dashboard |
| `08-closing-band.png` | The new closing band |
| `09-mobile-hero.png` | The phone hero with the menu button and all five keys above the fold |
| `10-mobile-nav-open.png` | The phone menu sheet, open |
| `11-mobile-booking-timeline.png` | The phone timeline at step 3 |
| `12-mobile-dashboard.png` | The stacked phone dashboard |

## Checks done

All checks ran in headless Edge 156 through the DevTools protocol.

- **Errors and overflow (pass 2).** At 1280 × 800, 1440 × 900, 768 × 1024 and 390 × 844, plus 1366 × 768, with and without `prefers-reduced-motion: reduce`, I played the intro and scrolled the whole page in quarter-screen steps.
  - There were no console errors, warnings or exceptions, and page scroll width equals viewport width every time.
  - Edge prints its own "Tracking Prevention blocked access to storage" notice for the CDN scripts on a `file://` page. The QA script filters that out because it is a browser notice, not a page error.
- **Hero overlaps.** I measured the floating objects against the badge, headline lines, sub-line, CTA, keys, nav and each other. There were no overlaps at any tested width.
- **Orphans.** No visible heading, paragraph or list item ends with a single word on its last line. Two-line key labels such as "Repairs &" over "Maintenance" are intended and excluded from the check.
- **Menu keyboard test** at 390, with real key events:
  - Opening the menu focuses "How it works".
  - Tab moves through the four links, both buttons and the menu button, then wraps.
  - Shift+Tab wraps backwards.
  - Esc closes the sheet, sets `aria-expanded="false"` and returns focus to the button.
- **Long tasks over 50 ms during a full scroll.** These were recorded with a PerformanceObserver injected before page load.

  | Rendering | With motion | With reduced motion |
  |---|---|---|
  | GPU compositing on (closer to a real device) | 0–8 tasks, 50–200 ms; 1440 had 0–3 across runs | 0 at every width |
  | Software rendering (`--disable-gpu`) | 1–4 s paint-bound tasks at every width | The same, so they come from software raster, not from the motion |

  - Load adds 2–5 tasks of 130–400 ms, mostly script parsing and fonts.
  - In software mode, script, style and layout stay at 4–50 ms per step. The time is paint of the large blurred glows and shadows.
  - Before the pass 2 fixes, GPU-on runs showed tasks up to 300 ms in the timeline, carousel and dashboard. The fixes are listed under pass 2.
- **Text size.** No visible CSS text is under 12 px, outside the intro's SVG.
- **Contrast.** The ratios above were computed with the WCAG formula.

## Not verified

- **Safari, Firefox and real phones.** Only Chromium-based Edge was used. Touch swiping was not exercised with real touch input.
  - In current Safari, `backdrop-filter`, the receipt's CSS mask, `overflow-x: clip` and `position: sticky` inside the 420 vh timeline section should work, but I didn't see them run there.
- **Rendering inside the claude.ai Artifact viewer.**
- **Frame rate on real devices.**
  - Long tasks were only measured in headless Edge, whose GPU path is software-emulated. The timeline, carousel blur and big blurred glows should still be profiled on a mid-range Android phone.
  - Headless Edge runs the intro slower than real time, so its 3.9 s length comes from the animation timings, not a measurement.
- **Screen readers.** The menu sheet, live region and carousel roles were checked as markup and by keyboard, not with VoiceOver, TalkBack or NVDA.
- **Scaled hero objects.** From 901 to 1439 px the floating objects are scaled down (0.8, then 0.72) as a whole, so the text inside them renders at about 9–11 px. They are decorative and `aria-hidden`, but a later pass could give them compact variants instead of scaling.
- **Neighbour phone cards.** The out-of-focus phones in the carousel are scaled to 0.9 and 0.8, so their text renders below 12 px by design. The phone in focus is full size.
