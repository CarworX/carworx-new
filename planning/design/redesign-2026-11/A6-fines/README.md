# A6 · Fines journey

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-20, B-21, B-22, D-099 (O-2, O-3) (see `planning/claude/BACKLOG.md` on `claude/backlog`, PR #163).

## States

| State | Source | Screenshots |
|---|---|---|
| Fines: verify your ID | [`a6-1-verify-id.html`](a6-1-verify-id.html) | [1280](png/a6-1-verify-id-1280.png) · [390](png/a6-1-verify-id-390.png) |
| Fines: ID pending review | [`a6-2-pending-review.html`](a6-2-pending-review.html) | [1280](png/a6-2-pending-review-1280.png) · [390](png/a6-2-pending-review-390.png) |
| Fines: ID rejected with reason | [`a6-3-rejected.html`](a6-3-rejected.html) | [1280](png/a6-3-rejected-1280.png) · [390](png/a6-3-rejected-390.png) |
| My fines: several | [`a6-4-my-fines.html`](a6-4-my-fines.html) | [1280](png/a6-4-my-fines-1280.png) · [390](png/a6-4-my-fines-390.png) |
| My fines: none | [`a6-5-my-fines-none.html`](a6-5-my-fines-none.html) | [1280](png/a6-5-my-fines-none-1280.png) · [390](png/a6-5-my-fines-none-390.png) |
| My fines: only not-payable fines | [`a6-6-my-fines-not-payable.html`](a6-6-my-fines-not-payable.html) | [1280](png/a6-6-my-fines-not-payable-1280.png) · [390](png/a6-6-my-fines-not-payable-390.png) |
| Fine detail | [`a6-7-fine-detail.html`](a6-7-fine-detail.html) | [1280](png/a6-7-fine-detail-1280.png) · [390](png/a6-7-fine-detail-390.png) |
| Pay: handoff to partner checkout | [`a6-8-pay-handoff.html`](a6-8-pay-handoff.html) | [1280](png/a6-8-pay-handoff-1280.png) · [390](png/a6-8-pay-handoff-390.png) |
| Pay: awaiting issuer confirmation | [`a6-9-awaiting-issuer.html`](a6-9-awaiting-issuer.html) | [1280](png/a6-9-awaiting-issuer-1280.png) · [390](png/a6-9-awaiting-issuer-390.png) |
| Receipt | [`a6-10-receipt.html`](a6-10-receipt.html) | [1280](png/a6-10-receipt-1280.png) · [390](png/a6-10-receipt-390.png) |

## Design notes (why)

- **Verify ID (a6-1):** ID number + one photo (smart ID front, green ID book photo page or driver's licence). The **privacy note is part of the form, not a link**: encrypted, only the last 4 digits shown, only the verification team sees the photo and views are logged, used only for fines, deletable. An explicit consent tick sits right above the button. *(Retention period and Information Officer details still need the owner/legal answer from B-21.)*
- **Pending (a6-2)** and **rejected (a6-3)** use the same status layout with the existing state illustrations. Rejected always shows the **reason from the reviewer** and how to fix it, and tells the person the photo was deleted.
- **My fines (a6-4):** totals first (to settle, open, saving if paid early), then one card per fine with issuer, place, date, status chip and amount (strike-through when discounted). Fines that **can't be paid online** sit in their own muted group with the reason.
- **None (a6-5)** is a calm empty state; **only not-payable (a6-6)** explains what to do next with the issuer and court.
- **Fine detail (a6-7):** every field in plain rows, an *In plain words* explanation, and a sticky pay box with the breakdown.
- **Pay (a6-8):** a visible handoff (CarworX → payment partner) that says CarworX never sees the card, then *Continue to secure checkout*. The partner is unnamed until O-2 is signed.
- **Awaiting issuer (a6-9):** three steps; the fine is only marked *Paid* after the issuer confirms (B-22: settle on the partner callback, never on the browser return).
- **Receipt (a6-10):** a torn-edge receipt with a PAID stamp, both timestamps in SAST, references, PDF and email.
