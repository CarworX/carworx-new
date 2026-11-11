# G-PROD checklist (free public site)

**Purpose:** one place to see what stands between today and the free site going live. G-PROD is in PLAN §18; who does what is in Claude 17 §4.
**State as of:** 2026-11-10 (SAST), `main` at `b899190`, with Bundle C draft PRs #56 (runbooks), #58 (legal) and #59 (owner guides) open.
**Rule:** an item closes only on its evidence. A draft, a plan or a local run is never a pass.

**Legend:** ✅ done · 🟡 drafted, waiting on review or approval · 🔴 open · ⛔ blocked by another item

## Summary

| | Count |
|---|---|
| ✅ Done | 0 |
| 🟡 Drafted | 10 |
| 🔴 Open | 14 |
| ⛔ Blocked | 6 |
| **Total** | **30** |

```
Phase 1 closed ─► production project ─► backups (BK-1) ─► A7 on final schema ─┐
region chosen ──┘                                                              ├─► owner release ─► G-PROD
legal approved ─► IO registered ─► D-060 checks ─► repo gaps fixed ────────────┘
```

## A. Foundations

| # | Item | Source | Who | Evidence that closes it | Today |
|---|---|---|---|---|---|
| A1 | Phase 1 closed: A1–A7 passed on staging | D-074, PLAN §3 | Codex (staging, D-071), owner | STATUS records each A-test with its run link | 🔴 Staging promotion is blocked (STATUS) |
| A2 | Hosted application timing measured and reviewed | STATUS BLOCKER | Owner deploys, agents review | Timing receipt per stratum, reviewer record | 🔴 |
| A3 | Phase 2 A8–A17 pass | PLAN §3 | Agents | CI links on `main` for A8–A15 and A17; A16 manual record | 🔴 A8–A11 and A17 are in CI from P2-2/P2-3; A12 (Bundle A), A13, A14 (Bundle B) and the manual A16 are open |

## B. Production project (Claude 17 §4 row 1)

| # | Item | Source | Who | Evidence that closes it | Today |
|---|---|---|---|---|---|
| B1 | Production runbook reviewed | Claude 17 §4 | Claude drafts, coordinator and owner review | Merged runbook | 🟡 #56 |
| B2 | Repo gaps P-1 to P-5 fixed (no production Wrangler env, no `CATALOGUE_DB` binding, no production mode, no production Auth email path, Turnstile names) | Runbook §1 | Agents, reviewed | Merged PRs | 🔴 |
| B3 | Supabase production project on the **free plan**, in the chosen region | D-044, PLAN §18 | Owner ([guide 14](../owner-guides/14-production-project.md)) | Receipt: project ref, region, migration count | ⛔ B2, C1, A1 |
| B4 | Hyperdrive `CATALOGUE_DB` with **caching off**; direct-or-pooler question (OQ-1) answered | D-081, runbook §6 | Owner | Receipt: config ID, "caching disabled", connection type | ⛔ B3 |
| B5 | Worker secrets set by name; staging-only names absent | Runbook §7 | Owner | `wrangler secret list` names in the receipt | ⛔ B3 |

## C. Latency and region (Claude 17 §4 row 3)

| # | Item | Source | Who | Evidence that closes it | Today |
|---|---|---|---|---|---|
| C1 | London vs Frankfurt measured from JNB and CPT; region recorded in DECISIONS | PLAN §4, §18 | Owner runs the script, agents read it | Two JSON receipts (`edge.colo` JNB and CPT), a D- entry with the files' SHA-256 | 🟡 Method and script in #56; not run |

## D. Backups and restore (Claude 17 §4 row 2)

| # | Item | Source | Who | Evidence that closes it | Today |
|---|---|---|---|---|---|
| D1 | Backup and pause runbook reviewed | D-044 | Claude drafts, review | Merged runbook | 🟡 #56 |
| D2 | **BK-1:** a hosted exporter that covers every table and Storage object, with a read-only login | Runbook §2 | Agents build, review | Merged PR, synthetic CI drill listing every Phase 2 table | 🔴 |
| D3 | Production destinations, restore operator and encryption tool chosen (OQ-B1 to B3) | D-044, D-072 | Owner | Names (not keys) recorded | 🔴 |
| D4 | Daily backup and keep-alive running at $0; the first week passes without a pause (OQ-B4) | D-044 | Owner | Seven daily ciphertext hashes from both copies; project still active after 7 days | ⛔ B3, D2 |
| D5 | **A7 re-run on the final Phase 2 schema** passed on a staging restore | PLAN §3, §18 | Codex or Claude runs, owner holds keys | Sanitized receipt: counts, hashes, RLS TAP counts, TOTP | ⛔ D2 |

## E. Legal and privacy (Claude 17 §4 rows 4–9)

| # | Item | Source | Who | Evidence that closes it | Today |
|---|---|---|---|---|---|
| E1 | Privacy notice approved and published | D-045, PLAN §9.2 | Claude drafts, owner approves | Owner's written OK; the page live in production | 🟡 #58. Waits on OQ-L1, L2, L3 |
| E2 | Terms of use for the free site approved | D-045 | Claude drafts, owner approves | Owner's written OK; the page live | 🟡 #58 |
| E3 | Retention schedule approved; the accountant colleague has noted the financial row | D-053, PLAN §9.3 | Claude drafts, accountant reviews, owner approves | Owner's written OK | 🟡 #58 |
| E4 | Retention gaps fixed: limiter expiry (R-1), deletion jobs (R-2) | Retention schedule §3 | Agents | Merged PRs with tests | 🔴 |
| E5 | Section 72 assessment approved, with each vendor DPA confirmed in force (OQ-L4) | PLAN §4, §18 | Claude drafts, owner approves | Signed assessment; dates each DPA was accepted | 🟡 #58 |
| E6 | Probing residual risk accepted in writing | PLAN §6.2 | Claude assesses, owner accepts | Signed acceptance in `probing-risk.md` | 🟡 #58 |
| E7 | Provider onboarding shows the probing notice (M1) and records that it was shown | PLAN §6.2 | Bundle A | Merged PR plus a test | 🔴 |
| E8 | Incident plan approved and the tabletop drill done | PLAN §9.4 | Claude drafts, owner approves and drills | Signed plan; drill timings recorded here | 🟡 #58 |
| E9 | Information Officer registered with the Information Regulator | D-043, PLAN §18 | Owner ([guide 13](../owner-guides/13-information-officer.md)) | Registration date and certificate number | 🔴 Waits on OQ-L1 |
| E10 | Codex's independent cross-check of E1–E8 (D-045) | D-045 | Codex | `REVIEW:` record on the legal PR | 🔴 Codex unavailable (D-080) |

## F. Owner design checks (D-060, guide 9)

Each stays **open until evidenced**; never counted as a pass from screenshots (D-060).

| # | Item | Who | Evidence that closes it | Today |
|---|---|---|---|---|
| F1 | Live design-system screenshots (rows 13 and 14) | Owner | `13-*-live.png`, `14-*-live.png`, opened and recorded by Claude | 🔴 |
| F2 | Real 200% zoom (row 15) | Owner | `15-zoom-200-*.png` on staging pages | 🔴 |
| F3 | Phone screen reader, VoiceOver or TalkBack (row 19) | Owner | `19-notes.md` | 🔴 |
| F4 | Physical devices and browsers: iPhone Safari, Android Chrome, desktop Firefox (row 20) | Owner | `20-<device>-*.png` | 🔴 |

## G. Release

| # | Item | Source | Who | Evidence that closes it | Today |
|---|---|---|---|---|---|
| G1 | Turnstile widgets made (needed by Bundle B forms) | Claude 17 §5 | Owner ([guide 12](../owner-guides/12-turnstile.md)) | Sitekeys sent; secret set | 🟡 Guide in #59 |
| G2 | **Owner-run release** of the approved `main` commit, with smoke checks passing | PLAN §12, §18 | Owner | Version ID, SHA and smoke receipt (runbook §9–10) | ⛔ everything above |

## How to update this file

Change an item's state only in a PR that links the evidence. Add the date in SAST.
