# FinesCard

A peach-lit card that surfaces fines between home rows: count and total, the nearest deadline, and one action.

## Anatomy
Fines object (72px), title ("3 fines on your ID · R 2 250"), one line ("One has a discount until 2 December. Checked today, 08:15 SAST."), primary *See my fines →*.

## States
- has fines: as above
- not verified yet: "Check your traffic fines" / "Confirm your ID once, then see and pay fines here." / secondary *Get started*
- verification in review: "We're checking your ID" / *See status*
- no fines: hidden on home (shown only on My fines)

## Tokens used
`--peach` (the light), `--surface`, `--hair`, `--sh-2`, `--radius-xl`, `--muted`.

## Do / Don't
- Do give one deadline, the nearest; never a list here.
- Do write amounts as "R 2 250" (space before the number, thin grouping).
- Don't use red or alarm wording; it informs, it doesn't scare.

## Screens
`planning/design/redesign-2026-11/A4-customer-home/png/a4-1-home-1280.png`, `a4-2-home-no-location-1280.png`; the landing version is `A2-landing/png/a2-2-fines-section-signed-in-1280.png`.
