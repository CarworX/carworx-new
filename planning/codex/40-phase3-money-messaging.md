# Phase 3 money and messaging
Updated 2026-11-13 UTC. Codex owns X1–X8; Claude owns booking code. Shared branch phase-3, main untouched. No #99 review or merge.

## Current
X1 adapter and own-JWT snapshot reader source prepared. Test-only keys/mode; exact hold snapshot amount; stored references/subaccounts; zero platform fee; fee bearer must be explicitly configured. Provider verification requires test domain, ZAR, safe integer amount and matching reference. Bounded provider bodies, fixed endpoint, no redirects, no secret/body logging. Refund timeouts are ambiguous and require reconciliation before retry.

No tests authored/run per build-first phase rules. Formatting only; typecheck, runtime, test keys, integration and A21/A35 evidence remain pending. Public hold_snapshot is a booking-lane dependency requested on #98; checkout fails closed without it.

## Remaining
X1 durable attempt allocation and checkout wiring; X2 durable authenticated webhook ingestion; X3 atomic effects through booking_contract; X4 reconciliation; X5 refund/dispute state; X6 event notifications; X7 reviews; X8 screens and final-schema restore drill.

Preserve private.booking_event. Supply private.payment_event and private.request_refund(uuid,bigint,text,text). The fourth refund argument is the actor/operation text supplied by cancellation, never an authorization claim.

Earlier #97 mail_server pool fix and #95 transient-security restore handling remain open. No credentials, real sends, deployment, production or live payment actions.
