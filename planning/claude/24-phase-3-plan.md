# Phase 3 plan: bookings, quotes and test payments

**Author:** Claude · **Date:** 2026-11-13 (SAST) · **For approval by:** Codex, then the owner
**Phase:** 3 in PLAN §3 ("Bookings and quotes (test payments)"). **Exit:** A18–A36 pass on staging.
**Hard limits (unchanged):** staging and synthetic data only; Paystack **test mode** only; no live money (G-PAY / G-LIVEPAY), no real email, no spending, no production.

## 0. Owner decisions for this phase (2026-11-13, SAST)

| # | Decision |
|---|---|
| P3-O1 | Start Phase 3 now, in parallel with the Phase 1/2 staging and launch work (as D-074 did for Phase 2). |
| P3-O2 | **Build first, test after.** No new tests are written until both agents have built every A18–A36 feature. Then both agents test, then review. |
| P3-O3 | **Separate lanes, no cross code review while building.** Only this plan is jointly agreed (Claude writes, Codex approves). |
| P3-O4 | All Phase 3 code lands on a shared **`phase-3`** branch. It merges into `main` only after the test-and-review round. `main` stays launch-safe. |
| P3-O5 | **Split: Claude = bookings, Codex = money and messaging** (section 3). |
| P3-O6 | The owner creates **Paystack test keys now** (section 8). |
| P3-O7 | **Full scope**: reviews, mobile travel and notifications all stay in. |

These override D-073 (reciprocal review per PR) **for `phase-3` only, until the review round**. `main` keeps D-073 and the green exact-head CI rule.

## 1. What Phase 3 delivers, in plain words

Customers book and pay for car services inside CarworX, and providers manage their time and quotes.

```
FIXED-PRICE SERVICE (e.g. a car wash)
customer picks a slot ─► provider accepts (≤ 2 business hours) ─► 15-minute hold ─► pays (Paystack) ─► confirmed
                                                                          └─ hold expires ─► slot freed; a late payment is reconciled, never silently confirmed

QUOTED REPAIR (e.g. a mechanic)
enquiry ─► (optional paid diagnostic) ─► provider sends quote v1 (expires in 7 days) ─► customer approves that exact version ─► hold ─► pay
                     revised quote v2 supersedes v1 ─┘                   work added later ─► separate change quote

AFTER BOOKING: reschedule (new slot reserved before the old is released) · cancel ─► refund · dispute · review
MOBILE PROVIDERS: travel band + buffer in the slot · full address shown only after confirmation, only to assigned staff, hidden 7 days after completion
```

## 2. Ground rules for building fast

1. **Branch.** `phase-3` is created from `main`. Each agent works on its own `claude/p3-*` or `codex/p3-*` branches and merges into `phase-3` itself when its slice builds. Merge `main` into `phase-3` regularly.
2. **CI still runs** on `phase-3` PRs: lint, format, typecheck, build and the **existing** Phase 1–2 suites. Why: it stops Phase 3 breaking the site we're about to launch. **New Phase 3 tests wait** for the test round (P3-O2).
3. **No editing the other lane's files.** The only shared surface is the contract in section 4. A contract change is a one-paragraph note on the plan PR, agreed by the other agent before either side relies on it.
4. **Migrations.** One migration file per slice, named `2026111xhhmmss_p3_<lane>_<topic>.sql`. Claude owns booking tables, Codex owns money tables. Neither alters the other's tables.
5. **Defaults from PLAN** (all PROPOSED, changeable by the owner): 2-business-hour acceptance (08:00–17:00 Mon–Sat, SA public holidays excluded), 15-minute hold, 7-day quote expiry, times stored in UTC and shown in Africa/Johannesburg, money in integer cents (ZAR minor units).

## 3. Who does what

| Area | Claude (bookings) | Codex (money and messaging) |
|---|---|---|
| Data | resources, capacity, schedules, closures, SA holidays, service offers (price, duration, buffer), booking requests, holds, bookings, quotes and versions, change quotes, reschedules, cancellations, travel bands, booking addresses | payment attempts, Paystack customers and subaccounts, integration events, payment effects, refunds, disputes, reconciliation cases, notification templates and jobs (on the O5 outbox), reviews |
| Server | availability search, acceptance deadline clock, atomic hold, hold expiry, quote lifecycle, reschedule, cancel request, travel and buffer, address-access rules | Paystack adapter (initialise, verify, refund), webhook ingest, effect applier, scheduled reconciliation, late-payment resolution, refund and dispute tooling, notification producer, review rules |
| Screens | customer: slot picker, booking request, quote view and approve, my bookings, reschedule, cancel. Provider: resources and capacity, hours and closures, request inbox, quote builder, schedule view, mobile settings | customer: checkout hand-off, payment result, refund status, leave a review. Provider: payouts and fees view. Admin: payments, reconciliation queue, refunds, disputes, reviews moderation, notification failures |
| A-tests owned | A18, A19, A20, A22, A27, A28, A30, A31, A34 | A21, A24, A25, A26, A32, A33, A35, A36 |
| Shared A-tests | **A23** (Codex detects the late payment; Claude offers rebook-if-available) · **A29** (Claude cancels; Codex refunds and handles the dispute) | (same) |

Why this line: it follows the database boundary. Bookings decide **what is reserved**; money decides **what was paid**. They meet only at the hold, through the contract below.

## 4. The contract between the lanes (the only shared surface)

All functions are `SECURITY DEFINER`, `search_path = ''`, in `private`, called only by the scoped server logins (the forms_server pattern), never from PostgREST.

**Bookings exposes (Claude):**

| Function | Returns / does |
|---|---|
| `private.hold_snapshot(p_hold uuid)` | `hold_id, booking_id, quote_version_id (nullable), organisation_id, amount_minor bigint, currency 'ZAR', expires_at, state`. The **only** source of the amount to charge. Read-only |
| `private.confirm_paid(p_hold uuid, p_payment_attempt uuid)` | Atomically confirms the booking if the hold is still active. Returns `'confirmed'`, `'already_confirmed'` (idempotent) or `'hold_expired'` (Codex then opens a reconciliation case). Never confirms an expired hold |
| `private.rebook_options(p_booking uuid)` | Slots still free for a late payer (A23) |
| `private.rebook_after_late_payment(p_booking uuid, p_slot ...)` | Reserves the chosen slot for an already-paid attempt |
| `private.booking_event` (table, insert-only) | `booking_id, kind, occurred_at, data jsonb` (no personal fields). Codex's notification producer reads it |

**Money exposes (Codex):**

| Function | Returns / does |
|---|---|
| `private.payment_state(p_booking uuid)` | `unpaid`, `pending`, `paid`, `partially_refunded`, `refunded`, `disputed` |
| `private.request_refund(p_booking uuid, p_amount_minor bigint, p_reason text, p_idempotency_key text)` | Records a refund request (many per payment allowed). Called by Claude's cancel flow |
| `private.payment_event` (table, insert-only) | `booking_id, kind, occurred_at`. Lets Claude's screens show payment state |

**Invariants both sides rely on:** one active hold per booking; one payable attempt per hold (re-initialising reuses it, A21); amount and currency always come from `hold_snapshot`; a browser redirect is never proof of payment.

## 5. Claude's build: bookings (in order)

| Slice | Content | A-tests |
|---|---|---|
| **C1 capacity core** | `resources` (bay / team / calendar, `capacity smallint ≥ 1`, default 1, D-057), `resource_schedules`, `resource_closures`, `sa_public_holidays` (seeded from the official list), `service_offers` (listing, price_minor, duration, buffer). **Hold design:** lock the resource row (`select … for update`), count active holds and bookings whose `tstzrange [start,end)` overlaps, refuse when the count reaches `capacity`. Why not per-seat exclusion rows: capacity N changes without rewriting rows, and the lock keeps it atomic. Adjacent `[a,b)` and `[b,c)` don't overlap by definition | A18, A19, A20 |
| **C2 request → accept → hold** | booking requests, acceptance deadline (business-hours clock with holidays), atomic accept that creates a 15-minute hold, hold expiry job (pg_cron or the Worker cron) that releases capacity, the `hold_snapshot` and `confirm_paid` contract | A21 (with Codex), A22 |
| **C3 quotes** | quotes, immutable `quote_versions` (expiry 7 days), approve-exact-version, supersede on revision, change quotes after payment | A27 |
| **C4 change and cancel** | reschedule (reserve new, then release old, in one transaction; show any price or travel difference), cancel request → `request_refund`, `rebook_options` for late payers | A28, A23, A29 |
| **C5 mobile** | travel bands (straight-line, labelled), provider-confirmed buffer added to the interval, manual timing when routing is unavailable, `booking_addresses` visible only to assigned staff after confirmation, hidden 7 days after completion, admin access audited | A30, A31 |
| **C6 membership** | revoked membership loses booking and quote access on the next request (builds on Phase 1) | A34 |
| **C7 screens** | the customer and provider screens in section 3, using the existing design system (`Booking.tsx`, `HoldDial.tsx` designs already exist) | — |

## 6. Codex's build: money and messaging (proposed order; Codex may re-sequence)

| Slice | Content | A-tests |
|---|---|---|
| **X1 Paystack adapter** | server-side initialise (hosted checkout, amount from `hold_snapshot`), verify, refund; test keys from the environment's network secrets; a local stand-in for CI | A21, A35 |
| **X2 events** | webhook route: HMAC over raw bytes, store the event durably **before** replying 200, dedupe by stable event id (otherwise type + object + transition), bad signature / amount / currency / reference rejected, verification outage → retried | A24, A25 |
| **X3 effects and recovery** | apply each business effect at most once (unique constraints and transactions), recovery after a crash between storing and applying | A24, A26 |
| **X4 reconciliation** | scheduled check of Paystack transactions, refunds and settlements; mismatches shown to operators; late payment after hold expiry → case → customer chooses rebook (Claude's `rebook_options`) or refund | A23 |
| **X5 refunds and disputes** | each refund its own row; partial refund plus dispute on one payment; duplicate refund requests collapse on the idempotency key | A29 |
| **X6 notifications** | booking and payment events → O5 outbox (same key within Resend's 24-hour window, flagged not resent after it, stale action emails suppressed, quota alert). No real sends: staging approved-recipient policy only | A32, A33 |
| **X7 reviews** | one review per completed booking; moderation; text kept de-identified after account closure (retention schedule) | — |
| **X8 screens and drill** | checkout hand-off, payment result, admin money screens; the A36 restore drill on the final Phase 3 schema (BK-1 is Codex's) | A36 |

## 7. Sequence (both lanes in parallel)

```
Day 0  plan approved ─► phase-3 branch created ─► owner Paystack test keys
Week 1  Claude C1–C2 (capacity, holds, contract)     ‖  Codex X1–X3 (adapter, webhooks, effects)
Week 2  Claude C3–C5 (quotes, reschedule, mobile)    ‖  Codex X4–X6 (reconciliation, refunds, notifications)
Week 3  Claude C6–C7 (membership, screens)           ‖  Codex X7–X8 (reviews, screens)
        ── both declare "built" ──
TEST ROUND   each agent writes and runs the tests for its own A-tests; then the shared A23, A29, A35 end to end on staging
REVIEW ROUND  Claude and Codex review each other's lane; fixes; phase-3 ─► main through a normal reviewed PR
```

Weeks are an order of work, not a promise; we move as fast as the build allows. Whichever lane finishes first starts its tests early only after the other lane says it's built (P3-O2).

## 8. Owner tasks

1. **Approve this plan** (after Codex's `REVIEW: APPROVE`).
2. **Paystack test keys (about 10 minutes).** Sign up at paystack.com as a South African business (test mode needs no documents). In the dashboard go to **Settings → API Keys & Webhooks**, stay in **Test Mode**, and copy the **test secret key** (starts `sk_test_`). When an agent asks, paste it into the secure Claude form for `api.paystack.co`, never into chat. The test public key (`pk_test_`) isn't secret. The webhook URL will be the staging address once staging is deployed.
3. Later, not now: company registration and live keys (D-049, G-PAY).

## 9. Risks and how we contain them

| Risk | Containment |
|---|---|
| Building without tests hides bugs until late | Strong database constraints from the start (they're design, not tests); the test round is mandatory before anything reaches `main` |
| The two lanes drift apart | One written contract (section 4); changes only by agreement on the plan PR |
| Double-booking under load | Row lock plus overlap count in one transaction; A18 races N+1 holds in the test round |
| A payment confirms an expired hold | `confirm_paid` refuses; late payments always go to reconciliation (A23) |
| Phase 3 breaks the free site | Separate `phase-3` branch; existing suites still run in CI on every `phase-3` PR |
| Real money or messages by mistake | Test keys only; no live keys exist until G-PAY; staging recipient policy blocks real email |

## 10. Approval

Codex records `REVIEW: APPROVE @<sha>` (or `CHANGES`) on the plan PR. On approval, Claude creates `phase-3` from `main`, and both lanes start.
