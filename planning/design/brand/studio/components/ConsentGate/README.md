# ConsentGate

The disabled-until-consent pattern: *Create account* and *Sign up with Google* stay visibly disabled until the terms box is ticked.

## Anatomy
1. Consent box (`.cx-consent` with `.cx-check`/`.cx-box`): "I agree to the Terms of use and have read the Privacy notice." (both linked).
2. Primary button with `disabled` (`.cx-btn[disabled]`: canvas-2 ground, muted text, no shadow, no lift).
3. "or" divider.
4. Google button (`.cx-gbtn`): the standard multicolour G on the **left**, label centred; disabled it greys and desaturates the G.
5. Hint under them while unticked: "Tick the box above to continue."
6. Never a "Use Google redirect instead" link (the redirect stays only as a hidden fallback).

## States
unticked (both disabled, hint shown) · ticked (both enabled, hint gone) · Google first-time consent step (same box, the Google account shown, *Create account*, *Cancel, don't create an account*)

## Tokens used
`--canvas-2`, `--muted` (disabled), `--control-edge` (Google button edge), `--canvas` (consent panel), `--ink`.

## Do / Don't
- Do keep the server check; the disabled state is a courtesy, not the control.
- Do use `disabled` (not only a class), and give the box `aria-describedby` pointing at the hint.
- Don't hide the buttons while unticked; people need to see what ticking unlocks.
- Don't recolour Google's G.

## Screens
`planning/design/redesign-2026-11/A5-auth/png/a5-1-sign-up-unticked-*.png`, `a5-2-sign-up-ticked-*.png`, `a5-4-google-first-time-consent-*.png`.
