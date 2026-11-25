# A6 · Fines journey

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-20, B-21, B-22, D-099; owner choice 25 Nov: Didit "Option A" (O-3) (see `planning/claude/BACKLOG.md`).

## States

| State | Source | Screenshots |
|---|---|---|
| Fines: verify your ID, intro | [`a6-1-verify-intro.html`](a6-1-verify-intro.html) | [1280](png/a6-1-verify-intro-1280.png) · [390](png/a6-1-verify-intro-390.png) |
| Fines: back from Didit, checking | [`a6-2-checking.html`](a6-2-checking.html) | [1280](png/a6-2-checking-1280.png) · [390](png/a6-2-checking-390.png) |
| Fines: verified | [`a6-3-approved.html`](a6-3-approved.html) | [1280](png/a6-3-approved-1280.png) · [390](png/a6-3-approved-390.png) |
| Fines: declined with reason, retry | [`a6-4-declined-retry.html`](a6-4-declined-retry.html) | [1280](png/a6-4-declined-retry-1280.png) · [390](png/a6-4-declined-retry-390.png) |
| Fines: declined, no tries left | [`a6-5-declined-final.html`](a6-5-declined-final.html) | [1280](png/a6-5-declined-final-1280.png) · [390](png/a6-5-declined-final-390.png) |
| Fines: in review by our team | [`a6-6-in-review.html`](a6-6-in-review.html) | [1280](png/a6-6-in-review-1280.png) · [390](png/a6-6-in-review-390.png) |
| My fines: several | [`a6-7-my-fines.html`](a6-7-my-fines.html) | [1280](png/a6-7-my-fines-1280.png) · [390](png/a6-7-my-fines-390.png) |
| My fines: none | [`a6-8-my-fines-none.html`](a6-8-my-fines-none.html) | [1280](png/a6-8-my-fines-none-1280.png) · [390](png/a6-8-my-fines-none-390.png) |
| My fines: only not-payable fines | [`a6-9-my-fines-not-payable.html`](a6-9-my-fines-not-payable.html) | [1280](png/a6-9-my-fines-not-payable-1280.png) · [390](png/a6-9-my-fines-not-payable-390.png) |
| Fine detail | [`a6-10-fine-detail.html`](a6-10-fine-detail.html) | [1280](png/a6-10-fine-detail-1280.png) · [390](png/a6-10-fine-detail-390.png) |
| Pay: handoff to partner checkout | [`a6-11-pay-handoff.html`](a6-11-pay-handoff.html) | [1280](png/a6-11-pay-handoff-1280.png) · [390](png/a6-11-pay-handoff-390.png) |
| Pay: awaiting issuer confirmation | [`a6-12-awaiting-issuer.html`](a6-12-awaiting-issuer.html) | [1280](png/a6-12-awaiting-issuer-1280.png) · [390](png/a6-12-awaiting-issuer-390.png) |
| Receipt | [`a6-13-receipt.html`](a6-13-receipt.html) | [1280](png/a6-13-receipt-1280.png) · [390](png/a6-13-receipt-390.png) |

## Design notes (why)

**Revised 25 Nov 2026 (SAST):** the owner chose Didit "Option A". The person photographs their ID and takes a selfie inside **Didit's hosted screen**; Didit checks the document, liveness and face match. CarworX never receives or stores the ID photo or selfie, only the result and the last 4 digits. The earlier "upload ID photo" screen is gone.

- **Intro (a6-1):** why we ask, the three steps (photograph ID, selfie, come back), the three accepted documents, and a privacy note naming Didit as our verification partner and saying exactly what CarworX keeps. Explicit consent tick, then *Start verification*. On a computer, Didit offers a code to continue on the phone.
- **Checking (a6-2):** the return screen. The turbine spins inside a progress ring ("this usually takes under a minute"); the person can leave, and we email the result.
- **Approved (a6-3):** "You're verified", then straight to the fines.
- **Declined (a6-4):** Didit's reason in plain words and how to fix it, with a **3-try meter** (1 of 3 used) and *Try again*.
- **Declined, no tries left (a6-5):** support takes over, with a reference number. Three tries stops endless retries and limits spend per person.
- **In review (a6-6):** Didit asked for a second look; our team decides (A7) within one business day.
- **My fines (a6-7)**, **none (a6-8)**, **only not payable (a6-9):** totals first, one card per fine, not-payable fines grouped apart with what to do.
- **Fine detail (a6-10):** every field, an *In plain words* note and the pay box.
- **Pay (a6-11):** a visible handoff to the payment partner's secure checkout (partner unnamed until O-2).
- **Awaiting issuer (a6-12):** *Paid* shows only after the issuer confirms (B-22: settle on the partner callback, never on the browser return).
- **Receipt (a6-13):** PAID stamp, SAST times, references, PDF and email.
