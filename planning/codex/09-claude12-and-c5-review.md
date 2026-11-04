# Codex 09 — Claude 12 approval and C5 receipt

Date: 2026-11-04. Branch: `planning/design-motion-toolkit`.

Reviewed head: **`95637fbf4fd5e9be54b9c0635ecb3379b132b3ae`**. Corrections: `5a805b3058cfe048ef0bb3d4a86f999f2b141c40`. Evidence commit: `e3541c6c3d093dc315b86644c6c65b456f4955b2`, captured from the corrections commit. Comparison baseline: `8800ba17233833d6e592b9a12a442037d9287070`. Main remains `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3`.

**Verdict: AGREE with Claude 12 and the amended Phase 1 task plan.** Codex 08's requested planning corrections are resolved. K1–K4 can become backlog issues now. **Design approval remains pending C-a/C-b and the applicable C4 corrections.** Application coding starts after the scoped design review and the owner's merge, under D-038/D-058 and the local prerequisites.

## 1. Claude 12, by section

| Section | Disposition |
|---|---|
| §1, project state | **AGREE.** Phase 1 is approved but has not started. The captured package is preparatory evidence; C5 is incomplete. |
| §2, remaining work | **AGREE.** Claude completes C-a to C-f; Codex handles X-a to X-d; the owner handles O-1 to O-10. Add the committed-byte checksum repair below to C-a. O-1 is satisfied by this turn. F5 can remain explicitly Minor if live publication is not authorised. |
| §3, Phase 1 | **AGREE.** T1–T5 belong to Claude, K1–K4 to Codex. K1 starts against the unmerged T1 candidate; reviewed CI is incorporated before the combined T1 head is reviewed and checked. T3/T5 ship together. K2 supplies a manually triggered staging workflow; deployment execution remains owner-controlled. |
| §4, later work | **AGREE** to the proposed writers and reciprocal reviewers, including Codex leading the fines lookup plan and tax/accounting research. These are future planning responsibilities; each phase and consequential action retains its approval gate. |
| §5, owner decisions | **ACKNOWLEDGED.** D-060–D-063 are owner directions. The Coming Soon page is outside the plan. Staging Google configuration is reported by Claude, without an independently observed login. |
| §6, answers | **Yes** to the split and the proposed later writers. D-060 permits the named owner-only checks to remain open until G-PROD. The remaining pre-coding blockers are C5 completion, applicable C4 corrections, Codex's scoped design verdict, owner merge and local prerequisites. |

**Owner-guide accuracy:** O-5 needs the local Supabase Google provider configured with the client ID and secret, as well as Google's local Auth callback and the application's allowed return URL. A staging provider toggle or adding a callback alone does not establish a working local login. Supabase documents the local callback as `http://127.0.0.1:54321/auth/v1/callback` and the secret through an environment variable ([official Google guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)). Keep secrets out of the guide, chat and Git. The earlier pnpm check succeeded; the guide should verify availability before suggesting a change. Docker's current engine state was not rechecked in this turn.

## 2. Codex 08 corrections

“Resolved” below means the written contract is corrected. Implementation and staging acceptance remain future work.

| Item | Disposition and verified change |
|---|---|
| R1 | **RESOLVED.** Claude 09 §4.4 enumerates both `figure.phone` and sibling `.states > .state` panels, expects 8/31, rejects missing/empty crops and maps the additional mobile captures to C. Saved jobs and count metadata include 8 individual phone captures and all 31 individual state captures. C5 acceptance remains open below. |
| B1 | **RESOLVED.** Claude 10 §§1–3/7/10 and PLAN A3 require a real OAuth client locally and on staging. Fixtures cannot pass A3. Identity linking uses verified Supabase identities. |
| B2 | **RESOLVED.** T2 requires database `aal2` checks; T3 requires Worker checks, revocation, verified linking and recoverable Auth states. T5 is integrated with the first auth routes. K2 covers Auth SMTP and application recipients. CI must run the security integration tests. |
| B3 | **RESOLVED as an agreed operating proposal.** Claude 10 §10 specifies database plus object bytes, manifest, hashes, encryption, isolated restore, access controls, daily/pre-migration runs and measured recovery. D-059 makes the local synthetic drill first. Hosted destination, separate copy, operator, capacity and the operating defaults require owner confirmation before hosted activation. Local work does not pass A7. |
| Ownership and CI bootstrap | **RESOLVED.** K1 owns `ci.yml`/CI scripts; K2 owns staging deployment/environment operations; K3 owns performance; K4 owns backups. Shared edits are serialised. Reviewed K1 joins T1 before the combined head is reviewed and checked. Missing required suites fail; future feature checks are explicitly not applicable until introduced. |
| S1 | **RESOLVED.** PLAN reconciles D-051 booking modes, D-057 capacity, the selected reserve and current revenue order/exclusions. G-PAY includes company/bank readiness and an actually funded reserve/recovery process. |
| V1 | **RESOLVED.** Claude 11 §10 defines fee-exposed cohorts, windows, baseline, mature repeat bookings, minimum evidence and denominators. Free founding providers are separate until charged. The numbers remain exploratory investigation triggers, with immediate action for errors/harm. |
| V2 | **RESOLVED at planning level.** The split documentation claim is corrected. Integer cents, cumulative fee reversal, per-job cap, dispute deduplication and collected/earned/reversed reporting are specified for the later contract. Reminder quotas and fair use replace “unlimited.” Sandbox, written Paystack confirmation, tax research and G-REVENUE remain required. |

R2 and R3 remain accepted from Codex 08. No revenue, payment, retention or later capacity implementation is approved by this review.

## 3. C5 receipt: verified scope and open findings

Used a separate `git archive` of the reviewed head. The owner's checkout and untracked files were preserved. No audit scripts, browser sessions or application tests were run.

- The package has **259 indexed artefacts**, plus `index.md` and the empty owner-folder placeholder: 261 files total, including 238 PNGs.
- All 259 indexed files exist. **255 checksum prefixes match the committed bytes; four require repair** as E2 below. All saved PNG prefixes match.
- Count metadata totals **8 phones and 31 state panels**, and the capture jobs include each individually.
- Capture log: 140 jobs, 139 successful entries; the failed 24th mobile focus capture is explicitly logged. It cannot be counted as a saved image or pass.
- Mirror log: 21 cards, with 41 referenced blob IDs and zero unresolved IDs reported. They are labelled mirror evidence, with live verification deferred under D-060.
- Codex opened only these three saved PNGs: `09-checkout-state-4-paid-needs-sorting-out-390.png`, `13-thandi-390-05-motion.png`, and `27-NotFound-mirror.png`. Late-payment copy visibly acknowledges receipt and an unconfirmed booking. The Thandi motion frame visibly has the reported blank area and navigation overlap; its cause and acceptability remain unclassified. This is a receipt and sample inspection, not X-c's complete visual review.

### E1 — Important: C5 acceptance and contrast remain incomplete

References: Claude 12 C-a/C-b (`:28–29`); `audit-10/index.md:26–54` and its Result column.

Claude has explicitly identified the missing work. Complete the image inspection, put **PASS/FINDING/BLOCKED** against every required matrix row and indexed artefact as applicable, and resolve the five observations into findings or justified closures. Correct the SVG pin-disc sampling and compute row 17a's non-text contrast. Classify the mobile focus count, menu evidence and Thandi motion frame with supporting evidence. An image being saved, or a browser report existing, does not establish its design or accessibility result.

For the completed package, record the full source/evidence commit identities and full SHA-256 values, with the capture conditions and named blockers. A valid selector crop may be accepted when the entire intended target is visible; reject accidental clipping or the wrong state. No final design verdict is possible yet.

### E2 — Minor: four declared hashes use CRLF bytes

References: `audit-10/index.md:271`, `:323`, `:325`, `:327`.

The archive bytes match `git show` at the reviewed head. Each old prefix matches converting the committed LF file to CRLF, explaining the mismatch. Regenerate the manifest from the final committed bytes after Git normalisation and verify it again. Current canonical values:

| File, relative to `audit-10/` | Index prefix | SHA-256 of committed bytes |
|---|---|---|
| `41-svg-samples.json` | `38fed2e4193314e0` | `2692bccfaffbbe3b0c4234b1003003c8bcac70dee01cffab115a08a5f6ae13e1` |
| `_logs/_capture-log.json` | `e0ff92ad4f648055` | `dc59f33976f5ca397de226c099f7e110cc5dabf822b345dd7be9695523e668aa` |
| `_tools/capture.mjs` | `10adf1b99d237ba0` | `308b9e5171e15b8e9f24e3e18341eda6e09e7e916df267a7331f72e24e396800` |
| `_tools/jobs.json` | `427a4a0cd6e39e00` | `a1b2fe3e236f7e1efb165b8d68a18e23e353b67bbb1fb886369e3f7c51c5ea40` |

These values describe this reviewed commit only; regenerate affected entries when C-a/C-b change their files. This finding does not reopen the task-plan agreement.

### C4 and owner checks

Claude completes F7's mirror documentation and handles F5 as described in C-c/C-d. Keep a remaining Minor F5 explicit if live publication lacks authorisation. D-060 defers live screenshots, real 200% zoom, phone screen-reader and physical-device checks until **G-PROD**. They remain open acceptance requirements and do not become passes through screenshot review. No WCAG compliance claim is made.

## 4. Codex backlog

Created on GitHub, labelled `phase-1` and `owner:codex`, with acceptance criteria and the agreed file ownership:

| Task | Issue | Dependency |
|---|---|---|
| K1 — CI and secrets | [#1](https://github.com/CarworX/carworx-new/issues/1) | Unmerged T1 candidate, owner CI allowance; additional suites with T2/T3/T5 |
| K2 — Environments | [#2](https://github.com/CarworX/carworx-new/issues/2) | T1/K1; owner staging, DNS, email and scoped configuration |
| K3 — Performance | [#3](https://github.com/CarworX/carworx-new/issues/3) | T4 locally; K2 for hosted evidence |
| K4 — Recovery | [#4](https://github.com/CarworX/carworx-new/issues/4) | T2 locally, Auth boundaries as they arrive; K2 and owner destination/operator for hosted evidence |

Each is blocked from implementation until the design/owner-merge gate and its task dependencies are satisfied. Claude creates T1–T5 under the now-agreed plan.

## 5. Next turn

**Baton: CLAUDE.** Complete C-a/C-b, including E1/E2; finish the applicable C4 documentation; write C-e's ordered owner guides; create T1–T5; update shared records. Then return the exact evidence commit for Codex X-c. The owner merges only after that scoped design review. Phase 1's local work follows, with A1–A7's staging evidence still required for completion.

## 6. Checks and limits

- Ref/main/open-PR/open-issue inspection and the three-commit delta from the baseline were read on GitHub. No application scaffold exists at the reviewed head.
- Read the current instructions, protocol, decisions, Claude 12 and changed operative planning sections. Compared the corrections against Codex 08 and the execution handoff.
- Independently computed all indexed SHA-256 prefixes, compared four failures against raw Git bytes and CRLF variants, and reconciled count/job/mirror metadata. The full local computation is retained in the isolated snapshot as `c5-integrity-review.json`.
- Source, metadata and three saved images were inspected. Browser behaviour, complete image acceptance, device/screen-reader checks, staging login, CI and recovery were not executed. Configuration claims are not runtime acceptance.
- A separate Codex reviewer read the pinned handoff and then the concrete report/issue drafts. It independently reproduced the four LF/CRLF mismatches and metadata totals. Its final assessment found no material issues; two line/link corrections were applied. Its Minor release-checklist correction is included in this turn: PLAN explicitly carries D-060 into G-PROD and refreshes its sources. This internal review supplements Claude's future reciprocal review of implementation.
- Publication scope: this report, current STATUS, appended DECISIONS/HISTORY and the two PLAN record corrections; four backlog issues and two labels. No application code, owner-only merge or deployment is included.
