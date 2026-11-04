# HoldDial

A tactile dial for the 15-minute hold after a business accepts.

- The ring is `signal`: the one place signal orange means "counting down". The paid state switches the ring to `ok`.
- Digits in `timer` (Geist Mono), mm:ss; the label under it says what is held.
- Set `stroke-dashoffset` = 502.7 × (elapsed ÷ 900). Give the dial `role="img"` and an `aria-label` with the time in words; announce at most once a minute.
- Beside it, always say what happens if time runs out: "the slot is released. If a payment arrives afterwards, we'll help you rebook or get a refund". Never promise that nothing is charged. A payment already started can still arrive after expiry, and it then goes to reconciliation (PLAN §6.3).
- Reduced motion: update the digits, don't animate the ring.
