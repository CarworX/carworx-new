# Claude — 25: branded transactional emails (plan)

**Date:** 2026-11-13 (SAST). **Author:** Claude (email design sub-session). **Status:** plan; merged under D-091, reviewed after merge.

**Owner request (2026-11-13):** branded transactional emails in the CarworX design system (real fonts and brand styling, not plain text). The owner picks a direction, then the set is finished and wired up so real emails use it.

**Rules:** D-014 (Resend outbox), D-087 (noreply commits), D-091 (build and merge authority, review after merge), the design system's README and `tokens.json`, POPIA and ECTA (footer), PLAN §9.1 (no personal data in logs).
**Out of scope:** real sends, DNS, accounts, deploys, spending (all owner-only).

## 1. The flow, in one picture

```
   design system card            repo templates                 who sends it
 ┌────────────────────┐   ┌───────────────────────────────┐   ┌────────────────────────┐
 │ Emails: A · B · C  │──►│ supabase/templates/*.html     │──►│ Supabase Auth → Resend │  verify, reset
 │ owner picks one    │   │ (Go template, inlined CSS)    │   │ SMTP (custom SMTP)     │
 │ then 9 email cards │   ├───────────────────────────────┤   ├────────────────────────┤
 └────────────────────┘   │ apps/web/app/server/          │──►│ app mail outbox (O5,   │  the other 7
                          │   mail-templates/  (new)      │   │ Codex) → Resend API    │
                          │   render(kind, data) →        │   └────────────────────────┘
                          │   { subject, html, text }     │
                          └───────────────────────────────┘
```

Why two senders: Supabase Auth already owns the sign-up and reset tokens, so those templates must live in Supabase. Everything else is produced by the app and goes through Codex's encrypted outbox, which keeps idempotency, retries and bounce handling (D-014).

## 2. Sender and replies

| Field | Value | Why |
|---|---|---|
| From | `CarworX <no-reply@carworx.app>` | One sender for every email, so people learn to trust it |
| Reply-To | `support@carworx.app` | A reply reaches a person instead of bouncing |
| Return path / DKIM | Resend's on `carworx.app` (owner task, §7) | SPF, DKIM and DMARC alignment, D-014 |

Today `MAIL_FROM` must match `MAIL_SENDING_DOMAIN`; `no-reply@carworx.app` does. The outbox needs a `reply_to` field added (Codex, §6).

## 3. The nine emails

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

Notes:
- Booking confirmed and receipt fire on the same event; they stay two emails because a receipt is a record people file, and a confirmation is something they act on.
- Demo businesses show a **DEMO** tag beside the business name, and synthetic data only in every preview and test.
- Security code (O5 `security_code`) stays plain and short; it gets the shared frame but no extra design (not in the owner's nine).
- Open for the owner: does the business also get an "enquiry received" email, or only the in-app inbox? Default: in-app only until they say.

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
| Supabase templates | `supabase/templates/confirmation.html`, `recovery.html` (Go-template vars kept) | Claude |
| Renderers | `apps/web/app/server/mail-templates/` (new folder): `render(kind, data) → { subject, html, text }`, one module per email, a shared frame | Claude |
| Tests | Render each with synthetic data; check escaping of every user field, the plain-text part, one primary action, no `<img>` pixel, no `http:` links | Claude |
| Outbox wiring | Add the new kinds to `MailMessage` and its validator, add `reply_to`, send `html` + `text` from `render()` | **Codex** (outbox internals are Codex's lane; Claude doesn't edit them) |
| SMTP config | `[auth.email.smtp]` in `config.toml` stays commented; hosted values are an owner task | Owner |

## 7. Owner tasks (none done by agents)

1. In Resend, add and verify the domain `carworx.app` (the DNS records Resend gives: SPF, DKIM, and a DMARC record).
2. Create the mailboxes or aliases `no-reply@carworx.app` (can discard) and `support@carworx.app` (must reach a person).
3. In the Supabase dashboard (staging, then production): turn on custom SMTP with Resend's SMTP host and an API key, sender `no-reply@carworx.app`.
4. Answer OQ-L2 so the footer placeholders can be filled.
5. Pick direction A, B, C or a mix in the design system's Emails card.

## 8. Milestones

1. This plan (docs PR, merge on green CI).
2. Emails card with directions A, B and C (verify + receipt each) in the design system. **Stop for the owner's choice.**
3. All nine in the chosen direction as cards; unchosen directions removed.
4. Build PR (`claude/branded-emails`), with the Codex hand-off paragraph.
