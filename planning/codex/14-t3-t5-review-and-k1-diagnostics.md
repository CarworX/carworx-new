# Codex 14 — T3/T5 review and K1 diagnostics

Date: 2026-11-05 UTC. Baseline main: `99efccfc4752f10478afa75ea63c2628a6395c0d`. Final T3/T5 verdict: APPROVE @91e7e4400690c97f8cc38a0f54b48032352c69b8; merged as 199d448. This continues Codex 13; Phase 1 staging acceptance remains open.

## Reviewed heads and findings

Initial [PR #25](https://github.com/CarworX/carworx-new/pull/25) head `59ff8fb81ffac8ad77a702f718c24d71555f701a` received CHANGES ([review 5778763752](https://github.com/CarworX/carworx-new/pull/25#pullrequestreview-5778763752)). The follow-up at `fe34cd25ff71d170ca693e44b044a4dec73ea23e` received CHANGES ([review 5778801921](https://github.com/CarworX/carworx-new/pull/25#pullrequestreview-5778801921)). Findings belong to Claude; Codex changed no application source.

| ID     | Finding and original location                                                                                                                                                   | Resolution                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1, P1 | `supabase/tests/database/30_t3_caller_admin_status.test.sql:49`: five `SELECT set_config` results polluted TAP. All assertions passed, but the required runner correctly failed | Resolved at `fe34cd2`: non-emitting `SET LOCAL` statements. Fresh local reset and strict runner passed 168 assertions / 4 files, no extra rows, failures, skips or TODOs |
| R2, P1 | `apps/web/integration/google-fixture.test.ts:99`: regex assumes `method` is the first form attribute; real markup includes `data-discover` and `action` first                   | Resolved at `d3308b6`; all 45 required integration tests pass locally and on combined-head CI                                                                                                              |
| R3, P2 | `apps/web/app/server/security/boundary.ts:78`: full `arrayBuffer()` read precedes the 64 KB check. An unknown-length probe consumed all 1 MiB                                   | Claude fixed at `d3308b6` with a bounded read/cancellation and a regression; independent streaming probe now passes                                                      |
| R4, P2 | `apps/web/app/server/security/boundary.ts:67,85`: lowercasing Content-Type also changes its case-sensitive multipart boundary                                                   | Claude fixed at `d3308b6`: normalize only media type, preserve parsing header; independent mixed-case multipart probe now passes                                         |

Locations above refer to the original reviewed application source and correct the approximate line references in the follow-up PR review. The strict TAP/report validators were retained.

## K1 repair — independently reviewed and merged

Codex's [PR #27](https://github.com/CarworX/carworx-new/pull/27), exact head `b1e12cef9006416c7639b290397fcd32d231a9ee`, records startup, reset, RLS, integration and cleanup separately. Errors expose only fixed stage labels. Cleanup always runs and cannot mask the original failure; the final gate also requires passed startup/reset/cleanup evidence when feature suites apply.

- 18 local Node tests passed, including all stage failures, missing/malformed reports, primary plus cleanup failure, and failed/missing service evidence at the gate. Focused ESLint, pinned Prettier and diff checks passed.
- Two Claude reviews approved that exact head. [Run 41952735152](https://github.com/CarworX/carworx-new/actions/runs/41952735152) passed all jobs. Downloaded checks/secrets/gate JSON match `b1e12ce`; required RLS 154 and startup/reset/cleanup passed.
- Claude merged as `0961c989c4911de10d36840693181bd7cc6ca18f`. Its earlier run 41952266001 was superseded/cancelled, never acceptance evidence. Temporary Claude verification PR #26 is closed unmerged.
- Claude merged main into T3/T5 at `91e7e4400690c97f8cc38a0f54b48032352c69b8`. Relative to `d3308b6`, only these six approved K1 files changed; app/schema/manifests/lockfile are identical.

## Independent local evidence and limitations

- Pinned Node 24.22.2, pnpm 12.16.1, Supabase CLI 2.122.1; Docker 29.9.2, about 4 GB RAM. Frozen install passed. Local Supabase uses synthetic data and the mail sink only; process-local TMP/TEMP workaround retained. Ancillary services excluded as in Codex 13; hosted CI runs separately.
- At `59ff8fb`, `pnpm run check` passed lint, formatting, types, 141 unit tests and build. The initial integration run executed 45 tests: 44 passed, R2 failed, none skipped/TODO. Real local Auth/TOTP, server and database admin boundaries, revocation, cross-tenant denial, forged-session/metadata denial, CSRF/redirects, confirmation/recovery/logout and no-store were exercised. Google cases remain fixtures only.
- Integration used the unchanged production Worker export, with only an external Windows adapter for the Supabase CLI launcher/build-path lookup. Original application source and all 45 assertions were unchanged. This does not claim that the unadapted integration launcher works on Windows.
- Chromium at 390 x 844 passed eight checks: signup consent/keyboard/overflow; signup confirmation state; confirmation POST after reload and native secure HttpOnly SameSite session cookies; no Auth tokens in web storage; logout; password sign-in; recovery/password save; private/no-store response. It ran through a local Node HTTP bridge into the production Worker export, not hosted Cloudflare. An initial probe incorrectly required completely empty web storage; React Router uses a benign entry. The corrected check targets Auth token storage specifically; the application was not changed.
- At `fe34cd2`, fresh reset plus `node supabase/tests/run-rls.js` using the documented private `RLS_DB_URL` override passed all 168 assertions (23/85/46/14). The previous report failure is retained as historical evidence, not counted as a pass.

## Final verification and verdict

**REVIEW: APPROVE @91e7e4400690c97f8cc38a0f54b48032352c69b8**, [review 5778949813](https://github.com/CarworX/carworx-new/pull/25#pullrequestreview-5778949813). All four findings are resolved. Codex merged #25 under Q-021 as `199d44804ea74844f3de36513582abd79e6846d3`. This approves the local/synthetic implementation; staging sign-in remains blocked by K2.

- [Combined run 41953684824](https://github.com/CarworX/carworx-new/actions/runs/41953684824) passed all three jobs. Downloaded sanitized checks, secrets and gate JSON each match the full approved SHA: **143 unit tests, 168 required RLS assertions / 4 files, 45 required integration tests**, and passed startup/reset/cleanup. The required `integration: true` contract is accepted. No missing suite was counted as passing.
- Fresh local `pnpm run check` passed at `d3308b6` (143 tests/build); the combined head has identical application/schema/manifests/lockfile. Both independent boundary probes pass. The original 45 integration tests were rerun successfully at the combined head, with K1's real Vitest report validator, zero failures/skips/TODOs.
- An additional local session-refresh probe passed separately: a real session scheduled as due in its synthetic cookie invokes Auth refresh, rotates the refresh token and returns cookies that support the next protected request. Its first version used falsey `expires_at=0`, which the pinned SDK treats as no expiry; correcting that probe to a past positive timestamp exercised refresh. No application fix was needed for this probe.
- Chromium reran all eight checks successfully on the updated production build. Its local Node bridge limitation remains; no hosted Workers, real Google or device/screen-reader pass is inferred.
- Local Supabase stop returned 0 and Docker reports no task containers. The browser bridge was stopped. Task-created CLI logs containing local keys were removed by literal path; sanitized evidence is retained. No images, unrelated files or WSL installations were removed.

The [sanitized summary](evidence/14-verification-summary.json) preserves heads/counts/limits. [Independent boundary probes](evidence/14-boundary-probes.test.ts) preserve the failing-before/passing-after checks; run them against the T3/T5 source using a temporary Vitest config with an explicit include and Node environment, not the application's normal unit discovery. Raw reports, email bodies, cookies, session tokens, TOTP secrets and CLI service output are not published.

## K2 inputs and next boundary

The implemented server consumers establish `APP_ORIGIN` (one exact origin), `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Ordinary Worker requests use the publishable key plus the user's JWT; no service-role binding is required by these routes. The Google client names in `.env.example` configure the owner's local Supabase CLI, not a Worker secret. `CARWORX_DEV_PAGES=1` remains staging-only.

Claude re-approved K2 preflight #23 at `7911d486aaeabf688c1723224e363eff055c754d` and acknowledged the Auth-email clarification. K2 must coordinate its private recipient-setting name and server-side consumers with Claude; the direct Auth delivery mechanism is still open. Neither confirmations off nor unset custom SMTP proves mail disabled. Staging sign-in/email remain blocked until both restrictions are demonstrated. The owner supplies private values and executes hosted configuration/deployment.

After T3/T5 acceptance, Codex continues K2's local/staging configuration and manual owner-run workflow. K3 local measurements follow accepted T4; K4 local synthetic recovery follows accepted T2 with capacity preflight. Real Google login/linking, A1-A7 staging evidence, hosted CPU/recovery and D-060 owner checks remain open. No deployment, account/DNS change, real mail, production credential access or spending occurred.
