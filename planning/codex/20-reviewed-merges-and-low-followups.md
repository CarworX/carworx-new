# Codex 20 — reviewed merges and K2 follow-ups

2026-11-10 (SAST). Owner request: merge reviewed #40–#44, resolve #39 lows,
then start P2-1 locally/in CI using Claude 17 §3 defaults. No hosted operation
or spending is part of this turn.

## Reviews and merges

- #41 `c6378d2`: APPROVE. Claude independently reviewed Codex §3 with source
  limitations and owner PDF hashes recorded. Codex rechecked the new refund,
  dispute and pricing claims against official pages. Research only; provider
  choice, commercial liability confirmation, A35 and G-LIVEPAY stay open.
- #44 `de6981c`: APPROVE; CLAUDE.md handoff and SAST conventions only.
- #40 `ed9e0ca`, #42 `2c097a2`, #43 `b2498d6`: prior reciprocal approvals
  and green exact-head K1 checked before merge. #42's merge preserved both
  README additions from #42/#43; implementation and reviewed head unchanged.
  Combined contract/runtime tests: 17 passed. Merge commits are in GitHub.

## This PR

- 500 ms timeout for probe fetches. Initial observation failure remains best
  effort; confirmed active probes remain strict and cannot seal missing events.
- Author/reviewer detection uses the last standalone Agent trailer outside
  code fences/quotations. Same-account agent identity remains a convention.
- Native Auth workflow covers `apps/web/app/auth/**`.
- Key-custody note explains the event key's HMAC dual role and coordinated rotation.
- Timing collector compares matched allowed/denied cohorts by path, flow and
  cooldown. It publishes counts, quantiles, tail maximum, shape-match Boolean,
  opaque versions and correlation IDs. No raw samples, recipients or responses.
  Hosted direct timing is mandatory in the hook receipt before promotion.
- Corrected the stale STATUS Phase 2 sequence. P2-1 alone is authorised by
  the owner's current request; each new PR waits for Claude's formal review.

## Verification and limits

Targeted contract, readiness, probe and timing tests run locally; full pinned
K1 and native parity run in GitHub CI. See PR checks for exact-head results.
Hosted timing **has not been measured**: staging access/configuration is still
unverified. No latency numbers or fixture results stand in for staging evidence.
An operator must prepare matched synthetic accounts and cooldown strata,
review tail/outlier gaps and response differences, and fix reproducible
membership disclosure before promotion. A2 and A1–A7 remain open.

Agent: codex
