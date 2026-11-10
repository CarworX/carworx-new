# Claude — 17: Phase 2 proposal (free public site, A8–A17, to G-PROD)

**Date:** 2026-11-10. **Base:** main `bd5d1f2`. **Author:** Claude, under D-074.
**Status:** PROPOSAL. Codex reviews it (`AGREE` or `CHANGES`). **No Phase 2 code starts until the owner approves it.**

## 1. What Phase 2 is

Phase 2 is the first product people see: a **free directory**. Customers find car-service providers near them, and providers apply to be listed. There are no bookings and no payments; those come in Phase 3. The site launches to the public at **G-PROD** on the Supabase free plan (D-044).

```
customer ──▶ home / category ──▶ search (fixed or mobile) ──▶ listing ──▶ enquiry
                                        │ (no results)
                                        └──▶ private "need a provider here"
provider ──▶ apply ──▶ admin review (aal2) ──▶ verification labels ──▶ live listing
```

**Build rules:**
- **Parallel build (D-074):** slices are built locally and in CI with synthetic data while Phase 1 finishes on staging. Staging deploys of Phase 2 wait for Phase 1 A2. G-PROD waits for Phase 1 to close (A1–A7).
- **List first (D-075):** the map (P2-8) is out of Phase 2.

## 2. Slices

Each slice is one PR and has its own issue.

- Every migration ships its RLS policies **and** pgTAP tests (A4 extended to each new table: anonymous, self, member, other-organisation member, admin).
- Every slice passes exact-head CI and needs the other agent's formal review (D-073).
- **Writer:** Codex. **Reviewer:** Claude, security first (D-071 lead, D-073 review).

| Slice | Builds | Tables / routes | Acceptance | Security focus |
|---|---|---|---|---|
| **P2-1 Catalogue data** | The data the site lists | `categories`, `services`, `branches`, `listings` (+ provenance), `service_areas` (**private** base and radius), `listing_public` (projection view), `verifications`, `coordinate_sources`; synthetic seed | **A10**, A4 | The public projection exposes no base, radius centre, base-derived distance or private row ID |
| **P2-2 Search** | The server search endpoint | Fixed premises: 5/10/25/50 km (default 25), straight-line label. Mobile: coarse point of about 1 km inside the radius, no distance shown. **Ordering in §2.1.** Bounded inputs. Rate limit (§2.2). No anonymous RPC (§2.3) | **A8, A9, A10, A11, A17** | Anti-probing (§6.2). No geocode is stored. Mobile order never depends on base distance. The residual-risk note is ready for G-PROD |
| **P2-3 Public pages** | Home, category/subcategory, results, listing, empty states | React Router routes on T4 Studio components and the D-041 loaders | **A15**, A16 (manual) | `no-store` on personal responses; public pages cacheable only when they contain no personal data |
| **P2-4 Provider applications** | Apply → review → labels → live; claims; transfer of control; suspension; former staff revoked | `claims`, application state on `listings`, audit entries | **A12** (Playwright) | Admin actions at `aal2` only; review method recorded; audit log |
| **P2-5 Enquiries and demand** | Enquiry form; private demand capture on empty results; support cases | `enquiries`, `demand_requests` (private), `consents` (unticked by default), `support_cases` | **A13** | POPIA consent; demand data never public; Turnstile or rate limit on forms |
| **P2-6 Fines pages** | Guidance plus labelled official referral links | Static routes | **A14** | No ID field anywhere; "no results" never means "no fines" |
| **P2-7 Admin tools** | Application queue, claims, suspensions, audit-log view | Admin routes | A12 (part) | Server-enforced MFA on every admin route and on the database API |
| **P2-9 G-PROD readiness** | Everything the launch gate needs (§4) | Docs, runbooks, production project runbook | **G-PROD** | The owner runs the release |

### 2.1 Result ordering (P2-2), so the base never leaks through rank

PLAN §6.2 forbids ranking mobile providers by distance to their private base. So results come in **two separately paginated groups**, never interleaved:

| Group | Order | Shown |
|---|---|---|
| **Fixed premises** | Straight-line distance from the customer's point (to 0.1 km), then `listing_public.public_id` | Distance, labelled "straight-line" |
| **Mobile** ("serves your area") | `listing_public.public_id` only: a random, stable, public UUID assigned at creation | No distance, labelled "approximate area" |

- **Paging:** each group uses keyset pagination. The cursor for fixed is `(distance_bucket, public_id)` and for mobile is `(public_id)`, signed and bounded.
- **The page shows** the fixed group first, then the mobile group. Each group has its own "more" control.
- **Why two groups:** mixing them by any score would give mobile rank a meaning tied to the base.
- **Tests (A8, A9, A10):**
  - deterministic order across pages, with no duplicates or gaps;
  - moving a mobile provider's base, while keeping the customer point inside its radius, leaves its position and response byte-identical;
  - a mixed result set keeps the two groups apart;
  - no base, centre or base-derived value appears in JSON, HTML, cursors, logs or cache.

### 2.2 Rate limiting (P2-2, P2-5)

- **Choice:** the Workers **Rate Limiting binding** (`ratelimits`, GA since 2025-09-19; `simple.limit`, `period` of 10 or 60 s; needs Wrangler 4.36.0 or later). Keys are a hash of the IP plus a session cookie, separate per route. Source: [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
- **Known limit:** counts are approximate and per Cloudflare location, so this is a brake, not a strict cap. Probing defence also relies on input rounding (about 1 km) and the bounded radius set.
- **Free-tier check (Codex, before P2-2 is built):** confirm from Cloudflare's official limits and pricing pages that the binding is available on Workers Free at $0. If it isn't, use a Durable Object counter with SQLite storage, the same class of free-plan resource K2's probe ledger already uses. Either way, record the pinned source in the P2-2 PR.

### 2.3 Projection boundary (P2-1)

- **Base tables** (`listings`, `branches`, `service_areas`, `coordinate_sources`, `verifications`) have RLS enabled and **no `anon` policy**. Members and admins use the existing `private.has_org_role` and `private.is_platform_admin` helpers.
- **`listing_public`** is a view in `public`, owned by a dedicated `NOLOGIN` role `listing_projection`. That role holds `SELECT` only on the allowed columns of the base tables, plus an RLS policy `to listing_projection using (status = 'live')` (the role has no `BYPASSRLS` and owns no base table, so RLS still applies to it). The view is `security_invoker = false` and `security_barrier = true`. `anon` and `authenticated` get `SELECT` on the view only.
- **Search** runs in `private.search_listings(...)`, a `SECURITY DEFINER` function owned by `listing_projection` with a fixed `search_path`. It returns only projection columns. `EXECUTE` is revoked from `public`, `anon` and `authenticated`, and granted only to the server role the Worker uses for this call. That role's key is a server-only Worker secret, never sent to the browser. **Codex to propose** whether this is `service_role` (simplest) or a narrower custom role (preferred if Supabase supports it cleanly). This keeps "no anonymous RPC".
- **pgTAP:**
  - the exact column set of `listing_public`;
  - `anon` has no privilege on any base table or on `private.*`;
  - the view owner isn't a superuser and can't read `service_areas` centre columns;
  - only `live` rows are visible;
  - the function's `EXECUTE` grants are correct.

**Order (arrows mean "after"; ∥ means in parallel):**
```
P2-1 ──▶ P2-2 ∥ P2-3 ──▶ P2-4 ──▶ P2-5 ∥ P2-6 ──▶ P2-7 ──▶ P2-9 ──▶ G-PROD
```
Why this order: the data comes first because everything reads it. Search and pages only share the projection, so they can run side by side. Applications need pages to land on. Admin tools come last, once there is something to administer.

## 3. Proposed defaults (the owner can change any)

| Topic | Proposed default | Why |
|---|---|---|
| Launch region | One metro first (owner to name it, e.g. Gauteng or Cape Town) | Supply starts at zero (D-004). A tight area makes the empty-results rate meaningful |
| Launch categories | Wash and valet, mechanical service, tyres, panel and paint, auto electrical, mobile mechanic | Covers both fixed and mobile flows; owner to confirm |
| Verification labels | "Identity checked", "Business details checked", "Premises visited" (D-023 methods recorded) | Honest, method-based labels; no "certified" claims |
| Claim rule | A claim needs a business-domain email, or a document reviewed by an admin; control transfers only after admin review | Stops listing hijacks |
| Demand capture | Email only, with a consent tick off by default, kept 12 months (retention to be confirmed in D-053) | POPIA minimality |
| Form abuse | Cloudflare Turnstile (free) plus a per-IP limit | $0. Turnstile needs an owner widget, set up through an owner guide |

## 4. G-PROD: what must be true, and who does it

| Item | Agents draft | Owner does |
|---|---|---|
| Production Supabase project (free plan) and production Workers | Runbook and config | Creates the project and secrets; runs the release |
| No-cost backup route and pause plan (D-044); A7 re-run on the final schema | Drill and runbook | Holds the keys; confirms the destinations |
| Latency and region measured | Measurements | Accepts them |
| Privacy notice and terms (POPIA, CPA, ECTA; D-045) | Drafts with citations | Approves them |
| Retention schedule (D-053) | Schedule with citations | Approves it; accountant colleague checks financial periods |
| Information Officer registration | Owner guide | Registers with the Information Regulator |
| Section 72 (cross-border transfer) assessment | Draft | Approves it |
| Probing residual risk (§6.2) | Assessment and mitigation | Accepts it in writing |
| Incident plan | Draft | Approves it |
| D-060 design checks (screenshots, 200% zoom, phone screen reader, real devices) | Checklist | Performs them |

## 5. Owner prerequisites, by when

| Needed before | What | Guide |
|---|---|---|
| P2-1 starts | **Approve this proposal**; name the region and categories (§3) | — |
| P2-5 | Cloudflare Turnstile widget (free) | New guide 12 |
| P2-9 | Information Officer registration; production Supabase project | New guides 13 and 14 |
| G-PROD | §4 owner column; Phase 1 closed | 9, 11 |

## 6. Not in Phase 2

- Maps (D-075).
- Bookings, quotes, resources and holds (Phase 3).
- Any payment provider integration. The Paystack vs Yoco comparison is research only ([Claude 18](18-paystack-vs-yoco.md)).
- Reviews.
- WhatsApp or SMS.
- Integrated fines lookup (G-FINES).
- Ads, sponsorship and subscriptions.

## 7. Questions

**For Codex:** the open points are the free-tier check (§2.2) and the role choice for `private.search_listings` (§2.3). The three earlier questions are answered in §2.1–§2.3, and Turnstile stays in P2-5.

**For the owner:** the four §3 defaults (region, categories, labels, claim rule) and the §5 prerequisites.

Agent: claude
