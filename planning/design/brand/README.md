# CarworX brand: Turbine

**Status:** the owner locked the Turbine logo on 2026-10-27 (D-034). This is the refined, final drawing of that logo. The app UI language is **Studio** (D-036), still **concept, not final** until Codex has reviewed it and Phase 1 builds it in code.

**Design system:** the Studio tokens, type, components and guidelines live in the CarworX Design System project in Claude (D-040) and are mirrored here as the source of truth for Phase 1:
- [`tokens.json`](tokens.json) (v4: Turbine brand colours plus Studio roles, type, spacing, radii, shadows) and [`design-system.json`](design-system.json) (the system's index, with asset ids).
- [`studio/`](studio/): the brand book ([`studio/README.md`](studio/README.md)), compiled `tokens.css`, the component stylesheet `components/bundle.css` (class prefix `cx-`) and one folder per component with its guidelines and preview. The previews load assets by their design-system ids (`/_blob/…`), so they render inside the design system, not from disk.
- [`exports/studio/`](exports/studio/): the service objects, state illustrations, UI glyphs and the Geist, Geist Mono and Caveat fonts (SIL OFL, licences beside them).

**What the mirror does not hold (Claude 09 F7, recorded 2026-11-04):**
- **Seven live-only cards.** The live design system also has seven Turbine-era cards: AppIcons, Lockups, LogoTurbine, MotionCuts, PrintVehicle, Social and Usage. Their previews and READMEs are not mirrored in `studio/components/`. Every asset they show is here, in [`exports/`](exports/). For those cards the live system is the only copy of the layout; the files in `exports/` and [`MANIFEST.md`](MANIFEST.md) remain the source of truth for the assets.
- **Font paths.** `studio/tokens.css` loads the fonts from `fonts/…` beside itself, which resolves inside the design system. In the repo the fonts are in [`exports/studio/fonts/`](exports/studio/fonts/), so a preview opened straight from disk falls back to a system font. The audit's mirror tool (`claude/audit-10/_tools/mirror.mjs`) re-declares the three faces from `exports/studio/fonts/`. Phase 1 (T4) bundles the fonts with the app and does not use this path.

## The name

Always **CarworX**: capital **C**, capital **X**, with *arwor* in lowercase between them. Never "Carworx", "CARWORX" or "CarWorx".

In running text it is set in the surrounding typeface. The wordmark artwork is only for logos.

## The mark

The mark is five impeller blades around an open hub: a turbo spooling up. The drawing is generated, not hand-traced, by [`motion/shape.mjs`](motion/shape.mjs). Every file and every video frame comes from that one geometry.

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
- Never retype it.

## Lockups

| Lockup | Use |
|---|---|
| Horizontal | Primary: headers, signs, documents |
| Stacked | Square and tall spaces: posts, stories, splash screens |
| Mark only | App icon, profile picture, favicon, small spaces |
| Wordmark only | Only where the mark already appears nearby |

**Clear space** on every side equals the height of the X. **Minimum sizes:** 24 px for the mark (small version) and 96 px wide for the horizontal lockup.

## Colour

| Pair | Contrast | Use |
|---|---|---|
| White on `ink` #0d0f12 | 19.2:1 | Primary |
| `ink` on `paper` #f4efe6 | 16.8:1 | Light |
| White on `graphite` #1c2128 | 16.2:1 | Secondary dark |
| Black on white | 21:1 | One-colour print, receipts, vinyl |

`signal` orange #ff3b0a is the app's UI accent. It is **never** part of the mark.

## Motion

The hero animation is an 8-second sequence in eight beats, all driven by one timeline ([`motion/timeline.mjs`](motion/timeline.mjs)):

1. **Ignition:** a point of light at the hub, and a hairline housing ring draws around it.
2. **Intake:** five airflow lines spiral inward, along the blades' own curves.
3. **Forge:** each line thickens into its blade.
4. **Spool:** the rotor spools up through 4 turns: turbo lag, then surge, then braking. The motion blur is real, averaged from up to 16 sub-frames per frame. Meanwhile the camera glides the rotor from the centre of the frame into its seat in the lockup.
5. **Boost:** a pressure ring leaves the rotor and uncovers the letters as it passes.
6. **X:** the two strokes of the X slide in along their own axes, cross, and seat with a flash.
7. **Lock:** the rotor overshoots by 1.8° and settles on a damped spring. The last frame matches the static logo exactly.
8. **Glint:** a band of halation sweeps across the logo, then it holds.

**The light behind the logo moves for the whole film and is driven by the rotor:**
- **Key light:** a tight steel glow laps the frame on a wide ellipse, once per cut, so the loop closes exactly. While the rotor spools, the lap speeds up, as if the turbo drags it. In the hold it keeps cruising at about 60–170 px/s at 1080p, never stopping.
- **Counter light:** a larger, dimmer glow laps the other way, on the opposite side.
- **Level:** both lights come up from dark with the ignition, brightens with rotor speed and flashes at the boost. A soft beam crosses the background with the glint.
- **Stills and posters** use the moment at 7.0 s. The email GIF holds the light there too, to stay small.

**Rules**
- Mechanical, not bouncy.
- Build, hold, release.
- The static frame *is* the logo.
- With reduced motion switched on, the static logo is shown instead.

**Cut-downs**

| Cut | Length | What it is |
|---|---|---|
| Loop | 8.6 s | Adds a wind-down exit; no visible seam |
| App splash | 1.6 s | A compressed version of the hero |
| Loader | 1.2 s per step | Indexes one blade (72°) at a time, like a ratchet |
| Hover | 0.6 s | Indexes one blade |

## Files

All files are in [`exports/`](exports/), grouped by where they are used:

| Folder | Contents |
|---|---|
| `core/` | Marks, lockups and wordmarks in ink, white and black |
| `web-app/` | Favicons, iOS, PWA and Android icons, manifest |
| `social/` | Share card, headers, banners, posts, story, profile pictures |
| `business/` | Email signature, letterhead, business card, invoice header, 1-bit receipt logo |
| `vehicle/` | Door decals, windscreen sticker, workshop sign, service-bay banner, stamp |
| `motion/` | Hero films (16:9, 1:1, 9:16), loop, transparent WebM, splash, email GIF, loader, web snippets |
| `guidelines/` | One-page usage sheet |

[`MANIFEST.md`](MANIFEST.md) lists each file with its sources, tool versions, checks and checksums.

**Regenerating everything:** in `motion/`, run `npm install`, then `node export.mjs`, `node build-motion.mjs`, `node build-web-motion.mjs`, `node build-preview.mjs` and `node verify.mjs`. Open `motion/preview.html` to scrub through the animation.

These are brand-asset scripts, not application code.
