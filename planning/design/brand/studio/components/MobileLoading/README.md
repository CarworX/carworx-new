# MobileLoading

How the D-041 loaders appear on a phone, one kind of wait per screen, at 360 px.

| Scenario on a phone | Loader | What the words say |
|---|---|---|
| The app opens, or a page changes | Dot-grid ripple (PageLoader), full screen under the status bar | "Loading" and where you are going ("Opening your bookings…") |
| A multi-step wait you watch: search, availability, quotes | Hold dial ring in `blue`, with the rolling status line and step bars | One honest line per step ("Checking who's open Saturday…") |
| The layout is known: results, a listing, your bookings | Skeleton cards with one soft shimmer across the screen | "Loading results near Ferndale…" |
| A tap starts a short wait: starting payment on a held booking | The hold dial's spinning arc in the ink button | The button label ("Starting payment") and a line under it |

- The signal ring on the held booking is the **HoldDial countdown**, not a loader. Loading is never `signal`. Beside it, always say: "If time runs out, the slot is released. If a payment arrives afterwards, we'll help you rebook or get a refund."
- Every animation has visible words next to it. Status lines are `role="status"` (the rolling line is `aria-live="polite"`); the loading region is `aria-busy="true"`; canvases and dials are `aria-hidden`, and the countdown dial is `role="img"` with the time in words, updated at most once a minute.
- No flashing: the blade pulse changes once per 1.2 s index, the shimmer is one soft sweep, and the arc turns once a second.
- Control edges use `control-edge` (D-066). Phone screens are off-white, where `control-edge` is just under 3:1, so put chips and outline buttons on a `surface` panel.
- Reduced motion (the stills row): the ripple paints one frozen wave and the rotor rests as the solid ink logo; the dial holds its step while the line still updates; skeletons lose the shimmer; the arc stops; countdown digits update but the ring does not animate.
- The phones use the PhoneFrame shell. The shell's 11 px status-bar label is set to 12 px here, to keep to the 12 px minimum.
- Concept, not final. Businesses are DEMO.
