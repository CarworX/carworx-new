# Claude — 10: Phase 1 build plan

Date: 2026-11-03. Branch: `planning/design-motion-toolkit`. Base: `d5b09ce`.

**Status: PROPOSAL for Codex to agree or change.** Planning only: no application code, issues, accounts or spending. Phase 1 is owner-approved (D-038), but coding starts only after Codex reviews the design work and the owner merges this branch to `main` (the order the owner chose on 2026-11-03).

## 1. What Phase 1 is

PLAN §3 defines Phase 1 as the foundations, built with synthetic data only:
- the repo scaffold, CI and local development
- staging
- sign-in (D-042)
- the first four tables, each with RLS: `profiles`, `organisations`, `memberships` and `audit_log` (§5)
- the Studio design system in code (D-040, D-041)
- a staging deploy

There are no payments, maps, providers or real customers in it.

**Exit criteria:** A1–A7 pass on staging (§11). Phase 1 **starts local-only**. Staging is added once the owner has created it (§15 item 2), so A2 and A7 wait for staging.

**Owner decisions that shape Phase 1:**
- **D-042:** sign-in with Google or with email and password; admins need TOTP. Until the owner's OAuth client exists, Google is tested against the local auth server only (A3).
- **D-044:** production will run on the Supabase free plan. A7 therefore restores from a **no-cost backup route**, which Phase 1 builds and the drill proves (K4). That route is the one G-PROD later relies on.
- **D-051** (book and pay now for price-list services; the enquiry → range → quote flow) is Phase 3 work. It isn't in Phase 1, but the `organisations` and `memberships` model must not rule it out.

## 2. Tasks

Leads and reviewers follow PLAN §13. Each task is one or more PRs on its own `claude/*` or `codex/*` branch.

| ID | Task | Tests | Lead → reviewer | Files owned | Needs first | Owner prerequisite |
|---|---|---|---|---|---|---|
| **T1** | **Monorepo scaffold:** pnpm workspace; `apps/web` on React Router v7 running on Cloudflare Workers; TypeScript strict; lint and format; Vitest; one health route; a PR template | A1 (base) | Claude → Codex | root `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, lint and format config, `apps/web/**` except `wrangler.jsonc`, `.github/pull_request_template.md` | Branch merged to `main` | Docker Desktop and pnpm (§15 item 6) |
| **T2** | **Local Supabase and the Phase 1 schema:** `profiles`, `organisations`, `memberships`, `audit_log`, with RLS deny by default and membership-based checks (§4). Each migration ships with its pgTAP tests, including the A4 matrix (anonymous, self, member, other organisation, admin), plus a synthetic seed | A4 | Claude → Codex | `supabase/migrations/**`, `supabase/tests/**`, `supabase/seed.sql`, `supabase/config.toml` | T1 | Docker running |
| **T3** | **Sign-in (D-042):** email and password; Google; admin TOTP enforced on the server. Sessions in httpOnly cookies, validated every request; a revoked membership loses access on the next request; a Google and a password account with the same verified email are linked, not duplicated; Google requests only basic scopes | A3 | Claude → Codex (security-sensitive, so always reviewed) | `apps/web/app/auth/**`, auth routes, the auth part of `supabase/config.toml` | T2 | Google OAuth client before A3's Google path passes on staging (§15 item 5) |
| **T4** | **Studio in code:** Tailwind theme generated from `design/brand/tokens.json` (v4); Geist, Geist Mono and Caveat self-hosted; base components following the Studio design system; a living component page at `/_dev/components` that includes the D-041 404 and loaders (hold dial, skeleton, dot-grid ripple) with reduced-motion stills | A6 (frontend), part of A1 | Claude → Codex | `apps/web/app/ui/**`, `apps/web/app/styles/**`, `apps/web/app/routes/_dev.*`, the token build script | T1 | None |
| **T5** | **Security headers and boundaries:** `Cache-Control: private, no-store` on personal responses; origin and CSRF checks on cookie-authenticated mutations; a redirect allowlist; `Secure; HttpOnly; SameSite=Lax` cookies | A5 (cacheability) | Claude → Codex | `apps/web/app/server/security/**` | T3 | None |
| **K1** | **CI workflow:** on every PR at the exact head SHA, run lint, typecheck, unit tests, pgTAP RLS tests (local Supabase in the runner) and the build, plus a secret scan | A1, A5 (secret scan) | Codex → Claude | `.github/workflows/**`, CI scripts under `scripts/ci/**` | T1 | GitHub Actions minutes (§15 item 4) |
| **K2** | **Environments and Wrangler:** local and staging config; secret names; the staging deploy workflow; email recipients for staging limited to an allowlist | A2 | Codex → Claude | `apps/web/wrangler.jsonc`, `.github/workflows/deploy-staging.yml`, `scripts/ops/**` | T1, K1 | Staging Supabase project and Cloudflare route (§15 item 2); Resend subdomain (§15 item 3); account and DNS inventory (§15 item 1) |
| **K3** | **Performance-budget harness (A6):** Worker CPU p95 ≤ 8 ms with the sampled tail inspected; Lighthouse mobile performance ≥ 90 and accessibility ≥ 95; CLS ≤ 0.1; lab LCP ≤ 2.5 s; pinned profile, repeated runs; a failure blocks promotion | A6 | Codex → Claude | `perf/**`, its workflow | T4, K2 for the staging run | None |
| **K4** | **No-cost backup route and the restore drill (D-044):** a scheduled export of the staging database and storage objects to private storage at no cost; a written runbook; the drill restores both into an isolated environment and checks access controls | A7 | Codex → Claude | `scripts/ops/backup/**`, `planning/runbooks/restore-drill.md`, its workflow | T2, K2 | Staging; the owner chooses where the private backup copies are kept |

**Shared files.** Root `package.json` and `supabase/config.toml` are each touched by one PR at a time. A later PR rebases onto the earlier one; two open PRs never edit the same file (D-039).

## 3. Order

1. **T1** first: everything else sits on it.
2. Then in parallel: **T2** and **T4** (Claude) and **K1** (Codex).
3. **T3** after T2; **T5** after T3.
4. **K2** after K1, and its staging part once the owner has created staging.
5. **K3** after T4 (local runs), then on staging after K2.
6. **K4** after T2 and K2.

Local-only work (T1–T5, K1, and local K3) can all finish before staging exists. A2, A7, staging A6, and A3's Google path wait for the owner's prerequisites.

## 4. How we work (PLAN §12, §14)

- **Branches:** `claude/<task>` and `codex/<task>`, cut from `main`. Every commit has an `Agent:` trailer.
- **PRs:** use the template, list the A-tests covered, and include the test evidence.
- **Review:** the other agent records `REVIEW: APPROVE @<sha>` or `REVIEW: CHANGES @<sha>`. Nobody approves their own work.
- **Merges:** under Q-021, the reviewing agent merges staging-only PRs once CI is green on the exact head and approval is recorded for that commit. Anything touching production is merged and released by the owner.
- **Turns:** the owner still triggers each turn (L1+). No GitHub-triggered handoffs before G-AUTO.
- **Versions:** pinned at the start of Phase 1 from each tool's official docs, never from memory. Before T1, the PR records each pinned version and its source.

## 5. GitHub issues (created only after Codex agrees)

One issue per task, labelled `phase-1` and `owner:claude` or `owner:codex`. Each issue's acceptance criteria quote its A-tests from §11.

| Issue | Labels |
|---|---|
| T1 Monorepo scaffold | `phase-1`, `owner:claude` |
| T2 Local Supabase and the Phase 1 schema with RLS | `phase-1`, `owner:claude` |
| T3 Sign-in: email and password, Google, admin TOTP | `phase-1`, `owner:claude`, `security` |
| T4 Studio tokens and the living component page | `phase-1`, `owner:claude` |
| T5 Security headers and boundaries | `phase-1`, `owner:claude`, `security` |
| K1 CI workflow and secret scan | `phase-1`, `owner:codex` |
| K2 Environments and the staging deploy | `phase-1`, `owner:codex` |
| K3 Performance-budget harness | `phase-1`, `owner:codex` |
| K4 Free backup route and the restore drill | `phase-1`, `owner:codex` |

## 6. Setting up this computer (Windows)

Needed before coding (§15 item 6):
- **Docker Desktop** with the WSL2 backend, installed and running. On 2026-11-03 the `docker` command was present, but its engine wasn't running.
- **pnpm**, turned on through Corepack (`corepack enable pnpm`).
- **Supabase CLI and Wrangler** are added as project dev dependencies. Nothing is installed globally.
- Node 24, git, `gh`, Deno and WSL (Ubuntu) were already present on 2026-11-03.

The owner installs or turns on Docker Desktop, because agents don't install system software unasked.

## 7. Owner prerequisites, by when each is needed

| Item | Needed by |
|---|---|
| Codex review of the design work, then the merge of `planning/design-motion-toolkit` to `main` | Before T1 |
| Docker Desktop running, pnpm enabled | Before T1 |
| GitHub Actions minutes | K1 |
| Account inventory and who controls the `carworx.app` DNS | K2 |
| Staging Supabase project (free) and Cloudflare staging route, with staging-scoped secrets | K2, and so A2, A7 and staging A6 |
| Resend subdomain with a staging allowlist | K2 |
| Google OAuth client (local and staging redirect URLs) | A3's Google path on staging |
| Where private backup copies are kept (free) | K4 |

## 8. Not in Phase 1

- payments
- maps
- listings and search
- bookings
- providers or real customers
- production, and any production credentials
- spending

The D-051 flows, the fines partner plan (D-052), the legal drafts (D-045) and the retention schedule (D-053) are later work. They need their own proposals.

## 9. Questions for Codex

1. Do you agree with your four tasks (K1–K4), their file ownership, and the order?
2. For K4: which free private store for the backup copies do you propose, and how often should exports run? The owner picks where it lives.
3. For K1: which secret scanner do you propose, and how does it run without paid services?
4. Is there anything in A1–A7 that this plan doesn't map to a task?
