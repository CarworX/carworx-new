# Codex round 03 — plan review evidence

Date: 2026-10-27. Reviewed `2a92499842dee1d7df16e1d404c51d5db8a3a3ca`, PLAN.md draft 1 and Claude 03. No account or live integration access was used.

## Repository evidence

- GitHub main fast-forwarded from `79e5959` to `2a92499`; open PR list empty. Global/scoped instruction timestamps unchanged; changed protocol/status/decision/owner records and complete plan read.
- PLAN §3 requires G-PROD during Phase 2; §18 makes A28 restore a prerequisite; §11 schedules A28 in Phase 3. This is a concrete phase-dependency defect, not a request for broader testing.
- A7 fixed-location wording lacks a search radius; A15 assumes one last slot without an explicit resource/capacity model; no payment-hold lifetime is defined. Those missing contracts affect observable behaviour and concurrency tests.
- §7 treats B2 and B4 as alternative funding choices. B4 changes collection timing but creates no refund funds or liability backstop. The gate must remain funded/approved independently.
- §17's sponsored flag is inactive but still speculative build scope. Moving it to the approved experiment preserves the free-core scope and does not prevent later sponsorship.

## New primary-source verification

- [Paystack Accept Payments](https://paystack.com/docs/payments/accept-payments/) documents backend transaction initialisation returning an `authorization_url`. [Split payments](https://paystack.com/docs/payments/split-payments/) documents a subaccount on the transaction. A CarworX payment-due link can therefore enter the normal backend eligibility/initialisation flow; a separate Paystack Payment Requests product is not established as necessary. Actual SA account eligibility, splits, refunds and future scheduling remain unverified/gated. This is a design inference from the documented APIs, not a live test.
- [Resend idempotency docs](https://resend.com/docs/dashboard/emails/idempotency-keys) state a 24-hour key window. Persistent outbox state and bounded retry/reconciliation are needed; exactly-once email delivery across arbitrary retries is not established by the vendor key alone.
- [RTIA FAQ](https://www.rtia.co.za/faq.php?read=more) discusses demerits against persons/drivers/operators and contains older rollout context. It does not substantiate a blanket current claim that fleet demerits attach to a business registration number. Do not infer current nationwide legal operation from an undated FAQ. Remove that assertion as the revenue justification; obtain current applicable legal sources before any actual fines product.

## Limits

No routing/latency tests, booking code, runtime checks, commercial agreement, SDK spike, user research, monetary activation or legal determination occurred. Proposed resource/hold/quote/search/performance defaults in Codex 03 are explicit recommendations for draft 2, not measurements or owner-approved operating policies. Existing same-day platform/revenue evidence is reused rather than repeated.
