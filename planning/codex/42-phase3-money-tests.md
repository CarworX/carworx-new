# Phase 3 money and messaging test round

Updated 2026-11-13 16:45 UTC. Owner started this lane in chat. Base:
`phase-3` @`4b97de8`; branch `codex/p3-money-tests`, PR target `phase-3`.
Original planning and build worktrees remain untouched. No merges, deployments,
provider requests, real email or production access.

## Results

- Node 24.22.2 and pnpm 12.16.1: frozen installation passed. Temporary npm tool
  cache supplies pins; the default Windows shims use incompatible versions.
- Web `vitest run`: **44 files / 502 tests passed**. New local tests cover raw
  signatures, event replay/transition identities, checkout snapshot validation,
  provider verification mismatches/outages, durable acknowledgement ordering,
  transaction rollback, retries and stale booking-email suppression.
- Web `typecheck` (including route/Worker type generation), subsequent
  `tsc --build`, focused ESLint, Prettier and `git diff --check`: passed.
- Disposable native Supabase (WSL `CarworX-Native`, separate random stack and
  dynamically assigned ports): **30/30 pgTAP assertions passed** in
  `supabase/tests/database/60_p3_money.test.sql`. Covers A21/A24/A25/A26,
  local refund idempotency from A29, plus A32 event deduplication, freshness,
  expired retry reconciliation and quota alert. Initial notification assertion
  incorrectly counted all distinct booking/refund/payment events; corrected to
  count the paid event's logical key. No production bug was demonstrated.
- `supabase/tests/money-concurrency.js`: **passed** against that disposable
  stack: 12 simultaneous initialisations → one dispatch/reference/attempt;
  12 receptions → one inbox row; 12 effect transactions → one paid event and
  one booking confirmation. Requires `P3_DISPOSABLE_STACK=1`, loopback
  `RLS_DB_URL` on a disposable port in 20000–32767 and `psql` on PATH. Run only
  on a fresh disposable schema: it commits synthetic fixtures. Stack stopped.
- Existing Auth email handler/probe tests: **17/17 passed** (A33 local failure
  and recovery boundary coverage). Hosted application recovery remains open.
- BK-1 coverage tests: **7/7 passed**. Fixed Windows file-URL conversion in
  the test harness and asserted money/booking tables are included. This is
  coverage-plan evidence, not a completed restore drill.

## Outstanding evidence

- A36: run the final-schema native BK-1 source/restore drill; coverage tests do
  not establish restoration. Preserve any failure as a blocker.
- Shared A23/A29/A35 end-to-end: staging deploy required. A35 adapter tests use
  synthetic responses; they are not a Paystack sandbox round trip.
- A33 hosted UI/Auth failure recovery, full cross-lane integration and reciprocal
  independent review remain required. Unit mocks do not establish DB atomicity;
  the SQL/concurrency tests above supply the local DB evidence.
- #95 BK-1 exception and #97 connection-limit migration remain separate PRs;
  neither is silently incorporated or merged here.

## Coordination

#97 was marked ready and ready-for-review Actions ran at
`8527587e4a401a7ba32f33329a2b8d6d208a4223`; K1 checks and K4 recovery reported
failure, commit-email and secret checks passed. Diagnose separately; do not
describe its old draft-skipped checks as a pass.

Claude received #95's published head
`8f8abe5f2c49e12b0767533ef32d37300b7db8d1` and this lane's start via
[#98 coordination comment](https://github.com/CarworX/carworx-new/pull/98#issuecomment-6858785689).
No bookings test PR was merged.
