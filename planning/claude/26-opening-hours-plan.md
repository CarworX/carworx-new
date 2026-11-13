# Claude — 26: opening hours per day (plan)

**Date:** 2026-11-13 (SAST). **Author:** Claude (opening hours sub-session). **Status:** plan; merged under D-091, reviewed after merge. **Launch work on `main`** (D-093: the directory goes live first, and hours are part of a listing).

**Owner request (2026-11-13):** "Businesses need to be able to set their dates and times for each day of the week, and you should be able to see their opening hours as a customer for each day of the week."

**Rules:** D-088 (onboarding design: pick, don't type), D-091 (build and merge authority, review after merge), D-087 (noreply commits), D-081 (scoped server logins), the `cx-` design system, synthetic data only.
**Out of scope:** deploys, staging or production database changes (the coordinator applies the migration), real email, spending.

## 0. What exists today, and the bug

| Piece | Where | State |
|---|---|---|
| Storage | `public.listing_hours` (`20261112120000_onboarding.sql`) | One row per day: `day` 1 = Mon … 7 = Sun, `opens`, `closes`, `check (closes > opens)`, `unique (listing_public_id, day)`. Members and admins can read. No anonymous read. Per-row audit trigger `catalogue_audit`. |
| Draft | `provider_applications.hours` (jsonb), checked by `private.clean_hours` | Already a list of `{day, opens, closes}`, so it **can** hold different times per day. |
| Submit | `private.provider_submit` | Copies the draft hours into `listing_hours`. |
| Form | `app/ui/DayToggles.tsx`, `onboarding/draft.ts` (`about` step) | **The bug:** seven day toggles plus **one** opens/closes pair applied to every ticked day. Saturday can't close at 13:00 if the week closes at 17:00. |
| Editing after live | — | **No screen.** |
| Customer page `/p/:publicId` | `routes/p.$publicId.tsx` | **Shows no hours.** |

The good news: the database and `clean_hours` already store per-day times. The fix is mostly the form, one write function, one public read function and the customer view. **No table changes.**

## 1. The flow, in one picture

```
  PROVIDER (owner / manager)                       DATABASE                              CUSTOMER
 ┌──────────────────────────────┐       ┌──────────────────────────────────┐     ┌───────────────────────────┐
 │ Get listed · About step      │──────►│ provider_applications.hours      │     │ /p/:publicId              │
 │  (draft, before approval)    │ save  │   (jsonb, clean_hours)           │     │                           │
 └──────────────────────────────┘ draft └──────────────┬───────────────────┘     │  ● Open now · closes 17:00 │
                                                        │ provider_submit         │  Mon  08:00–17:00          │
 ┌──────────────────────────────┐                       ▼                         │  Tue  08:00–17:00  ◄ today │
 │ /provider/hours/:publicId    │  set_listing_hours  ┌──────────────────────┐    │  …                         │
 │  (after listing; NEW)        │────────────────────►│ public.listing_hours │    │  Sun  Closed               │
 │  staff: read-only            │  owner/manager only │  1 row per open day  │    │  Public holidays may differ│
 └──────────────────────────────┘  + audit (trigger)  └──────────┬───────────┘    └─────────────▲─────────────┘
                                                                  │ live listings only           │
                                                     api.listing_hours(uuid)  ─── catalogue_server (Hyperdrive CATALOGUE_DB)
                                                     owner: listing_projection
```

## 2. Decision: one period per day in v1 (no split hours)

**Recommendation: v1 stores one opening period per day. Split hours (e.g. 08:00–12:00 and 13:00–17:00) wait.** Recorded as **D-095**.

| | One period (v1) | Split periods |
|---|---|---|
| Schema | Unchanged (`unique (listing_public_id, day)`) | Migration: a `period` column, new unique key, an overlap check |
| `clean_hours`, `provider_submit`, drafts | Unchanged | All change, and existing drafts need a conversion |
| Form | 7 rows, each a switch and two times | A variable list per day: "Add a break", remove buttons, harder with no JS and on a phone |
| Customer value | Covers most car businesses (workshops, washes, mobile mechanics) | Mainly lunch closures |

**Why:** the schema, the parser and the existing drafts all already assume one period, so v1 ships without a table migration and with a simpler form. A later split is additive (add `period smallint default 1`, swap the unique key to `(listing_public_id, day, period)`), and the public function can return the same row shape plus a period number. A business that closes for lunch can say so in its description until then.

**No midnight crossing in v1, for the same reason:** `check (closes > opens)` and the open-now logic stay simple when a period lives inside one calendar day. A 22:00–02:00 business would enter 22:00–23:59 on one day and 00:00–02:00 on the next. Very few car businesses keep those hours; a later change can allow `closes < opens` to mean "next day".

## 3. Provider editor (shared component)

One component, `OpeningHoursEditor` (`app/ui/OpeningHours.tsx`), replaces `DayToggles` and is used in both places (§4).

```
 Desktop (≥ 640 px)                                       Phone
┌────────────────────────────────────────────────────┐   ┌─────────────────────────────┐
│ Monday     [● Open ]   Opens [08:00 ▾]  Closes [17:00 ▾]│ │ Monday            [● Open ] │
│ Tuesday    [● Open ]   Opens [08:00 ▾]  Closes [17:00 ▾]│ │ Opens [08:00▾] Closes[17:00▾]│
│ …                                                    │   │ Tuesday           [● Open ] │
│ Saturday   [● Open ]   Opens [08:00 ▾]  Closes [13:00 ▾]│ │ …                           │
│ Sunday     [  Closed]  (times dimmed, ignored)       │   │ Sunday            [ Closed] │
│                                                      │   │                             │
│ ( Copy Monday to weekdays )                          │   │ ( Copy Monday to weekdays ) │
└────────────────────────────────────────────────────┘   └─────────────────────────────┘
```

- **A row per day, Mon–Sun.** Each row is a `<fieldset>` with the day as its `<legend>`, a `cx-switch` labelled "Open on Monday", and two selects labelled "Monday opens" and "Monday closes" (visible "Opens"/"Closes" text plus the day in a visually hidden span, so screen readers hear the full label).
- **Field names:** `open-1` … `open-7` (checkbox), `opens-1` … `opens-7`, `closes-1` … `closes-7`. Closed days keep their selects (so switching back on remembers the times), and the server ignores times for closed days. CSS (`.cx-hours-row:has(.cx-switch input:not(:checked))`) dims a closed row's times without any JavaScript.
- **Defaults** (no saved hours): Mon–Fri 08:00–17:00, Sat 08:00–13:00, Sun closed. Most businesses press "Save" and adjust one row.
- **Times:** 30-minute steps from 00:00 to 23:30, plus 23:59 shown as "23:59 (midnight)". Today's list is 05:00–22:00, too narrow for 24-hour washes. Pick, don't type (D-088).
- **"Copy Monday to weekdays":** a submit button `name="hoursAction" value="copy-monday"`. The server copies Monday's switch and times to Tue–Fri and redraws the form **without saving**, so it works with no JavaScript. With JavaScript the same post runs through React Router (one code path).
- **Validation** (one parser, `parseHoursForm` in `app/onboarding/hours.ts`, unit-tested), with a message per row:
  - times must be in the list; closing must be after opening ("Monday: closing time must be after opening time.");
  - the About step needs at least one open day (as today); the edit screen allows "closed all week", which the customer sees as "Hours not provided".
- **Layout:** `cx-hours` grid; the day and switch share a line, times wrap below on phones; 44 px targets; `cx-` tokens only.

## 4. Where it's used

### 4a. Onboarding "About" step (before approval)

`provider.get-listed.$step.tsx` swaps `DayToggles` for the editor and `parseStep("about")` calls `parseHoursForm`. It still saves through `provider_save_draft` → `clean_hours`, so **no database change**. Existing drafts (one shared pair of times) load per day as they are. The Check step lists each day ("Mon 08:00–17:00 · … · Sun closed"). `DayToggles` stays for staff working days (its `days` toggles are reused there).

### 4b. New provider edit screen (after listing)

- Route `provider/hours/:publicId` (`routes/provider.hours.$publicId.tsx`), linked as **"Opening hours"** from each listing card on `/provider` and as a task in the Finish setup hub.
- **Owner and manager** see the editor. **Staff** see a read-only table ("Only owners and managers can change opening hours.") and a POST from staff is refused (403). Non-members get 404. Signed-out users go to sign-in. `Cache-Control: private, no-store`; CSRF on the form.
- The loader reads `listings` and `listing_hours` with the caller's JWT (existing member RLS).
- The action calls `public.set_listing_hours(p_listing, p)`, the invoker wrapper of
  `private.set_listing_hours(p_listing uuid, p jsonb) returns void`, **SECURITY DEFINER**, `search_path = ''`, the same pattern as `set_team_settings`:
  1. `auth.uid()` required, else `not_allowed` (42501);
  2. lock the listing row (`for update`) and take its `organisation_id`; unknown listing → `not_allowed` (no existence leak);
  3. `private.has_org_role(org, array['owner','manager'])`, else `not_allowed` (staff and other organisations);
  4. `private.clean_hours(p)` (bad input → 22023);
  5. **write only the difference:** delete days now closed, upsert days whose times changed. The existing `catalogue_audit` trigger writes one `audit_log` row per changed day with the actor (`auth.uid()`) and empty details. `audit_log` is trigger-only by design, so no hand-written audit row.
  - Grants: `revoke all` from `public, anon, authenticated, service_role` on both, then `grant execute … to authenticated` on both (like the other onboarding functions).
- **Changes apply immediately, with no re-review. Why that's OK:** hours are structured values checked by `clean_hours` (a day number and two times), with no free text, links or contact details, which are what admin review exists for. Free-text changes (name, description) keep going through review. Every change is audited and admins can still suspend a listing. **Flag:** a business could publish misleading hours; that's the same risk as a business keeping bad hours on its own website, and customers confirm before travelling.

## 5. Customer view on `/p/:publicId`

```
┌ Opening hours ─────────────────────────────┐
│ ● Open now · closes 17:00                  │  ← status chip (ok tone); "Closed · opens Mon 08:00" in quiet tone
│                                            │
│  Mon   08:00 – 17:00                       │
│  Tue   08:00 – 17:00      ◄ Today (bold, tinted row, "Today" text)
│  Wed   08:00 – 17:00                       │
│  Thu   08:00 – 17:00                       │
│  Fri   08:00 – 17:00                       │
│  Sat   08:00 – 13:00                       │
│  Sun   Closed                              │
│                                            │
│ Times are South African time. Public       │
│ holiday hours may differ; check with the   │
│ business before you travel.                │
└────────────────────────────────────────────┘
```

- **A 7-day `<table>`** (caption "Opening hours", `scope="row"` day headers). Today's row is bold with a tint **and** the word "Today" (not colour alone), and has `aria-current="date"`.
- **Status line**, computed in `Africa/Johannesburg` with `Intl.DateTimeFormat` (no DST; UTC+2 all year), by a pure function `openStatus(hours, now)` in `app/catalogue/hours.ts`:
  - open now → "Open now · closes 17:00";
  - closed, opens later today → "Closed · opens today 13:00";
  - closed otherwise → "Closed · opens Mon 08:00" (the next open day within 7 days);
  - open at the opening minute, closed at the closing minute (`opens ≤ now < closes`); 23:59 counts as open to the end of the day.
- **No hours** → "Hours not provided." (no table, no status).
- **Hours couldn't be read** (no `CATALOGUE_DB` binding, or the database is slow) → "Opening hours aren't available right now." The rest of the page still renders: hours never turn the listing page into a 503.
- The page is already `private, no-store` (it carries a CSRF token), so the status is fresh on every load. **The cache stays as it is today.**

### Data path (no `anon` access to `listing_hours`)

- `api.listing_hours(p_listing uuid) returns table(day smallint, opens text, closes text)`, `language sql stable security definer`, owner **`listing_projection`**, `execute` granted to **`catalogue_server` only**, the `api.search_listings` pattern (grant before the ownership transfer; temporary `set` membership for `postgres` then removed).
- `listing_projection` gets `select (listing_public_id, day, opens, closes)` on `listing_hours` (no `id`, no `organisation_id`) and an RLS policy `catalogue_projection` that passes only rows whose listing is `live`. The function also joins `listings` on `status = 'live'` (two locks on the same door).
- Times leave the database as `HH:MM` text (`to_char(opens, 'HH24:MI')`).
- Worker side: `app/server/catalogue/hours.ts` `createHoursReader(connectionString)` (the `search/db.ts` pattern: one `pg` client per call, 3 s connect, 2 s statement timeout), imported lazily. The `/p/:publicId` loader reads the listing and the hours **in parallel**, and validates rows (`day` 1–7, `HH:MM`) before use.

## 6. Tests

| Kind | File | What |
|---|---|---|
| pgTAP | `supabase/tests/database/52_opening_hours.test.sql` | `api.listing_hours`: `catalogue_server` can execute; `anon`, `authenticated` and `service_role` can't; `catalogue_server` can't select `listing_hours` directly; returns a live listing's hours; returns nothing for `submitted` and `suspended` listings. `set_listing_hours`: owner and manager succeed; staff, another organisation's owner, a signed-out caller and an unknown listing are refused with `not_allowed`; bad input (closes before opens, repeated day, day 8, bad time) refused; only changed days are written and each change has an audit row with the actor. |
| Unit | `app/onboarding/hours.test.ts` | The per-day parser: defaults, closed days ignored, closes ≤ opens refused per row, unknown time refused, at-least-one-day rule for onboarding only, "copy Monday" result, old drafts load. |
| Unit | `app/catalogue/hours.test.ts` | `openStatus`: open, before opening, after closing, exactly at open/close, 23:59, Sunday → Monday wrap, all closed, no hours; **timezones**: the same instant gives the SAST answer whether the server runs in UTC or another zone (e.g. 22:30 UTC Sunday = 00:30 SAST Monday). |
| Unit | `app/ui/ui.test.tsx` (add) | Editor renders labelled controls; table marks today with text and `aria-current`. |
| Integration | `integration/pages.test.ts` (add) | `/p/:id` shows the table through the real `catalogue_server` login; "Hours not provided" for a listing without hours; page still 200 without the binding. |
| Integration | `integration/team.test.ts` or new `hours.test.ts` | Edit screen: owner saves, staff sees read-only and is refused on POST, other org gets 404. |
| Playwright | `scripts/hours-e2e.ts` | One journey: an owner signs in, opens Opening hours, closes Saturday at 13:00, uses "Copy Monday to weekdays", saves; the public page shows the new table with today marked. Runs locally against the production build like the other `*-e2e.ts` scripts (CI has no browser). |

## 7. Migration and staging apply order

One new migration, `supabase/migrations/20261114090000_opening_hours.sql` (no table changes, so no data backfill):

1. `grant select (listing_public_id, day, opens, closes) on public.listing_hours to listing_projection;` plus the `catalogue_projection` policy on `listing_hours` (live listings only).
2. `private.set_listing_hours(uuid, jsonb)` and the `public.set_listing_hours(uuid, jsonb)` invoker wrapper, with revokes and `authenticated` grants.
3. `api.listing_hours(uuid)`: create, revoke from everyone, grant `execute` to `catalogue_server`, transfer the owner to `listing_projection` (temporary `create on schema api` and `set` membership, both removed at the end).

**Staging (coordinator):** apply the single migration file exactly as merged on `main` (the build PR's message will paste the SQL). It is safe on a live database: it adds functions, a column grant and a policy, and changes no rows. **Order:** migration first, then the Worker that calls it; until the Worker deploys, nothing calls the new functions. If the Worker deploys first, the listing page shows "Opening hours aren't available right now" and the editor reports a save problem; nothing breaks. No role password, Hyperdrive or secret changes: `catalogue_server` already logs in through `CATALOGUE_DB`.

## 8. Build order (branch `claude/per-day-hours`)

1. Migration + pgTAP (§7, §6).
2. Parser and `openStatus` + unit tests.
3. `OpeningHoursEditor` + CSS; About step; Check step summary.
4. Edit screen, links from `/provider` and the setup hub.
5. Listing page hours (reader, loader, table) + integration tests.
6. Playwright journey; `pnpm run check`, pgTAP and integration locally; PR into `main`, marked ready, template filled. The coordinator reviews and merges.
