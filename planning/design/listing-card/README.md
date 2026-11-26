# Listing card redesign: options A–D

Made by the Claude design session on 26 Nov 2026 (SAST) for the owner to choose one. **Mockups only; no app code changes.** Gallery (private artifact): https://claude.ai/artifact/ELQYfLPqJpXtMcs9XMnZVv

The owner asked for: the business photo filling the top of the card, then the area, an open status with colour markers, and the name, rating, category and trust checks, with the checks made compact. Round 2 (owner and coordinator) added the service mode, distance or "Covers your area", the top services, at most one extra chip and a ♡ save button, with a cap of about 5 signals per card.

All businesses, suburbs and ratings are synthetic. The photos are generic Unsplash stock (IDs below), not of real businesses. The open status is shown as at **Saturday 12:35 SAST**.

| Option | Idea | Why |
|---|---|---|
| A | Photo with status overlay | The status sits on the photo, so the eye lands on it first, and the photo keeps the whole top half. |
| B | Photo plus a clean info stack | Nothing covers the photo and every fact has its own line with an icon. Easiest to scan and to read with a screen reader. |
| C | Compact horizontal card | About half the height of A or B, so about twice as many businesses fit on a phone screen. Best for long result lists. |
| D | Status strip (recommended) | The name on the photo reads like a shopfront sign, and a full-width tinted strip shows at a glance whether it is open now. |

PNGs (2x, 256 colours) in [`png/`](png/): `{a,b,c,d}-desktop-1280.png` (3 per row) and `{a,b,c,d}-mobile-390.png` (three phone screens of the same list).

## Open status states

The threshold for "closing soon" is **60 minutes**. Each state has its own marker shape and its own words, so it never relies on colour alone.

| State | Marker | Copy | Text contrast (white / D strip) |
|---|---|---|---|
| Open | solid dot | `Open · closes 14:00` | 6.5 / 5.7 |
| Closing soon (≤ 60 min) | half-filled dot | `Closes in 25 min · at 13:00` | 6.3 / 5.8 |
| Closed | crossed ring | `Closed · opens today 14:00` / `tomorrow 09:00` / `Mon 08:00` | 7.5 / 6.6 |
| No hours | dashed grey ring | `Hours not listed · ask when you enquire` | 6.0 / 5.2 |

Colours are the app's `ok`, `warn`, `err` and `muted` tokens. All text passes WCAG AA (4.5:1).

## Shared rules

- **No photo:** the category tint with its CarworX service illustration and the business's initials. No emoji.
- **Verified:** a single badge showing how many checks were done. Hover or focus (desktop) or a tap (phone) lists the checks, worded exactly as today. A business with no checks shows no badge. When it is built, the badge must be a button outside the card's link: use a stretched-link card, not a badge nested inside `<a>`.
- **Mode and where:** one line with an icon (no emoji). *Visit them* (shopfront) and *Visit or comes to you* (two arrows) show the suburb and the distance, e.g. "Milnerton · 2.4 km", when the visitor's location is known. *Comes to you* (van) never shows a distance or pin (K6); it shows "✓ Covers your area" instead. In C the mode is an icon only, and its label stays for screen readers.
- **Services:** the main service plus one more as chips (one in C), then "+N". These replace the bare category line.
- **One extra chip at most**, outlined, and only when it applies: accreditation (RMI accredited), Open Saturdays or 24h call-out (worked out from the hours), a speciality (Toyota & VW), languages, or an extra such as Free collection. Four of the six example cards carry one.
- **Save:** a ♡ button on every card. Like the Verified badge, it sits outside the card link.

## Data gaps for the build

1. **Hours in results:** `listing_hours` is read one listing at a time (`api.listing_hours`). The search, category and home projections need to return the hours in the same query.
2. **Open-status helper:** a pure, unit-tested function that takes the hours and the time in Africa/Johannesburg. It returns the state, the closing time, the minutes left and the next opening (today, tomorrow or a weekday).
3. **Suburb:** listings have only the free-text `metro` and the full `public_address`. We need a public `suburb`/locality field, asked at onboarding and editable later.
4. **Public holidays and one-off closures:** not stored. Until they are, a public holiday shows the normal hours.
5. **Services, mode and coverage in results:** `listing_services` (up to 8, position 0 = main) and `mode` exist, but the result rows need the services list. `distance_km` already comes back for fixed premises; "Covers your area" needs the coverage match exposed as a yes/no on each row.
6. **New data for the extra chip:** accreditations (RMI, MIWA, SAMBRA; ideally checked by CarworX before they show), vehicle specialities, languages spoken and extras such as free collection. None of these exist yet; each needs fields in onboarding and the listing editor. "Open Saturdays" and "24h call-out" need no new data.
7. **Saved businesses:** there is no saved-listings table yet. The ♡ needs one (signed-in only) and a "Saved" list.
8. **Photo:** already covered by `cover_key` (D-098). An optional crop focal point could come later.

## Rebuild

```
python3 planning/design/listing-card/_src/build.py <photo-dir> <out>/gallery.html
node planning/design/listing-card/_src/shoot.cjs <out>/gallery.html planning/design/listing-card/png
```

`<photo-dir>` holds `p1.jpg`–`p5.jpg`, downloaded from `https://images.unsplash.com/photo-<id>?w=720&h=450&fit=crop`. The IDs, in order: `1596986952526-3be237187071`, `1578844251758-2f71da64c96f`, `1520340356584-f9917d1eea6f`, `1615906655593-ad0386982a0f`, `1530046339160-ce3e530c7d2f`. After shooting, quantise the PNGs to 256 colours.
