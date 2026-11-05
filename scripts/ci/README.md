# K1 CI contracts

K1 owns this directory and `.github/workflows/ci.yml`. The workflow checks the PR's exact head on standard Ubuntu 24.04, with read-only repository/PR permissions, no application secrets, no cache and seven-day sanitized artefacts. `ci` is the final gate. An old, cancelled, missing or failed run cannot approve a new head. GitHub Free process controls still require the reviewer to verify the current head and approval before any authorised merge.

## Bootstrap

The existing scaffold pins Node in `.node-version` and pnpm in `package.json`. K1 verifies both, installs the frozen lockfile, runs the existing lint/format/types/test/build commands and validates the Vitest JSON report. Currently there is one test workspace (`apps/web`); adding another test workspace must add an individual report contract rather than silently overwrite its results.

`node --test scripts/ci/core.test.js` tests suite activation, report validation and the gate. The workflow additionally runs `quality-fixtures.js`: ten actual command/activation faults in a new temporary worktree. It copies installed dependencies while preserving package links; the real node_modules directory satisfies pnpm task-state safety. It edits neither the checked-out PR nor its index. Scanner fixtures use a separate temporary Git repository and an assembled synthetic credential; no credential fixture is committed to the project.

## Activating T2 and T3/T5

Service stages are recorded separately as `startup`, `reset`, `rls`, `integration` and `cleanup`. A failure publishes only its fixed stage label; command output and validator details remain private. Later stages do not run after a failure, cleanup is always attempted, and a cleanup error cannot replace the first failure. The gate requires passed startup/reset/cleanup evidence whenever either feature suite applies. `future-stages.test.js` covers stage failures, missing/malformed reports and simultaneous suite/cleanup failure.

`contract.json` version 1 has boolean `rls` and `integration` flags. Unit tests cannot be disabled. The base contract and base/current source paths are checked: introduced migrations require RLS; Auth/security implementation paths and conventional auth routes require integration. Once required in the base, a suite cannot be disabled or made not applicable by deleting its files. Required commands, tests and reports must exist and execute. False flags are explicitly **not applicable**, never feature acceptance.

The corresponding Claude task adds its root script in a serialised edit of `package.json` and enables its flag in coordination with K1. No application APIs belong to K1.

### T2: `test:rls`

- Pin `supabase` to an exact version in the root dependencies/devDependencies; supply local config, synthetic seed and pgTAP SQL files under `supabase/tests/database/`.
- K1 starts local Supabase and resets the database. The script `pnpm run test:rls` must execute the real pgTAP files and exit nonzero on failure.
- The script receives a fresh absolute `CI_RLS_REPORT_DIR`. For every SQL file, write its full TAP output to `<relative SQL filename>.tap` under that directory, preserving subdirectories. Example: `tenant.test.sql` produces `tenant.test.sql.tap`. Do not fabricate a passing plan from a CLI exit code or a summary.
- K1 requires exactly one report per SQL file, a nonzero complete plan, consecutive assertions and no failures, SKIP, TODO or bailout. Raw TAP and service output stay private; only counts are published. Supabase is stopped without a backup in a `finally` block.

### T3/T5: `test:integration`

- Run against the isolated local Supabase instance started/reset by K1, using synthetic identities and the local mail sink.
- `pnpm run test:integration` must exit nonzero on failure and write its Vitest JSON report to the fresh absolute `CI_INTEGRATION_REPORT` path. Configure Vitest's JSON reporter to use that environment variable. K1 requires passed assertions, nonzero executed tests and zero skipped/TODO tests, then publishes counts only.
- The script and real tests arrive together with Auth/security code; a placeholder, missing command/report or fixture-only Google result cannot complete A3. Supabase's local provider keys and report contents are not uploaded.

## Secret scanning

Gitleaks CLI 8.30.1, Linux x64, is verified against SHA-256 `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`. History scans cover everything reachable from the tested HEAD; the clean checkout is scanned separately in a job that never installs project dependencies. Wrong checksums, scanner errors and findings fail. No automatic baselines, root `.gitleaks.toml`, inline allow comments or project ignore files can suppress results. One manual prose exception is proposed for Claude review: the Resend checklist at codex-vendor-access.md line 10 (historical commit 668466e234e65c92dfceba3037a34a9ca9e5bcbc, or the identical checkout line). It matches only generic-api-key and the full line SHA-256 e26004a8204052de2bb98025b77e9a30afc413c2ce14214eb18ee6c43c5e3f56. The technical phrase retry/suppression is not a credential; the complete line was compared to known checklist prose. Every applied exception is reported explicitly. Changed lines, other commits, other files and other rules remain blocked. Any further scanner-policy exception needs a reviewed K1 change.

The scanner runs with 100% redaction and captured stdout/stderr. Raw results stay in runner temporary storage and are never uploaded or printed. Published findings contain only rule, file, line and commit metadata. No Gitleaks Action licence or paid scanner service is used.

## Evidence and review

`checks.json`, `secrets.json` and `gate.json` record source/base/merge-base/workflow SHAs, run/attempt and tool/image details. The checks summary records every stage and the reason for future suites being not applicable. Job summaries pass to the final gate through outputs; upload failure still fails the originating job. Artefacts last seven days; retain relevant run links and results in the task handoff.

K1 targets `claude/t1-scaffold`. Claude reviews the exact K1 commit and incorporates it into T1; Codex reviews the combined head and checks its new CI run. This workflow performs no merges or deployments. Bootstrap success is not acceptance of future suites, A1/A5 for absent features, A3 or Phase 1 staging A1–A7.
# K2 required delivery and operations checks

K2 adds required `operations` test counts to the checks gate and `auth_delivery`
after the existing integration stage. The latter runs a disposable Linux local
Supabase stack with the signed HTTP hook and a synthetic capture adapter. Its
12 fixed checks/report must match the exact PR head, execute completely and have
zero failures/skips/TODOs. Missing or malformed evidence fails, and cleanup cannot
erase a primary failure. Raw service/mail output remains private. This does not
establish hosted staging delivery. See `scripts/ops/env/README.md` and Codex 17.
