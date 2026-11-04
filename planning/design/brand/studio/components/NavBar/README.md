# NavBar

A frosted pill fixed 16px from the top: lockup left, links centred, one action right.

- Above 1060px: the links and the business action. At and below 1060px: the lockup and a 44px menu button (40px under 600px) that opens a frosted **sheet**.
- The sheet: `role="dialog"`, the button carries `aria-expanded` and `aria-controls`; focus moves into the sheet, Tab is trapped between the button and the sheet, Esc and the scrim close it and focus returns to the button.
- In the sheet the **driver** action is primary ("Find a service near you"), the business action secondary.
- The lockup is the horizontal ink export (asset group *Logos*), 116 to 128px wide: never below 96px.
