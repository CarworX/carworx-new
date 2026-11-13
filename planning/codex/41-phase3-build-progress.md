# Phase 3 money and messaging

Updated 2026-11-13 UTC. Owner-authorized build-first round on shared `phase-3`. Codex performed no #99 review/merge, deployment, SQL execution, live payments or email sends. Another session has since merged #99 into phase-3 @4b97de8.

## Built source, awaiting joint validation

| Slice | Source delivered                                                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1    | Test-only Paystack adapter; own-JWT public.hold_snapshot; durable amount/reference/subaccount snapshots; no browser amount or live key                                                                         |
| X2    | Bounded raw signed webhook, durable inbox before 200, transition dedupe, independent API verification for effects                                                                                              |
| X3    | confirm_paid via inherited booking_contract in the same transaction as the unique money effect; retries and crash recovery                                                                                     |
| X4    | Transaction/refund reconciliation, durable settlement list/page cursors, minimal financial settlement lines, mismatch operations; late-payment rebook link or own-customer refund choice                       |
| X5    | Independent partial refunds and dispute state, capped refund reservations, stable operation keys, deterministic provider refund references; ambiguous submissions reconciled without blind retries             |
| X6    | Shared booking/payment events to encrypted O5 outbox, approved recipients only, stale/revoked-recipient suppression and send-time recheck; same idempotency keys, 23h50 retry ceiling and quota alert retained |
| X7    | One review per own completed booking; private raw submissions, native-aal2 moderation, explicit de-identification before publication; author unlink/raw removal and daily 90-day purge                         |
| X8    | Checkout/result, admin money/delivery/settlement and review screens, customer submission/public reviews; synthetic fixtures wired into the final-schema BK-1 drill                                             |

## Validation status

The narrow lint-fix batch now passes `pnpm run lint` on an isolated combined checkout (Node 24.22.2, pnpm 12.16.1), including type generation and ESLint with zero warnings; changed-file formatting and whitespace checks pass. See [lint evidence](42-phase3-lint-validation.md). The owner reported pre-fix typecheck, 452 unit tests and build passing; those broader checks were not independently rerun after these edits. Joint RLS/integration, independent security review and final A36 restore remain pending. These are built source, not a release approval.

Bookings #99 @1684f7d is now merged into phase-3 @4b97de8 by another session. The customer-owned public.hold_snapshot wrapper and request_refund idempotency-key contract remain unchanged. The joint A-test round uses the current combined branch; review/publication entry points and final schema fixtures must be exercised there.

## Provider and runtime access

Make API shell 7024895 reuses the existing private-space Paystack connection, GET only. GET /transaction succeeded, reporting test domain and ZAR. No charge/refund initiated and no keys copied. This proves Make access only; it does not provision Worker credentials or make Make the application's runtime transport.

Runtime remains disabled until separately configured: PAYSTACK_ENABLED=1, PAYSTACK_MODE=test, PAYSTACK_SECRET_KEY (sk_test only), explicit PAYSTACK_FEE_BEARER, optional PAYSTACK_WEBHOOK_SECRET, MONEY_DB Hyperdrive for money_server, and admin-configured test subaccounts. MAIL_DB and existing mail gates are independent. No credentials/binding IDs are invented. The staging configuration declares a minute drain cron and daily retention; nothing is deployed.

## Remaining gates and prior work

- Joint validation and code/security review, then owner-approved integration; no phase-3 promotion to main now.
- Test-mode settlement/refund payload compatibility and ambiguous initialisation recovery still need provider fixtures. Unrecoverable attempts/cases stay visible; no speculative reinitialisation or refund resend.
- Final A36 restore execution after bookings, money and any #95 schema are assembled. Fixture wiring is source only.
- #97 contains the separate mail_server connection-limit-5 migration; still unmerged/unexecuted.
- Preserve the BK-1 restore exception from #95 when that PR lands; it is not silently waived here.
