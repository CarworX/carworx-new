# Claude — 18: Paystack vs Yoco for CarworX payments (research, partial)

**Date:** 2026-11-10. **Author:** Claude, under D-076. **Status:** PARTIAL RESEARCH, for Codex review.
No accounts, sign-ups or spending. Every fact below cites an official page read on 2026-11-10. Anything a page doesn't state is marked **NOT DOCUMENTED**. Nothing is filled in from memory.

## 1. What CarworX needs (D-050, D-054)

**The flow we need:**
```
customer pays once ──▶ gateway ──┬──▶ provider's share   (settled to the provider)
                                 └──▶ CarworX 10%, capped at R500 (settled to CarworX)
refund / dispute ──▶ reverse both shares; recover from the provider's future payouts if needed (D-050)
```

**What we have to check:**

| # | Requirement | Why |
|---|---|---|
| R1 | One payment split automatically between the provider and CarworX | D-054 commission; no wallets or escrow (v1 scope) |
| R2 | A platform share that can be capped (R500) | D-054 |
| R3 | Provider onboarding (subaccount or connected merchant) | One account per provider (G-PROVIDER) |
| R4 | Full and partial refunds by API | A29 |
| R5 | Disputes and chargebacks visible by API or webhook | A24, A29 |
| R6 | Signed webhooks with replay protection | A24, A25 |
| R7 | Test mode covering payments **and** refunds | A35 sandbox |
| R8 | Fees and settlement timing in South Africa | Pricing (§17) |

## 2. Yoco — what the official docs say

| Req | Finding | Source |
|---|---|---|
| R1 / R2 | **NOT DOCUMENTED.** The developer docs index lists no split, marketplace, subaccount or platform-fee feature. The Checkout API takes one payment for one merchant | [llms.txt index](https://developer.yoco.com/llms.txt), [Checkout API](https://developer.yoco.com/docs/checkout-api.md) |
| R3 | Apps can act **on behalf of a merchant** through the OAuth 2.0 authorization code flow. Partner apps apply through a partnership form. Each provider would hold its own Yoco account | [OAuth 2.0](https://developer.yoco.com/docs/api/authentication/oauth.md), [Partner with Yoco](https://developer.yoco.com/partnerships.md) |
| R4 | Refunds by API (`POST /api/checkouts/{id}/refund` with `amount`). **Refunds need live keys**, so they can't be tested in test mode | [Refunding a payment](https://developer.yoco.com/guides/online-payments/refunding-a-payment.md) |
| R5 | **NOT DOCUMENTED.** The docs index has no dispute or chargeback pages | [llms.txt index](https://developer.yoco.com/llms.txt) |
| R6 | `webhook-id`, `webhook-timestamp` and `webhook-signature` headers; HMAC over `id.timestamp.body`; a 3-minute replay window is recommended; retries are re-signed. This is the same scheme our K2 hook already uses | [Verifying the events](https://developer.yoco.com/guides/online-payments/webhooks/verifying-the-events.md) |
| R7 | Test keys are available immediately, with test cards. Live keys are locked until a domain is verified. Test transactions don't show in reports. Minimum payment is R2.00 | [Testing](https://developer.yoco.com/docs/checkout-api/testing.md) |
| R8 | Fees: **NOT VERIFIED.** The pricing page renders in the browser and its numbers couldn't be read automatically. Payouts: `sent → paid` within hours or days, and can revert up to 5 business days after `paid` | [Payouts intro](https://developer.yoco.com/api-reference/yoco-api/payouts/introduction.md), [pricing](https://www.yoco.com/za/pricing/) |

## 3. Paystack — BLOCKED

`paystack.com` answered **403** to automated requests from this environment on 2026-11-10, so none of its docs could be read. PLAN §7 and D-012 already assume Paystack subaccount splits, but **those assumptions are not re-verified here**. To finish this section:
- **Option A (recommended):** Codex reads the official pages from its own environment and fills in this table with citations.
- **Option B:** the owner saves the pages as PDFs (split payments, multi-split, subaccounts, refunds, disputes, webhooks, ZA pricing) and adds them to the repo's `planning/research/` folder.

| Req | Finding | Source |
|---|---|---|
| R1–R8 | **PENDING**: not read | — |

## 4. Early read (not a recommendation yet)

- **Yoco's public docs don't show a way to split one payment between a provider and CarworX.** Without that, CarworX could only charge the D-054 commission by invoicing providers separately, or by collecting everything and paying providers out. Both conflict with the v1 rule of no wallets or escrow, and with D-054's single-payment split.
- **If Paystack's split and subaccount features are confirmed, Paystack fits D-054 as primary**, and Yoco becomes the backup or an in-person option. Ask Yoco directly (partnership form) whether a marketplace split exists outside the public docs.
- **The owner decides** after §3 is complete.

## 5. Questions

- **For Codex:** can you complete §3 with citations?
- **For the owner:** may we send Yoco's partnership team the question "Do you support split payouts for a marketplace?" You would send it; agents do no outreach.

Agent: claude
