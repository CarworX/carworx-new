# Studio: CarworX web design concept

**Status:** concept, not final. This is refinement pass 1 (2026-10-28), built to `../BRIEF.md`. The first version is kept for comparison as `v1/index.html`, with its stills in `v1/stills/`.

**One-line idea:** a calm, light studio desk where the objects of a booking float in soft depth: a sticky note, a key fob, a quote receipt and a hold timer. Every screen tells you what happens next.

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
8. **Footer.** The lockup, "Concept, not final", and a line saying all businesses, people, prices and ratings are fictional.

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

All are in `stills/`. Desktop stills are 1440 × 900. Mobile stills are 390 × 844 at 2× pixel density. All were captured in headless Edge.

| File | Shows |
|---|---|
| `01-intro-large-mid-reveal.png` | The intro at 1.2 s: glyphs half resolved, the rotor spooling with motion blur inside its concentric housing |
| `02-intro-large-settled.png` | The intro at 2.85 s: the full-scale lockup with the tagline and rolling services |
| `03-hero-settled.png` | The hero after the intro |
| `04-shortcuts-hover-tyres.png` | Hovering the Tyres key: the key lifts, the tyre rolls, the gauge needle swings and the other objects dim |
| `05-booking-timeline.png` | The signature moment at step 3, the hold timer |
| `06-product-glimpse.png` | The carousel |
| `07-business-dashboard.png` | The dashboard |
| `08-mobile-intro.png` | The phone intro, using the stacked lockup |
| `09-mobile-hero-shortcuts.png` | The phone hero, with all five keys above the fold |
| `10-mobile-booking-timeline.png` | The phone timeline at step 3 |
| `11-mobile-dashboard.png` | The stacked phone dashboard |

## Checks done

All checks ran in headless Edge 156 through the DevTools protocol.

- **Errors and overflow.** At 1440 × 900, 768 × 1024 and 390 × 844, with and without `prefers-reduced-motion: reduce`, I played the intro and scrolled the whole page. There were no console errors, warnings or exceptions. Page scroll width equals viewport width every time.
  - Edge prints its own "Tracking Prevention blocked access to storage" notice for the CDN scripts on a `file://` page. The QA script filters that out because it is a browser notice, not a page error.
- **Hero overlaps.** I measured the floating objects against the badge, headline lines, sub-line, CTA, keys, nav and each other. Nothing overlaps at 1920, 1440, 1439, 1360, 1280, 1200, 1180, 1024, 768, 600 and 390 px.
- **Text size.** No visible CSS text is under 12 px, outside the intro's SVG.
- **Contrast.** The ratios above were computed with the WCAG formula.

## Not verified

- **Safari, Firefox and real phones.** Only Chromium-based Edge was used. Touch swiping was not exercised with real touch input.
  - In current Safari, `backdrop-filter`, the receipt's CSS mask, `overflow-x: clip` and `position: sticky` inside the 420 vh timeline section should work, but I didn't see them run there.
- **Rendering inside the claude.ai Artifact viewer.**
- **Frame rate on low-end devices.**
  - The timeline animates width, height and border radius every frame while you scroll. That is smooth in desktop Chromium but should be profiled on a mid-range Android phone.
  - Headless Edge runs the intro slower than real time, so its 3.9 s length is by the timeline, not measured.
- **Scaled hero objects.** From 901 to 1439 px the floating objects are scaled down (0.8, then 0.72) as a whole, so the text inside them renders at about 9–11 px. They are decorative and `aria-hidden`, but a later pass could give them compact variants instead of scaling.
- **Neighbour phone cards.** The out-of-focus phones in the carousel are scaled to 0.9 and 0.8, so their text renders below 12 px by design. The phone in focus is full size.
