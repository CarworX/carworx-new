**Status:** the **Turbine** logo is locked and final (D-034). The **Studio** UI language below is the owner-approved direction for the product (D-036) and is **concept, not final** until it has been reviewed and built in code in Phase 1. Logo rules are fixed; UI rules may still change.

# Part 1 · Turbine, the logo

## The name

Always **CarworX**: capital **C**, capital **X**, with *arwor* in lowercase between them. Never "Carworx", "CARWORX" or "CarWorx".

In running text it is set in the surrounding typeface (Geist in the product). The wordmark artwork is only for logos.

## The mark

The mark is five impeller blades around an open hub: a turbo spooling up. The drawing is generated, not hand-traced, by `motion/shape.mjs`. Every file and every video frame comes from that one geometry.

**Blades**
- Each blade grows from a **logarithmic spiral**: the curve air follows through an impeller, crossing every radius at the same angle.
- The thickness follows a skewed curve: full near the root, a needle at the tip.
- The trailing edge sits on the same side as the leading edge, so each blade is a scythe rather than a leaf.
- The spiral sweeps 110° from hub (radius 21) to tip (radius 100).

**Two optical sizes**
- **Full**, for 48 px and up.
- **Small**, for 16–47 px, embroidery and stamps. Heavier blades and a bigger hub keep the gaps open at tiny sizes.

**The X is part of the rotor**
- The wordmark's X is drawn as two straight strokes, and its rising stroke leans at **38°**.
- The mark rests at the angle where one blade tip runs exactly parallel to that stroke.

## The wordmark

- Drawn from Sora SemiBold (SIL Open Font Licence) as outlined artwork, with hand-set letter spacing and a custom X.
- It looks the same everywhere, needs no font installed, and is ready to cut in vinyl.
- Never retype it. Use the files in *Logos*.

## Lockups

| Lockup | Use |
|---|---|
| Horizontal | Primary: headers, the product nav, signs, documents |
| Stacked | Square and tall spaces: posts, stories, splash screens |
| Mark only | App icon, profile picture, favicon, small spaces |
| Wordmark only | Only where the mark already appears nearby |

**Clear space** on every side equals the height of the X. **Minimum sizes:** 24 px for the mark (small version) and 96 px wide for the horizontal lockup. In the product nav the lockup is 116–128 px wide.

## Logo colour

| Pair | Contrast | Use |
|---|---|---|
| `white` on `ink` | 19.2:1 | Primary |
| `ink` on `paper` | 16.8:1 | Light; `ink` on `canvas` (17.0:1) in the product |
| `white` on `graphite` | 16.2:1 | Secondary dark |
| `black` on `white` | 21:1 | One-colour print, receipts, vinyl |

`signal` is the app's UI accent. It is **never** part of the mark. Don't stretch, rotate, recolour, add effects to or rearrange the logo (see *Usage*).

## Logo motion

The hero animation is an 8-second sequence in eight beats, all driven by one timeline (`motion/timeline.mjs`): ignition, intake, forge, spool (turbo lag, surge, braking, real motion blur), boost, the X strokes crossing, lock (a 1.8° overshoot settling on a damped spring) and a glint. The last frame equals the static logo.

- Mechanical, not bouncy. Build, hold, release. The static frame *is* the logo.
- With reduced motion switched on, show the static logo instead.
- Cut-downs: loop (8.6 s), app splash (1.6 s), loader (one blade, 72°, every 1.2 s), hover (0.6 s). Films are in *Motion*.

# Part 2 · Studio, the UI language

**Idea:** a calm, light desk where the objects of a booking float in soft depth: a sticky note, a confirmed tile, a hold timer, a written quote. Every screen says what happens next.

## Content

- **Voice:** plain, honest and calm, in South African English. Say what happens next and what it costs. Never promise what can't be checked.
- **Say:** "Request sent. Gleamline has until 11:40 to reply. You haven't paid anything." **Not:** "Booked instantly!"
- **Say:** "No wash businesses within 25 km yet. Tell us what you need and we'll let you know." **Not:** "Hundreds of providers near you."
- **Say:** "No results here doesn't mean you have no fines. Check the official channels." **Not:** "You're all clear!"
- Sentence case everywhere. "You" for the driver or business; "we" for CarworX. Buttons are verbs that say what happens ("Approve version 2 and pay").
- Money: `R2 430` (space as thousands separator, no decimals unless needed). Times: `14:32`, `Sat 31 Oct, 09:00`. Distances say "straight-line".
- No emoji. No fake urgency, no invented counts, no real logos or endorsements. Concepts and demos say "Concept, not final" and mark businesses DEMO.

## Colour

- **Ground:** every page sits on `canvas` with the 24 px `dot` grid. Cards, keys and inputs are `surface`. Frosted layers (nav, sheets, phones) use `frost` with `blur-frost`.
- **Text:** `ink` for headlines and body; `muted` for secondary text and captions (5.3:1 on `canvas`, 6.0:1 on `surface`); `quiet` only for the grey second line of a display headline at 24 px and up (3.8:1).
- **Blue** means confirmed or informational: `blue` for ticks and fills, `blue-ink` for blue text (5.3:1 on `sky`).
- **Signal** means counting down: the hold ring, live dots, the fold line. It is never small text and never the logo. `apricot` and `peach` are its soft partners in gradients and tints.
- **Status:** `ok` / `ok-bg`, `warn` / `warn-bg`, `err` / `err-bg`, each 5.6:1 or better. A status is always a word or an icon as well as a colour.
- One primary action per view, in `ink`. Never use signal or blue for a primary button.

## Type

- **Geist** (`sans`) for everything you read: `display-xl` for the one hero line, `display-lg` for section headlines (second line in `quiet`), `heading`, `title`, `lede`, `body`, `body-sm`, `label`, `caption`. Headlines are weight 500 with tight tracking; dashboard numbers use `kpi` (weight 200).
- **Geist Mono** (`mono`) for data: `eyebrow` (uppercase, tracked), `price`, references like `CX-2048` and the `timer`.
- **Caveat** (`hand`) only on sticky notes (`note`). Never for UI text.
- Nothing below 12 px. Headings `text-wrap: balance`; paragraphs `text-wrap: pretty`; keep "&" with the word before it.

## Space, shape and depth

- **8 px rhythm:** `space-2` (8) is the base step; `space-4` (16) card padding and phone gutter; `space-6` (24) desktop card padding; `space-12` (48) above a key row; `space-24` (96) between sections. `space-1` and `space-3` are for tight insides only.
- **Radii:** `radius-pill` for buttons, chips and the nav; `radius-lg` for keys and cards; `radius-md` for notes and cards inside phones; `radius-sm` for inputs; `radius-xl` for the dashboard; `radius-phone` for the phone shell.
- **One shadow scale:** `sh-1` resting, `sh-2` floating objects and primary buttons, `sh-3` lifted (hover, sheets, phones). Key-caps use `sh-key` (with a `key-side` edge). To lift something, move it up and fade the next shadow in on a layer; never animate `box-shadow`.
- **Tactile objects:** the five service objects (*Objects*), the sticky note, booking tile, hold dial and receipt. They float in the hero with a slow drift and pointer parallax, and appear in the product where they explain a state.

## Iconography

- **Glyphs:** a 24-unit line set, 1.8 stroke, round caps and joins (*Glyphs*). In code they take `currentColor` (the bundle draws them as CSS masks: `cx-ic search`). The files are in `ink`.
- **Service objects:** soft-3D, one per service, used only on the five shortcuts and their pages (*Objects*).
- **Illustrations:** hand-drawn line drawings in `ink` with one pastel fill, for empty, error, expired and paused states (*Illustrations*). Always decorative (`alt=""`), always beside words that say the same thing.
- No emoji as icons.

## Motion

- **Mechanical for the logo, springy for objects:** objects spring in and lift on hover (`cubic-bezier(.34,1.56,.64,1)`); everything else eases out (`cubic-bezier(.16,1,.3,1)`), 0.3 to 0.9 s.
- **Scroll-linked, never scroll-jacked:** scroll may move a booking along a timeline; the browser's own scroll is never taken over.
- Animate only `transform`, `opacity` and `filter`. Pause loops off screen.
- **Reduced motion:** the intro becomes the still logo, nothing drifts, hover changes shadow only, countdown digits update without animating the ring.

## Accessibility

- Text meets 4.5:1 (3:1 at 24 px and up) on the grounds its token note names; control edges, icons and the focus ring meet 3:1.
- **Focus:** a 2 px `ink` outline with a 2 px offset on every interactive element.
- Touch targets at least 44 px. Mockup buttons in decks are pictures, not controls.
- Five shortcuts: equal, in order, all visible on a 360 × 640 phone without scrolling.

# Files

All logo, motion and print files are in this system (*Logos*, *Icons*, *Social*, *Print*, *Motion*, *Guidelines*) and in the repo at `planning/design/brand/exports/`. Studio's objects, illustrations and glyphs are in *Objects*, *Illustrations* and *Glyphs*, and in the repo at `planning/design/brand/exports/studio/`. Component styles are `components/bundle.css` (class prefix `cx-`). `MANIFEST.md` in the repo lists each brand file with its sources and checksums.

**Regenerating the logo files:** in the repo, in `planning/design/brand/motion/`, run `npm install`, then `node export.mjs`, `node build-motion.mjs`, `node build-web-motion.mjs`, `node build-preview.mjs` and `node verify.mjs`. These are brand-asset scripts, not application code.
