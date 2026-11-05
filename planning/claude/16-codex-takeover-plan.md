# Claude — 16: Codex takes over the build (rest of Phase 1, then Phase 2)

**Date:** 2026-11-05. **Main:** `e92aab6`. **Author:** phase1-master (Claude), at the owner's request.
**Status:** PLAN for Codex to execute. The decisions in §1 are **owner directions given in chat today**; Codex records them in DECISIONS.md on its next turn.

## 1. Owner directions recorded today (for Codex to log)

| Proposed ID | Direction |
|---|---|
| **D-069** | Docker-free local development stays (`CarworX-Native` WSL). Docker Desktop was removed before full native acceptance: full Auth and Auth-to-hook integration still fail because the native stack rejects the custom Auth email templates. **Codex fixes the template gap** and proves native parity. Docker is not reinstalled. |
| **D-070** | **Heavy runs go to GitHub CI**, not the owner's laptop. This covers K3 Lighthouse, the K4 restore drill and any Docker/Supabase full-stack suites. The laptop has about 3 GiB free disk and under 2 GiB free RAM. Use the included Actions minutes, with no paid runners (the $0 cap stands). |
| **D-071** | **Codex leads the build from here,** including application code that was Claude's (T-tasks and Phase 2 features), because Claude's usage is limited. Claude keeps **independent review**, batched and security-first: auth, RLS, privacy, payments, deploy and secrets first; UI and docs after. **Nobody approves their own work still holds.** A PR waits for Claude's formal PR review. If Claude is unavailable for more than 48 h, Codex asks the owner, and never self-approves. |

## 2. What "next" is

```
NOW ─ finish Phase 1 (A1–A7 on staging) ─────────────► PHASE 2 (free public site) ─► G-PROD (launch)
       K2 probes · K3/K4 in CI · native fix              catalogue · search · listings   legal · retention
       owner staging bootstrap → A2 → A3–A7              applications · admin · fines    Info Officer · D-060
```

**Phase 1 isn't done until A1–A7 pass on staging.** Most of what's left is Codex's, plus the owner's staging setup (guide 11, PR #30). **Phase 2** is the first product people will see: a free public site where customers find providers and providers apply. There are no bookings or payments; those are Phase 3.

## 3. Part A — finish Phase 1 (do in order)

| # | Slice | Branch / PR | Done when |
|---|---|---|---|
| A0 | **Clear the review backlog.** Re-review and merge Claude's #30 (`a31b030`), #28 (`f8f774c`) and #16 (`b273ad3`). Merge K4 #34 (`aea84ff`, Claude APPROVE). Log D-069–D-071 | existing | All merged; DECISIONS updated |
| A1 | **Native template gap (D-069).** Make the native stack accept the confirmation and recovery templates, or generate a native-only config that keeps the same `token_hash → /auth/confirm` links. Never drop them silently. Prove full Auth (52) and Auth-to-hook (12) suites pass natively. Update the native runbook | #33 → ready | Native = CI parity for Auth; Claude review |
| A2 | **K3 in CI (D-070).** `.github/workflows/perf.yml`: build, preview, 5 serial Lighthouse 13.6.0 mobile runs × 5 foundation routes on the runner. Strict budgets: perf ≥ 90, a11y ≥ 95, CLS ≤ 0.1, LCP ≤ 2.5 s. Sanitized reports only. Manual and PR triggers within the minutes budget | #32 → ready | Green budgets with artifacts; failure blocks promotion |
| A3 | **K4 in CI (D-070), plus review notes 1 and 5 from #34.** Port the drill to the Linux runner with Docker-based Supabase. Derive the pgTAP total from the TAP plans instead of hard-coding 168. Keep the WSL path optional | `codex/k4-ci` | Repeatable drill green in CI |
| A4 | **K2 owner tooling.** Finish #31: the exact hook deploy command (owner login, custom domain), the probe ledger with counters, signed app instrumentation and receipt generation for `hosted_hook` and the app negatives. The output is the sanitized schema from `scripts/ops/env/README.md` | #31 → ready | Owner can produce all 4 receipts without hand-writing JSON |
| A5 | **K2 security notes from Claude's #23 review.** (a) Hook 403 lets direct callers probe the allowlist: propose a silent 200 plus a private counter, and decide with Claude. (b) App-path timing. (c) Design a production email mode before G-PROD. Propose first, then build | `codex/k2-hardening` | Agreed and tested |
| A6 | **Owner staging bootstrap support.** Walk the owner through guide 11. Review each receipt. Open the **ready** PR (`promotion.json` → `ready`, with receipt hashes). Owner deploys; smoke passes | `codex/k2-ready` | **A2 passes** |
| A7 | **Staging acceptance.** A1 on staging; A3 with real Google (guide 4) plus admin TOTP; A4 RLS matrix against staging; A5 secret scan plus no-store on staging; A6 hosted Worker CPU p95 ≤ 8 ms plus Lighthouse on staging; A7 hosted restore (encrypted, owner destination, guide 8) | per test | **Phase 1 complete**, recorded in a Codex close-out note |

**Owner gates inside Part A:** guide 11 steps (accounts, token, secrets, hook enable), the Google local redirect (guide 4), and the backup destination (guide 8). Codex never does these itself.

## 4. Part B — Phase 2 plan (free public site; A8–A17; ends at G-PROD)

**Step B0: write the Phase 2 proposal first.** Use a `planning/codex/` note in the style of Claude 10, with tasks, owned files, tests, order and owner prerequisites. Claude reviews it and the owner approves it, as PROTOCOL and Claude 12 §4 require. The writer changes from Claude to Codex under D-071. No Phase 2 code starts before that approval.

**Proposed slices.** Tables come from PLAN §5 Phase 2, and every migration ships with its RLS policies and pgTAP tests:

| Slice | What | Key acceptance | Security focus (Claude reviews first) |
|---|---|---|---|
| **P2-1 Catalogue data** | `categories`, `services`, `branches`, `listings` (with provenance), `listing_public` projection, `verifications`, synthetic seed | A10 (no base/radius/base-derived data in public output), A4 extended to new tables | Public projection never exposes private rows |
| **P2-2 Search** | Server search endpoint: fixed premises (25 km default; 5/10/25/50; straight-line label) and mobile (customer point inside radius, coarse ~1 km point, no distance shown). Deterministic pagination; rate limits; bounded inputs; no anonymous RPC; empty results lead to demand capture | **A8, A9, A11, A17** | Anti-probing (§6.2); no geocoding stored |
| **P2-3 Public pages** | Home, category/subcategory, search results, listing page, built on T4 Studio components | **A15** (A6 budget on new routes), A16 manual | No personal data cached; no-store where personal |
| **P2-4 Provider applications** | Application → admin review (method recorded) → verification labels → live; claims and transfer of control; suspension; former staff revoked | **A12** (Playwright) | Admin actions at `aal2`; audit log |
| **P2-5 Enquiries and demand** | `enquiries`, `demand_requests` (private), `consents` (unticked by default, G8), `support_cases` | **A13** (demand never public) | POPIA consent; no public exposure |
| **P2-6 Fines pages** | Guidance plus labelled official referrals; no ID field; "no results" never means "no fines" | **A14** | No ID collection |
| **P2-7 Admin tools** | Application queue, claims, suspensions, audit-log view | A12 part; `aal2` everywhere | Server-enforced MFA |
| **P2-8 Maps (optional)** | Mapbox list-first map; `coordinate_sources` provenance; temporary geocodes never stored | **A17** | Owner Mapbox account needed |
| **P2-9 G-PROD readiness** | Production Supabase project and Cloudflare (owner-run); privacy notice and terms (D-045, cited against POPIA/CPA/ECTA); retention schedule (D-053); section 72 and latency/region; incident plan; D-060 owner checks; A7 re-run after the schema change | **G-PROD** | Owner-run release only |

**Order:** P2-1 → P2-2 ∥ P2-3 → P2-4 → P2-5 ∥ P2-6 → P2-7 → (P2-8 if the owner wants maps) → P2-9.

## 5. Rules that still hold (unchanged)

- One PR per slice: exact-head CI, a formal PR review from the *other* agent (`REVIEW: APPROVE|CHANGES @<full-sha>`, PR review not issue comment), merge commit, Q-021 for staging-only work.
- Pin versions from official sources; synthetic data only; no secrets anywhere; owner runs every hosted, account, DNS, deploy and spending step.
- Commit trailers: `Agent: codex` (or `claude`). Records: each PR updates its own STATUS/HISTORY lines. Avoid editing STATUS in several open PRs at once, because those PRs conflict every time one merges.
- Laptop limits: prefer CI (D-070). Check disk and RAM before any local Docker or native stack work.

## 6. What Claude still does

- Batched formal reviews under D-071, security-first.
- Review the Phase 2 proposal (B0).
- Keep the owner guides current. Guide 11 is in #30. Guides for production, Mapbox and the Information Officer follow when Phase 2 needs them.
