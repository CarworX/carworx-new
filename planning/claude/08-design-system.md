# Claude — 08: Studio design system

Date: 2026-11-02. Branch: `planning/design-motion-toolkit`. Carries out D-040: the Studio UI language (D-036) built as a Design System project in Claude, then mirrored into `design/brand/` as the source of truth for Phase 1.

**Status: DELIVERED FOR REVIEW.** Planning artefact only; no application code.

## What was built

- **Design system in Claude:** the existing **CarworX** Design System project (private, owner's account) now holds Turbine and Studio together. The Turbine cards and assets are unchanged.
- **Tokens (v4, `design/brand/tokens.json`):** 33 colours (Studio roles plus the Turbine brand pairs and status colours, each with a usage note naming its grounds and contrast), Geist, Geist Mono and Caveat with 14 type styles, 10 spacing steps on an 8 px rhythm, 8 radii, one five-step shadow scale and two blur values.
- **15 components** with guidelines and live previews, styled by one stylesheet (`studio/components/bundle.css`, prefix `cx-`):
  - Actions: Button
  - Services: ServiceKey (desktop key-caps and phone key rows)
  - Forms: Chip (chips, labels, slots, actor chips), Field
  - Feedback: StatusNote, EmptyState
  - Booking: StickyNote, BookingTile, HoldDial, ReceiptQuote, ResultCard, StepList
  - Navigation: NavBar (with the menu sheet), PhoneFrame
  - Business: KpiCard
- **Assets:** 5 service objects, 10 state illustrations and 25 UI glyphs (in `design/brand/exports/studio/` and as asset groups Objects, Illustrations and Glyphs); the three font files with their licences.
- **Brand book** (`design/brand/studio/README.md`): Turbine rules plus Studio content, colour, type, space and depth, iconography, motion and accessibility rules, naming the tokens.
- **Cover:** new, built from the Studio tokens around the real lockup (the name is not retyped).

## Checks

- **Rendered:** all 16 previews (15 components and the cover) in local headless Chrome against the same tokens.css and bundle.css, with asset ids mapped to the repo files. Two fixes followed: box sizing inside the preview frame, and the glyphs embedded as data URIs so icons render anywhere.
- **Contrast:** every text token's note states its grounds; all named text pairs are 4.5:1 or better, except `quiet` (3.8:1), which is restricted to text 24 px and up.
- **UNVERIFIED:**
  - the live design-system page in a browser (it needs the owner's claude.ai sign-in)
  - its generated `api/` cards: they still list the eight removed logo concepts until someone saves an edit on the page, which regenerates them
  - a dark theme: Studio is light only, and none is designed

## Needs the owner

- Open the design system in Claude and say whether it matches the approved Studio direction.
- Switch the active GitHub login back to the account with CarworX access (`gh auth switch --user Gerrard-Lewu`) so the branch can be pushed.

## Handoff

**Baton: CODEX.** Please review together:
- the rebuilt §22 pack ([Claude 07](07-pack-studio.md))
- this design system (the `design/brand/` mirror)
- D-037 to D-040

After approval, the owner merges `planning/design-motion-toolkit` to `main`, and Phase 1 starts local-only (D-038).
