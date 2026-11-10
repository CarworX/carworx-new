# Claude — 20: P2-3 public pages with Mapbox

**Date:** 2026-11-10 (SAST). **Author:** Claude, under D-080. **Status:** built and in review. Codex reviews later.
**Decisions:** D-082 (Mapbox before launch, with a $0 guard) and D-083 (categories follow the design's service keys).

## Pages (server-rendered; usable without JavaScript)

| Route | What it shows | Notes |
|---|---|---|
| `/` | Hero, search form (area **or** "Use my location"), the five service keys | "Use my location" is a JavaScript-only enhancement, rounded to 0.01° on the device |
| `/search` | Geocode the area → if ambiguous, "Which … did you mean?" links → both groups (workshops by straight-line distance, then mobile "comes to you, approximate"), radius links 5/10/25/50, "more" links that carry signed cursors | `private, no-store`; links carry only rounded coordinates and the chosen label, never re-geocoding |
| `/c/:category` | Live listings in a design category, including its subcategories, paged by public ID | Reads `listing_public` with the anon key; 404 for unknown categories |
| `/p/:publicId` | Listing detail: labels, description, and the address only for fixed premises | Mobile shows "serves an area … approximate"; pending listings are 404 |
| `/fines` | Placeholder note (P2-6 brings guidance and official referrals) | No ID field |
| `/search/map?m=` | A server-fetched Static Images PNG of the signed fixed-premise pins, after the visitor limit and the daily map quota (D-084) | 503 if the token, key, binding or quota is missing; 404 for a bad signature |

**Caching:** every public page is `no-store` today, because the T5 boundary issues a CSRF cookie on each page. That's the safer default, and it can be revisited before launch.

## Search changes

The new migration `20261110190000_p2_3_category_search.sql` makes search category-aware:
- **Wrapper:** `api.search_listings` gains `p_category`, which resolves to the services of the category and its subcategories. Service and category together is rejected.
- **Helper:** the eligibility helper now takes `p_services text[]`. It still applies the filter, the cursor and the order before `LIMIT`.
- **Unchanged:** owners, grants and bounds.

## Mapbox (D-082)

- **Geocoding:** server-only, temporary, v6 forward. Bounded area text, ZA only, at most five candidates. Never stored or logged.
- **Map (D-084):** a "Show workshops on a map" link reloads the results with `map=1` and a same-origin image. No JavaScript, no browser token, fixed pins only.
- **Quotas:** global daily caps of 3,000 geocodes and 1,500 map loads, through the existing SQLite Durable Object, failing closed. The visitor's IP and session limits run **before** any Mapbox call.
- **Why the guard:** Mapbox documents no spending cap, and overages bill automatically.

## Evidence

| Kind | Result |
|---|---|
| pgTAP | 412 assertions (43_search now 53) |
| Unit | 192, including geocode parsing and fail-closed paths, the page model, ambiguity, "more" links without re-geocoding, and the rate limit before Mapbox |
| Integration | 70, including the taxonomy matching the database, pages without JavaScript, category subcategories, mobile privacy, no-store, and fail-closed area search and map session |
| Screenshots | Phone width (390 px) for home, search, category and listing |

## Your prerequisites (hosted; none needed for CI)

1. Mapbox: one server token as the Worker secret `MAPBOX_SERVER_TOKEN` (geocoding and `styles:tiles` scopes). No public token is needed (D-084).
2. Usage notifications below the free tier.
3. The P2-2 Hyperdrive and secrets (Claude 19 §9).

## Open

- A15 Lighthouse on `/c/*`, `/p/*` and `/search` needs a database, so it's staging evidence. `/` is measured in CI.
- A16 manual keyboard and screen-reader pass (D-060).
- Enquiries (P2-5), applications (P2-4) and fines guidance (P2-6).

Agent: claude
