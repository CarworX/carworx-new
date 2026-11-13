# Claude — 25: branded transactional emails (plan)

**Date:** 2026-11-13 (SAST). **Author:** Claude (email design sub-session). **Status:** plan; merged under D-091, reviewed after merge. **Direction chosen by the owner (2026-11-13, via the coordinator): a mix of A, B and C (§1a).** Revised for the Codex review on #109 (staging Auth hook, §6).

**Owner request (2026-11-13):** branded transactional emails in the CarworX design system (real fonts and brand styling, not plain text). The owner picks a direction, then the set is finished and wired up so real emails use it.

**Rules:** D-014 (Resend outbox), D-087 (noreply commits), D-091 (build and merge authority, review after merge), the design system's README and `tokens.json`, POPIA and ECTA (footer), PLAN §9.1 (no personal data in logs).
**Out of scope:** real sends, DNS, accounts, deploys, spending (all owner-only).

## 1. The flow, in one picture

```
   design system card            repo templates                 who sends it
 ┌────────────────────┐   ┌───────────────────────────────┐   ┌────────────────────────┐
 │ Emails: A · B · C  │──►│ supabase/templates/*.html     │──►│ Supabase Auth → Resend │  verify, reset
 │ owner picks one    │   │ (Go template, inlined CSS)    │   │ prod SMTP; staging hook│
 │ then 9 email cards │   ├───────────────────────────────┤   ├────────────────────────┤
 └────────────────────┘   │ apps/web/app/server/          │──►│ app mail outbox (O5,   │  the other 7
                          │   mail-templates/  (new)      │   │ Codex) → Resend API    │
                          │   render(kind, data) →        │   └────────────────────────┘
                          │   { subject, html, text }     │
                          └───────────────────────────────┘
```

Why two senders: Supabase Auth already owns the sign-up and reset tokens, so those templates live in Supabase (production custom SMTP and local), and on staging the D-068 Send Email Hook renders the same design through the shared renderer (§6). Everything else is produced by the app and goes through Codex's encrypted outbox, which keeps idempotency, retries and bounce handling (D-014).

## 1a. The chosen direction: ink band, paper letter, signal countdown

The owner chose a mix of the three concepts:

| Part | Taken from | What it is |
|---|---|---|
| Header | **A · Ink band** | A full-width `ink` band with the white horizontal lockup (`carworx-lockup-horizontal-on-ink.png`) and, where useful, the reference in Geist Mono on the right |
| Body | **B · Paper letter** | `paper` (#f4efe6) ground, letter-like, thin rules, no boxed cards. Receipts and invoices are a white Geist Mono **ticket with dashed tear lines** |
| Deadlines | **C · Studio desk** | The `peach` chip with a `signal` live dot ("Link expires in 24 h") on anything with a deadline: verify and reset links, invites (7 days), booking holds (15 min), quote expiry (7 days), the provider's accept-by time. Signal only for deadlines; buttons stay ink; `blue`/`sky` only for confirmed |

```
┌──────────────────────────────────────┐
│████ CarworX ████████████ CX-2048 ████│  ← A: ink band
├──────────────────────────────────────┤
│  ● Link expires in 24 h              │  ← C: signal chip, deadlines only
│  Confirm your email                  │
│  your account is one tap away.       │  ← B: paper letter
│  ( Confirm my email )  ink button    │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │  ← B: mono ticket (receipts)
│  ───────────────────────────────     │
│  footer: sender, legal, Privacy      │
└──────────────────────────────────────┘
```

## 2. Sender and replies

| Field | Value | Why |
|---|---|---|
| From | `CarworX <no-reply@carworx.app>` | One sender for every email, so people learn to trust it |
| Reply-To | `support@carworx.app` | A reply reaches a person instead of bouncing |
| Return path / DKIM | Resend's on `carworx.app` (owner task, §7) | SPF, DKIM and DMARC alignment, D-014 |

Today `MAIL_FROM` must match `MAIL_SENDING_DOMAIN`; `no-reply@carworx.app` does. The outbox needs a `reply_to` field added (Codex, §6).

## 3. The emails (the nine, plus welcomes)

Times are SAST, written `14:32` and `Sat 31 Oct, 09:00`. Money is `R2 430` in Geist Mono. One primary action per email, always ink.

| # | Email | Trigger | To | Subject | Key facts shown | Primary action | Sender |
|---|---|---|---|---|---|---|---|
| 1 | Sign-up verification | Supabase sign-up (`confirmation`) | New user | Confirm your CarworX email | The address being confirmed; link lifetime | Confirm email | Supabase Auth |
| 2 | Password reset | Supabase recovery (`recovery`) | Account owner | Reset your CarworX password | Requested time; link lifetime; "ignore if not you" | Choose a new password | Supabase Auth |
| 3 | Team invite | Owner invites a member (O5 `invite`, exists) | Invitee | You're invited to join {business} on CarworX | Business, inviter's first name, role, expiry `Sat 31 Oct, 09:00` | Accept invite | Outbox |
| 4 | Enquiry received | Customer sends an enquiry (Bundle B form) | Customer | We've sent your enquiry to {business} | Business, service, reference `ENQ-7K2Q`, what happens next, typical reply time | View enquiry | Outbox |
| 5 | Booking request | Customer requests a slot (Phase 3 C2) | Provider | New booking request: {service}, {date} | Service, slot, vehicle, price, **accept-by countdown chip (signal)** | Review request | Outbox |
| 6 | Booking confirmed | Payment verified (Phase 3 X3) | Customer | Booking confirmed: {service}, {date} | **Confirmed chip (blue)**, business, slot, address, reference, amount paid | View booking | Outbox |
| 7 | Reschedule | Either side moves a booking (C4) | Customer and provider | Your booking moved to {date} | Old slot struck through, new slot, who moved it, reference | View booking | Outbox |
| 8 | Cancellation and refund | Booking cancelled (C5 / X5) | Customer | Booking cancelled: refund of R{amount} | Who cancelled, refund amount, fee kept (if any), refund timing in business days, reference | View refund | Outbox |
| 9 | Payment receipt | Payment verified (X3) | Customer | Your CarworX receipt {ref} | Ticket of line items, VAT line where the business is VAT-registered, total, method `Card ••4242`, paid time, reference | View receipt | Outbox |

**Welcome emails (owner, 2026-11-13).** One per kind of user, sent once, after verification or approval, each with one primary action:

| # | Email | Trigger | Subject | Key facts | Primary action | Sender |
|---|---|---|---|---|---|---|
| 10 | Welcome, customer | First sign-in after the email is verified | Welcome to CarworX | Three steps: find, enquire, book; "you never pay CarworX" | Find a car service | Outbox |
| 11a | Welcome, business: application received | Provider application submitted (Bundle A) | We've received your CarworX application | What we check, typical review time, that the listing stays hidden until approved | View your application | Outbox |
| 11b | Welcome, business: approved | Admin approves the application | {business} is live on CarworX | The live listing link, three next steps (hours, services, invite your team) | Open your dashboard | Outbox |
| 12 | Welcome, team member | Invite accepted (O5) | You've joined {business} on CarworX | Role (manager or staff), what that role can do, who invited them | Open your dashboard | Outbox |
| 13 | Welcome, admin | Admin role granted | Finish setting up your CarworX admin access | Two-step sign-in (aal2) is required before any admin page opens | Set up two-step sign-in | Outbox |

The admin welcome makes sense only as an aal2 set-up prompt, so it is that and nothing else.

Notes:
- Booking confirmed and receipt fire on the same event; they stay two emails because a receipt is a record people file, and a confirmation is something they act on.
- Demo businesses show a **DEMO** tag beside the business name, and synthetic data only in every preview and test.
- Security code (O5 `security_code`) stays plain and short; it gets the shared frame but no extra design (not in the owner's nine).
- Open for the owner: does the business also get an "enquiry received" email, or only the in-app inbox? Default: in-app only until they say.

## 3a. Downloadable receipts and invoices (PDF)

Every receipt or invoice email carries a **Download PDF** link (a text link, so the ink button stays the one primary action). Attaching the PDF too is optional and off by default: attachments raise spam scores and Resend's size limits, and the link always serves the current, correct document.

| Document | Seller on it | Buyer | Lines | Reference | Sent with |
|---|---|---|---|---|---|
| **(a) Customer receipt** | **The provider** (D-012 direct split settlement: the provider is the supplier, CarworX is the platform) | Customer | Services and quote versions, travel band, total, method, paid time; "CarworX never holds the money" | `CX-` + booking payment ref | Email 9 |
| **(b) CarworX invoice to the provider** | **CarworX** | Provider | Commission at 10% capped at R500 per job (D-054), per paid booking or monthly statement; "taken through the split" | `CXI-` + sequence | A monthly statement email (new, after G-PAY) |

**Layout:** A4 printable in the same style: the ink band header, the paper body, the mono ticket, the legal block, page numbers. No signal (nothing on paper counts down).

**Route:** `GET /receipts/:ref.pdf` and `GET /provider/invoices/:ref.pdf`, signed-in only, owner of the record only (the customer for (a); a member of the business with money access for (b)), `Cache-Control: private, no-store`, `Content-Disposition: attachment`, a 404 for anyone else (never a 403 that confirms the record exists). Rendered **server-side in the Worker** from the same data the email uses; no third-party PDF service, no personal data in logs or URLs beyond the opaque reference.

**Owner questions (not guessed, D-047 says the accountant reviews):**
- **OQ-E1:** is CarworX VAT-registered at launch? If so, invoice (b) must be a full **tax invoice** under the VAT Act s20(4) (the words "tax invoice", CarworX's and the provider's names, addresses and VAT numbers, a serial number, date, description, value, VAT and total), or an abridged one under s20(5) below the threshold.
- **OQ-E2:** for receipt (a), which providers are VAT-registered? A VAT-registered provider must issue its own tax invoice; does CarworX issue it **on the provider's behalf** (needs a written agreement under s20(2)) or is ours only a payment receipt? Default until answered: a **receipt, not a tax invoice**, saying so in words.
- **OQ-E3:** invoice (b): per job or a monthly statement? Default: monthly.
- **OQ-E4:** record retention for these PDFs (the Tax Administration Act's five years is the likely floor; see the retention schedule).

Invoice (b) only matters once commission starts (D-054: after company registration, G-PAY and a free pilot), so its build waits; its design is done now so the style is settled.

## 4. Email-client constraints (why the templates look old-fashioned inside)

| Constraint | What we do | Why |
|---|---|---|
| Gmail strips `<style>` in some views; Outlook uses Word's renderer | Table layout, **inline styles** on every element; a small `<style>` only for dark mode and mobile tweaks | Survives every major client |
| Web fonts | `Geist` via `@font-face` from `carworx.app`, stack `Geist, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`; mono falls back to `ui-monospace, Menlo, Consolas, monospace` | Apple Mail and iOS show Geist; Gmail and Outlook fall back cleanly |
| Logos | Hosted **PNG** at 2x from `planning/design/brand/exports/core/`, with `width`/`height` and `alt="CarworX"` | Gmail and Outlook don't render SVG |
| Dark mode | `color-scheme: light dark`, `prefers-color-scheme` overrides; lockup in a version that reads on both grounds | Apple Mail and Outlook invert otherwise and the ink button can vanish |
| Width | 600 px max, fluid below | The long-standing safe width |
| Tap targets | Buttons at least 44 px high, bulletproof (table cell + link), with the URL also in plain text below | Mobile thumbs; works with images off |
| Tracking | **No pixels, no click-tracking redirects**; Resend open and click tracking off | POPIA minimal processing; also stops scanners breaking links |
| Preheader | A hidden first line with the key fact | Inbox preview reads well |
| Plain text | Every app email also ships a `text/plain` part with the same facts and the URL | Accessibility, spam scoring, and today's outbox |
| Escaping | Every user-supplied field (business name, names, service, notes) HTML-escaped; URLs built only from our origin plus validated tokens | No injection through a business name |

## 5. Legal footer

Every email ends with:
- `CarworX (Pty) Ltd · [registration number, OQ-L2] · [physical address, OQ-L2]` (placeholders until the owner answers OQ-L2; ECTA s43 and POPIA s18 need the name and address).
- "You're getting this because {reason}." and a link to `/privacy`.
- "Replies go to support@carworx.app."

**No marketing unsubscribe link.** These are transactional messages the person needs for an account or booking they asked for. POPIA s69 (direct marketing) and the CPA opt-out rules apply to marketing, not to service messages; adding an unsubscribe would suggest people can stop receiving receipts or password resets, which they can't. If CarworX ever sends marketing, it goes from a different stream with its own consent and unsubscribe.

## 6. Build and hand-off

Branch `claude/branded-emails` (after the owner picks a direction):

| Part | Path | Owner |
|---|---|---|
| Supabase templates | `supabase/templates/confirmation.html`, `recovery.html` (Go-template vars kept): used by **local** Supabase and by **production custom SMTP** | Claude |
| Staging Auth hook | On staging the D-068 Send Email Hook (`scripts/ops/env/auth-email/handler.js`) builds its own subject, text and HTML and never reads the Supabase templates. Claude ships `renderAuthEmail(action, link)` in the renderers; **Codex** swaps the hook's message construction (lines 103–114) to call it, keeping the signature check, the approved-recipient allowlist and the `token_hash` checks exactly as they are. The hook stays on for staging | Claude (renderer), Codex (hook) |
| Renderers | `apps/web/app/server/mail-templates/` (new folder): `render(kind, data) → { subject, html, text }`, one module per email, a shared frame; `renderAuthEmail` for the hook | Claude |
| PDF renderer and routes | `renderReceiptPdf`, later `renderInvoicePdf`; the two routes in §3a | Claude (after the email set) |
| Tests | Render each with synthetic data; check escaping of every user field, the plain-text part, one primary action, no `<img>` pixel, no `http:` links | Claude |
| Outbox wiring | Add the new kinds to `MailMessage` and its validator, add `reply_to`, send `html` + `text` from `render()` | **Codex** (outbox internals are Codex's lane; Claude doesn't edit them) |
| SMTP config | `[auth.email.smtp]` in `config.toml` stays commented; hosted values are an owner task | Owner |

## 7. Owner tasks (none done by agents)

1. In Resend, add and verify the domain `carworx.app` (the DNS records Resend gives: SPF, DKIM, and a DMARC record).
2. Create the mailboxes or aliases `no-reply@carworx.app` (can discard) and `support@carworx.app` (must reach a person).
3. **Production only:** in the Supabase dashboard, turn on custom SMTP with Resend's SMTP host and an API key, sender `no-reply@carworx.app`. Staging keeps the D-068 Send Email Hook (it enforces the approved-recipient list), branded through the shared renderer (§6).
4. Answer OQ-L2 so the footer placeholders can be filled.
5. ~~Pick a direction~~ Done: the A/B/C mix (§1a).
6. Answer OQ-E1 to OQ-E4 (§3a) with the accountant.

## 8. Milestones

1. This plan (docs PR, merge on green CI).
2. Emails card with directions A, B and C in the design system. Done; the owner chose the mix.
3. The full set in the chosen style as design-system cards: the nine, the welcomes, and the PDF receipt and invoice layouts. The options card is replaced; A, B and C are credited in its README.
4. Build PR (`claude/branded-emails`), with the Codex hand-off paragraph.
