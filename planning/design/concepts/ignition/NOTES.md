# Ignition: CarworX web design concept

**Status:** concept, not final. Built 2026-10-28 for the owner to compare with the other directions in `planning/design/concepts/`.

**One-line idea:** car care at night, in an engine bay lit by instruments. The Turbine is the hero object. It ignites out of a wave of light, spools up as a 3D voxel rotor, then turns into the page's selector, clock and telemetry.

## Files

| File | What it is |
|---|---|
| `index.html` | The concept. One self-contained file (about 138 KB). The only external requests are to Google Fonts. |
| `src/page.html` | Source template. Edit this, not `index.html`. |
| `build.mjs` | Inlines the locked artwork and `motion/shape.mjs` into the template: `node build.mjs` |
| `qa.mjs` | Headless Chrome check: console errors, horizontal overflow at 1440 and 390 px across the whole scroll, reduced motion, and the stills: `node qa.mjs --stills` |
| `stills/` | `01` intro mid-reveal, `02` ignition, `03` hero settled, `04` telemetry, `05` product rail, `06` business, `07–09` the same at 390 px |

## Palette

The canvas is ink-black. Light comes from the instruments.

| Token | Value | Use |
|---|---|---|
| `ink` | #0d0f12 | Page ground (brand ink) |
| `graphite` | #1c2128 | Glass cards, tinted with a white edge |
| `steel` | #8a97a6 | Hairlines, ticks, the engineering grid |
| `text` / `text-2` / `text-3` | #eef1f4 / #b3bcc6 / #919dab | Text. On ink the contrast ratios are 16.9, 10.0 and 7.0 to 1 (5.9 to 1 for `text-3` on graphite), so all pass AA. |
| `signal` | #ff3b0a | Primary CTA fill (ink text on it is 5.4:1), wave, pointer, live traces. Never used for small text. |
| `gold` | #ffb547 | Warm half of the wave; live numbers and the active index (10.9:1 on ink) |

Signal and gold never touch the mark. The rotor is white at rest. It glows orange only while it spools up, as a heat effect on the voxel copy and never on the logo artwork. The logo artwork itself (nav, footer and the reduced-motion still) is the exported white SVG, inlined unchanged.

## Type

- **Archivo** (Google Fonts, variable width and weight) for display and text. It is a grotesk with sharp terminals and an industrial history. Headlines are set at 600 weight, 108% width and -0.035em tracking, so they read engineered rather than friendly. Large numerals (the R0, the readouts and the dashboard KPIs) use the light 300 weight, like an instrument face.
- **JetBrains Mono** for data: labels, channel names, timecodes, prices in lists and the boot log. It is already the brand's mono token, and it is the face the intro glyphs cycle through.
- The wordmark is never typed. It is the outlined artwork. Archivo sits close enough to Sora that the two do not fight.

## Motion system

There is one clock for the intro and one damped spring for the rotor. Everything else is scroll-linked. The rules come from the brand motion: mechanical, not bouncy; build, hold, release.

1. **Intro (about 3.9 s, skipped by any scroll, click, key or touch).** Crosshairs draw out from the centre, and a mono boot log types the Turbine's real parameters. A grid of code glyphs cycles over the wordmark's footprint. The mask comes from the wordmark's own paths. The glyphs lock left to right into pixels, flash gold, then sharpen into the real SVG wordmark. A pixel wave in signal and gold ignites from the centre outward. Its particles swirl into a **voxel rotor**: the five blades are sampled from `bladeOutline()` in `shape.mjs` on a 2.6-unit grid and extruded into slices that are thick at the root and thin at the tip. The rotor spools two turns (lag, surge, braking), overshoots 1.8° and settles on a spring. Then it glides into its seat as the wordmark flies into the nav lockup. The headline, CTA and shortcuts stagger up, and the "Indexing" line starts its text roll.
2. **Hero.** The WebGL rotor idles with a slow tilt, so the slices read as 3D. A scan band passes through the slices (the Agentic UI voxel morph). The rotor is framed by a tick dial, crosshairs, corner brackets and metadata badges: live RPM, the 38° X-stroke, status, and the selected service. A cursor crosshair reads out X/Y.
3. **Five shortcuts: rotor selector.** Each service is mapped to a blade. Its number sits at that blade's tip on the dial. Hovering or focusing a shortcut **indexes the rotor one blade (72°) at a time**, always forward like a ratchet, on a damped spring. The dial, the badge and the text roll update together. With no input, it auto-indexes every 3.8 s, and the tile's bottom gauge shows the countdown. Each tile's icon is a blade-outline rotor (generated from the geometry) with that service's blade filled. Indexing by whole blades keeps the resting pose identical to the logo.
4. **How it works: telemetry scope.** Pinned while it scrubs. Scrolling moves a playhead across a five-channel timing diagram, like a logic analyser. **Booking (Thandi, Rosebank):** request pulse → accept window (dashed: up to 2 business hours, accepted at 0:47) → 15-minute slot hold → payment pulse to the business → confirmed. Axis breaks mark the change of time scale. **Repair (Pieter, Pretoria East):** written quote → 7-day validity with day ticks → approve this exact quote → pay → extra work found, new quote Q-0418-B approved separately → paid. The readouts count down live (2:00:00, 15:00, days left), and the step list follows the playhead.
5. **Product glimpse: glass rail (Lightspark).** Pinned. Four device cards glide sideways. The card in focus is crisp and full size. Its neighbours blur, shrink, tilt in 3D and fade. The screens are search results, a listing with time slots and the 2-hour note, quote approval, and the business dashboard. A telemetry ticker of product facts runs below (in place of a logo marquee, since there are no real partners to show).
6. **For businesses.** A light-weight **R0.00** numeral rolls down from 9 to 0 like an odometer as it scrolls in. The WebGL wave reignites behind it, without the rotor. A spec sheet lists the pilot terms.
7. **Reduced motion.** No intro. The rotor is a single static frame at rest, which is the logo pose. There is no tilt, scan or auto-index. The product rail becomes a static grid. If WebGL is unavailable, the exported white mark SVG sits in the seat.

## References: where each one shows up

| Reference | In Ignition |
|---|---|
| Apple Mac mini | Intro: code glyphs cycle and lock into the wordmark. The product (rotor) slides into place aligned to it. Copy, pill CTA and shortcuts stagger up and roll into the "Indexing" text carousel. |
| Antimetal | The shimmering signal/gold pixel wave igniting across the centre, and again behind R0. Headline, pill and nav stagger in after it. |
| Agentic UI | A monochrome voxel-sliced 3D emblem built from the real Turbine geometry, with a scan band through the slices, crosshairs, corner brackets and badges (RPM, 38°, status, SVC 01/05). The precise mono type comes from here too. |
| Lightspark | Product rail: focus card goes crisp, neighbours blur, shrink and drift. A fact ticker stands in for the logo marquee. |
| EquipFlow | Dashboard and readouts: large thin numerals, frosted cards, a signal-to-gold gradient on the hot KPI, pill tabs. They are dark, not airy, to suit the direction. |
| Apple iMac | Loosely: one hero object that then resolves into a lineup (the rotor becomes the five-service cluster). |
| Melius, Wabi, Fundable, Notion, ChronoTask | Not used. They pull towards light, playful or illustrated, which is the opposite of this direction. They suit the other concepts better. |

## What it would mean for the app screens

- **Dark-first app.** Ink background, glass cards with a 1px white edge, mono labels in caps, light-weight tabular numerals for money and time. A light theme would need its own pass.
- **Timers are first-class UI.** The 2-hour accept window, 15-minute hold and 7-day quote validity appear as countdown readouts and progress bars on every relevant screen: request status, checkout, quote approval and the business inbox.
- **The rotor as system feedback.** The loader indexes one blade at a time (the brand's 1.2 s ratchet). Pull-to-refresh spools the rotor. A booking confirmation could replay a short spool-and-lock.
- **Service picker.** The five services can keep the blade-index metaphor (01–05, the same order everywhere). The outline-rotor icons work as tab or category icons.
- **Signal discipline.** Signal is reserved for the one primary action per screen and for live state. Gold is for live numbers. That keeps the instrument-cluster feel without turning the app orange.
- **Cost:** WebGL suits the marketing site only. The app should use the SVG mark and CSS, and the voxel look could be pre-rendered as a short video if wanted.

## Checks run

- `node qa.mjs --stills` in headless Chrome 156, with WebGL on SwiftShader: **no console errors or warnings** and **no horizontal overflow** at 1440×900 and 390×844, checked every half-screen down the whole page. Reduced motion loads cleanly with no intro.
- Also viewed in the desktop app's built-in browser at about 800 px wide.
- Not verified: real phones (iOS Safari's `backdrop-filter` and WebGL point-size limits), frame rate on low-end Android, and screen-reader passes beyond the semantic structure (the telemetry scope is one labelled `role="img"`). Contrast ratios were calculated from the token values (WCAG formula), not measured on rendered pixels. Text that crosses the WebGL wave was checked by eye only: the wave sits behind the R0 numeral, away from body text.
