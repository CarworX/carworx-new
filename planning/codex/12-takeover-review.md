# Codex 12 — T2/T4 takeover and K1 feature-suite repair

Date: 2026-11-04 UTC. Main baseline: `18cfedc89631506fbcf66bf35233ab5ca10c4931`.

**Historical review:** this records the initial takeover. Final approvals, merged heads and the resolved workstation blocker are in [Codex 13](13-foundation-closeout-and-k2.md).

## Verdict and reviewed scope

**Claude 15: AGREE WITH CHANGES for the CI fixture assumptions identified below.** The agreed T1–T5 / K1–K4 ownership remains binding. Design #10, T1 #11 and K1 follow-up #13 have merged. D-067 closed the design start gate; D-060 owner checks remain open. No decisions are reopened.

**T2 #15: CHANGES at `b823b0326bafe2f0d2bdf1ca807b9ea5663978c2`. T4 #17: CHANGES at `cae7591eeca41e54a51fc61298c4aea61604879a`.** Their original CI heads remain red. No additional material application defect was established in this review. Approval requires the independently reviewed K1 repair, reconciliation with current main and fresh green CI on the resulting feature heads. Candidate results are supporting evidence, never approval of another SHA.

## K1 repair and evidence

[PR #18](https://github.com/CarworX/carworx-new/pull/18), branch `codex/k1-feature-suite-fixtures`, changes CI fault fixtures only. Its stable review head is `b0a24af4e3b557fc856dea21ac0df48dd17a4e75`. These records are published separately on `codex/phase1-takeover-records`.

- `missing-required-command` now removes `test:rls` from the scratch manifest and preserves unrelated suite flags. The old fixture incorrectly succeeded once T2 supplied the real command.
- `zero-tests` overrides the entire configured Vitest include list with an empty list, with `passWithNoTests: false`. `all-skipped` filters out all test names. Both cover T4's additional component/script tests.
- A `finally` restores fixture files and removes the staged synthetic Auth marker. Every case checks that scratch Git status is clean. Required suite/report/gate validation is unchanged.

| Candidate | Exact SHA | Hosted run | Result |
| --- | --- | --- | --- |
| Scaffold + repair code | `b0a24af4e3b557fc856dea21ac0df48dd17a4e75` | [41870256432](https://github.com/CarworX/carworx-new/actions/runs/41870256432) | checks/secrets/ci passed |
| T2 + same repair | `570e1a939e6506f06b35374ee25e6f9a0ccd53fc` | [41870352422](https://github.com/CarworX/carworx-new/actions/runs/41870352422) | checks/secrets/ci passed; required RLS: 154 assertions, 3 files |
| T4 + same repair | `3f837415565f41e6a2f7904a3c8aa4d5bbd3fdbc` | [41870373184](https://github.com/CarworX/carworx-new/actions/runs/41870373184) | checks/secrets/ci passed; 75 unit tests |

All ten real fault cases and six CI contract tests passed on these candidates. Three sanitized reports per feature candidate were downloaded and inspected; head identifiers and suite dispositions match. Gitleaks history/checkout scans passed. Local syntax, pinned Prettier and `git diff --check` passed. The local six contract tests passed on Node 24.14.0; authoritative CI used Node 24.22.2 / pnpm 12.16.1.

PRs [#19](https://github.com/CarworX/carworx-new/pull/19) and [#20](https://github.com/CarworX/carworx-new/pull/20) are isolated verification candidates. **Do not merge them.** #19 additionally holds Codex's temporary PostgREST review harness; its latest SHA/results are recorded below. It must not be confused with the minimal repair in #18.

## T2 — R1–R10 assessment

- **R1/R7/R8:** migration and catalog tests cover RLS on all five application/private tables, explicit authenticated policies, minimal client grants, non-exposed helpers, fixed empty search paths and revoked default function/table grants.
- **R2:** inspected all three SQL files. Declared and statically counted assertions agree: catalog 23, A4 matrix 85, boundaries 46. The full four-table, five-actor CRUD matrix is represented.
- **R3–R5:** policies use server-controlled admin membership plus `aal2`, never metadata. Tests cover forged claims, `aal1`, missing/malformed AAL, same-session membership revocation/deletion and immutable membership tenant/person columns, including upsert denial.
- **R6:** clients cannot insert or rewrite audit rows. Triggers record organisation/membership changes; update/delete/truncate protections are tested, including privileged rewrite attempts. This does not claim immunity to a database owner changing schema/triggers.
- **R9/R10:** synthetic `example.test` seeds only; pinned Supabase CLI 2.122.1; changes match T2 ownership plus coordinated dependency/script and suite flag edits. Codex accepts `rls: true`; integration remains not applicable until T3/T5.
- **Runtime:** the Linux runner started local Supabase, reset its synthetic database and passed all 154 real pgTAP assertions. This is runner-local evidence, not workstation or staging acceptance.
- **PostgREST: PASS within the synthetic fixture scope.** The initial probe executed 22 cases before its unfiltered audit PATCH received HTTP 400, rather than reaching the intended permission boundary ([diagnostic run 41876772108](https://github.com/CarworX/carworx-new/actions/runs/41876772108)). After filtering audit UPDATE/DELETE, candidate `3d15f8bb6ca7e28fb1a0db1184f9e44b72b65978` passed **24 REST probes plus all 154 pgTAP assertions** in [run 41877829916](https://github.com/CarworX/carworx-new/actions/runs/41877829916). Downloaded `checks.json`, `secrets.json` and `gate.json` all say `passed` at that exact head; RLS reports 3 files / 154 tests / 24 REST tests. Probes cover anonymous/cross-tenant denial, membership moves/upsert, admin AAL fixtures, forged metadata, revocation and audit writes. These are signed local fixture claims, not real Auth login or TOTP enrollment.
- GitHub's run/job status responses continued to show queued after completed logs and all three downloadable artifacts existed. Treat this as inconsistent metadata; the exact-head sanitized evidence establishes the executed probe results. Reconcile workflow/check status before any merge. Original T2/T4 heads are still not approved.

Workstation Docker initially could not connect. Codex started the existing per-user Docker Desktop installation; its engine pipe appeared, but the API returned HTTP 500. Ubuntu WSL separately reports a missing registered `ext4.vhdx`; no system repair or settings change was attempted. Therefore the specifically requested workstation Supabase execution remains BLOCKED. No hosted Supabase project or production data was used.

## T4 — D1–D12 assessment

Reviewed the generated token/theme and glyph contracts, self-hosted font provenance/licences, components, state animation cleanup, guard, route wiring and tests. T4's `209ccaf` code is unchanged at `cae7591`; that commit adds only saved evidence.

- **D1/D3–D7/D12:** pinned local `pnpm run check` passed lint, format, typecheck, all 75 tests and the build. Tests exercise stale token output, deliberate bad contrast, control fills/edges, consent defaults, current navigation and StepList selectors. Root package/CI/schema files remain outside T4's changes; skeleton wiring is necessary for T4.
- **D2/D7–D9:** independently ran the supplied browser audit on the built preview with Node 24.22.2, pnpm 12.16.1 and Chromium 153 / Playwright 1.63.0 on Windows. **27 checks passed, zero failed.** Phone 390×844; desktop 1440×900. No external requests; primary actions ≥44×44; all measured targets ≥24×24; 61 component/8 404 focus stops have the required outline. Reduced motion changed 0/7 canvases. Axe reported zero violations on the tested pages.
- Independent machine-readable result: [browser audit](evidence/12-t4-browser-audit.json). Temporary screenshots were inspected and are not duplicated here; the reviewed 11 saved screenshots and their index already live in Claude's T4 evidence package. All 13 listed hashes match. All 11 PNGs were opened.
- **D10:** compared desktop/phone 404 and loader captures with the approved state source. Layout, copy, service links, lens and loader families align; animated frames naturally differ. Larger phone service chips match the target-size adjustment. PR #16's additional loading page remains separate.
- **D11: AGREE** to `CARWORX_DEV_PAGES=1` on staging for review/K3 only. K2 must exclude it from production. The guard defaults closed on deployed hosts; unit tests cover absent/wrong flags and staging enablement. Actual hosted configuration remains unverified.

The first browser launch occurred before browser installation finished and failed for a missing executable; after installation the complete audit passed. Existing Wrangler/Vite deprecation/sourcemap warnings did not fail the build. These tests do not establish WCAG compliance, A6, real-device behavior or D-060 completion. The audit explicitly skips 18 gradient-backed text elements; those are not contrast passes.

## Receiving-agent steps and next work

1. Claude reviews #18 at its final full SHA. Do not merge Codex's own repair without that independent review. Under Q-021 the reviewing agent may merge an approved staging-only PR with green CI; deployments remain owner-controlled.
2. Claude incorporates only the approved repair into T2/T4, preserving task records. Reconcile main/lockfile changes in task order and record each new head. Do not include the temporary #19 probe hook in the application PR by accident.
3. Codex checks both resulting heads and fresh evidence, then records exact-SHA feature approval or remaining changes. Close verification-only PRs after their evidence is referenced and no longer needed. A changed head invalidates approval.
4. **K2 #2:** next Codex implementation branch is `codex/k2-environments`. Owns Wrangler, manual staging workflow and environment operations. Define names-only local/staging inputs and reviewed-SHA evidence; coordinate Auth/application recipient controls with T3. Hosted execution remains blocked on verified account/DNS/route/secrets/email setup. A Worker allowlist alone is insufficient for direct Auth SMTP. No email restriction agreement is fabricated here.
5. **K4 #4:** after T2 acceptance and usable local Docker, branch `codex/k4-recovery`: synthetic tenant data plus at least two private object byte streams, manifests/hashes and isolated recovery. Local results remain preparatory. Hosted destination, separate copy, operator and capacity/retention approval remain owner prerequisites.
6. **K3 #3:** after T4 acceptance, branch `codex/k3-performance`: repeated pinned mobile measurements; hosted Worker CPU p95/tails follow K2. No measurements are inferred from this component review.
7. **Claude T3/T5:** after T2 merges, implement Auth and route security together. Codex reviews real session validation, database/server MFA, revocation, cookies, CSRF/origin, redirects, no-store responses and actual Google evidence. Application APIs remain Claude-owned.

No feature merge, deployment, account/settings change, production credential or paid service was used by Codex this turn. Staging A1–A7, real Google, hosted recovery and D-060 remain open. Original checkout/untracked planning work was preserved.
