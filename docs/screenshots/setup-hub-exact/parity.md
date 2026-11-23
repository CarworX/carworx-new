# Finish setup hub: preview (left) vs apps/web (right)

Preview: `onboarding/setup/index.html#hub` (#83 @ `b88a8ca`), hosting notice
hidden. Ours: `/provider` signed in as a synthetic owner of a live listing,
the hub section. Share of pixels that differ by more than 24/255, over the
part both have (ours adds real-screen links underneath).

| width | hub  |
| ----- | ---- |
| 1280  | 4.6% |
| 390   | 0.4% |

Intended differences:

- The business name is the real one ("Shine Studio" in the synthetic seed).
- Under the hub, links to real screens the preview's hub has no tile for:
  Opening hours, Your services and days, History · Team changes.
- The app header is still the app's own; the preview's owner bar (Today,
  Requests, Earnings, …) belongs to the dashboard port (group 1c).
- "Team sign-in security" keeps its look but its Start is inert: team
  two-step enforcement ships with O7 (on the "Sites port: not wired yet"
  list in planning/STATUS.md).
