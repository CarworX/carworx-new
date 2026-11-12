# Segmented progress bar (proposal for the design system)

**Status:** for owner approval, 2026-11-12 (SAST). Live in the stepper, live-preview and checklist concepts (`_shared/kit.css` `.ob-segbar`, `_shared/kit.js` `segbar()`).

## Look

| Part | Value |
|---|---|
| Segment | 6 px tall, pill radius, 6 px gap, equal width; one per step |
| Track (upcoming) | `canvas-2` |
| Fill (done and current) | `ink` |
| Step name (left) | Geist 500, 15/20, `ink` |
| Count (right) | Geist Mono 500, 13/20, `muted`, "3 of 6" |

## Motion

| Move | What happens |
|---|---|
| Next | The new segment **fills left to right**: 420 ms, `cubic-bezier(.65,0,.35,1)` |
| Back | The segment you left **drains right to left**, same timing |
| Jump of several steps (Change on review, or back to step 1) | The segments chain in order, each starting about 230 ms after the one before it; a long jump is capped at about 640 ms of delay in total |
| Step name and count | Slide in 10 px (up going forward, down going back) and fade in over 360 ms |
| First render, or a branch changes the step count (new ⇄ claim) | No animation; it draws in place |
| `prefers-reduced-motion` | No glide; segments switch instantly |

The fill is clipped with `clip-path: inset(… round 999px)` instead of `scaleX`, so the leading edge stays round while it moves.

## Accessibility

`role="progressbar"` with `aria-valuenow`, `aria-valuemax` and `aria-valuetext` ("Step 3 of 6: Location"). The visible name and count are `aria-hidden`, so screen readers hear them once. Ink on `canvas-2` is a UI pair (non-text). The muted count on canvas is an existing text pair in `contrast-pairs.ts`.

## Evidence

- `glide-frames.png`: paused frames at fixed times (Next, Back, a 4-step Change jump, a checklist task).
- `glide-stepper.mp4` (full phone screen) and `glide-stepper.gif` (top of screen): a real-time run through the stepper.
- `phone-*.png` and `desktop-*.png`: the bar in place in the stepper (new and claim), live preview and checklist.

## Open for the owner

On desktop the stepper shows the bar **and** the step rail. Keep both, or keep only the bar?
