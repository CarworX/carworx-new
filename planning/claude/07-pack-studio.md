# Claude — 07: §22 pack rebuilt in Studio

Date: 2026-10-28. Branch: `planning/design-motion-toolkit`, built on `0d53f8e` (Studio pass 2). Follows [Claude 06](06-presentation-pack.md), D-035 and D-036. Started from the owner's master session.

**Status: DELIVERED FOR REVIEW.** These are planning artefacts only. There is no application code, hosting, account or network call.

## What changed from 06

**Design**

Every page of [`design/pack/`](../design/pack/) is rebuilt in the Studio language:
- a light dotted canvas and a frosted pill nav
- Geist, Geist Mono and Caveat
- soft-3D key-cap shortcuts, the receipt quote, the hold dial and the sticky note
- frosted phones
- an EquipFlow-style dashboard
- hand-drawn illustrations for empty and error states

The ink-header style of 06 is gone.

**New**
- **Opening:** the Studio intro. Glyphs resolve into the full-scale lockup while the rotor spools inside its housing, then the lockup flies into the nav. Phones use the stacked lockup.
- **Brand page:**
  - Turbine rules quoted from `brand/README.md`: clear space, minimum sizes, the four colour pairs with their contrast ratios, the don'ts, and two optical sizes.
  - A Studio UI-language section, tagged "Chosen direction · concept, not final".
- **Journeys:** each has a scroll-linked booking object that changes form as each step reaches the middle of the screen. The step lists are complete on their own, so stills and print read without it.
- **Mobile nav:** a menu button opens a frosted sheet, with a focus trap, Esc to close and `aria-expanded`.
- **Business dashboard:** a computer view with demo numbers, in addition to the phone view.
- **Footer:** "Concept, not final. All businesses, people, prices and ratings are fictional."

**Facts:** unchanged. The summary, screen copy and states, journeys, roadmap and decisions table are carried over word for word. The only factual addition is the D-035/D-036 line in "Key decisions already made". [`SUMMARY.md`](../design/pack/SUMMARY.md) gets one sentence naming Studio as the chosen concept.

**Tooling**
- **Build:**
  - `build.mjs` now assembles `src/parts/*.html`.
  - It embeds the Studio fonts, which are vendored with their OFL licences in `src/vendor/fonts/`.
  - It takes the intro's geometry from the core exports, after checking both lockups' transforms.
  - No GSAP is needed: the pack's motion is plain JavaScript.
- **Exports:** `export.mjs` writes 27 PNGs (sections at 1440, eight phones at 390 and 2×, intro stills) and an A4 PDF. Print styles render the scroll-linked parts as settled stills.
- **QA:** `qa.mjs` now runs at 360, 390, 768, 1280, 1440 and 720 (the 200% zoom stand-in). It also checks contrast through translucent layers, real-key focus order and rings, the menu trap and reduced motion.

## Checks (detail in [QA.md](../design/pack/QA.md))

**PASSED**
- **Layout:** no overflow at any width, including the 200% stand-in. At 360 the five shortcuts are equal (63 px each) and end at 576 px, inside the 640 px fold.
- **Contrast:** 0 failures across 1,055 text elements. The first run found 2 failures, which were fixed.
- **Keyboard:** 28 focus stops in DOM order, all with visible rings. The menu traps focus and Esc closes it.
- **Motion:** reduced motion and motion-on behaviour both work.
- **Loading:** no network requests at view time.
- **Exports:** all 27 PNGs were opened and checked by eye, and so were PDF pages 1–5 and 38–42 (42 pages, 2.9 MB). That review found and fixed three layout bugs before the final export.

**UNVERIFIED**
- real browser zoom
- contrast of text inside SVG
- the design-critique and accessibility-review skills (not invoked)
- Safari, Firefox and real phones (Chromium only)

## Needs the owner

- Looking at the rebuilt pack, then showing it to the colleagues.
- Merging this branch, or any public hosting. Neither is done here.
- `/design-sync` to Claude Design, if wanted.

## Handoff

**Baton: CODEX.** Please review the rebuilt pack at the tip of `planning/design-motion-toolkit`:
- that the facts match 06 and PLAN 2.1;
- §10 state coverage;
- accessibility, including the UNVERIFIED rows;
- that the exports are usable.

Cosmetic feedback doesn't reopen technical decisions.
