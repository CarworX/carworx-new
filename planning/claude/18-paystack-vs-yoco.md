# Claude — 18: Paystack vs Yoco for CarworX payments (research, partial)

**Date:** 2026-11-10. **Author:** Claude, under D-076. **Status:** RESEARCH, for Codex review. Paystack §3 is by Codex.
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

## 3. Paystack — official documentation checked by Codex

Checked 2026-11-10. The table distinguishes documented API capabilities from the CarworX implementation inference and the remaining commercial confirmation.

| Req | Finding | Official source |
|---|---|---|
| R1 | Split payments share a transaction's settlement with a subaccount. Multi-split supports the merchant payout account and one or more subaccounts, using flat or percentage shares. | [Split payments](https://paystack.com/docs/payments/split-payments/), [Multi-split](https://paystack.com/docs/payments/multi-split-payments/) |
| R2 | `transaction_charge` overrides the percentage split with a flat amount paid to the main account. **CarworX inference:** calculate the agreed 10% capped at R500 in integer currency subunits on the server, then pass that amount. This is an application calculation, subject to ZA onboarding and fee-bearer confirmation. | [Flat fee](https://paystack.com/docs/payments/split-payments/#flat-fee), [Transaction initialization](https://paystack.com/docs/api/transaction/#initialize) |
| R3 | Subaccounts can be created in the dashboard or through the API. The API accepts business name, settlement bank, account number and percentage charge. These fields alone do not establish each provider's onboarding eligibility. | [Subaccount API](https://paystack.com/docs/api/subaccount/), [Split payments](https://paystack.com/docs/payments/split-payments/) |
| R4 | Refund API takes a transaction reference/ID and optional amount in currency subunits. Omitting the amount defaults to the original amount, and the amount cannot exceed it. Processing is asynchronous and exposes statuses and refund events. | [Refund API](https://paystack.com/docs/api/refund/), [Refund lifecycle](https://paystack.com/docs/payments/refunds/) |
| R5 | Dispute management includes receipt/evidence submission and accepting or declining chargebacks. Events include `charge.dispute.create`, `charge.dispute.remind` and `charge.dispute.resolve`. | [Manage disputes](https://paystack.com/docs/payments/manage-disputes/), [Dispute API](https://paystack.com/docs/api/dispute/) |
| R6 | The current guide documents `Paystack-Signature` with a signed timestamp, HMAC SHA512 over timestamp + dot + raw bytes, and a 300-second tolerance. It also documents legacy `x-paystack-signature`, which signs the raw body with the API secret and has no timestamp. Select verification from the integration's actual headers and retain durable event deduplication for retries. | [Webhook verification and retries](https://paystack.com/docs/payments/webhooks/) |
| R7 | Test payments and test cards are documented. The refund guide documents test-key retrieval of test refunds. **Unverified for CarworX:** end-to-end ZA split, partial/full refund and dispute scenarios in A35. Documentation examples do not supply executed sandbox evidence. | [Test payments](https://paystack.com/docs/payments/test-payments/), [Refunds](https://paystack.com/docs/payments/refunds/) |
| R8 | ZA published pricing lists local transactions at 2.9% + R1 excluding VAT, with the R1 waived below R10. Capitec Pay and Ozow EFT are listed at 2% without a flat fee. International transactions are 3.1% + R1 excluding VAT. Published payout timing is two working days. The split guide permits the subaccount to bear transaction charges if its share is sufficient. | [ZA pricing and payout timing](https://paystack.com/za/pricing/), [Fee bearer](https://paystack.com/docs/payments/split-payments/#bearer-of-transaction-fee) |

**D-050 / G-LIVEPAY remains open.** The reviewed split and refund documentation does not establish how both parties' shares are clawed back after settlement, who funds a refund or chargeback shortfall, or whether CarworX can recover the provider's liability from later payouts. Obtain Paystack's written confirmation of those marketplace arrangements before live activation. The API capabilities above support further evaluation, while those commercial mechanics remain unverified. [Split settlement model](https://paystack.com/docs/payments/split-payments/), [Refund lifecycle](https://paystack.com/docs/payments/refunds/), [Dispute handling](https://paystack.com/docs/payments/manage-disputes/)
## 4. Early read (not a recommendation yet)

| | Paystack | Yoco |
|---|---|---|
| R1/R2 split with capped CarworX share | **Documented** (subaccount split plus flat `transaction_charge`; cap calculated on the server) | **Unresolved**: not in the public docs. It isn't ruled out, and it isn't established |
| R4/R7 refunds testable in sandbox | Documented for test keys; A35 still needs executed evidence | **No**: refunds need live keys |
| D-050 recovery after settlement | **Unverified**: needs Paystack's written confirmation | Unverified |

- **Paystack is the only candidate whose public docs cover D-054's single-payment split.** It still needs the D-050 commercial confirmation (claw-back, shortfall funding, recovery from future payouts) before G-LIVEPAY.
- **Yoco's compatibility is unresolved.** It isn't named as a working backup until R1/R2 are confirmed, for example through Yoco's partnership team, and the live-key-only refund testing has an acceptable test plan.
- **The owner choice stays open.** Questions to put to each provider are in §5.

### Independent check of §3 (Claude, 2026-11-10)

**Access limits.**
- paystack.com returns **403** to this environment's direct requests, and the web-reading tool can't resolve the host. So the prose pages Codex cited could not be read.
- Instead, Claude checked §3 against Paystack's own public repository of the code samples shown in those docs: [PaystackOSS/doc-code-snippets](https://github.com/PaystackOSS/doc-code-snippets), commit `d0e625c` (2026-11-02), under `src/doc/payments/`.
- Samples prove the request and event shapes. They don't prove prose rules, pricing or commercial terms.

| Req | Verdict | Evidence (path in that repo) |
|---|---|---|
| R1 | **Confirmed (API shape)**. Single split via `subaccount` on initialize. Multi-split via `POST /split` with `type`, `currency` and `subaccounts[{subaccount, share}]` | `split-payment/initialize`, `multi-split/create-split` |
| R2 | **Confirmed (API shape)**. `transaction_charge` (flat, in subunits) on initialize. Calculating the R500 cap on the server is our inference, as §3 says | `split-payment/flat-fee` |
| R3 | **Confirmed, with a correction**. `POST /subaccount` takes `business_name`, **`bank_code`**, `account_number` and `percentage_charge`. §3's "settlement bank" corresponds to `bank_code` in the sample | `split-payment/create-subaccount` |
| R4 | **Confirmed**. Partial or full refunds. With no `amount` it's treated as a full refund, and the amount "cannot be more than the original transaction amount". Your own refund `reference` (8–64 characters) is idempotent: a repeat returns **409**. Statuses are pending, processing, needs-attention, failed and processed. On `failed`, "your account now reflects the credited amount" | Owner PDFs: Refund API, Refunds guide; plus `refunds/create-refund` |
| R5 | **Confirmed**. List pending disputes, upload evidence (signed URL valid for 30 min; jpg, jpeg or pdf), add evidence for fraud claims, and resolve as `merchant-accepted` (full or partial amount) or `declined`. `charge.dispute.remind` arrives **every 4 hours**. **Disputes must be handled within 16 hours, or Paystack accepts them automatically and refunds "from your Paystack Balance"** | Owner PDF: Manage Disputes; plus `webhooks/events/charge-dispute-*` |
| R6 | **Confirmed, with detail added**. The `paystack-signature` header is `t=<unix>,v1=<kid>:<hex>`. It is HMAC-SHA512 over `t + "." + rawBody`, with a 300 s tolerance, using a **dedicated webhook signing secret (`whsec_…`) with key IDs for rotation**, not the API secret. Legacy `x-paystack-signature` is HMAC-SHA512 of the raw body with the secret key. For K2-style code: verify on the raw bytes, compare in constant time, and support several `v1` entries | `webhooks/verifying-signature`, `webhooks/verifying-transaction` (added in that repo's PR #141, merged 2026-11-02) |
| R7 | **Confirmed**. Test cards for success, PIN, OTP and declines. Dedicated test cards and EFT accounts produce `failed` and `needs-attention` refund outcomes. Test and live are separate environments, and test refunds are listed with the test key. Not shown: split-specific test behaviour, so A35 still needs executed evidence | Owner PDFs: Test Payments, Refunds guide |
| R8 | **Confirmed**. Local: **2.9% + ZAR 1 excluding VAT**, ZAR 1 waived under ZAR 10. Capitec Pay and Ozow EFT: **2%, no flat fee**. International: **3.1% + ZAR 1 excluding VAT**, settled in Rand. Transfers to bank accounts: **ZAR 3 each, failed or successful**. Payout: **2 working days** after payment | Owner PDF: paystack.com/za/pricing |

**Owner-saved pages (2026-11-10, 13:53–13:56 SAST).** The owner printed the five pages to PDF, and Claude read them. The originals stay with the owner and aren't committed, to keep large binaries out of Git. SHA-256:

| Page | SHA-256 |
|---|---|
| paystack.com/za/pricing | `38b1b70ed5eff6ee835eb7dddac92a19b815f21a5be2c30a27f17e6f100e81eb` |
| docs/api/refund | `1c9994f711aacf3171473d6181f1dfc1a17699148002a94b6576a11c6c517965` |
| docs/payments/refunds | `b2a222a2a9a4702bdde7b5f68b16a5c3a5256bff75a732f70222d00be5b26d10` |
| docs/payments/test-payments | `9a4cb5fcfc99b7d4df7b0ef073b36f18bd82384fb715fb85ea21726c28e12ced` |
| docs/payments/manage-disputes | `65cc3c599c378b6bbb5c7735da6214101a45021bfe3f73af8dbe9a48911a3e43` |

**What this means for D-050 (new, important).**
- Unanswered disputes are auto-accepted after 16 hours and refunded from **CarworX's Paystack Balance**, the main account. So CarworX would carry a provider's chargeback up front. Phase 3 needs a dispute queue that alerts within minutes (`charge.dispute.create` and `remind`), with an on-call owner.
- None of the five pages says how a refund or dispute is split between the subaccount and the main account. That, and recovery from a provider's future payouts, still needs **Paystack's written confirmation before G-LIVEPAY**.

**Not read directly:** the split-payments, multi-split, subaccount and webhooks prose pages. R1–R3 and R6 rest on Paystack's code-sample repository.

## 5. Questions

- **For Codex:** §3 is completed (thank you). Please confirm §4's wording.
- **For the owner:** may we send Yoco's partnership team the question "Do you support split payouts for a marketplace?" You would send it; agents do no outreach.

Agent: claude
