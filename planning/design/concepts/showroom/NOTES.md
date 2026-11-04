# Showroom

**Status:** concept, not final. 2026-10-28.

**Idea:** CarworX introduced like a product launch. The Turbine is the product on the turntable, the five services are its colour lineup, and every section is a keynote slide: giant type, one idea at a time, confident colour.

Open `index.html` directly in a browser, or publish it as an Artifact. It is one self-contained file of about 105 KB. It loads only Google Fonts and GSAP 3.12.5 with ScrollTrigger from cdnjs.

## Palette

The base comes from the logo: **ink** #0d0f12 for the dark stages, white for the showroom floor and **floor** #f5f5f7 for the soft-grey sections. Around that sits a five-colour lineup, one colour per service and always in the same order. `signal`, the brand's own UI accent, is the anchor. The other four are tuned to sit beside it at a similar strength, like an iMac colour range.

| Service | Colour | Fill | Text on fill | Deep (text on white) |
|---|---|---|---|---|
| Wash & Detailing | Rinse | #2a5cff | white 5.2:1 | #0b4fd6 |
| Repairs & Maintenance | Signal | #ff3b0a | ink 5.4:1 | #c42600 |
| Glass Repair & Replacement | Lens | #7b4dff | white 4.8:1 | #5b2fe0 |
| Tyres & Wheel Alignment | Tread | #00b37a | ink 7.1:1 | #007a52 |
| Fines & Vehicle Admin | Permit | #ffc21a | ink 11.9:1 | #8a6100 |

- Every pair of text and fill was checked for WCAG AA. On light grounds, the morphing keyword uses the deep tone for Tread and Permit.
- The mark itself is only ever white on ink or ink on white, as the brand README says. Signal never touches the mark.
- Each how-it-works slide takes one lineup colour as a full-bleed background: white, Rinse, Permit, Tread, then Signal.
- The page has a fixed palette by design. It sets `color-scheme: light` and does not switch for dark mode.

## Type

- **Display: Bricolage Grotesque** (variable optical size, width and weight). It has a lot of character at giant sizes, with ink traps and tight curves, yet stays readable. Used at weight 700 with tracking of -0.045em for keynote headlines. The dashboard numerals use a thin cut (weight 250, width 85), taking the EquipFlow cue. Its warmth contrasts with the geometric Sora of the wordmark without fighting it.
- **Text: Geist.** A clean, neutral grotesk that reads well at 11–19 px in the phone and dashboard UI.
- **Data: Geist Mono.** Prices, timers, references, eyebrows, and the glyphs that cycle in the intro.
- The wordmark is never typed. It is the outlined artwork from `brand/exports/core`, inlined as an SVG symbol together with the rotor and lockup.

## Sections and where each reference shows up

1. **Intro (Apple Mac mini).**
   - Mono code glyphs cycle in each letter slot of the real wordmark, then resolve one by one with a blur-to-sharp morph.
   - The Turbine rotor rolls in from the right, spinning down, and seats beneath the word. It overshoots by 1.8° and settles, as in the brand motion films.
   - A steel glint sweeps the word. Then the sub-line, the pill CTAs and the details stagger up and roll into a text carousel of the five services.
   - A key light and a counter light lap the background, taken from the hero film.
   - Any scroll, click, touch or key press skips to the end. Under `prefers-reduced-motion` the final still is shown.
2. **Hero (Apple iMac morph zoom).** Pinned and scrubbed by scroll.
   - The hero object is the CarworX app icon, built as a 3D squircle: 12 stacked slabs give it real thickness, a nod to Agentic UI's voxel slices. Its rotor spins, it sways, and on scroll it turns a full 360°.
   - It then shrinks into the centre slot of the lineup while the five coloured shortcut tiles fly out from behind it. The headline "Find it. Book it. Sorted." fades in with the sub-line and CTA.
   - On phones the lineup becomes five full-width rows.
3. **Search ring (Melius).** Twelve service and booking cards spin as a tight 3D cylinder.
   - On scroll the ring bursts outward, and the cards walk the screen perimeter to settle along the edges.
   - That clears the centre for "What does your car need?" and a prompt pill. The pill types example requests, such as a hand wash in Rosebank or a brake quote in Pretoria East.
   - On phones, three cards sit above and three below the copy, and the rest fly off the edges.
4. **Product glimpse (Wabi).** The headline keyword rolls vertically, letter by letter, through Wash → Repairs → Glass → Tyres → Fines, ", made simple.", changing colour with each service.
   - Three puffy die-cut stickers per service float around a phone and pop out and in on a spring.
   - The phone screen changes in step:
     - search results for Wash
     - Pieter's written quote approval for Repairs
     - a business listing for Glass
     - accepted plus the 15-minute hold for Tyres
     - fines guidance for Fines
   - It auto-cycles while in view and stops when you pick a tab. The tabs are a proper keyboard tablist.
5. **How it works (keynote slides).** A pinned horizontal run of five full-bleed slides, with the visuals scrubbed by scroll:
   - Thandi's request card flips from Draft to "Request sent".
   - A dial counts down the 2 business hours and stamps "Accepted".
   - A 15:00 hold timer ticks down.
   - A payment dot travels from Thandi through the payment partner to the business, with "CarworX fee R0".
   - Pieter's 7-day quote validity drains day by day.
   - The travel charge by distance band is noted on slide 1.
   - Under reduced motion the slides stack vertically.
6. **For businesses (Fundable).** Thirteen circular badges burst out from the headline "List free. Pay R0." with spin and real spring physics: an integrated, underdamped spring for position, rotation and scale.
   - The badges are the five service categories, the pilot facts (R0 fee, free listing, 2 h to accept, 15 min hold, 7-day quotes, paid directly, travel bands) and the mark.
   - They shy away from the pointer.
   - Below them is an **EquipFlow**-style business dashboard: frosted cards, thin giant numerals that count up, pill tabs, a blue-to-orange meter, bookings by service in the lineup colours, and a list of requests waiting to be accepted.
7. **Footer.** A giant white horizontal lockup that scrubs up into place, a "Concept, not final" tag, and a line saying all businesses, people, prices and ratings are made up.

Not used: Lightspark, Antimetal, Notion and ChronoTask, apart from the light thinking. The other concepts cover those.

## Motion system

- **One library, two kinds of motion.**
  - Scroll-scrubbed timelines (GSAP ScrollTrigger) for the three pinned set pieces: hero, ring and how it works.
  - Self-running physics for the badges and stickers: hand-written springs, and CSS spring curves.
- **Easing.** The brand rule for the mark is followed: mechanical, not bouncy. Everything else uses expo-out for arrivals and real overshoot only where something is "thrown": stickers, badges and tile hovers.
- **Rhythm.** Build, hold, release. Each pinned section holds a beat at its settled state before releasing the scroll.
- **Reduced motion.** No pins and no autoplay. Every section renders in its final, readable state.
- **Fallback.** If GSAP fails to load, the page falls back to the same static states.
- Test hook: `window.__showroom.intro` is the intro timeline. `__showroom.intro.pause(); __showroom.intro.seek(1.3)` freezes it mid-reveal.

## What it would mean for the app screens

- **Colour as wayfinding.** Each service keeps its lineup colour everywhere: tab chips, result thumbnails, primary buttons inside that service, and status accents. Ink and white stay the chrome, so the app feels calm with one splash of colour per context.
- **Big type for the one number that matters.** On each screen, show the one key number large in mono: the time left to accept, the 15-minute hold, a quote total, or R0.
- **Status as a physical object.** Timers are rings, quotes are cards with a validity strip, and payments are a dot travelling to the business. The app should use the same components the site shows.
- **App icon.** The ink squircle with the white rotor is the hero object, so the site and the home-screen icon reinforce each other.
- **Risk.** Five saturated colours need discipline. Never more than one service colour per screen, apart from overview screens like the lineup and the dashboard chart.

## Checks

- Headless Chrome, at 1440×900 and 390×844, scrolling through every section, with reduced motion at both widths:
  - **0 console errors or warnings**
  - **no horizontal overflow** (`scrollWidth` equals `clientWidth` at every stop)
- Stills in `stills/`:
  - `01-intro-mid-reveal.png`: the intro at 1.3 s
  - `02-hero-settled.png`: the hero lineup settled
  - `03-ring-burst.png`: the ring after the burst
  - `04-hero-settled-390.png`: the phone lineup
- Not verified:
  - Real touch scrolling on iOS Safari or Android, which matters most for the three pinned sections.
  - Firefox: the phone mock-up uses CSS `zoom` at narrow widths, which needs Firefox 126 or later.
  - Frame rate on low-end phones.
  - A screen-reader pass beyond the semantic structure.
