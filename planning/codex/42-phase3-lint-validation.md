# Phase 3 lint validation

Updated 2026-11-13T16:26:19.218Z. Parent: `4b97de815344666fde24965665d4a6fb218d8409`, which includes #99 @1684f7d and money source @874cc5f.

## Changes

Six money/review files only: use the existing HTTP status helper; narrow unknown operation rows; replace unchecked array/transition assertions with explicit checks; convert numeric query parameters to strings; remove comparisons between values already constrained to ZAR by verified snapshots/provider parsing and SQL constraints. No shared payment contract change.

## Verification

Isolated sparse checkout; original workspace branch and untracked work untouched. Locked dependencies installed with Node 24.22.2 and pnpm 12.16.1; no global tool installation.

- `pnpm run lint` PASS, including token checks, Worker/React Router type generation and `eslint . --max-warnings=0`.
- Prettier check on all six changed source files PASS (the final two interpolation conversions were formatted again).
- `git diff --check` PASS.
- Initial lint verification found two stricter interpolation errors in the first fix; both were corrected before the successful full rerun.

Owner reported combined-head format, typecheck, 452 unit tests and build passing before these lint edits. Those broader checks were not independently rerun for this narrow change. No RLS/integration/restore evidence is implied by lint.

## Joint round

X1–X8 implementation source is on phase-3. Acceptance remains open: Claude is building booking A-tests; Codex money coverage is A21/A24–A26/A32/A33/A35/A36, with shared A23/A29/A35 staging checks after approved deployment. Paystack remains test-only. Runtime bindings/secrets, provider fixture compatibility and final restore evidence remain outstanding.

#99 was already merged by another session while these fixes were prepared; Codex did not merge it. #102 is still a draft integration PR, with draft CI skips passing no gate. Main promotion requires the joint RLS/integration/security review, not just this lint pass. #97 and the #95 BK-1 exception remain tracked.
