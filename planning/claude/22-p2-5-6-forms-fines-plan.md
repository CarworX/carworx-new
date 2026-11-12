# Claude — 22: P2-5 + P2-6 visitor forms and fines (Bundle B)

**Date:** 2026-11-11 (SAST). **Author:** Claude sub-session, under D-080 and D-085. **Status:** plan; built straight after on stacked branches (no wait for plan approval, as Bundle A). The coordinator and the owner review; the plan changes if reviewers ask.
**Builds on:** `listing_public`, the P2-2 `SearchLimiter` Durable Object and the scoped-login pattern of `catalogue_server` (D-081), the Bundle A wrapper shape and `private.require_admin()` (Claude 21 §4), the T5 boundary (Origin + CSRF on every post), T4 Studio components.
**Rules:** A13, A14, A10, A11 (spirit: no anonymous RPC that skips the Worker), POPIA (s10 minimality, s11 consent, s14 retention, s18 notice, s72 notice), PLAN §9.1 log redaction, the Bundle C [retention schedule](../legal/retention-schedule.md) and [privacy notice](../legal/privacy-notice.md), owner guide 12 (Turnstile).

## 1. What ships

| Who | Can do | Where |
|---|---|---|
| Any visitor | Send an enquiry to a live listing's provider: name, email, message, and an **unticked** "share with this provider" box | Form on `/p/:publicId` |
| Any visitor | On empty search results, ask to hear when a provider joins: **email only**, plus the service and province already chosen, and an **unticked** consent box | Link in the empty state → `/demand` |
| Any visitor | Open a support case: email, topic (fixed list), message | `/support` (footer link) |
| Provider owner or manager | Read enquiries sent to their listings | `/provider` (new "Enquiries" section) |
| Admin at `aal2` | Read demand requests (A13: the only reader), withdraw one on request | `/admin/demand` |
| Admin at `aal2` | Read support cases, close one with a short note | `/admin/support`, `/admin/support/:id` |
| Anyone | Read fines guidance with labelled official referral links. **No ID-number field, no lookup** | `/fines` |

Every form works the same way: limiter → parse → Turnstile → database, then post-redirect-get to a "sent" page. Replies never say whether an email is already known.

## 2. Data model (one migration, `20261111140000_p2_5_forms.sql`)

| Table | Key columns | Notes |
|---|---|---|
| `enquiries` | `id`, `listing_public_id`, `organisation_id` (snapshot), `sender_name` (2–80), `sender_email` (≤ 254), `message` (10–1000), `consent_id`, `created_at` | Listing must be `live` when sent. No user link: anonymous by design |
| `demand_requests` | `id`, `email`, `category_slug`, `province` (one of the 9), `consent_id`, `created_at`, `last_activity_at`, `expires_at` (= last activity + 12 months) | **Private.** No point, no geocode, no search text (A17). One row per email + category + province: a repeat refreshes `last_activity_at` and `expires_at` and looks identical to the visitor |
| `consents` | `id`, `purpose` (`enquiry_share_with_provider`, `demand_notify`), `notice_version`, `method` (`checkbox_unticked_default`), `subject_email`, `granted_at`, `withdrawn_at`, `processing_ended_at`, `retain_until` | Proof of consent (s11(2)(a)). Kept 3 years after withdrawal or the end of processing (retention schedule) |
| `support_cases` | `id`, `email`, `topic` (`listing_problem`, `account`, `privacy_request`, `other`), `message` (10–2000), `status` (`open`, `closed`), `closed_by`, `closed_at`, `close_note` (5–500), `created_at` | Privacy requests (withdraw consent, deletion) come in here |

- **Consent is a hard requirement.** The box is never pre-ticked in HTML. The database also refuses an enquiry or demand row without a matching consent row created in the same call. "Not unticked" never counts as consent (privacy notice §3).
- **Text checks** reuse `private.clean_text` and `private.clean_multiline` from Bundle A. The email check is a bounded shape check (`^[^@\s]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,}$`, lower-cased); nothing is sent to it (no real email, binding rule).

## 3. Privilege boundary

**The problem.** The forms are for visitors who aren't signed in. A `public` RPC granted to `anon` would let anyone post straight to PostgREST with the publishable key, skipping Turnstile and the limiter.

**The shape (Bundle A's, with a different caller).** Each write is a `SECURITY INVOKER` wrapper in `public` calling a `SECURITY DEFINER` function in `private` with `search_path = ''`. But `EXECUTE` on the submit wrappers goes **only to a new scoped login, `forms_server`**, never to `anon`, `authenticated` or `PUBLIC`. The Worker reaches it through a Hyperdrive binding, `FORMS_DB`, exactly as search reaches `catalogue_server` (D-081). PostgREST can never switch to `forms_server`, so the only way in is through the Worker's checks.

```
browser ──POST──▶ Worker: T5 Origin + CSRF ─▶ limiter (per IP) ─▶ parse ─▶ Turnstile siteverify
                                                                            │ ok
                                                FORMS_DB (forms_server) ────┘
                                                  │ EXECUTE only on:
                                                  ├─ public.submit_enquiry(...)  invoker ─▶ private.submit_enquiry   definer
                                                  ├─ public.capture_demand(...)  invoker ─▶ private.capture_demand   definer
                                                  └─ public.open_support_case(...) invoker ─▶ private.open_support_case definer
signed-in user ──JWT──▶ PostgREST (RLS reads; admin wrappers below)
                          ├─ public.admin_close_support_case(...) ─▶ private.… (require_admin: listed admin AND aal2)
                          └─ public.admin_withdraw_demand(...)    ─▶ private.… (require_admin)
```

| Role | Can | Can't |
|---|---|---|
| `forms_server` (login, `connection limit 5`, no password in Git; tests set a synthetic one) | `EXECUTE` the three submit wrappers, and so the three private functions they call | Read any table; execute any other function; `BYPASSRLS` |
| `anon` | Nothing new | Execute any new function; read any new table |
| `authenticated` | Read new tables through RLS; execute the two admin wrappers (refused unless `aal2` admin) | Insert, update or delete any new table directly |

The submit functions return only `void`, so a caller learns nothing about existing rows.

**RLS and the A4 matrix** (no client `INSERT`, `UPDATE` or `DELETE` grant at all; every admin policy checks `aal2` inline):

| Table | Admin `aal2` | Organisation owner/manager | Organisation staff | Other-org member | Self | Anonymous |
|---|---|---|---|---|---|---|
| `enquiries` | read | read (own organisation) | — | — | — (no user link) | — |
| `demand_requests` | read, unexpired rows only | — | — | — | — | — |
| `consents` | read | — | — | — | — | — |
| `support_cases` | read | — | — | — | — | — |

An `aal1` admin reads nothing from any of the four. **A13** is these rows plus tests that `listing_public`, `/api/search`, search HTML and every provider page contain no demand data.

## 4. Abuse controls

**Turnstile.** Managed widget, implicit rendering (`<div class="cf-turnstile" data-sitekey data-action>`), script `https://challenges.cloudflare.com/turnstile/v0/api.js` loaded `async defer` on form pages only. Server side: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`, `remoteip` and an `idempotency_key`, a 3-second timeout, and token length ≤ 2048. Source: Cloudflare Turnstile docs, read 2026-11-11 ([server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), updated 2026-11-10; [testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), updated 2026-11-05; [client-side rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)).

- **Names (final, replacing guide 12's proposals only if they differ):** `TURNSTILE_SITE_KEY` (Worker var, public) and `TURNSTILE_SECRET_KEY` (Worker secret). They're the same as guide 12 proposed.
- **Without the owner's widget:** local and CI use Cloudflare's official test pair, sitekey `1x00000000000000000000AA` and secret `1x0000000000000000000000000000000AA` (always pass; the widget yields the dummy token `XXXX.DUMMY.TOKEN.XXXX`). Tests also use the always-fail secret `2x0000000000000000000000000000000AA` and the spent-token secret `3x0000000000000000000000000000000AA`.
- **Checks on a pass:** `success` is true, and `hostname` equals `APP_ORIGIN`'s host and `action` equals the form's action. A test secret always answers `hostname: "example.com"` with no `action`, so **those two checks relax only when the secret is a Cloudflare test secret and `CARWORX_ENV` is `local`**. A test secret anywhere else fails closed, so test keys can't reach staging by mistake.
- **Fails closed:** a missing key, a network error, a timeout or any odd answer gives "This form isn't available right now" (503), never an accept.
- **No JavaScript or blocked widget:** the existing form stays protected by Turnstile. `/support#support-contact` must also render a plain email link outside the conditional form, using the public `SUPPORT_CONTACT_EMAIL` Worker variable. The owner must confirm that this is an existing monitored support/privacy channel before installing its value. The link must work without JavaScript and remain visible when Turnstile configuration is missing or its script is blocked. Missing or invalid contact configuration displays an explicit unavailable state, never an invented address. **Release blocker:** the owner has not yet supplied/verified this channel; synthetic tests do not clear that operational requirement. No new mailbox, hosted settings or real mail is authorised.
- **Tests never call Cloudflare.** Unit tests inject `fetch`. Integration tests stub `fetch` for the siteverify host only and assert the exact request body. The Playwright check replaces `api.js` with a local stub that drops the dummy token into `cf-turnstile-response`.

**Per-IP limit (existing limiter).** A new window in `SearchLimiter`, `FORM_WINDOW = 5 per 10 minutes`, keyed `form:<enquiry|demand|support>:ip:<HMAC(salt, ip)>`, reusing `SEARCH_LIMITER_SALT` with its own purpose label. Counted before parsing, so a bad post still counts. Limited → 429 with `Retry-After`; limiter down → 503. *Why 5/10 min:* a person sends one or two; a script sending more is stopped at once, and the counter stays a brake, not a cap (§2.2 of Claude 17).

**Database brakes.** A demand repeat refreshes one row instead of adding rows. Every bounded text field has a `check`.

## 5. Retention and redaction

| Data | Kept | How |
|---|---|---|
| Demand requests | **12 months** from last activity | `expires_at`; RLS hides expired rows at once; `private.purge_expired_forms()` deletes them |
| Enquiries | 12 months from creation (retention schedule) | Same purge |
| Support cases | 3 years after closing; open cases stay | Same purge |
| Consents | 3 years after withdrawal or the end of processing | `retain_until`, set when its demand or enquiry row is purged or withdrawn; same purge |

`purge_expired_forms()` is `SECURITY DEFINER`, executable by nobody but its owner, returns counts only and is tested in pgTAP. **Scheduling it is a G-PROD item** (gap R-2), because a scheduler (`pg_cron` or a Worker cron) is a hosted setting. The plan doesn't enable one.

**Redaction (PLAN §9.1).** Audit triggers on the four tables log `id`, `status`/`topic`/`purpose`, and the listing or category only, **never** a name, email, message or note. The Worker never logs a form body, an IP or a Turnstile token; errors are mapped to fixed keys.

## 6. Fines pages (P2-6, A14)

`/fines` stays a static, cacheable page (`public, max-age=300`; no form, no cookie of its own).

- **Guidance:** what kinds of fines exist (national AARTO infringements, municipal and provincial traffic fines), that each authority keeps its own records, how to pay or make a representation, and the deadlines to watch for.
- **Labelled official links only:** each shows who runs it, for example "Road Traffic Infringement Agency (government)", and opens the official site. Every URL is read and checked before it ships, and the PR records the date. No commercial fine checkers.
  - **Checked 2026-11-11:** `https://www.rtia.co.za/` loads (HTTP 200) and names the Road Traffic Infringement Agency, which the AARTO Act makes the only body that may process AARTO fines. It also warns of fake AARTO payment sites, so the page repeats that warning. `www.aarto.gov.za` and `online.natis.gov.za` answered 503, and `www.rtmc.co.za` answered 403, so they are rechecked before PR 4. A link that can't be confirmed is left out rather than guessed.
  - A link's label names only what the page itself says about its operator.
- **"No results" never means "no fines":** a callout says that finding nothing on one site doesn't mean you have no fines, because another authority may hold them.
- **No ID field anywhere:** no field asks for an ID, licence or registration number. There is no lookup (G-FINES is out of scope). A test walks every route's HTML and fails on any `input`, `select` or `textarea` whose name, id, label or `autocomplete` mentions ID, identity, licence or registration, or that has a 13-digit pattern or length.

## 7. Tests

| Layer | What |
|---|---|
| pgTAP (new `46_forms.test.sql`, `47_forms_matrix.test.sql`, own fixtures: K4 recovery runs with no seed) | Each submit function: valid, bounds, refused without consent, refused on a non-live listing; the demand repeat refreshes and doesn't add; `void` results; `forms_server` can execute only the three wrappers and read no table; `anon`/`authenticated` can't execute the submit functions; admin wrappers refuse `aal1` and non-admins; the A4 matrix for the four tables × six actors × four operations; expired demand hidden; purge deletes exactly what it should; audit details contain no email, name or message |
| Unit (Vitest) | Form parsing and bounds; Turnstile verify (pass, fail, spent, timeout, bad JSON, hostname/action rules, test-secret rule per environment); the form limiter window; the ID-field scan helper |
| Integration (built Worker + local stack, `apps/web/integration/forms.test.ts`) | Each form end to end as the real `forms_server`; CSRF and Origin refusals; Turnstile fail → no row; limiter 429; no-config 503; provider sees its own enquiries only; admin `aal2` sees demand and support, `aal1` redirected, non-admin 404; demand never appears in public JSON or HTML (A13); `/fines` scan (A14). Rows bulk-inserted for a test are removed in `onTestFinished` |
| Playwright (`playwright` 1.63.0, already pinned) `apps/web/scripts/forms-e2e.ts` | At 390 px wide: enquiry sent, demand sent from an empty search, support case sent; the consent box starts unticked; phone-width screenshots at deviceScaleFactor 2 |
| Checks | Lint, format, typecheck, build, perf (A15) |

## 8. Stacked PRs (each about 1,500 changed lines or fewer)

| # | Branch | Contents |
|---|---|---|
| 1 | `claude/p2-5-6-plan` | This plan |
| 2 | `claude/p2-5-6-db` | Migration and pgTAP |
| 3 | `claude/p2-5-6-forms` | Turnstile, form limiter, `FORMS_DB` client, the three forms, unit and integration tests |
| 4 | `claude/p2-5-6-admin-fines` | Provider enquiries, admin demand and support views, the fines page, Playwright and screenshots |

## 9. Owner and G-PROD items this creates

- Turnstile widgets and the staging secret (guide 12; names confirmed above).
- A `FORMS_DB` Hyperdrive binding for the `forms_server` login, set up the same way as `CATALOGUE_DB` (added to the production runbook).
- Scheduling `purge_expired_forms()` (R-2).
- Privacy notice: add the demand row ("tell me when a provider joins") and the support row's 3-year period; the s72 T1b prerequisites are met by the enquiry form's notice.

## 10. Not in this bundle

Sending any email (to providers, enquirers or demand subscribers); replies inside CarworX; file attachments; an integrated fines lookup (G-FINES); Turnstile on the Bundle A forms (they're signed-in and already per-user); scheduling the purge.

Agent: claude
