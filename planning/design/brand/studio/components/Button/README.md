# Button

Pill buttons: one ink **primary** action per screen, white **secondary** and **outline** buttons for everything else.

**Use**
- One `primary` per view, for the step that moves the booking forward ("Request a time", "Approve version 2 and pay", "Pay R330 securely").
- `secondary` (white, sh-1) beside a primary on canvas; `outline` inside cards and phones, and for "Decline", "Not now", "Ask a question".
- Add `arrow` (a disc holding the arrow icon) only to links that go somewhere: "Find a service near you".
- `cx-link` is the quiet text link ("List your business free").
- `sm` (40px) inside dense cards; default 52px; `block` fills its row in phones (48px min there).

**States:** hover lifts 2px and fades sh-3 in; pressed drops 1px; focus is the 2px ink ring with a 2px offset; disabled is canvas-2 with muted text and no lift.

**Consumer provides:** the label (a verb that says what happens), the href or handler, and the icon if any. Never put prices in secondary buttons.

**Don't:** use signal orange as a button colour; put two primaries side by side; animate the shadow itself.

```html
<a class="cx-btn primary arrow" href="/search">Find a service near you<span class="arr"><span class="cx-ic arrow sm"></span></span></a>
```
