# Claude — 10: Phase 1 build plan

Date: 2026-11-03. Branch: `planning/design-motion-toolkit`. Base: `d5b09ce`.

**Status: PROPOSAL, amended for Codex 08 (see §10).** Planning only: no application code, issues, accounts or spending. Phase 1 is owner-approved (D-038), but coding starts only after Codex reviews the design work and the owner merges this branch to `main` (the order the owner chose on 2026-11-03).

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
- **D-042:** sign-in with Google or with email and password; admins need TOTP. **Real Google sign-in is BLOCKED locally and on staging until the owner supplies the OAuth client**, because Supabase needs a client ID and secret for local development too (Codex 08 B1). Before then, only callback, error and session contract tests run, against controlled fixtures labelled as such. A3 doesn't pass on fixtures.
- **D-044:** production will run on the Supabase free plan. A7 therefore restores from a **no-cost backup route** that K4 builds. It starts with a **local synthetic drill** (owner choice, D-059). Hosted activation waits for an owner-chosen existing private destination and operator (B3).
- **D-051** (book and pay now for price-list services; the enquiry → range → quote flow) is Phase 3 work. It isn't in Phase 1, but the `organisations` and `memberships` model must not rule it out.

## 2. Tasks

Leads and reviewers follow PLAN §13. Each task is one or more PRs on its own `claude/*` or `codex/*` branch.

| ID | Task | Tests | Lead → reviewer | Files owned | Needs first | Owner prerequisite |
|---|---|---|---|---|---|---|
| **T1** | **Monorepo scaffold:** pnpm workspace; `apps/web` on React Router v7 running on Cloudflare Workers; TypeScript strict; lint and format; Vitest; one health route; a PR template. Merged only with K1's reviewed CI included (§4, CI bootstrap) | A1 (base) | Claude → Codex | **Scaffold only:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, lint and format config, the initial `apps/web` skeleton (app shell, health route, Vite config), `.github/pull_request_template.md`. Later folders belong to their tasks | Branch merged to `main` | Docker Desktop and pnpm (§15 item 6) |
| **T2** | **Local Supabase and the Phase 1 schema:** `profiles`, `organisations`, `memberships`, `audit_log`, with RLS deny by default and membership-based checks (§4). Admin policies require an `aal2` session in RLS itself, so the directly exposed database API is protected as well as the Worker. Each migration ships with its pgTAP tests, including the A4 matrix (anonymous, self, member, other organisation, admin) and cases where forged user metadata or a revoked membership must not grant access. Synthetic seed | A4, A3 (database half) | Claude → Codex | `supabase/migrations/**`, `supabase/tests/**`, `supabase/seed.sql`, the database part of `supabase/config.toml` | T1 | Docker running |
| **T3** | **Sign-in (D-042):** email and password; Google; admin TOTP enrolment and challenge. Sessions in httpOnly cookies, validated on every request. Accounts link only through Supabase's verified identity linking, never because email strings match. Google requests only basic scopes. **Acceptance (B2):** an admin with an `aal1` session is refused at admin Worker routes and, through T2's policies, at the database API; `aal2` is allowed; membership revocation takes effect on the next request; sign-up confirmation, password reset, expired or invalid links and email-delivery failure each show a recoverable state (local tests use Supabase's local mail sink); real Google sign-in tests the redirect, code exchange, logout, both account-linking directions and denied consent, once the client exists. Ships together with T5 before staging sign-in is exposed | A3 | Claude → Codex (security-sensitive) | `apps/web/app/auth/**`, auth routes, the Auth part of `supabase/config.toml` | T2 | Google OAuth client, needed **locally and** on staging for the real Google path (§15 item 5) |
| **T4** | **Studio in code:** Tailwind theme generated from `design/brand/tokens.json` (v4); Geist, Geist Mono and Caveat self-hosted; base components following the Studio design system; a living component page at `/_dev/components` that includes the D-041 404 and loaders (hold dial, skeleton, dot-grid ripple) with reduced-motion stills | A6 (frontend), part of A1 | Claude → Codex | `apps/web/app/ui/**`, `apps/web/app/styles/**`, `apps/web/app/routes/_dev.*`, the token build script | T1 | None |
| **T5** | **Security boundaries, wired into routes:** `Cache-Control: private, no-store` on personal responses; Origin and CSRF checks on cookie-authenticated mutations; a redirect allowlist; `Secure; HttpOnly; SameSite=Lax` cookies. Built **with the first auth endpoints** and tested through those routes in integration tests (hostile Origin, CSRF and redirect inputs fail; cookie flags and session validation checked), not as unused helpers | A5 (cacheability), A3 | Claude → Codex | `apps/web/app/server/security/**`, plus its route wiring in T3's files, serialised with T3 | T3 (same PR series) | None |
| **K1** | **CI workflow:** on every PR at the exact head SHA, run lint, typecheck, unit tests, pgTAP RLS tests (local Supabase in the runner), the auth and security integration tests and the build. Secret scan with the **Gitleaks CLI** (MIT), pinned by version and checksum, redacted output, scanning PR history through the head and the checked-out tree. A required suite that is missing or skipped fails the run; checks for features not yet built are recorded as not applicable, never as passed | A1, A5 (secret scan) | Codex → Claude | `.github/workflows/ci.yml`, `scripts/ci/**` | T1 candidate (built on its own branch against T1's unmerged scaffold) | GitHub Actions minutes (§15 item 4) |
| **K2** | **Environments and Wrangler:** local and staging config; secret names; the staging deploy workflow. The staging recipient allowlist covers **Supabase Auth SMTP as well as** application email; K2 and T3 agree how before any staging sign-in test (B2) | A2 | Codex → Claude | `apps/web/wrangler.jsonc`, `.github/workflows/deploy-staging.yml`, `scripts/ops/env/**` | T1, K1 | Staging Supabase project and Cloudflare route (§15 item 2); Resend subdomain (§15 item 3); account and DNS inventory (§15 item 1) |
| **K3** | **Performance-budget harness (A6):** Lighthouse mobile performance ≥ 90 and accessibility ≥ 95; CLS ≤ 0.1; lab LCP ≤ 2.5 s; pinned profile, repeated runs. **Hosted Worker CPU p95 ≤ 8 ms is measured separately**, from Cloudflare's Worker metrics, with the tail inspected. Browser wall time is not CPU time. A failure blocks promotion | A6 | Codex → Claude | `perf/**`, `.github/workflows/perf.yml` | T4 for local runs; K2 for hosted | None |
| **K4** | **No-cost backup route and the restore drill (D-044, B3):** first, a **local** export and restore of synthetic data (D-059). Then the contract in §10 B3: database and Storage object bytes, with a manifest and hashes, encrypted, and restored into an isolated target with access controls checked. A metadata-only restore cannot pass A7, and a local pass is preparatory, not A7 | A7 | Codex → Claude | `scripts/ops/backup/**`, `planning/runbooks/restore-drill.md`, `.github/workflows/backup.yml` (if a scheduler runs there) | T2 (local); K2 and the owner's destination (hosted) | Staging; the owner picks an existing private destination and operator. If none exists, the hosted route is marked BLOCKED |

**Shared files.** Root `package.json` and `supabase/config.toml` are each touched by one PR at a time, in task order. A later PR rebases onto the earlier one, and two open PRs never edit the same file (D-039). CI belongs to K1 alone, the staging deploy and environment operations to K2, the performance workflow to K3, and backup scripts and their scheduler to K4. A task that needs a change in another task's files asks that file's owner.

## 3. Order

1. **T1** first: everything else sits on it.
2. **K1** is built alongside T1 and merged inside it (§4, CI bootstrap). Then in parallel: **T2** and **T4** (Claude), with K1's suites growing as they land.
3. **T3 and T5** together after T2, as one PR series. Staging sign-in isn't exposed until both are in.
4. **K2** after K1, and its staging part once the owner has created staging.
5. **K3** after T4 (local runs), then on staging after K2.
6. **K4**: the local synthetic drill after T2; the hosted drill after K2 and the owner's destination.

Local-only work can all finish before staging exists: T1–T5 (except real Google sign-in), K1, local K3 and the local K4 drill. The rest waits for the owner's prerequisites: A2, A7's hosted evidence, hosted A6, and **A3's real Google path, which needs the OAuth client even locally**. A local recovery pass is preparatory evidence, not Phase 1 completion.

## 4. How we work (PLAN §12, §14)

- **Branches:** `claude/<task>` and `codex/<task>`, cut from `main`. Every commit has an `Agent:` trailer.
- **PRs:** use the template, list the A-tests covered, and include the test evidence.
- **Review:** the other agent records `REVIEW: APPROVE @<sha>` or `REVIEW: CHANGES @<sha>`. Nobody approves their own work.
- **Merges:** under Q-021, the reviewing agent merges staging-only PRs once CI is green on the exact head and approval is recorded for that commit. Anything touching production is merged and released by the owner.
- **Turns:** the owner still triggers each turn (L1+). No GitHub-triggered handoffs before G-AUTO.
- **CI bootstrap (agreed with Codex's handoff note):**
  - Codex builds K1 on its own branch, against T1's unmerged scaffold.
  - Claude records approval of K1 and includes the reviewed CI commit in T1. Codex then reviews the combined T1 head, and the bootstrap checks run on that exact head before the merge.
  - So no scaffold is merged without CI. This doesn't authorise an agent to merge the design branch.
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
| Google OAuth client (local and staging redirect URLs) | A3's real Google path, **locally as well as on staging** (B1) |
| An existing private place for the backup copies, a second copy elsewhere, and who runs the backups | K4's hosted drill (the local drill doesn't need it) |

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

## 10. Response to Codex 08 (2026-11-03, reviewed head `280373e`)

| Item | Disposition | Where |
|---|---|---|
| **B1** Real Google sign-in needs the client locally | **AGREE.** Real Google sign-in is BLOCKED locally and on staging until the owner's client exists. Fixture tests are labelled as such, and A3 can't pass on them. Accounts link only through verified identity linking | §1 D-042; T3; §3; §7; PLAN §11 A3, §15 item 5 |
| **B2** Security boundary testable in Phase 1 | **AGREE.** `aal2` is enforced in RLS (T2) and at the Worker (T3); membership revocation and forged metadata are tested; confirmation, reset, expired-link and delivery-failure states use the local mail sink; the Auth SMTP allowlist is agreed between K2 and T3 before staging sign-in; T5 is wired into routes and ships with T3 | T2, T3, T5, K1, K2 |
| **B3** Backup contract | **AGREE**, with the defaults below, for owner approval. The local synthetic drill comes first (D-059). The hosted route stays BLOCKED until the owner names an existing private destination, a second copy in a separate place, and an operator. No new service or paid tier is assumed | K4; §7; below |
| **Ownership** | **AGREE.** T1 is scaffold only. CI belongs to K1, the staging deploy and environment operations to K2, the performance workflow to K3, and backups to K4. Shared-file edits are serialised. Missing or skipped required suites fail the run | Task table; Shared files |
| **CI bootstrap** (handoff note) | **AGREE** | §4 |
| **Gitleaks CLI** | **AGREE** | K1 |
| **§9 answers 1–4** | **AGREE**, including K3's split between lab measures and hosted Worker CPU | K3 |

**B3 backup contract (agreed proposal; the owner approves before hosted use):**
- **Frequency:**
  - daily, plus before every migration
  - recovery point of 24 hours at most
  - a missed run triggers a catch-up run
  - the operator is alerted when the latest complete set is more than 24 hours old
  - recovery time is measured in A7, and its target is proposed from that result
- **Contents:**
  - roles, schema, data and migration history
  - policies, triggers and the Auth configuration
  - all Storage object bytes and bucket settings, exported separately
  - recovery keys and configuration stay in an owner-held procedure, outside Git and outside any environment an agent can reach
- **Consistency:** a manifest records the source revision, the backup window, each object's version and hash, and completion. A set with a partial database or a partial set of objects is never marked complete. The first drill uses a quiet synthetic fixture, which isn't a claim about live consistency.
- **Retention:** 7 daily sets and 4 weekly sets to start with, subject to the D-053 schedule, legal holds and the destination's capacity.
- **Verification:** restore synthetic tenant records, Auth identities and at least two private objects into an isolated target. Then check:
  - hashes and counts
  - that cross-tenant access is denied
  - admin MFA
  - access to private storage
- **Cost:** export volume, egress, retention and runner time are measured against the actual free allowances.
- **Who controls it:** production scheduling, credentials and restores stay under the owner's control.
