# CarworX brand: Turbine

**Status: logo locked by the owner on 2026-10-27 (D-034).** The rest of the brand (UI palette, type scale, imagery, tone of voice, app icon) is still being refined in Claude Design. Treat everything here except the mark as **concept, not final**.

The eight other logo concepts from rounds 1 and 2 were removed on the owner's instruction. They remain in git history only as this note.

## The name

- Always **CarworX**: capital **C**, capital **X**, lowercase *arwor* in between. Never "Carworx", "CARWORX" or "CarWorx".

## The mark

Five curved impeller blades around a hub: a turbo spooling up.

| File | What it is |
|---|---|
| [`assets/Logos/carworx-turbine-mark.svg`](assets/Logos/carworx-turbine-mark.svg) | The symbol alone, transparent background, single colour `ink` #0d0f12. On a dark ground, recolour to white or `paper`. |
| [`assets/Logos/carworx-turbine-lockup.svg`](assets/Logos/carworx-turbine-lockup.svg) | Mark and wordmark on `ink` with drifting `steel` light and grain, 1200 × 630 (share-card size). |
| [`assets/Logos/carworx-turbine-animated.svg`](assets/Logos/carworx-turbine-animated.svg) | The lockup with motion. Plays when opened in a browser. |
| [`videos/carworx-turbine.mp4`](videos/carworx-turbine.mp4) | A rendered loop of the animated lockup. |
| [`tokens.json`](tokens.json) | Colour, type, spacing and radius tokens, trimmed to this direction. |

The wordmark is live text in Sora 600 (Google Fonts), not outlines. Convert it to outlines before sending files to print.

## Motion

- **Build:** the blades grow out from the hub, the rotor turns 144° and locks, and the wordmark sharpens from a blur.
- **Hold, release:** a 6 s loop, about a quarter building and most of it holding the finished logo, with a short exit.
- **Mechanical, not bouncy:** `cubic-bezier(.65,0,.25,1)` for the rotor, with slight overshoot only on the blades.
- **The static frame is the logo.** With *reduce motion* switched on, the logo shows complete and still.

## Colour

`ink` and `paper` grounds carry most of the work, with white blades and wordmark on ink. `signal` orange is kept as the UI accent for the app; it is not part of the mark. Accent colours never set small text.

## Clear space and sizing

- Clear space around any lockup equals the height of the X.
- Minimum size: 24 px tall for the mark alone, 96 px wide for a mark-and-wordmark lockup.

## Still to do (in Claude Design)

App icon and favicon from the mark, UI palette and type scale for the app, imagery and tone of voice. These feed the §22 presentation pack.
