# CarworX backlog

Owner list from 25 Nov 2026, confirmed one by one against `main` @ `fe6a955` and staging Worker v21 (`fe6a955`). Written by Claude (coordinator), 2026-11-25 23:10 SAST.

**Legend:** 🔴 broken · 🟠 design mismatch · 🟡 missing build · ⚪ owner or partner step · ✅ confirmed (the issue is real, with evidence) · **Lane:** C = Claude, X = Codex, O = owner.

## Roadmap

```
WAVE 1  Fix what's broken      B-01 sign-out splash · B-05 location squeeze · B-10/11 sign-up gating + redirect link
WAVE 2  One shell everywhere   B-02 header (signed-in aware, fixed) · B-03 footer · B-04 nav (no Find-a-service page)
WAVE 3  Look and feel          B-06 category page · B-07 customer home (Uber-Eats style) · B-08 dashboard glimpse · B-09 intro
WAVE 4  Launch-ready words     B-12 copy sweep (needs O-1 fee wording) · B-13 legal pages final
WAVE 5  Fines for real         B-20 fines section on landing · B-21 ID check (admin queue) · B-22 My Fines + pay (needs partner)
LATER   Phase 3 (Codex)        bookings, quotes, checkout, earnings on `phase-3` (#102)
```

Why this order: Wave 1 is small and visible. Wave 2 changes the shared layout that every later page uses, so it goes before the redesigns. The copy sweep comes after the redesigns so it isn't done twice. Fines needs an owner decision and a partner, so it starts last but can be planned in parallel.

## Wave 1 · Broken

| ID | Issue | Confirmed cause (evidence) | Fix | Lane |
|---|---|---|---|---|
| B-01 🔴✅ | After sign-out, a full-screen "CarworX" splash shows until refresh | The landing page has **two** intros: the brand one (`#cx-intro`, `public/intro/intro.js`, first visit only) and the old mockup one (`#intro` in `app/home/preview.html:85`, driven by `public/home/home.js:131`). The mockup one is only hidden once `home.js` adds `intro-done`. Sign-out (`auth/routes/sign-out.tsx`) redirects to `/` as an in-app navigation, so `home.js` (a `<script defer>` inside the React tree, `routes/home.tsx:186`) never runs and `#intro` stays on screen. | Remove the mockup `#intro` from the cut markup; keep only the brand intro. Make sign-out a full page load (`reloadDocument`) as a safety net. | C |
| B-05 🔴✅ | When "Use my location" fails, the search bar squeezes ("What do you need?" wraps to 4 lines) | The error text renders inside `.lp-loc`, a flex item in the bar's row (`routes/home.tsx:221`, `home/landing.css:23,68`), so a long sentence takes the space. Screenshot: `scratchpad/shots/home-locfail.png`. | Show the message under the bar (its own row), never inside it. Same on `/search`. | C |
| B-10 🔴✅ | "Create account" and "Sign up with Google" are clickable before the terms box is ticked | `auth/routes/sign-up.tsx:162-180`: the checkbox only blocks on submit; Google only complains after the account picker (`auth/GoogleButton.tsx:89`). Sign-in's Google button can also create new accounts with no consent box. | Disable both buttons until ticked (with a no-JS server check kept). Google on sign-in: new Google users are sent to a one-step consent screen before the account is made. | C |
| B-11 🔴✅ | "Use Google redirect instead" link | `auth/GoogleButton.tsx:155`: shown whenever the Google widget loads. | Remove the link; keep the redirect only as a hidden fallback when the Google widget fails to load. | C |
| B-14 🔴✅ | After signing in (Google or email) you land on a bare "Your account" card | `DEFAULT_AFTER_SIGN_IN = "/account"` (`server/security/redirect.ts:8`) and `/account` is a plain `AuthPage`. Google sign-in itself works (owner screenshot: signed in as the owner). | Send customers to the new customer home (B-07); businesses to `/provider`. | C |

## Wave 2 · One shell everywhere

| ID | Issue | Confirmed cause | Fix | Lane |
|---|---|---|---|---|
| B-02 🟠✅ | The top menu differs per page and disappears on the category page | Three headers: landing `.nav` (fixed pill, `home/home.css:392`), `SitesShell` (static, scrolls away, `sites/SitesShell.tsx`, `sites/app.css:95`) on search/category/listing, and `PublicShell` on fines/support/privacy/terms. Auth pages have none. **None of the landing, search or category headers know you are signed in**: they always show "Sign in / Sign up". | One shared `SiteHeader` component: the landing pill style, fixed, signed-in aware (avatar and "Account" when signed in), used by every public page. | C |
| B-03 🟠✅ | Footer differs per page | Three footers: landing (`home/preview.html:1873`), `SitesShell` (`sites/SitesShell.tsx:71`), `PublicShell` (`ui/public/PublicShell.tsx:94`), each with different links. | One shared `SiteFooter` (the landing design) on every public page, including the auth pages. | C |
| B-04 🟠✅ | "Find a service" opens a separate page; an "All services →" link exists | Nav links to `/search` (`routes/home.tsx:51`, `sites/SitesShell.tsx:9`); "All services →" at `routes/home.tsx:254`. | "Find a service" scrolls to the services section on the landing page (`/#services`); remove "All services". `/search` stays as the results page that the search bar submits to. | C |

## Wave 3 · Look and feel

| ID | Issue | Confirmed cause | Fix | Lane |
|---|---|---|---|---|
| B-06 🟠✅ | The category page doesn't follow the design system | Uses the older Sites shell and card styles. Cards fill only ~60% of the width with an empty right side. Screenshot: `scratchpad/shots/category-scrolled.png`. Also shows "Cost to search R0". | Rebuild on the landing system: shared header and footer, category hero, full-width card grid, the landing's card style. | C |
| B-07 🟡✅ | Signed-in customers need an Uber Eats-style home | Doesn't exist (B-14). | A new signed-in `/` view: location chip at the top, search, the category icon row, rows of nearby businesses ("Near you", "Top rated", "Comes to you"), and a fines card. Our design system, not Uber's look. | C |
| B-08 🟠✅ | The landing's "Shine Studio" dashboard isn't the real dashboard | The landing glimpse shows bookings, earnings and payments (Phase 3). The real `/provider` (directory launch) shows listings, enquiries, team and setup only. | For the directory launch: redraw the glimpse from the real `/provider` screen. When Phase 3 ships, both get the booking numbers together. | C |
| B-09 🟠✅ | The first-visit animation plays too fast | Same two-intro conflict as B-01: the mockup intro (`home.js`) runs on **every** visit and speeds up 5× on any scroll, click or key (`home.js:154`). The brand intro (`intro.js`, from `planning/design/brand/exports/motion`) is the approved one. | Keep only the brand intro (fixed together with B-01). Owner checks the speed on staging. | C |

## Wave 4 · Launch-ready words

| ID | Issue | Confirmed cause | Fix | Lane |
|---|---|---|---|---|
| B-12 🟠✅ | "Pilot", "R0 fee", "demo", "sandbox" wording | Found on staging: landing (badge "Pilot · CarworX fee R0", "List free during the pilot", "No CarworX fee during the pilot", "CarworX fee (pilot) R 0", 10 places in `preview.html`), search and category ("Cost to search R0"), `/fines` ("Try My Fines in the staging sandbox"), `/fines/mine` ("Staging sandbox", "Simulated checkout"), privacy and terms ("free pilot"). Seed businesses called "Synthetic fixed provider" are visible on search. | A sweep of every page, with a list of each change for owner sign-off. Seed data renamed to realistic (still synthetic) names. Needs **O-1**. | C |
| B-13 ⚪✅ | Privacy and terms say "This is a draft, not yet approved", "[launch date]" | Correct until the owner approves (G-PROD E1, E2). | The owner answers OQ-L1, L2, L4 and L6 and approves; then Claude removes the draft banner and the free-pilot wording. | O → C |

## Wave 5 · Fines for real (new owner direction, 25 Nov)

**This changes D-013 and D-052** (launch with official referral links only, no ID collection, integrated lookup behind G-FINES). A new decision (D-099) must record: in-app fines lookup and payment, an ID check before fines show, admin review now, AI later.

| ID | What | Needs | Lane |
|---|---|---|---|
| B-20 🟡 | "Fines & admin" becomes a section on the landing page (how it works, then "See my fines" once signed in); no separate `/fines` page | B-02 | C |
| B-21 🟡 | ID verification: the user submits their ID number (and a selfie or document photo, if the partner requires it); an admin queue approves or rejects it; nothing shows until approved | D-099; POPIA rules for ID numbers (unique identifiers): store encrypted, show masked, admin-only, a retention row, Information Officer registered; Section 72 check if the partner is offshore | C (DB and admin queue), O (legal) |
| B-22 🟡 | My Fines: list, detail, pay through the partner's hosted checkout, receipt; settled only on the partner's callback, never on the browser return | A partner contract and sandbox keys (Pay@ first, Electrum as fallback; `/fines/mine` today is a synthetic sandbox, #160) | X or C after the partner is signed |

## Other confirmed items

| ID | Issue | Evidence | Lane |
|---|---|---|---|
| B-30 🔴 | Resend's bounce and complaint webhook is blocked by Cloudflare Access | Codex's test: `/api/mail/events` → 302 to Access (PR #102 comment, 25 Nov) | O: Access Bypass rule for that one path |
| B-31 ⚪ | Staging Worker logs are off, so failures can't be read | Observability query returned no events (25 Nov) | O: switch on Workers Logs for `carworx-web-staging` |
| B-32 ⚪ | Supabase Auth URLs for Google | Codex saw Supabase send the code to `localhost:3000`; the owner's 25 Nov screenshot shows sign-in now works. Recheck once B-14 is done. | O check |
| B-33 🟡 | Email change on hosted Auth (two recipients, two tokens) | `EMAIL_CHANGE_ENABLED` off on staging (#152) | X |
| B-34 ⚪ | "Prevent use of leaked passwords" in Supabase | Owner to-do | O |
| ✅ | Search 503 on staging | Fixed by Codex #161 and #162; `/search?q=shine` 200 on v21 | done |
| ✅ | Address suggestions | "Sandton" gives 2 suggestions on staging (25 Nov, 23:00 SAST) | done |
| ✅ | Dead links | The 35 internal links on 10 public pages all answer 200 (or 302 to sign-in) | done |

## Owner questions

- **O-1 Fee wording:** with "pilot" and "R0" gone, what do businesses read? (a) Nothing about fees, (b) "Free to list", or (c) the Phase 3 commission (10%, capped at R500, D-054) shown only when bookings launch.
- **O-2 Fines:** confirm D-099 (above), and which partner to approach first (Pay@ or Electrum).
- **O-3 ID check:** is the ID number alone enough, or also a selfie or document photo? (Affects POPIA risk and cost.)

## Still to build after this list (unchanged)

- **Phase 3** (Codex builds, Claude reviews) on `phase-3` / #102: booking, quote, checkout, result, my bookings, dashboard numbers, earnings, history, prices and travel setup. Its migrations go to staging only when phase-3 deploys.
- **G-PROD** (`planning/runbooks/g-prod-checklist.md`): the production project and region, backups (BK-1 and a restore drill), Turnstile and Mapbox production keys, D-060 device checks, legal E1–E6, Information Officer.
- **Business paperwork** (owner): company registration, business bank account, accountant on VAT (OQ-E1).
