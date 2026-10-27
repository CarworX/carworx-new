# Payments: Paystack for a South African marketplace

Researched by Claude, 2026-10-27. Paystack's own docs and pricing pages blocked automated fetching (HTTP 403). **Codex: please confirm the items below marked UNVERIFIED.**

## What is confirmed

- **South African local card fee: 2.9% + R1.00, excl. VAT.** Paystack's support table lists **EFT at 2%** ([Paystack support: transaction charges](https://support.paystack.com/hc/en-us/articles/360009881920-What-are-Paystack-s-transaction-charges)).
- Merchants can absorb fees or pass them to customers ([Paystack support](https://support.paystack.com/hc/en-us/articles/360009973579-Can-I-pass-the-transaction-charges-to-my-customers-)).
- **Subaccounts and split payments exist.** Each provider gets a subaccount holding their bank details. A transaction can name a subaccount, and Paystack splits it between the platform and the provider. A `bearer` setting decides who pays Paystack's fee. There are also multi-split "transaction splits" across several subaccounts ([developer write-up](https://dev.to/beven_spangenberg/paystack-multi-vendor-split-payments-306d); official docs at paystack.com/docs/payments/split-payments).

## UNVERIFIED, needs confirming

1. Whether subaccounts and splits are fully supported for **South African** businesses (they started in Nigeria and Ghana).
2. Settlement timing for South African subaccounts (one third-party source says about T+1 for splits).
3. Whether there's an extra fee for splits or for Transfers (payouts) in South Africa.
4. Requirements to go live in South Africa: CIPC registration, business bank account, director ID (→ owner question Q-005).
5. Refund mechanics when a transaction was split: does the refund come out of the provider's share or the platform's?

## The key design choice: split at payment time, or hold and pay out later?

| | **A. Split at payment** (subaccounts) | **B. Collect, then pay out** (Transfers API after the job is done) |
|---|---|---|
| How it works | The provider's share settles straight to the provider | Everything settles to CarworX, which pays providers once the service is completed |
| Customer protection | Weak: the provider already has the money if the job goes wrong | Strong: a no-show or dispute can be refunded before payout |
| CarworX's legal exposure | Lower: CarworX never holds provider funds | Higher: holding third-party funds can look like payment facilitation or escrow under SA rules (**UNVERIFIED**; needs a professional opinion) |
| Engineering | Simpler | Needs a payout ledger, a schedule and reconciliation |
| Fits | Low-value, instant services (car wash) | High-value jobs (repairs, glass) |

**Claude's lean:** start with **A (split at payment)**, using a cancellation policy and a deposit model for high-value jobs, for example booking deposit now, balance at the workshop. Move to B only after a legal opinion. Debate this as topic T-07.

## Other local payment considerations

- Many South Africans prefer instant EFT (Ozow-style flows) over cards. Paystack lists an EFT channel. Confirm which EFT and bank options appear at a South African checkout.
- Repairs and maintenance are often paid at the workshop after a quote. The booking flow may need "pay deposit online, pay balance in person" rather than full prepayment.
