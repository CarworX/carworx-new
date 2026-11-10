# Claude — 19: P2-2 search plan

**Date:** 2026-11-10 (SAST). **Author:** Claude, under D-079 and D-080.
**Base:** Codex hardening head `0a6c3a6d00ecc9abffd7feb6ad0ce602b9ef0311` (#48), plus the Claude lint fix #49 at `f249cc0`.
**Status:** PLAN, approved by the owner in chat on 2026-11-10. Codex reviews it later (D-079).

## 1. Scope

P2-2 delivers the server search endpoint for A8, A9, A10, A11 and A17. It doesn't include:
- public pages (that's P2-3);
- maps (D-075);
- hosted configuration or deployment.

## 2. HTTP contract

The endpoint is `GET /api/search`, a React Router resource route.

| Parameter | Rule | Error |
|---|---|---|
| `lat`, `lng` | Finite decimals inside the South Africa bounding box (lat −35..−22, lng 16..33) | `400 invalid_query` |
| `service` | Optional; `^[a-z][a-z0-9-]{0,79}$` | `400 invalid_query` |
| `radius` | One of `5, 10, 25, 50`; default `25` | `400 invalid_query` |
| `limit` | `1..20`; default `20` | `400 invalid_query` |
| `fixed_cursor`, `mobile_cursor` | Optional signed cursors (§4) | `400 invalid_cursor` |

The response is `200`, `Cache-Control: private, no-store`, with this body:
`{"fixed":{"items":[…],"next":…},"mobile":{"items":[…],"next":…},"radius_km":25,"widened":false}`

- **Fixed items** carry `public_id, display_name, description, metro, service_slug, service_name, category_slug, category_name, public_address, public_latitude, public_longitude, verification_labels, distance_km`. The distance is a 0.1 km bucket, labelled straight-line.
- **Mobile items** carry the same fields without address, coordinates or distance.
- **Unknown parameters** are rejected (`400`).
- **Searches never widen silently.**
- **There is no exact-address eligibility endpoint.**
- Any other database or limiter failure returns `503 search_unavailable`, with a generic body and no detail.

## 3. Rounding and ordering (A8, A9)

**Fixed premises:**
- The query point is rounded to 0.001°.
- Distance is great-circle (haversine) to the public pin.
- Results are filtered by `distance ≤ radius` and ordered by `(distance_bucket, public_id)`, where `distance_bucket = floor(distance_km × 10)`.

**Mobile:**
- The query point is rounded to a 0.01° grid (about 1.1 km) on the server.
- A listing is included when the rounded point is within `radius_km` of its private centre.
- Results are ordered by `public_id` only, with no distance.
- The results are labelled approximate, because rounding can give boundary false positives and negatives (documented; tested with points either side of the boundary).

**Display:** the fixed group comes first, then the mobile group. The two are never interleaved, and each has its own "more" control.

## 4. Cursors

- **Format:** `base64url(JSON payload).base64url(HMAC-SHA256)`, keyed by the Worker secret `SEARCH_CURSOR_KEY` (at least 32 bytes).
- **Payload:** `{v:1, g:"fixed"|"mobile", q:<hash of normalised lat,lng,service,radius>, after:{b,id}|{id}, exp:<unix s>}`.
- **Expiry:** 15 minutes.
- **Validation:** verified in constant time, then the group, query hash, expiry and shape are checked.
- **Failures:** a tampered, expired, swapped (wrong group or query) or malformed cursor returns `400 invalid_cursor`.
- **Privacy:** cursors contain only public IDs, buckets and a query hash. No coordinates are put in a cursor in readable form.

## 5. Database boundary (A10, A11)

One migration, with pgTAP tests.

**`private.mobile_eligible_ids(p_lat double precision, p_lng double precision, p_after uuid, p_limit integer) returns setof uuid`**
- `SECURITY DEFINER`, owned by `listing_eligibility`, `search_path = ''`, `STABLE`.
- Reads `public.service_areas(listing_public_id, centre_latitude, centre_longitude, radius_km)` joined to live mobile `public.listings(public_id)`. These are the P2-1 columns that role was granted.
- Applies `public_id > p_after` (when given), then `ORDER BY public_id`, then `LIMIT least(p_limit, 21)`.
- Returns only UUIDs. It doesn't round the point itself; the wrapper passes a point that is already rounded.

**`api.search_listings(p_lat, p_lng, p_service text, p_radius integer, p_group text, p_after_bucket integer, p_after_id uuid, p_limit integer)`**
- `SECURITY DEFINER`, owned by `listing_projection`, `search_path = ''`, `STABLE`.
- Validates every input again and raises `22023` on violation.
- **`fixed` group:** reads `public.listing_public` fixed rows, with the radius filter and keyset `(bucket, public_id) > (after)`, ordered and limited to `p_limit + 1`.
- **`mobile` group:** rounds the point to 0.01°, calls the helper with `p_limit + 1`, and joins to `listing_public` with the order preserved.
- Returns only projection columns, plus `distance_bucket` for fixed rows.

**Grants:**
- `EXECUTE` on the helper goes to `listing_projection` only.
- `USAGE` on `api` and `EXECUTE` on the wrapper go to `catalogue_server` only.
- `public`, `anon`, `authenticated` and `service_role` get nothing on either schema.
- `listing_projection` needs `USAGE` on `private` for the helper call.
- `api` isn't added to `[api].schemas`, so PostgREST never exposes it.

**`catalogue_server`** becomes `LOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOBYPASSRLS`, connection-limited, and has **no password in Git**. Private test tooling sets a synthetic password locally. You set the hosted password, with `VALID UNTIL`.

**Search cost:** with a seed of fewer than 1,000 rows, a sequential scan is acceptable. A bounding-box prefilter can be added later.

## 6. Scoped server credential (D-081)

- The Worker uses a **Hyperdrive** binding `CATALOGUE_DB` and connects as `catalogue_server` with `pg` 8.23.1. That's the driver Hyperdrive recommends; Hyperdrive needs ≥ 8.16.3.
- The Worker's compatibility date (2026-11-01) is after 2026-08-04, so Node compatibility is on by default.
- **Why this path:**
  - no JWT signing secret and no `service_role` in the app;
  - the database role can only execute the wrapper;
  - Hyperdrive holds the credential, and the Worker code never sees a static password;
  - you rotate it by changing the role password and the Hyperdrive config.
- **Expiry:** the hosted role uses `VALID UNTIL`. An expired or wrong credential returns `503 search_unavailable` and the fixed log label `search-db-unavailable`.
- **Hyperdrive query caching should be disabled for this config,** so a suspension takes effect immediately. That's your hosted setting, recorded for the owner guide.
- **Local and CI:** the integration harness passes a binding double `{ connectionString }` pointing at the local stack as `catalogue_server`, with a synthetic password set by the test setup.
- **Deviation from Codex 22:** Codex asked for "genuine local PostgREST requests". This plan uses direct, scoped Postgres instead, because PostgREST would need a role JWT and therefore a signing secret. Codex should review this choice.

## 7. Rate limiter (A11, D-081)

**Choice:**
- a SQLite-backed Durable Object class `SearchLimiter` in the web Worker, through the binding `SEARCH_LIMITER`;
- not the Rate Limiting binding, whose free-plan pricing isn't documented;
- a Durable Object, because it's documented as available on Workers Free, where the free limits fail instead of billing.

**Checks** (two independent fixed windows, both must pass):

| Key | Built from | Limit |
|---|---|---|
| IP | `HMAC(SEARCH_LIMITER_SALT, CF-Connecting-IP)` | 30 per 60 s |
| Session | `HMAC(SEARCH_LIMITER_SALT, session cookie)`, where `__Host-cx-search` is an opaque random cookie set when missing | 60 per 600 s |

**Behaviour:**
- Over the limit, the response is `429` with `Retry-After` and a generic body.
- If the binding is missing, the Durable Object fails, or it takes more than 300 ms, the response is `503 search_unavailable`, so it fails closed. There is no in-memory fallback.
- Raw IPs and cookie values are never stored or logged.
- **Test boundary:** the Durable Object logic is unit-tested with a storage double, because the Node integration harness doesn't run workerd. The route's 429 and 503 handling is integration-tested with a binding double. A real workerd run of the limiter is left for staging evidence.

## 8. Tests and evidence

**pgTAP (`43_search.test.sql`):**
- Exact function owners, security definer and `search_path`.
- Grants: `anon`, `authenticated`, `service_role` and `catalogue_server` can't select any base table or execute the helper. `catalogue_server` can execute the wrapper only, and `api`/`private` aren't exposed schemas.
- Fixed boundary inside and outside, at 25 km and at the chosen radius.
- Mobile boundary, with rounding either side.
- Keyset paging with no gaps or duplicates across three or more pages.
- The helper applies the cursor and order before the limit.
- Moving the base within coverage leaves the wrapper output unchanged.
- Input bounds raise `22023`.

**Integration (`search.test.ts`, Node harness with a real `catalogue_server` login):**
- Mixed results across multiple pages.
- Tampered, expired and query-swapped cursors.
- `400` on bad input.
- `no-store` on every response.
- No private values in the JSON or the cursors.
- Limiter `429` and `503`, and a missing binding giving `503`.
- A wrong credential giving `503` with no detail.

**Unit:** the cursor codec and the limiter Durable Object logic.

**A17:** search uses only the user-supplied point, and nothing stores geocodes. Checked by code (no insert path) and by a pgTAP check that the search functions are `STABLE` and write nothing.

## 9. Your hosted prerequisites, later (none are needed for CI)

- A Hyperdrive config for `catalogue_server` through the Supabase pooler, with caching disabled.
- The role password, with `VALID UNTIL`.
- The Worker secrets `SEARCH_CURSOR_KEY` and `SEARCH_LIMITER_SALT`.
- The Durable Object migration applies on deploy.

## 10. Order and merge

1. #48 merges after the lint fix #49 and green CI.
2. D-080 and D-081 plus this plan merge (this PR).
3. The P2-2 code PR on `claude/p2-2-search` merges.

Each Claude-authored PR merges after green exact-head CI, a `CLAUDE SELF-CHECK @sha` comment and your chat OK (D-080). Codex does a general review later.

Agent: claude
