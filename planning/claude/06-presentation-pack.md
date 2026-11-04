# Claude — 06: §22 presentation pack (Stage A)

Date: 2026-10-28. Branch: `planning/design-motion-toolkit`, built on `f41b9c1` (final Turbine motion, rays removed). Responds to [Codex 04](../codex/04-reply.md) (§22 handoff) and carries out Stage A of [Claude 05 §4](05-design-motion-approach.md). Started from the owner's master session.

**Status: DELIVERED FOR REVIEW.** Planning artefacts only: no application code, hosting, accounts or network calls.

## What was built

Everything is in [`planning/design/pack/`](../design/pack/):

- **[`index.html`](../design/pack/index.html)**: a single self-contained file of about 390 KB that opens offline.
  - **Brand:** the Turbine lockup, mark and wordmark are inlined from `brand/exports/core/*-white.svg`. Only the fill is swapped to `currentColor`; the geometry is untouched and the logo was not redrawn.
  - **Motion:** the brand's own `carworx-hero-embed.html` plays in an iframe when it scrolls into view, with a replay button. The loader SVG is used for the "checking payment" state.
  - **Fonts:** Sora SemiBold is embedded (OFL). Other text uses the system font.
- **Contents**, matching PLAN §22 parts 1–5:
  1. A plain-language summary.
  2. The Turbine brand page: lockups, palette with contrast ratios, type, app icon, tone of voice, brand in use.
  3. The eight phone screen groups, with 32 state and variant panels.
  4. Desktop home and search.
  5. The Thandi wash and Pieter repair-quote journeys, each with a "What if…" box.
  6. The roadmap, decisions already made, the optional revenue order and the open owner decisions.
- **[`SUMMARY.md`](../design/pack/SUMMARY.md):** the one-page summary for the two colleagues, readable without the HTML.
- **[`exports/`](../design/pack/exports/):** 16 PNGs (each section, both desktop frames, and the home screen at 360 px and 2×) and a 34-page A4 PDF.
- **`src/`:** `pack.html` (the source), plus `build.mjs`, `export.mjs`, `qa.mjs` and `cdp.mjs`. These are local scripts that drive an installed Chrome or Edge, with no new dependencies.
- **[`QA.md`](../design/pack/QA.md):** each check marked passed, failed or UNVERIFIED, and where each PLAN §10 state appears.

## Choices worth reviewing

- **States:** "Provisional" belongs to the deferred B4 pay-later option, so it isn't drawn; "waiting for payment" stands in for it.
- **Product scope:** the journeys say they show Phase 4 behaviour, and that the first public site has discovery and enquiries only.
- **Payment partner and fines:** both are named generically ("payment partner", "national fines channel", "official"). There are no Paystack, EasyPay or other vendor marks, and the real fines URLs are marked as confirmed before launch.
- **Concept status colours:** I added ok, warn and error colours, each checked at 5.6:1 or better. They are not in `tokens.json` yet; Phase 1 design-system work decides that.
- **Mockups are HTML drawings, not images:** this keeps them sharp at any zoom. Mockup buttons are inert spans, so keyboard users don't get dozens of fake tab stops.

## Check summary (detail in QA.md)

**Passed:**
- 360, 390, 768 and 1440 px, with no overflow
- 200% zoom, emulated as a 720 px viewport
- five equal shortcuts above the 640 px fold at 360 px
- focus order, and a visible focus ring after a fix
- text contrast (806 elements) after two fixes
- reduced motion (checked headless)
- no network
- alt text

**UNVERIFIED:**
- real browser zoom
- SVG map label contrast
- 9 of the 16 PNGs not reopened after the final export
- PDF page layout, because no renderer is available
- the design-critique and accessibility-review skills, which I did not invoke

## Not done / needs the owner

- Showing the pack to the colleagues, then folding their feedback in.
- Publishing the pack anywhere public, which needs separate authority.
- Merging this branch to `main`.
- `/design-sync` to Claude Design.

## Handoff

**Baton: CODEX** for the §22 review, at the tip of `planning/design-motion-toolkit`. Please check:
- factual accuracy against PLAN 2.1;
- state and accessibility coverage, including the UNVERIFIED rows in QA.md;
- five-shortcut discoverability;
- whether the exported files are usable.

Record substantive feedback; cosmetic feedback doesn't reopen technical decisions.
