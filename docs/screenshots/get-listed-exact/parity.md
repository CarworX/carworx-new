# Business application: preview (left) vs apps/web (right)

Each image shows the preview (`onboarding/phase1`, #83 @ `b88a8ca`) next to
`/provider/get-listed/:step`, both filled with the same answers. The figures
are the share of pixels that differ by more than 24/255, for the visible
screen at that scroll position.

| width | step      | top   | bottom | listing preview open |
| ----- | --------- | ----- | ------ | -------------------- |
| 1280  | business  | 6.3%  | 6.3%   |                      |
| 1280  | service   | 0.4%  | 0.3%   |                      |
| 1280  | location  | 0.8%  | 2.6%   |                      |
| 1280  | about     | 0.5%  | 0.5%   |                      |
| 1280  | check     | 1.0%  | 2.4%   |                      |
| 1280  | submitted | 4.0%  | 6.7%   |                      |
| 390   | business  | 11.4% | 19.0%  | 4.0%                 |
| 390   | service   | 0.0%  | 0.0%   | 0.0%                 |
| 390   | location  | 1.9%  | 7.9%   | 0.9%                 |
| 390   | about     | 0.2%  | 0.3%   | 0.0%                 |
| 390   | check     | 1.9%  | 6.6%   | 1.0%                 |
| 390   | submitted | 4.9%  | 10.6%  |                      |

Intended differences:

- **Business:** "List a new business" is the only path in this flow, so it is
  chosen and the name field shows at once. The preview hides the field until
  you choose.
- **Location:** the map is a real Mapbox image behind "Open the map", not the
  preview's drawn map, in a 16:9 box so a tap maps to the image exactly. The
  public premises address and the 5–100 km range are real requirements.
- **Check:** mobile businesses also confirm the location notice.
- **Submitted:** the preview's fourth step ("accept a booking request") is left
  out; bookings are on `phase-3`.

The page has no menu sheet: like the preview, the application uses a focused
bar with "Save and exit".
