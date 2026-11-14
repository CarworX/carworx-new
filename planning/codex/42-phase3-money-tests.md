# Phase 3 money and messaging test round

Updated 2026-11-14 UTC. Owner started this lane in chat. Original base:
`phase-3` @`4b97de8`; branch `codex/p3-money-tests`, PR target `phase-3`.
Original planning and build worktrees remain untouched. No deployments, provider
requests, real email or production access. Reconciled with `phase-3` @`8c14e84`,
including approved #115 and #106. They were merged under later owner authority.
Shared staging end-to-end checks remain open.

## Results

Fresh reconciliation checks (2026-11-14): 502/502 web unit tests; 31/31 focused
CI-policy, environment-contract and backup-coverage tests; 30/30 money pgTAP
assertions on a fresh disposable native stack; twelve simultaneous payment
initialisations produced one dispatch, and twelve receptions/effects produced
one confirmation. Stack stopped. Formatting and diff whitespace checks passed.
Final-head CI and the integrated A36 repeat remain pending.

The following detailed results describe the earlier recorded test run unless
repeated above.

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
  count the paid event's logical key. Setup operations now use `PERFORM`, so
  the strict CI TAP validator sees only the plan and assertions.
- `supabase/tests/money-concurrency.js`: **passed** against that disposable
  stack: 12 simultaneous initialisations → one dispatch/reference/attempt;
  12 receptions → one inbox row; 12 effect transactions → one paid event and
  one booking confirmation. Requires `P3_DISPOSABLE_STACK=1`, loopback
  `RLS_DB_URL` on a disposable port in 20000–32767 and `psql` on PATH. Run only
  on a fresh disposable schema: it commits synthetic fixtures. Stack stopped.
- Existing Auth email handler/probe tests: **17/17 passed** (A33 local failure
  and recovery boundary coverage). Hosted application recovery remains open.
- Full operations suite: **60/60 passed** after the staging-only cron
  expectation fix; focused ESLint and formatting passed.
- BK-1 coverage tests: **7/7 passed**. Fixed Windows file-URL conversion in
  the test harness and asserted money/booking tables are included. This is
  coverage-plan evidence, not by itself a completed restore drill.

## Defects and regression fixes

- A36 originally failed restoring `private.payment_reconcile_cursor` because
  migrations seeded its key on the disposable target. #115 fixes this by lazy
  cursor creation. Keep that fix, remove this branch's target-row deletion,
  and explicitly seed non-default page/time in the synthetic backup fixture.
- The security catalog caught twelve public `SECURITY DEFINER` money/review
  RPCs. #115 moves all twelve implementations to `private`, with public invoker
  wrappers and existing scoped grants/checks. Removed this branch's overlapping
  unmerged facade migration. Reviews remain signed-in only per the owner;
  anonymous reading is deferred. No `review_projection` schema is introduced.
- The final-schema retention test had not included the explicitly granted
  review purge. Its exact function allowlist now includes only that addition;
  a new assertion also denies it to anon/authenticated/service_role.
- #107's scanner flagged inherited checklist prose at
  `db0ae78663a60c0fc42037f3ae41998269a91417`, line 8 of the build record.
  Extended the existing exact source-line hash exception mechanism to that
  one rule/path/line/commit. No path or history exclusion. Real scanner
  adversarial tests cover clean prose, an adjacent credential and an appended
  credential for both exceptions. Eight policy unit tests and remote secret
  scanning passed at `914bf4e`. Claude must review this policy adjustment.
- The operations test assumed retention was the only cron. Updated its exact
  expected staging schedule to the existing minute queue/recovery job plus
  daily retention. Production keeps daily-only scheduling; the Worker still
  guards retention on `17 1 * * *`.
- **A36 passed** at `2ef8951871cd8df95fecc7af2423c6189850dbdf`: 76 exported
  tables, 133 application rows, 4 Auth identities, 2 private storage objects,
  1,099 restored-schema RLS assertions and 8 negative checks. Disposable source
  and target stopped. [Sanitized receipt](evidence/phase3-money-restore.json).

## Outstanding evidence

- Earlier local A36 passed for its recorded schema. Repeat on this integrated
  schema and after schema-changing PRs such as #95; its BK-1 exception is not included here.
- Shared A23/A29/A35 end-to-end: staging deploy required. A35 adapter tests use
  synthetic responses; they are not a Paystack sandbox round trip.
- A33 hosted UI/Auth failure recovery, full cross-lane integration and reciprocal
  independent review remain required. Unit mocks do not establish DB atomicity;
  the SQL/concurrency tests above supply the local DB evidence.
- #95 BK-1 exception remains separate. #97 has merged into main; it remains
  subject to the normal main/phase-3 integration sequence.

## Coordination

#97 was marked ready. Its first RLS/recovery runs failed because the security
test still required connection limit 3 after its migration raised the cap to
5. Fixed only that assertion on its own branch; all 30 O5 pgTAP assertions
passed on a separate disposable native stack. Published and verified
`fb466afdab62ab565933cbfdb0f9fbffdf31579f`: **all five required checks green**
(K1 checks/gate, recovery, commit-email, secrets). No merge.

Claude received #95's published head
`8f8abe5f2c49e12b0767533ef32d37300b7db8d1` and this lane's start via
[#98 coordination comment](https://github.com/CarworX/carworx-new/pull/98#issuecomment-6858785689).
No bookings test PR was merged.

Test PR: [#107](https://github.com/CarworX/carworx-new/pull/107), targeting
`phase-3`. Claude's [#106](https://github.com/CarworX/carworx-new/pull/106)
merged after #115 and is incorporated here. Local and hosted evidence remain distinct.
