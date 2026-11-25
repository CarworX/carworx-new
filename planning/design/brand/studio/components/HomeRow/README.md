# HomeRow

The signed-in customer home: location chip, greeting, one search, the five service keys, then horizontal rows of ListingCards and the FinesCard.

## Anatomy
1. LocationChip at the top (chevron variant).
2. Greeting: "Good morning, Thandi." with "What does your car need?" in steel below.
3. Search pill (`.cx-search` style, 60px, *Search* button inside).
4. Service row (`.cx-svcrow`): five key-caps with short labels: Wash, Repairs, Glass, Tyres, Fines (five equal columns on phones, never clipped).
5. Rows, each a `.cx-rowhead` (title, one-line reason, *See all →*) and a `.cx-rail` that scrolls sideways with snap: **Near you** (nearest first), the **FinesCard**, **Comes to you** (mobile teams), **Recently viewed** (compact cards, *Clear*).

## States
- with location: rows filled
- no location: a prompt card ("Where should we look?", *Use my location*, *Type a suburb*, "We don't save your exact location.") and dashed ghost cards (`.cx-rail .ghost`) where rows will appear; FinesCard in its "Get started" form
- a row with no results is hidden, never shown empty
- loading: ghost cards

## Tokens used
`--sh-key`, `--surface`, `--canvas`, `--blue-ink`, `--muted`, `--steel`, `--space-10`, `--line` (ghosts).

## Do / Don't
- Do let rails scroll with touch and arrow keys; 4 cards visible at desktop, about 1.3 on phones so the next one peeks.
- Don't autoplay or auto-scroll rows.
- Don't show more than four rows above the footer.

## Screens
`planning/design/redesign-2026-11/A4-customer-home/png/a4-1-home-*.png`, `a4-2-home-no-location-*.png`.
