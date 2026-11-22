# Plan: "Browse first" landing page redesign

## Context

Today's home page (`/`) is an exact copy of the Sites preview (#122). It sells the idea well, but a new visitor **can't search or see any businesses from it**. They have to click "Find a service" and then type an area first. The owner wants anyone to land, **search straight away, see the categories and explore businesses and their services without an account**. An account is asked for only at **Book** or **Enquire**.

Mockups (approved for review): `planning/landing-redesign/mockup.html` → `desktop.png`, `phones.png`, `desktop-gate.png`.

### Owner decisions (22 Nov 2026)
| # | Decision |
|---|---|
| 1 | Enquiries **need an account** (same as bookings) |
| 2 | Add **name + keyword search** (business or service name) |
| 3 | Home list = **all live businesses first**, re-sorted "near you" once an area or location is given |
| 4 | **Keep:** hero objects, the first-visit intro, the app glimpse and business band. **Drop:** the long how-it-works timeline and the written-quote section (replaced by a 3-step "Look first, sign up when ready" row) |
| 5 | Phone hero keeps **2 small objects** (sticky note + timer in the corners), so the search box shows without scrolling at 390px |
| 6 | Goes **first**, before the 4 queued port groups |

⚠️ This **overrides Decision 1 (Option A, exact port) for the home page only**. Every other screen stays an exact port. The decision gets logged as a new D-number in `planning/DECISIONS.md`.

## The new home, top to bottom

```
┌ Header: logo · Find a service · Fines & admin · For businesses · Sign in · [Sign up]   (☰ + Sign in pill on phone)
├ Hero: pill · "Car care, booked properly." · objects (4 desktop / 2 phone)
│   [What do you need?  service or business] [Where? suburb] ◎ Use my location [Search →]
│   ✓ Free to browse · no account needed   🔒 Sign in only to book or send an enquiry
├ Categories: 5 object tiles + live counts → /c/:category
├ Businesses you can explore: filter chips + 3–6 cards (View business · 🔒 Book after sign in) → "See all N"
├ How it works: 01 Explore (no account) · 02 Free account · 03 Book or enquire
├ App glimpse (kept from today's home)
├ Fines band + business band (kept)
└ Footer
```

## Build: 3 PRs to main, in order (one builder session)

### PR A: Keyword search (backend + /search)
- New migration `supabase/migrations/2026112xxxxxx_keyword_search.sql`: extend `api.search_listings` (defined in `20261110190000_p2_3_category_search.sql`) with an optional `q text`. It matches business `display_name` and service names (`ilike`/trigram on live listings only), and works **with or without** a location. With no location it returns live listings in a stable order (newest verified first). Keep the existing signature working (default `null`).
- `apps/web/app/server/search/db.ts`, `handler.ts`, `page.ts`: pass `q`, and keep the rate limiter (`limiter.ts`) and cursor paging (`cursor.ts`).
- `apps/web/app/routes/search.tsx`: add a "What do you need?" field. Results show without an area (no more empty state that demands a suburb). The distance chips only appear once an area is set.
- Tests: extend `search.test.ts`, `server/search/*.test.ts`, plus SQL tests if the repo has a pgTAP folder.

### PR B: Accounts for enquiries (and the sign-in step)
- `apps/web/app/routes/p.$publicId.tsx`: the enquiry action calls `requireSignedIn` (`auth/session.server.ts`). Signed out, the form shows the **sign-in step** (desktop modal / phone bottom sheet from the mockup). Signed in, name and email come from the account and only the message is asked for.
- "Your message is kept": the draft goes into `sessionStorage` before the redirect and is restored when they come back. `signInUrl()` already carries `returnTo`, and sign-up must honour `returnTo` too (check `auth/routes/sign-up.tsx` and the email-confirm path).
- Migration: link `enquiries` to `auth.users` (nullable column → required for new rows). The enquiry function in `20261111140000_p2_5_forms.sql` reads `auth.uid()`. Old anonymous rows stay as they are.
- The Book button (phase-3 only) uses the same sign-in step. On main it stays inert, as today.
- Tests: `listing-pages.test.tsx` (signed-out gate, signed-in send, returnTo round trip).

### PR C: The landing page
- Replace the static `app/home/preview.html` hero/timeline with a React route in `routes/home.tsx`, plus a **loader** that returns category counts and 6 live listings (reusing `server/catalogue/public.ts` and `server/search`). Keep `introGate.ts` + `/intro/intro.js` (intro unchanged) and port the kept sections (hero objects, app glimpse, business band) **verbatim** from `preview.html`/`home.css`.
- Reuse: `sites/ListingCard.tsx` (add a "🔒 Book after sign in" hint), `sites/UseMyLocation.tsx`, `ui/services.ts` (`SERVICES` icons), `sites/SitesShell.tsx` header (already has Sign in/up and the ☰ sheet).
- "Near you" re-sort: submitting an area or location goes to `/search?q=…&near=…`. The home list itself never asks for location, so it's never empty.
- Cache: `public, max-age=300` stays, because the loader output has no personal data.
- Copy: words from the mockup. No demo/mock/fictional wording.
- Evidence in the PR: screenshots of mockup vs ours at 1280 and 390, a pixel-diff table, and Lighthouse a11y ≥ 95.

## Rules for the builder (same as before)
Don't deploy, don't touch staging Supabase (migrations are applied later by the coordinator, in order). Merge on green exact-head CI (D-091). Report to the coordinator only when a PR is merged. Then continue with port groups 1→5.

## Verification
| Check | How |
|---|---|
| Unit/route tests | `pnpm -r test` (Node 24.22.2, pnpm 12.16.1 per the handoff workaround) |
| Typecheck/lint/build | `pnpm -r typecheck && pnpm -r lint && CLOUDFLARE_ENV=staging pnpm run build` |
| Browse without an account | Playwright, signed out: `/` shows a search box, 5 categories and ≥ 3 businesses; open `/p/:id`; search "Shine" with no area → result |
| Enquiry gate | Signed out: Send enquiry → sign-in step → sign up → back on the listing with the message restored → sent; a direct anonymous POST is rejected |
| Phone | 390px: search box above the fold, ☰ sheet shows Sign in/up |
| Staging (after merge) | Coordinator applies the 2 migrations to `gdiyrdqfkthtcglgqnts`. Codex/owner deploys the Worker (cloud sessions can't, see gotchas). Then check `/` and `/search?q=` through the Access headers |
