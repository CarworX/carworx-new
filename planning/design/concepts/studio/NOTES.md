# Studio: CarworX web design concept

**Status:** concept, not final (2026-10-28). Built to `../BRIEF.md`.

**One-line idea:** a calm, light studio desk where the objects of a booking float in soft depth (a sticky note, a key fob, a quote receipt, a hold timer), and every screen tells you what happens next.

## Palette

The canvas is a soft off-white with a 22 px dot grid. Colour comes only from the accents and soft gradients.

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#f2f1ee` | Page ground, with the dot grid at `rgba(13,15,18,.12)` |
| `--ink` | `#0d0f12` | Logo, headlines, the pill CTA |
| `--graphite` | `#1c2128` | Key fob, strong secondary text |
| `--muted` | `#5b6470` | Body and caption text (5.4:1 on canvas) |
| `--quiet` | `#7a828d` | The grey second headline line, at display sizes only (3.4:1, AA large) |
| `--blue` / `--blue-soft` | `#3d6dff` / `#a9c0ff` | Confirmations, the "accept" ring, the cool end of gradients |
| `--signal` | `#ff3b0a` | The 15-minute hold ring, live dots, the warm end of gradients. Never used for small text, never part of the mark |
| `--apricot` / `--peach` | `#ffb08a` / `#ffe3d4` | Soft orange in the EquipFlow-style gradients |
| `--note` | `#ffe9a6` | The sticky note |

Frosted surfaces are white at 50–90 % opacity, with `backdrop-filter` where nothing above them is filtered.

## Type

- **Geist** (Google Fonts, variable 200–700) is the display and text face. It is neutral and precise in the Apple/Swiss way, so the outlined Sora wordmark stays the one distinctive letterform on the page. Headlines are set at weight 500 with tight tracking (-0.045em). Dashboard numerals use weight 200 for the EquipFlow-style large thin figures.
- **Geist Mono** is used for timers, prices on the receipt, metadata labels and the scrambling glyphs in the intro, so the numbers in the product feel like real data.
- **Caveat** is the handwritten accent, used only on the sticky note and the question marks in the fines section.

## Sections

1. **Intro (about 3.4 s plus a 0.95 s hand-off).** Mono glyphs scramble in the seven letter slots and resolve left to right into the outlined CarworX glyphs. At the same time the Turbine rotor slides in from the left and spools into its seat inside a hairline housing ring. The spool follows the brand timeline's physics: lag, then surge, then brake, a 1.8° overshoot and a damped spring that lands exactly on the static logo. Motion blur comes from trailing rotor copies whose spread follows the angular speed. A pressure ring leaves the rotor as it seats. Then "Car care, booked properly." staggers up and a "For [service]" line rolls through the services. Finally, the lockup flies into its place in the nav while the intro canvas dissolves into the identical page canvas.
   - Click, scroll, key or touch skips the intro by playing it at 5× speed.
   - With reduced motion, the settled lockup is shown as a still for 1.4 s, then fades.
2. **Hero.** The badge reads "Pilot · CarworX fee R0". The headline is "Car care, booked properly." with a grey second line, "Nearby, and in writing.", followed by a sub-line and one ink pill CTA. The five services are tactile key-cap tiles, in brief order, that lift on hover and press on click. Six objects float in soft depth with layered shadows:
   - a handwritten sticky note
   - a booking-confirmed tile
   - a tyre-pressure gauge whose needle wobbles
   - a 15-minute hold timer that counts down live
   - a key fob
   - a written-quote receipt with a zig-zag edge and an "APPROVED" stamp

   Each object has its own idle drift, pointer parallax by depth and scroll parallax that pushes it outwards. On entry, the objects spring in with elastic easing.
3. **How it works.** Four step cards sit beside a sticky status card that changes state as each step reaches mid-screen:
   - Request sent, with a ring showing 1:58 left to accept
   - Accepted, with a pinging check
   - Held for you, with a live 15:00 countdown in signal orange
   - Paid directly: a coin travels from Thandi to Shine Studio, and CarworX sits below on a dashed line marked "R0 fee, never holds it"

   Then a repair block shows Pieter's written brake quote, whose 7-day validity strip fills as you scroll, and an "Approve this exact quote" button with a sheen. A note says extra work needs a new approved quote.
4. **Fines & Vehicle Admin.** This is the Notion-style hand-drawn micro-illustration: a parked car in line art with a fine tucked on the windscreen. The wipers sweep on a loop, the ticket flutters, breeze lines drift and a question mark bobs. The text promises straight guidance in plain words.
5. **Product glimpse.** A Lightspark-style carousel of five frosted phone screens: search results (with a mobile business's travel band), a listing, quote approval, the payment hold and fines guidance.
   - The card in focus is crisp and full size. Its neighbours scale down, blur, lose saturation and drift.
   - The carousel runs on a spring and autoplays while visible. You can drag it, use the arrow keys or pick a pill tab.
   - A slow marquee of the five service names stands in for Lightspark's logo strip, so there are no fake brands.
6. **For businesses.** "List free during the pilot. R0 fee. Paid directly." Perk pills sit above an EquipFlow-style dashboard on a blue-to-orange glow:
   - pill tabs for Requests, Quotes and Payments, which swap the right-hand panel
   - large thin KPI numerals that count up: 38 requests, R 18 420 paid directly, 1h07 average reply against 2 h, and R0 CarworX fee
   - a bookings chart that draws on entry and morphs between Week and Month
   - a request queue with accept countdowns and a travel-band line
7. **Footer.** A large lockup, a "Concept, not final" pill, and a line saying all businesses, people, prices and ratings are fictional.

## Motion system

- **One clock for the logo.** The intro is a pure function of time, `drawIntro(t)`, driven by a GSAP tween. It can be paused at any moment; `#intro=1.3` in the URL freezes it, which is how the stills were made. `#skip` jumps straight to the page.
- **Springs for the objects.** Hero objects use `elastic.out(1, .72)`. The carousel uses a damped spring (stiffness .075, damping .74). Hover states use `cubic-bezier(.16,1,.3,1)`.
- **Scroll-linked, never scroll-jacked.** Headline lines rise out of masks. Content reveals with blur-to-sharp. The quote's validity strip and the background blobs are scrubbed by scroll. The status card is CSS-sticky.
- **Libraries:** GSAP 3.12.5 and ScrollTrigger 3.12.5 from cdnjs. If GSAP fails to load, the page shows everything statically with no intro.
- **Reduced motion:** the intro becomes a still. Drift, parallax, autoplay, wipers, needle, marquee and live countdowns all stop, and counters show their final values.

## Brand handling

- The mark and wordmark are never redrawn. The geometry comes straight from `brand/exports/core/`:
  - the single blade path used five times at 72° steps
  - the seven wordmark glyph paths
  - the lockup's own transforms, `translate(92,92) scale(0.92) rotate(21.9494)` and `translate(246,142)`
  - the small optical mark at its own rest angle of 39.9698°, used once at about 30 px in the payment diagram
- These were injected by a build script that checks the exported files have not changed. The result renders exactly like the export SVGs.
- The name is always written CarworX. Signal orange appears only as an accent.

## References and where they show up

| Reference | Where |
|---|---|
| Apple Mac mini | The intro: glyph scramble into the wordmark, the product (the rotor) sliding into alignment, then the tagline and the rolling text carousel |
| ChronoTask | The dotted off-white canvas, the floating tactile objects, the big clean sans headline with a grey second line and the single pill CTA |
| Lightspark | The product-glimpse carousel (focus crisp, neighbours blurred and drifting) and the marquee under it |
| EquipFlow | The business dashboard: large thin numerals, frosted cards, the blue-to-orange glow and pill tabs |
| Notion | The hand-drawn car with sweeping wipers and a fluttering fine |
| Apple iMac | The light, soft-shadow product staging, with UI shown as physical, frosted objects |

## What it would mean for the app screens

- **Ground:** a light, near-white UI with frosted cards and one ink primary button per screen. Signal orange is kept for anything that is counting down: the 15-minute hold and the time left to accept.
- **Numbers:** prices, timers and quote lines in Geist Mono. Big totals in thin Geist.
- **Status first:** every booking shows a single status card with a ring (time left to accept, then the hold, then paid) and one plain sentence about what happens next. This maps directly to the request, accept, hold and pay states.
- **Quotes:** written quotes look like a clean receipt, with a visible 7-day validity strip and a single "Approve this exact quote" action.
- **Personality:** occasional hand-drawn illustrations, mainly for empty states and the fines and admin guidance, add warmth without clutter.

## Stills

All in `stills/`, captured at 1440 × 900 with headless Edge:
- `01-intro-mid-reveal.png`: the intro paused at 1.3 s
- `02-hero-settled.png`: the hero after the intro
- `03-business-dashboard.png`: the business dashboard
- `04-product-glimpse.png`: the carousel (bonus)

## Checks done

- Ran in headless Edge 156 at 1440 × 900 and 390 × 844, playing the full intro and then scrolling the whole page. There were no console errors, warnings or exceptions, and the page's scroll width equals the viewport width at both sizes.
- Ran the same pass with `prefers-reduced-motion: reduce` at 1440 px: no errors and no overflow.
- Measured the hero objects against the headline, copy, shortcut tiles, nav and each other at 1440, 1180 and 390 px. Nothing overlaps.
- The page is about 94 KB, plus fonts and GSAP from CDNs.

## Not verified

- Safari and Firefox, and real phones (only Chromium-based Edge was used). `backdrop-filter`, CSS masks on the receipt and `overflow: clip` should work in current Safari but were not seen running there.
- Rendering inside the claude.ai Artifact viewer.
- Sizes between the tested widths other than 1180 px, such as tablet portrait at 768 px.
