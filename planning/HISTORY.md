# Planning history

Append-only evidence record. Current state belongs in [STATUS.md](STATUS.md); do not duplicate entire proposals here. Never record credentials, signed download URLs or private customer data.

## 2026-10-27 — Codex planning round 01

- Start: 2026-10-27 10:14 UTC. Reviewed/published-from base: `471a5c8b31f6c56277e33111b754455e5583eead`.
- Authority: owner requested "Implement the proposed plan" for documentation publication; consolidated application-build approval remains outstanding.
- GitHub checks: main matched the reviewed base; open PR list empty. Connected account and local GitHub CLI report repository admin/push/pull access. Local main was unborn with no remote; connected origin and ran `git pull --ff-only origin main` successfully, preserving remote history.
- Changes: independent baseline and T-01–T-16 response; T-17–T-20 proposals; evidence corrections/vendor checklist; owner-answer/decision records; proposed protocol amendments; README and baton/status update to Claude. No Claude-authored proposal/research source was overwritten.
- Checks: initial `git diff --check` passed. Relative-link check caught the not-yet-created HISTORY.md link; this file resolves it. Final document/topic/scope checks and publication verification are recorded below after execution.
- Limits: no app code or runtime tests; no account setup, DNS, credentials, external outreach, paid automation, vendor sandbox/live calls or deployment. Production vendor access, legal/payment approval, supply and restore/latency measurements remain unverified.
- Next: Claude responds to Codex 01. Only exact T-04 agreement and owner decisions are closed; amended topics require acceptance. The resulting commit contains this record; use Git history to identify its immutable SHA.
- Final pre-publication checks: PowerShell relative Markdown link validation passed across 20 documents; topic coverage T-01–T-16 and new T-17–T-20 passed; Markdown-only scope check passed; `git diff --exit-code` confirmed original Claude proposal/research and AGENTS.md/CLAUDE.md unchanged; `git diff --check` passed. Application tests are not applicable to this documentation-only round. After push, verify origin/main and all changed file blobs; report the observed result in the publishing chat without a self-referential follow-up commit.

## 2026-10-27 — Claude planning round 02

- Reviewed base: `668466e` (Codex 01). `git pull` fast-forward before writing; head re-checked before push.
- Changes: `claude/02-reply.md`; DECISIONS D-007–D-021 (T-01–T-16 closed by accepting Codex's changes); PROTOCOL §8 marked agreed; OWNER-QUESTIONS Q-018 and Q-019 added, plus a pointer to the Q-016 options; STATUS baton to Codex. No Codex-authored file was edited except shared logs.
- New evidence: GitHub API on 2026-10-27 shows the CarworX org plan is `free`; branch protection and rulesets endpoints return 403 ("Upgrade to GitHub Pro or make this repository public"). Paystack subaccount `settlement_schedule` values (auto/weekly/monthly/manual) come from third-party wrappers and are UNVERIFIED.
- Limits: no app code, accounts, credentials, outreach, deployments or paid runs.

## 2026-10-27 — Codex planning round 02

- Research/check timestamp: 2026-10-27 11:08 UTC. Reviewed base: `be028f08c9da5088391211c8cfb2a2b5d9bbf5a3`. Synced by fast-forward; no open PRs. Global/scoped instruction timestamps checked; changed protocol/status/decisions and full Claude 02 read.
- Owner requested another turn plus varied revenue streams, including website ads. Added D-022 as planning direction only; no reversal of the free pilot.
- Changes: Codex 02 answers T-17–T-22 and proposes T-23/T-24; revenue table, staged experiments and hypothetical unit economics; verification note and vendor checklist additions; protocol header fixed to reflect existing D-007; owner questions, README and status/baton to Claude. Original Claude proposals/research and prior Codex replies preserved.
- Evidence: independently reproduced org `free` and protection/rulesets 403s. Official GitHub documentation distinguishes Team private branch protections from private environment reviewers. Paystack response samples do not establish the proposed settlement/refund contract. Revenue research used Google publisher policies, Snupit/Fresha, ARB and Regulator sources. FSCA guidance/Justice PDF fetches failed; no regulatory exemption assumed.
- Limits: no app/runtime changes or tests, credentials, accounts, outreach, ad tags, pricing activation, merge, paid runs or deployment. Traffic, demand, margins and achievable ad RPM remain unmeasured. Example prices/results are hypotheses, not forecasts.
- Drafting repair: first combined status/README patch failed against a changed README line; it applied no changes. Re-read the relevant metadata/text and applied the corrected patch. Final document/topic/arithmetic/scope checks and publication verification follow in this round's evidence.
- Git hooks previously reported unavailable `lefthook`; no hooks are bypassed. Proportionate manual documentation checks remain required. Claude must accept amended topics before consolidated plan sign-off; owner commercial/build decisions remain separate.
- Final pre-publication checks passed: relative Markdown links across 24 documents; T-17–T-24 response coverage; Markdown-only change scope; preserved Claude and earlier Codex source; append-only history; revenue scenario/opportunity-cost arithmetic; `git diff --check`. `git fetch origin main` confirmed unchanged base `be028f0`. After push verify GitHub main plus tracked blob identities and report the observed SHA/result in chat; no app tests apply to this documentation-only change.

## 2026-10-27 — Claude planning round 03

- Reviewed base: `79e5959` (Codex 02). Fast-forward pull before writing.
- Changes: `claude/03-reply.md`; **`PLAN.md` draft 1** (consolidates D-001–D-029); DECISIONS D-023–D-029; OWNER-QUESTIONS Q-016 update (B4) and Q-021; STATUS baton to Codex; README pointer.
- Accepted Codex corrections: B1 withdrawn as a refund solution; Team doesn't provide private-environment reviewers; no implicit merge authority; 40 km/h fallback withdrawn.
- New, UNVERIFIED: whether Paystack payment requests/links support subaccount splits (needed for B4).
- Limits: no app code, accounts, credentials, outreach, deployments or paid runs.

## 2026-10-27 — Codex planning round 03

- Reviewed base: `2a92499842dee1d7df16e1d404c51d5db8a3a3ca`, Claude 03 and all 21 PLAN draft-1 sections. Repository fast-forwarded from `79e5959`; no open PRs. Instruction timestamps and changed planning records checked. New primary-source reads completed around 11:28 UTC.
- Verdict: CHANGES REQUIRED; Codex sign-off withheld. R1–R8 cover the Phase-2/Phase-3 restore dependency, search/private-location leakage, capacity/hold/quote contracts, event/send idempotency, B4 funding, retention/security/performance gates, revenue scope, and Phase-1 permission/dependency distinctions.
- Changes: Codex 03, round-03 verification, PLAN review notice (draft substance preserved), owner/decision/status records, vendor clarifications and README. Baton to Claude for draft 2. No prior proposal/research document was overwritten.
- Primary evidence: Paystack server-initialised checkout returns a URL; separate Payment Requests product is not assumed necessary for B4. Resend idempotency window is 24 hours. RTIA FAQ does not establish the blanket business-registration demerit claim; no current legal rule or fleet demand inferred from it.
- Limits: no application code/tests, live integrations, accounts, credentials, vendor outreach, spend, merge, ads or deployments. Proposed defaults/budgets are recommendations for draft 2, not measured behaviour or owner-approved policy. No consolidated build approval exists.
- Next: validate review coverage/links, append-only history, documentation-only scope and preservation of draft-1 substance; refresh remote before publication; verify remote head and blob identities afterward. Git hooks previously reported missing lefthook; no bypass is used. Results follow below.
- Pre-publication checks passed: relative links in 28 Markdown documents, all 21 section verdicts and R1–R8 present, documentation-only scope, prior proposal/source and append-only history preservation, PLAN content unchanged apart from review notice, `git diff --check`, and remote refresh matching `2a92499`. No app tests apply. Publication SHA and observed remote blob verification are reported in the publishing chat to avoid a self-referential follow-up commit.

## 2026-10-27 — Claude planning round 04

- Reviewed base: `a1ddd53` (Codex 03). Fast-forward pull before writing.
- Owner answers (Claude chat): Q-018 no brand assets; Q-021 yes (staging merges); Q-009 two non-technical colleagues to see a plan with design directions and layout images.
- Changes: `claude/04-reply.md`; **PLAN.md draft 2** (all R1–R8 and T-23 changes; new Phase 0b and §22 presentation pack; Q-022, Q-023); DECISIONS D-030–D-032; OWNER-QUESTIONS answers; STATUS baton to Codex; README.
- Limits: no app code, accounts, credentials, outreach, deployments or paid runs. Codex sign-off box left for Codex.

## 2026-10-27 — Codex planning round 04

- Reviewed base: `953fb083ea684a9e86299734d0e733b00692a876`, complete PLAN draft 2, Claude 04 and changed owner/decision/status records. Fast-forward pull; no open PRs; global/scoped instruction timestamps unchanged. Review timestamp around 11:42 UTC.
- Verdict: technical sign-off for PLAN 2.1. All R1–R8/T-23 changes resolved; final clarifications cover approximate mobile discovery/private exact coverage, per-event/per-effect deduplication, pre-production privacy approval, non-waivable frontend budgets, and local/file-shareable presentation delivery. No new vendor facts required external research; prior same-day evidence reused.
- Changes: Codex 04, signed PLAN 2.1, D-033, current status/baton, owner approval clarification and README. Earlier proposals/history preserved. Claude next creates §22 presentation artefacts; Codex reviews before owner/colleague feedback, brand selection and Phase 1 decision.
- Limits: no application code, accounts, credentials, outreach, ads, spending, merge, deployment or delegation. No live integration/runtime claims. Owner approval remains pending. No public pack-hosting authority inferred.
- Checks to record below: document links, R1–R8 review coverage, signed/owner-pending state, documentation-only scope, preserved source proposals, append-only history, diff whitespace, remote refresh and publication verification. Known missing lefthook is not bypassed; manual documentation checks apply.
- Pre-publication checks passed: relative links in 30 Markdown documents, R1–R8 coverage, technical-signed plus owner/colleague-pending state, D-033 reference, Markdown-only scope, unchanged original proposals/research/instructions, append-only history and `git diff --check`. Remote refresh matched `953fb08`. Runtime tests are not applicable. Remote head and file-blob verification are reported with the publication SHA in chat.
