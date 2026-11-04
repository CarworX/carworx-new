# Codex 11 — K1 CI implementation and Claude handoff

Date: 2026-11-04. Task: [K1 #1](https://github.com/CarworX/carworx-new/issues/1). Original PR [#12](https://github.com/CarworX/carworx-new/pull/12) was incorporated into T1 by Claude. This branch carries supplementary scanner-regression tests and records for a follow-up PR against claude/t1-scaffold.

## Current status

**K1 bootstrap is implemented, approved by Claude at 4b25bf0 and incorporated into T1. Codex approved the combined T1 head 7faf5a6af719b5b9973a432229314b96e9b6af88 after its green run 41826670253.** The additional regression tests and these records require follow-up review; they do not replace those baseline approvals. Base: T1 PR #11 at `e200334203630ad7ba9cf240c3fd01f8667acfb6`, from main `ed2095047e2b4e69dab2118e1d7fa16398db2032`. The owner confirmed available Actions minutes and a $0 spending limit in this Codex session.

First complete hosted success: **`4b25bf0cb16f2a8cb1e67636908270e71fd9dc77`**, [run 41825875526](https://github.com/CarworX/carworx-new/actions/runs/41825875526), with all three jobs successful. The current PR head must also have its own green run; adding the final scanner-policy regression cases and this record triggers fresh validation. The follow-up PR records its tested head/run and review status.

## Delivered contract

- Standard Ubuntu 24.04 `checks`/`secrets`/`ci` jobs, exact PR-head checkout, current-head validation, immutable action pins, read-only permissions and cancellation of superseded runs. Artefacts last seven days; upload failures fail the job/gate.
- T1's Node 24.22.2, pnpm 12.16.1, lockfile and application code are preserved. Frozen install; separate lint, format, types, unit and build steps; positive executed-test counts and strict report validation.
- Versioned RLS/Auth activation contract. Missing commands/reports, skipped/TODO/empty tests, introduced feature paths without activation, or disabling a base-required suite fail. T2/T3/T5 provide the real commands and reports through the interface documented in [the CI README](../../scripts/ci/README.md).
- Checksum-pinned Gitleaks CLI 8.30.1, all HEAD-reachable history plus a separate clean checkout. Scanner output is captured, fully redacted and never published raw. Findings are reduced to rule/file/line/commit metadata. No paid scanning action, deployment or application secrets.
- Six Node contract/security tests; ten actual scaffold failure fixtures in an isolated temporary worktree; actual scanner fixtures for checkout credentials, removed history credentials, clean content, redaction and wrong checksums. Final scanner regression coverage also checks the exact prose exception, a credential elsewhere in that document and a credential changing the exception line.

## One scanner-policy exception: approved by Claude at 4b25bf0

The first full-history scan found `generic-api-key` in a **Resend setup checklist**, not a credential: `planning/research/codex-vendor-access.md:10`, historical commit `668466e234e65c92dfceba3037a34a9ca9e5bcbc`. The complete line was independently compared to known checklist prose; its technical phrase is “retry/suppression.”

The exception requires the exact rule, path, start/end line 10, that historical commit (or the identical checkout line), and full source-line SHA-256:

`e26004a8204052de2bb98025b77e9a30afc413c2ce14214eb18ee6c43c5e3f56`

Every application of the exception is reported explicitly. Other commits, files, rules, lines or changed line bytes remain scanned and cannot match this exception. No folder/rule-wide exclusion or generated baseline was added. Claude independently checked the exception and approved it in [the K1 re-review](https://github.com/CarworX/carworx-new/pull/12#issuecomment-6630167889). The follow-up adds three real scanner regression cases around that unchanged policy.

## Evidence and limits

- Hosted green baseline: Node 24.22.2/pnpm 12.16.1 frozen install, scaffold lint/format/types/build, **3 passed unit tests**, **6 passed CI contract tests**, **10 rejected actual command/activation faults**, **5 scanner fixture cases**, full history and checkout scans, and final gate. Sanitized artefacts were downloaded and inspected; the three additional scanner-policy fixtures must pass on the final head.
- Local Node 24.14.0: six contract/security tests, JavaScript syntax, workflow YAML structure and pinned Prettier checks passed. Local full scaffold testing was intentionally left to the pinned hosted toolchain; the machine has limited free disk space. No dependency/toolchain upgrades were applied locally to the project.
- RLS and Auth integration are explicitly **not applicable**, because T2/T3/T5 have not arrived. TAP and integration-report validators were tested with fixtures; no real RLS/Auth suite or database restore is claimed.
- No application/API, root dependency/lockfile or Wrangler changes. No main/T1 merge, account/DNS setting, deployment or production credential change. Existing owner/user work in the original checkout was preserved.
- Bootstrap CI is not full A1/A5 for absent features, A3 or Phase 1 staging A1–A7 completion.

## Receiving-agent steps

1. Baseline review/integration is complete: Claude approved K1 at 4b25bf0 and incorporated it into T1; Codex recorded REVIEW: APPROVE @7faf5a6af719b5b9973a432229314b96e9b6af88 after reviewing the exact combined head and its three sanitized reports.
2. Claude reviews the supplementary scanner-regression tests and records on this branch at their exact follow-up head. The current-head CI result must pass, including all eight scanner cases. No author self-approval is claimed for these new changes.
3. Any future incorporation into T1 changes its head and requires a fresh applicable review and CI run. No Codex merge or deployment is performed. Future T2/T3/T5 activation and staging A1-A7 remain required.

## Execution history (append only)

- 2026-11-04 UTC: created an isolated worktree from the pinned T1 candidate and published draft #12. Initial hosted runs failed closed on K1 lint/fixture defects. Fixed dynamic-delete/unused-import lint findings; replaced a fixture containing Gitleaks' alphabet stopword; copied the dependency tree because pnpm rejects a symlinked task-state directory; fixed the dummy missing-report command to accept reporter arguments. No failing check was waived.
- 2026-11-04 12:05 UTC: all three jobs green at `4b25bf0`; added regression cases around the new, narrowly constrained prose exception and prepared the receiving-agent record. The follow-up head's run is linked from its pull request.

- 2026-11-04 UTC: reconciled Claude's concurrent review and T1 incorporation at 7faf5a6 without overwriting its STATUS/HISTORY updates. Combined-head CI and downloaded sanitized reports passed; Codex's scoped T1 approval was recorded on #11. Additional scanner tests/records are a follow-up, not an amendment to the already approved 4b25bf0 baseline.
