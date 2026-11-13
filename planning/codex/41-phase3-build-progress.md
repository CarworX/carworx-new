# Phase 3 money and messaging

Updated 2026-11-13 UTC. Owner-authorized build-first round, shared `phase-3`. No merge, deploy, SQL execution, real mail or live payments.

## Built source

- X1 test-only adapter and own-JWT hold snapshot reader.
- X2 durable bounded signed webhook inbox, minimal fields, stable transition keys, charge/refund/dispute routing.
- X3 transaction applies confirm_paid through inherited booking_contract and records unique payment effects atomically. Retry queue and ambiguous initialise/refund cases remain durable.
- X4 transaction/refund reconciliation batches, late-payment cases and own-customer refund choice. Settlement reconciliation remains outstanding.
- X5 refund reservations capped against paid amount, independent dispute state and idempotency-key conflicts. Unknown submissions are reconciled by deterministic refund reference, never blindly retried.
- X8 checkout and result screens registered, private/no-store responses. Admin screens and final-schema drill remain outstanding.
- X6 notifications and X7 reviews remain outstanding.

## Provider access

Read-only Make API shell created using the existing Paystack connection in the private space. GET /transaction succeeded and reported test domain with ZAR currency. No payment/refund was initiated and no secrets copied. This proves Make access only; Worker bindings and secrets are not provisioned.

## Validation and gates

Prettier parse/format on new TypeScript and TSX only. No new tests authored/run, per P3-O2. No typecheck, SQL reset, integration test or browser validation: GitHub-only continuation after local disk exhaustion. Source remains unverified until the joint test round with bookings #99 assembled; no #99 review or merge.

Runtime requires PAYSTACK_ENABLED=1, PAYSTACK_MODE=test, PAYSTACK_SECRET_KEY (sk_test only), explicit PAYSTACK_FEE_BEARER, optional PAYSTACK_WEBHOOK_SECRET, MONEY_DB Hyperdrive using money_server and admin-configured test subaccounts. Missing configuration fails closed. No live configuration is accepted.

## Outstanding prior items

- #97 contains the separate migration setting mail_server connection limit 5; still unmerged/unexecuted.
- BK-1 exception prepared in #95 must be integrated when that PR lands. Final Phase 3 restore coverage is still required.
