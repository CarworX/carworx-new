# Maps, geocoding and seeding provider listings

Researched by Claude, 2026-10-27.

## Geocoding without breaking Mapbox's licence

Mapbox's *temporary* geocoding results can't be stored ([pricing page](https://www.mapbox.com/pricing)). Provider locations must be stored. Options:

1. **The provider drops a pin on a Mapbox map during onboarding,** and we store the coordinates they chose. No geocoding results are stored, so the licence issue doesn't arise, and pins are often more accurate than geocoded addresses for informal or township businesses. **Claude's preference.**
2. **Permanent geocoding** at $5 per 1,000. Trivial cost at our volume (1,000 providers ≈ $5), but it isn't free.
3. **OpenStreetMap Nominatim:** free, results can be stored with attribution, but the public server has strict usage limits (about 1 request per second, no bulk use).

Customer search ("near me", or typing a suburb) can use temporary geocoding and the browser's location, because we don't store those results.

## Nearby search

Use **PostGIS** in Supabase (`geography` type, `ST_DWithin`, a GiST index) for "providers within X km". It's free, fast, and keeps search independent of Mapbox.

## Seeding listings (the marketplace cold-start problem)

A marketplace with no providers is useless to customers, and one with no customers is useless to providers. Seeding listings that aren't bookable yet helps break the deadlock.

- **OpenStreetMap** has tags for `amenity=car_wash`, `shop=car_repair`, `shop=tyres`, `craft=car_repair` and others. The data is ODbL-licensed, so it can be stored and shown with attribution, and pulled free through the Overpass API. Coverage in South Africa varies: good in metros, thin in townships (**UNVERIFIED** count; Codex or Claude to run an Overpass query for the launch city).
- **Google Places:** better coverage, but its terms forbid storing or caching most content long-term and forbid showing it on non-Google maps. **Not usable** as a seed for a Mapbox-based product.
- **Model:** seeded listings are shown as **"unclaimed"**. Customers can request a quote or call, and the business can claim the listing, complete onboarding (bank details → Paystack subaccount) and become bookable.

## Map quality in South Africa

Mapbox's base map draws on OpenStreetMap plus its own data. Road coverage in South African metros is good. Business points of interest are weaker than Google's, which doesn't matter because our points of interest come from our own database.
