# CarworX web design concepts: shared brief

**Status:** exploration, 2026-10-28. The owner rejected the look of the §22 pack (`planning/design/pack/`). The **Turbine logo and its motion films are the only things kept**. Everything else is open: palette beyond the logo, type, layout, imagery and motion.

**Goal:** three or four distinct directions for the CarworX marketing site, each good enough to win a web design award (Awwwards / FWA / CSS Design Awards level). The owner will look at each quickly, pick one, and then tweak it before the full pack is rebuilt in that direction.

## The product (keep the facts right)

CarworX (carworx.app) is a South African site where drivers find car services near them, ask questions, book a time and pay, and get straight guidance on traffic fines and vehicle admin. Businesses list for free during the pilot.

Five equal service shortcuts, always in this order and wording:
1. Wash & Detailing
2. Repairs & Maintenance
3. Glass Repair & Replacement
4. Tyres & Wheel Alignment
5. Fines & Vehicle Admin

How it works:
- Nothing is instant. You send a request; the business has **2 business hours** to accept.
- On accept, the slot is **held 15 minutes** while you pay on a secure payment partner's page. Money goes straight to the business; CarworX never holds it.
- Repairs start with a **written quote**, valid **7 days**. You approve that exact quote, then pay. Extra work needs a new approved quote.
- Mobile businesses add a **travel charge** by distance band.
- Pilot **CarworX fee: R0**.

Example people (fictional): **Thandi** books a wash in Rosebank; **Pieter** gets a brake repair quote in Pretoria East. Prices in rand (R). All businesses, people, prices and ratings are made up. Never use real company logos, real endorsements, fake press quotes, fake "trusted by" brands or invented user counts.

## The brand you must use

Read `planning/design/brand/README.md`, `tokens.json` and `design-system.json`.
- Logo files: `planning/design/brand/exports/core/` (SVG mark, small mark, horizontal and stacked lockups, on-ink and on-paper). Inline the SVG; **never redraw or retype the wordmark**. The name is always written **CarworX**.
- Geometry source: `planning/design/brand/motion/shape.mjs` (five log-spiral blades around an open hub; the X's rising stroke leans 38°). You may generate new graphics from this geometry (particles, voxel slices, outlines) as long as the mark itself is not altered.
- Motion reference the owner likes: `planning/design/brand/motion/preview.html`, `timeline.mjs`, and `exports/motion/` (hero films, loop, splash). Match its quality and timing; you may embed `exports/motion/carworx-hero-embed.html`'s approach.
- `signal` orange #ff3b0a is an accent, never part of the mark. Ink #0d0f12, graphite #1c2128, paper #f4efe6 are available, but each concept may build its own palette around the logo.

## Owner's references (what to take from each)

| Reference | Take |
|---|---|
| Apple Mac mini hero | **Required opening for every concept.** On load, code symbols and glyphs cycle and morph into the word, a product slides into place aligned to it, then secondary text, a pill CTA and details stagger up and roll into a text carousel. For CarworX: glyphs resolve into the CarworX wordmark/Turbine, the rotor spins up, then the page settles. |
| Lightspark hero | Grid of product UI cards gliding across; the card in focus scales up and goes from blurred glass to crisp; neighbours blur, shrink and drift. Logo marquee below. |
| Melius hero | Tight cylindrical ring of cards in 3D bursts outward to the screen edges, clearing the centre for the headline and a prompt pill. |
| Antimetal hero | Dark canvas lit by a shimmering pixel/particle wave expanding across the centre; headline, pill badge, CTA and nav stagger up. |
| Agentic UI logo | Monochrome hero with a 3D emblem whose voxel slices morph between forms as it rotates, framed by crosshairs, technical metadata badges and precise type. |
| Apple iMac morph zoom | One hero object rotates, then scales down into a full colourful lineup while the headline fades in. |
| Wabi hero | Headline keyword morphs vertically through use cases; floating 3D stickers around a phone swap to match; phone screen updates in step. |
| Fundable header | Cluster of circular badges bursts outward with spin and spring physics into a distributed layout. |
| Notion header | Hand-drawn illustration with one small looping micro-animation; calm, characterful. |
| ChronoTask (Dribbble) | Light, soft-grey dotted canvas; tactile floating objects (sticky note, checkbox tile, stopwatch, reminder card); big clean sans headline with a grey second line; one blue pill CTA. |
| EquipFlow (Dribbble) | Airy light dashboard: large thin numerals, frosted cards, soft blue-to-orange gradients, pill tabs. Use for the business dashboard / booking-status visuals. |

## What every concept page must contain

One page per concept, scrolling, desktop-first but working at 390 px wide:
1. **Intro**: the Mac-mini-style glyph-to-logo reveal (about 2.5–4 s, skippable by scroll/click, and replaced by a still under `prefers-reduced-motion`).
2. **Hero**: headline, sub-line, one primary CTA, and the five shortcuts presented in that concept's own way.
3. **How it works**: request → accepted in 2 business hours → 15-minute hold → pay the business directly; plus the 7-day repair quote. Animated, not a bullet list.
4. **Product glimpse**: phone and/or desktop UI for search results, a listing, a quote approval and the business dashboard, drawn in the concept's style (HTML/CSS/SVG, not screenshots).
5. **For businesses**: free listing during the pilot, R0 fee.
6. **Footer** with the lockup and "Concept, not final".

Motion should feel designed in every section (scroll-linked reveals, depth, spring physics), not just a hero trick. Typography should be deliberate: pick a display face and text face, load them from Google Fonts, and say why.

## Technical rules

- One self-contained `index.html` per concept, in `planning/design/concepts/<concept-slug>/`. It must work when published as a claude.ai Artifact: inline CSS/JS/SVG; external scripts only from cdnjs.cloudflare.com or cdn.jsdelivr.net/npm with an exact version (for example GSAP 3.12.5, three.js r160); fonts only from Google Fonts. Under 5 MB. Embedded raster images as data URIs only if small.
- Define colours as CSS custom properties on `:root`; give `body` an explicit background.
- No horizontal scroll at 390 px. Keep text contrast at WCAG AA. Respect `prefers-reduced-motion`.
- Also write `planning/design/concepts/<concept-slug>/NOTES.md`: concept name, one-line idea, palette, type, motion system, which references it draws from, and what it would mean for the app screens.
- Capture 3 stills into `planning/design/concepts/<concept-slug>/stills/` (intro mid-reveal, hero settled, one later section) by any local means available (for example headless Chromium via the existing pack `src/cdp.mjs` approach). If you cannot, say so in NOTES.md.
- Work only inside your own concept folder. Do **not** commit, switch branches or touch other folders; the master session commits.
- Optional inspiration: the `hyperframes` and `hyperframes-registry` skills list motion vocabulary (kinetic type, glitch, particles, 3D camera moves). Read them for ideas only; do not render videos.
