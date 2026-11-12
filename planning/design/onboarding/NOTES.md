# Business onboarding concepts: notes

> **LOCKED by the owner, 2026-11-12 (SAST),** for the build plan: the 2 + 3 + 5 direction, the gliding segmented bar, desktop option A (rail and bar), two-phase onboarding (Get approved → Finish setup), staff join, History, settings and sign-out for every user, filter and tab swipe bars, CarworX-styled authenticator QR codes, and the owner-chosen team two-step rule with email fallback. The admin designs build on these ([`admin/`](admin/index.html)).

**Status:** exploration, 2026-11-11 (SAST). Brief: [BRIEF.md](BRIEF.md). Board: [index.html](index.html). Design files only; no product code changed.

## How they are built

- `_shared/tokens.css` is a browser copy of `apps/web/app/styles/tokens.generated.css` (only Tailwind's `@theme static` block becomes `:root`). `_shared/studio.css` is an exact copy of `studio.css`. The fonts and the lockup are copied too.
- `_shared/kit.css` adds the onboarding pieces on top of Studio: pick chips, choice tiles, toggles, day toggles, a slider, the map pin, the listing card, review and status screens. Every colour is a Studio token, and every text and edge pair is one already in `contrast-pairs.ts`.
- `_shared/kit.js` holds one set of question definitions and a small step engine: Next, Back, branching (`data-if`), validation stubs (`data-require`), progress, the step rail and deep links (`#step-id`). Each concept is only its layout and CSS on top. `?preset=fixed|mobile|both|claim` fills synthetic answers for demos and screenshots.
- Keyboard: Tab order follows the page; **Enter** is Next (except in a text box or on a button), **Esc** is Back. Focus moves to the new step's heading. The map takes Enter (drop a pin) and the arrow keys (move it). On a single-choice question, auto-advance happens only after a tap or click, never on arrow keys.

## Typed fields (target: 2 or fewer)

| Journey | Typed fields | Everything else |
|---|---|---|
| New business (all 5 concepts) | **2**: business name, one "about" line (with 7 tap-to-add starter phrases) | Chips (role, team size, services, document type), tiles (new or claim, where you serve customers, evidence), dropdown (metro), day toggles and time pickers (hours), slider (radius), calendar (trading since, document date), map pin or "Use my location", toggle (18+), consent checkbox |
| Claim (all 5 concepts) | **0** | The typed "document reference" becomes a document-type chip plus a calendar date |

**"Where do you serve customers?" is pick one or both** (owner, 2026-11-11): "They come to me" and/or "I go to them". Both means the flow asks for the premises pin (public) and the private base and radius (never shown). The public line then reads "Saxonwold, Johannesburg · also comes to you".

**Privacy choices.** No ID numbers (banned) and **no date of birth**: CarworX has no need for it, and collecting it adds POPIA risk. The age check is an "I'm 18 or older" toggle. *The owner can overrule this.* Business dates use a calendar. A10 holds everywhere: a mobile base and radius appear only on the business's own screens, with a "Private" note, and never in the listing preview, review's public line or the live card. "Premises visited" is offered only to businesses with premises. Labels show only after an admin ticks them.

**Map.** A synthetic street map (inline SVG, "not to scale") and the browser's own geolocation. No hosted or paid geocoding. In the prototype, "Use my location" only places the pin at the map centre and sends nothing.

## The five concepts

### 1 · One thing at a time (`one-thing/`)
One question per full screen in big type, with a thin progress bar and Next/Back fixed at the bottom. Single-choice picks move on by themselves when tapped. It is the calmest on a phone and the simplest to build (one component per question), but it is the most screens (12 for fixed or mobile, 13 for both) and hides what's left beyond "7 of 12".
**Pros:** calm, mobile-first, very low cognitive load. **Cons:** most taps; weak overview.

### 2 · Guided stepper (`stepper/`)
Six named steps (Business → Service → Location → About → Check → Send) with the existing `StepList` look as the rail. Done steps turn ink; on phones the rail collapses to a segmented bar with the step name. A claim swaps Service/Location/About for one "Proof" step.
**Pros:** clearest orientation; fewest pages; strong on desktop. **Cons:** pages get long on phones; feels most like a form.

### 3 · Live preview (`live-preview/`)
Each answer builds the public listing card inside a phone frame beside the question, and the changed part flashes. On phones the preview docks at the top as a one-line summary that expands on tap. The review step shows the finished card.
**Pros:** shows why each answer matters; makes the public vs private line (A10) visible. **Cons:** most layout work; the preview competes for space on small phones.

### 4 · Conversational (`chat/`)
CarworX asks in friendly bubbles ("Where do customers find you? Pick one or both.") and your answers stack up as a thread, each with a Change link. Back is "Undo". On phones only the last two exchanges show.
**Pros:** warmest; good for first-time or less confident owners. **Cons:** slowest for confident users; chat patterns are harder to make fully accessible to screen readers.

### 5 · Setup checklist (`checklist/`)
A short welcome, then a "Get set up" hub with a progress ring and four tasks: Details, Location, Proof, Team (a claim has Your listing, Proof, Team). Each task is its own 1–3 step Next/Back flow that returns to the hub. "Review and send" unlocks when every task is done. Answers save on the device (localStorage), so you can stop and come back.
**Pros:** resumable, any order; grows into the business dashboard after approval. **Cons:** one extra level (hub, then task); a real build needs a saved-draft model on the server.

## Shared states (all five)

- **Submitted:** a tick, the time sent in SAST, and "What happens next" in the `StepList` look: Sent (you) → An admin checks it (CarworX) → You're live → Your first request (2 business hours to accept).
- **Waiting dashboard:** "Waiting for review" label, "Not in search yet", what the admin checks (each label "to do"), what you can do meanwhile, and the listing as customers will see it. No invented review time: "We'll email your sign-in address when it's reviewed."
- **Approved / live:** "You're live", the labels earned, the live card, and next tasks. Reached in the demo with "Demo: see it approved".

## Owner direction (2026-11-11, SAST)

The owner liked **2 · Guided stepper**, **3 · Live preview** and **5 · Setup checklist**, and asked to proceed with them. The grounded direction for the build plan:

| Piece | Comes from | What it does |
|---|---|---|
| Frame | 5 · Checklist | Welcome → new or claim → "Get set up" hub with tasks (Details, Location, Proof, Team). Resumable; any order; becomes the business dashboard after approval |
| Inside each task | 2 · Stepper | Named steps with the `StepList` rail on desktop and a segmented bar on phones; Next/Back on every page |
| Progress indicator | 2 · Stepper (phone view) | **Owner's pick (2026-11-12):** the segmented bar. One segment per step (done and current in ink, upcoming in `canvas-2`), the step name on the left and "3 of 6" in mono on the right. Use it at every width and inside every checklist task, in place of the thin bar from concepts 1 and 3. It **glides**: Next fills left to right, Back drains right to left, and jumps chain (spec and evidence in [progress/](progress/README.md)). |
| Feedback | 3 · Live preview | The public listing card builds beside the questions (docked on phones) and sits on the hub; makes A10's public vs private line visible |
| Shared, unchanged | All | Pick-don't-type controls (2 typed fields, 0 for a claim), "pick one or both" for where you serve customers, the 18+ toggle (no date of birth), the submitted, waiting and live states |

Open for the build plan: server-side drafts for "stop and come back" (today's prototype uses localStorage), and whether Team invites stay "after approval".

## Two-phase onboarding and staff (owner, 2026-11-12, SAST)

**Owner decisions**
1. **Managers can invite people** (as well as owners). Only the owner changes payment settings.
2. **Two separate experiences for owners.** Phase 1 **Get approved** is as short as possible (the flow above). Phase 2 **Finish setup** opens after approval: add staff and configure how the business works.
3. **The owner decides in Phase 2** whether the **customer** or an **owner/manager** picks the staff member for a booking, and **what staff can see** about customers.

**Prototypes**
- [`setup/`](setup/index.html), Phase 2 "Finish setup": approved screen → hub (progress ring) with four tasks: **Team** (invite: role → email or one-time link/QR → sent; team list with pending invites; or "It's just me for now"), **Who gets the booking** ("The customer picks", optionally with "Anyone available", or "We assign"), **What staff can see** (name and phone / first name only / booking details only), and **Cover photo**. "Later" cards (prices and durations, get paid, travel charges) show what opens with bookings in Phase 3. The listing stays live whatever is unfinished.
- [`staff/`](staff/index.html), staff join: invite (one-time, expires in 7 days) → sign in with **their own** account → 2–3 short steps (services they work on, days they work, and their **first name only if the business lets customers pick**) → staff home (requests, what they can and can't do, their details). Demo switches: `?pick=customer|assign&contact=phone|first|none&role=Staff|Manager`.
- Both use the approved gliding segmented bar.

**Typed fields:** an invite is 1 typed field (email), or 0 with a link. A staff join is 0 typed fields, or 1 (first name) when customers pick.

**Desktop (owner, 2026-11-12): option A.** The stepper keeps the step rail beside the gliding bar on desktop (`progress/desktop-A-bar-and-rail.png`). On phones the bar alone replaces the rail.

## Location for everyone (owner, 2026-11-12)

Every map pin (premises and private mobile base, in every concept) now offers three ways in:
1. **Search for an exact address or place** and pick a result (an ARIA combobox: arrow keys move, Enter picks, Esc closes). The prototype uses synthetic results. In the product this is D-082's server-side temporary geocoding: used once to choose a point, never stored.
2. **Use my location** first shows a CarworX card explaining why ("used once to place your pin; we don't track you or keep your device's location"). Only **Allow** triggers the browser's own permission prompt; **Not now** returns to search or tap.
3. **Tap the map** (keyboard: Enter, then the arrow keys).

The search is optional, so the typed-field count (2) is unchanged. A10 still holds: a searched base stays private.

## History in the menu (owner, 2026-11-12)

[`history/`](history/index.html) is a read-only record in the business menu, designed now for when bookings open (Phase 3). For review, the role is set in the address only (no on-screen switcher): `?as=owner|manager|staff&tab=bookings|assign|team&b=B-1042`.

| | Owner | Manager | Staff |
|---|---|---|---|
| Menu | Today, Requests, History, Team, Listing, Settings | Today, Requests, History, Team, Listing | Today, Requests, History |
| Bookings | Every booking | Every booking | Their own, including ones moved away from them |
| Assignments | Every assign and reassign: who, by whom, when, why | Same | Their own |
| Team changes | Invites, acceptances, setting changes | Same | — |
| Customer details | Full name and number | Full | As the owner set (demo: first name only) |
| Filters | Status chips, date range (calendar), team member, Download CSV | Same | Status chips, date range |

Each booking opens a timeline with an actor chip and the time in SAST: request → accepted (within 2 business hours) → assigned or picked by the customer → paid on the payment partner's page (15-minute hold) → reassigned (with reason) → completed, cancelled or declined. Repairs show the written quote (valid 7 days) and its approval. The record can't be edited or deleted (append-only), which matches the admin audit log approach.

## Recommendation (before the owner's pick)

**Use 5 as the frame, 1 inside the tasks, and 3's card on the hub.** The checklist is the only concept that is resumable by design, and its hub becomes the business dashboard after approval (team, photos, booking requests), so the build gets two screens from one. Inside each task, concept 1's one-question screens keep phones calm. Concept 3's live card on the hub shows people what they are building. If one concept must be picked unchanged, pick **2 (stepper)**: it is the cheapest to build from today's form and the clearest about where you are.

## Not done here

- No server drafts, emails or admin screens (admin concepts come next).
- Concepts 1, 2, 3 and 4 do not save between visits; only 5 shows that.
- Screenshots are synthetic (`<concept>/shots/`, 390 × 844 at 2×, plus one desktop thumbnail each).

## Owner rules, 2026-11-12 (SAST): no stacked buttons; settings and sign-out for every user

**1. Filters and tabs never stack (corrected by the owner the same day: filters and tabs only).** Filter groups (such as History's status filters, dates and team member) and tab bars are **one unified pill bar on one line** that **scrolls sideways** (swipe, trackpad, wheel, Tab), with an edge fade where there is more and the chosen item kept in view (`.ob-filterbar`, `.cx-tabs`, `.ob-scrollrow` in `_shared/kit.css`; `bars()` in `kit.js`). **Setup and onboarding choices (services, days, roles, phrases, documents) keep wrapping as normal chips.**

**2. Every user's menu has settings and Sign out** ([`account/`](account/index.html), shared menu in `_shared/shell.js`). Desktop: an avatar button opens Profile and settings, Security and two-step sign-in, and Sign out. Phone: the same items sit at the bottom of the menu sheet.

| Settings tab | Driver | Staff | Manager | Owner |
|---|---|---|---|---|
| Profile (name, verified email, optional mobile, photo) | ✓ | ✓ (photo shown if customers pick staff) | ✓ | ✓ |
| Security: **two-step sign-in** (authenticator app or passkey, recovery codes), password, passkey sign-in, signed-in devices and "sign out of all other devices" | Recommended | Recommended | Strongly recommended | **Required before changing payment settings** (when payments open) |
| Notifications (email now; SMS and WhatsApp later; news and offers off unless turned on) | Bookings, quotes | Requests, assigned to me | Requests, team changes | Requests, team changes |
| Privacy and data (download my data, what I agreed to, delete account) | ✓ | ✓ | ✓ | ✓ (must transfer ownership or close the listing first) |
| Your work (services, days, leave the team) | — | ✓ | — | — |
| Business (team and roles, who gets the booking, listing details, leave) | — | — | ✓ | ✓ plus what staff can see, payments (later), transfer ownership, close the listing |

For review, the role is set in the address only: `account/index.html?as=driver|staff|manager|owner&tab=…`. The "view as" switchers were removed (owner, 2026-11-12).

**Two-step sign-in uses the person's own authenticator app** (owner, 2026-11-12), for example Microsoft Authenticator or Google Authenticator. Steps, on the approved gliding bar: get an app → scan your code → enter the 6-digit code → save recovery codes. A wrong code or the unticked "I've saved my codes" box blocks the next step.
- **No connector needed.** It is the open TOTP standard (RFC 6238), and the app already enrols it through Supabase Auth (D-042, `apps/web/app/auth/routes/mfa.tsx`). Each enrolment makes a **new secret and `otpauth://` link for that one person**, so every code is unique and never reused.
- **CarworX-styled QR code:** round dot modules, rounded corner "eyes", and the CarworX mark in a white circle in the centre, at error-correction level H (about 30% recovery) so the mark never stops it scanning. The prototype codes (`account/qr-demo.svg` for a synthetic `otpauth://` link; `setup/qr-invite.svg` for the invite link) were made offline and **decoded successfully** at 600 and 220 px. In the build, draw the same style from Supabase's `totp.uri` instead of its default `qr_code` SVG, in the browser only. Never log or store the secret, and never send it to a third-party QR service. A QR encoder library is a build-plan choice (pin the version).
- **Recovery codes:** Supabase Auth has no built-in recovery codes. The build plan chooses between custom single-use codes (stored hashed) or asking people to add a second authenticator device.
- Passkey sign-in was dropped from this round. "Sign out" confirms on screen and points to Security to sign out everywhere.

**Owner answers (2026-11-12):**
1. **Owners are not forced** to use two-step sign-in (it is recommended), payment settings included.
2. **Ownership transfer has no two-step condition.**
3. **The owner decides** whether two-step sign-in is **optional**, **required for managers**, or **required for everyone**. This is a fifth "Finish setup" task, *Team sign-in security* (`setup/#s-mfa`), and it shows on the owner's Business tab. When it is required: the staff join flow adds a "Set up two-step sign-in" step (`staff/?teamMfa=all`); a manager's or staff member's Security tab shows "Required by Shine Bay Car Wash" with a prompt to turn it on, and they can't turn it off.
4. **Email fallback.** If someone has trouble with their authenticator app, they can get a sign-in code **by email** instead (`account/sign-in.html`: "Trouble with your app? Email me a code instead"). The setup's last step is now "Your backup": email backup on, with recovery codes optional.

*Security trade-off for the build plan:* if the password reset also goes to the same email, an email code makes the second step only as strong as the email account. Mitigations to consider: email codes only after the correct password, 10-minute single-use codes with rate limits, and an email alert "someone signed in with an email code". Supabase Auth's MFA factors are TOTP and phone, so the email code is custom work (for example the existing email OTP, used as a step-up).

## Money: earnings for businesses, Money for admins (owner, 2026-11-12, SAST)

One shared component (`_shared/money.js`, styles in `kit.css`), designed with the dataviz method: stat tiles for the figures, a column chart for change over time, ranked bars for breakdowns, and a table view.
- **At a glance:** an all-time hero figure ("Earned on CarworX, all time"; for admins, "Booking value through CarworX, all time").
- **Period:** one filter bar above everything: **Past week · Past month · Past year · Custom** (calendar From and To). Every tile, the chart and the breakdowns use the same period, so the numbers always agree. A reversed custom range is caught.
- **Change vs the previous period of the same length:** past week vs the 7 days before it, past month vs the previous 30 days, past year vs the previous 365 days, custom vs the same length just before. Each tile shows an **arrow, a sign and a percentage** (green up, red down, grey no change), so it is never colour alone, plus the previous value. With nothing in the previous period it says "New this period".
- **Chart:** columns per day (31 days or fewer), per week (120 days or fewer) or per month, drawn at the card's real width. Every column has a hover **and keyboard** tooltip (value first, then date and bookings). "Show as table" gives the same numbers without the chart. Studio blue passes the palette validator against both the surface and the canvas.

| Who | Where | What they see |
|---|---|---|
| Owner, manager | Menu → **Earnings** ([`earnings/`](earnings/index.html)) | Earned, completed bookings, average booking (each with its change); earned per day, week or month; by service; by team member |
| CarworX admin | Today: past-month booking value with its change → **Money** ([`admin/#money`](admin/index.html#money)) | Booking value, **CarworX fees (R0 in the pilot)**, completed bookings, active businesses (with changes); booking value over time; top businesses (open one to see its record); by service category |
| CarworX admin | A business's record ([`admin/#business=KG`](admin/index.html#business=KG)) | That business's earnings, same period controls |

*Honest framing:* money goes straight to each business through the payment partner, and CarworX never holds it. So "how much CarworX has made" is its **fees**, which are R0 during the pilot. The admin view therefore leads with **booking value** (the total customers paid businesses) and shows fees separately. The figures need bookings and the payment partner's records (Phase 3); the prototype uses synthetic data as if bookings had run since November 2024.

*For the owner to confirm:* staff don't see Earnings (only owners and managers do).
