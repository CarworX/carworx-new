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


## 2026-11-03 — Codex review of Claude 09 and corrections

- Reviewed `2b0258c8ef6b357f62f9383b6d97d3a024c94b54` against `173f476`; see [Codex 07](codex/07-claude09-review.md) for exact findings, commands, results and limits. C1–C3 accepted within scope; Claude 09 AGREE WITH CHANGES (R1 Important, R2–R3 Minor). No new decision/consensus or complete design readiness is claimed.
- Fresh evidence: pack QA exit 0; reproducible corrected HTML blob; both checkout PNGs and PDF pages 22–23 visually checked; approved-states QA exit 0, 16 loads with no console errors/overflow. Isolated archive only; no dependency installation. Initial PDF-library import and archive-local Git lookup limitations resolved using existing PyMuPDF and the owning Git repository; details in Codex 07.
- STATUS baton to Claude to amend the audit plan, then Codex delta review. Owner retains merge and later phase/release decisions. No Claude source or DECISIONS edit, application work, live-system write, spending, main merge or deployment. Publish only this review and shared status/history on the existing design branch; remote verification reported in the publishing chat.

## 2026-11-03 — Claude round 07: owner decisions, Claude 09 delta, Phase 1 build plan

- Base: `d5b09ce` (Codex 07), reached by a fast-forward pull. Uncommitted owner-decision edits were carried over, with no overlap with Codex's files.
- Owner decisions, in Claude chat: D-042 to D-053, each quoted in OWNER-QUESTIONS round 07, with PLAN §§2, 3, 6.6, 7, 9.1–9.3, 11, 15, 16, 18 and 20 updated to match. The owner asked for multiple-choice questionnaires; the answers are recorded in the owner's own words where they were typed.
- Changes:
  - Claude 09: §4.4 saved-evidence routes, row 17a, current-state note, History entry.
  - New: Claude 10, the Phase 1 build plan.
  - STATUS: baton to Codex, turn 17. This entry.
- Not included: `claude/11-revenue-streams.md`, which a separate Claude session is still writing with the owner. It is published once that discussion ends.
- Limits: no application code, issues, accounts, outreach, emails, installs, spending, merge or deployment. Nothing was run or rendered for the audit.

## 2026-11-03 — Claude: revenue streams (Claude 11, D-054 to D-056)

- Claude 11 was written by a side session that the master session started at the owner's request. It touched only its own file. The master session read the whole file before publishing it.
- Recorded:
  - D-054: commission of 10%, capped at R500; no lead or customer fees; founding providers get 3 months free.
  - D-055: Provider Pro at about R149–R199 a month, with "Pro preview" labels.
  - D-056: the later streams, and the ones not pursued.
  - Also PLAN §17, OWNER-QUESTIONS and STATUS.
- Open for the owner: whether one bay or diary stays free (Claude 11 §6.3). For Codex: the proposed entry and stop numbers, and the extra ideas.
- Limits: nothing activated; no accounts, outreach, billing code or spending.
- Follow-up, the same day: the owner answered "Yes, one free". One bay or diary stays free for every provider, and multi-bay planning and staff rosters become Pro. Recorded in D-055 and in Claude 11 §6.3.
- Follow-up, the same day: the owner asked that businesses set how many customers each bay or diary serves at once. Recorded as D-057, with PLAN §6.3 and A18 updated; the earlier one-job-per-resource rule is replaced. The concurrency design is for Codex review.

## 2026-11-03 18:02 UTC — Codex 08, review of `280373e`

- Reviewed all four commits after Codex 07 (`d5b09ce`) on `planning/design-motion-toolkit`; main remains `b104e43`, no open PRs at inspection. Owner decisions D-042–D-057 acknowledged; no new owner authority or complete design sign-off inferred.
- [Codex 08](codex/08-phase1-and-revenue-review.md): Claude 09 R2/R3 accepted; R1 remains open because the per-figure route omits 31 sibling state panels. Claude 10/11 AGREE WITH CHANGES: real Google OAuth prerequisites, auth/security acceptance, no-cost backup contract, shared ownership, current PLAN revenue records and commission-bearing measurement cohorts. Answers K1–K4, scanner and backup questions; D-057 detailed concurrency proposal remains later work.
- Read-only official-source checks and source/structure inspection in an isolated archive; no audit, render, application tests, installs, accounts, deployment or merge. Independent scoped review corroborated the main findings and checked the draft; wording corrections applied. Existing pack/state QA remains dated evidence, not a fresh visual audit.
- Published review plus current STATUS and this append-only entry only; checkout HEAD/index/tracked files preserved. Baton to Claude to amend/respond. Issues and coding wait for their recorded gates; full visual review and owner design-branch merge remain pending.

## 2026-11-03 — Claude: response to Codex 08

- Base: `8800ba1` (Codex 08 and its execution handoff note), fast-forwarded.
- **Claude 09, R1:** the selector now captures the 31 sibling state panels as well as the 8 phone figures, with count checks and failure on empty crops. The mobile cover, summary and brand views are mapped to route C.
- **Claude 10:**
  - B1 (real Google sign-in blocked until the client exists, fixtures labelled), B2 (`aal2` at both boundaries, revocation, email-failure paths, Auth SMTP allowlist, T5 wired with T3), B3 (backup contract) and ownership are all agreed.
  - The CI bootstrap and Gitleaks are agreed.
  - §10 records each disposition.
- **Claude 11:** V1 cohort and window definitions and the V2 fee, refund and reminder definitions are added. The Paystack split note is corrected.
- **PLAN (S1):**
  - the revenue order and exclusions are now current
  - Q-022 wording, the capacity architecture line, A3, §15 Google item, the refund reserve row and G-PAY (registered company, funded reserve) are updated
  - the sources range is updated
- **Decisions:** the owner's Codex-chat choices are recorded as D-058 (Claude evidence first) and D-059 (local restore drill first).
- **Not yet done:** C4 and C5. C5 needs the owner's OK to run scripts on an isolated copy. Baton stays with Claude.
- Limits: no scripts run, nothing rendered or published, no application code, issues, accounts or spending.

- **2026-11-04, Claude, C5 evidence package** (owner: "Yes, run them"):
  - **Run:** the repo scripts ran on `git archive 5a805b3` in `%TEMP%`. Nothing ran in the owner's checkout. Routes E, S1, S3 and Q are the existing scripts. C, M and P are new, and their sources are saved in `audit-10/_tools/`.
  - **Output:** 259 files under `planning/claude/audit-10/`, logged in `index.md` with SHA-256.
  - **Count check:** 8 phone figures and 31 state panels, as expected.
  - **Blank check:** clean.
  - **Mirror cards:** 21, every blob resolved, labelled mirror not live.
  - **Observations for Codex:**
    - 23 focus stops at 390
    - the menu re-run after a CDP key fault in Claude's tool
    - the Thandi frame at 390 in motion
    - the SVG pin-number sampler artefact
    - row 17a coverage
  - **Still blocked:** rows 13 and 14 (live cards), 15, 19 and 20, all owner-only.
  - **Limits:** no installs, no live design system, no accounts, nothing published. Baton to Codex.
- **2026-11-04, Claude, Claude 12 (remaining work and next phase):**
  - **Request:** the owner asked for a clear definition of what's left and who handles it, to put to Codex.
  - **Owner answers:**
    - the owner-only checks happen before launch (D-060)
    - the agreed Phase 1 split is kept (D-061)
    - "CarworX App" is staging (D-062)
    - step-by-step guides (D-063)
    - the Coming Soon page is scrapped (D-063)
  - **Removed at the owner's request:** the session was archived, and the worktree `cw-coming-soon` and the local branch `claude/coming-soon-page` (`9027a3d`, never pushed) were deleted.
  - **Supabase check:** Claude read the public Auth settings of project `gdiyrdqfkthtcglgqnts`. Google and email are enabled. No settings were changed.
  - **Found:** C5 still lacks per-row PASS, FINDING or BLOCKED verdicts and a full image inspection, as the handoff note requires. This is now recorded as Claude task C-a.
  - **Limits:** no code, issues, accounts or spending. Baton to Codex.

## 2026-11-04 — Codex 09: Claude 12 approval and C5 receipt

- Reviewed head `95637fbf4fd5e9be54b9c0635ecb3379b132b3ae`; corrections `5a805b3058cfe048ef0bb3d4a86f999f2b141c40`; evidence `e3541c6c3d093dc315b86644c6c65b456f4955b2`; baseline `8800ba17233833d6e592b9a12a442037d9287070`. Main stayed `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3`.
- **AGREE:** Claude 12 and the amended Phase 1 task plan; Codex 08 R1/B1–B3/ownership/S1/V1/V2 resolved at planning level. D-064/D-065 record the agreements, separately from D-060–D-063's owner directions.
- **C5 checks:** separate `git archive`; Python SHA-256 comparison of all 259 indexed files; 255 prefix matches, four CRLF-based mismatches independently reproduced against `git show`; 8 phone/31 sibling-state jobs; 140 log entries, 139 successful and one explicitly failed focus capture. All 238 PNG prefixes match. Opened only three saved images (late payment, Thandi motion and mirrored NotFound), as named in Codex 09. C-a/C-b and complete design review remain open.
- **Independent review:** a separate Codex reviewer examined the pinned handoff, then the report and issue drafts. No material draft findings; fixed two line/link references. Recorded the checksum/source metadata repair as Minor; C5 completion remains Important. Added D-060 checks to PLAN G-PROD and refreshed its sources.
- **Backlog published:** Codex K1 [#1](https://github.com/CarworX/carworx-new/issues/1), K2 [#2](https://github.com/CarworX/carworx-new/issues/2), K3 [#3](https://github.com/CarworX/carworx-new/issues/3), K4 [#4](https://github.com/CarworX/carworx-new/issues/4), with `phase-1`/`owner:codex` labels, boundaries, dependencies, PR-head evidence and acceptance criteria. Issues remain blocked from implementation until the design/owner-merge gate. Claude creates T1–T5.
- **Tools/checks:** GitHub read/compare/ref/tree inspections; native Git fetch/archive into an isolated temporary copy; local hashing/metadata checks and three `view_image` opens; official Supabase Google setup checked for guide accuracy. GitHub CLI created the two labels because the connector lacks label management; the connector created the four issues. No new audit/browser/application test, install, account change, production credential, deployment or merge.
- **Next:** baton Claude for C-a/C-b (including four committed-byte hash repairs), C4, owner guides and T1–T5 issues. Return a completed exact-commit package for Codex X-c, then owner merge. A local pass cannot complete Phase 1; staging A1–A7 remain required.

## 2026-11-04 — Claude 13: C5 verdicts, C4, owner guides, T1–T5

- **Answers:** Codex 09 E1/E2 and Claude 12 C-a to C-f. Source captured: `5a805b3058cfe048ef0bb3d4a86f999f2b141c40` (`git archive`); v1 package `e3541c6c3d093dc315b86644c6c65b456f4955b2`.
- **C-a:** every file in `claude/audit-10/` opened, tall pages in full-width slices. Verdicts: PASS 204, FINDING 43, NOT USED 4, TOOL 8, LOG 4. Each Claude 09 matrix row has a verdict. The five v1 observations are settled.
- **Own-tool faults (TF1–TF6), fixed and re-captured in the same export:** short settle wait; capture during smooth scroll (the Thandi blank area); lazy film not loaded; mirror width; mirror fonts; SVG sampler ring. Re-captured: `01-cover-390`, 12 motion journey frames, `42-brand-reduced`, Cover and seven other mirror cards (all 21 re-rendered with repo fonts).
- **C-b:** SVG text 8/8 (pins 19.19:1). Focus ring 16.99:1. Component edges: G1.
- **Findings:** G1 Important (control edges 1.37:1 vs the 3:1 Studio rule; owner's choice of fix). G2–G17 Minor: pack copy and print layout, mirror card heights, the StepList selector, the font path, a contrast tool that measures nothing on the approved page, the 44 px pack chrome rule.
- **E2:** full SHA-256 of committed bytes via `git cat-file blob :<path>`; two unchanged files match Codex 09's canonical values.
- **C-c:** `design/brand/README.md` records the seven live-only cards and the font path. **C-d (F5)** stays Minor pending the owner's O-2.
- **C-e:** `owner-guides/README.md` and guides 01–09, ordered by need, secrets kept out.
- **T1–T5:** issues #5–#9 with labels `phase-1`, `owner:claude` (new) and `security` (new, T3/T5). Blocked until X-c and the owner's merge.
- **Computer:** C: was full; at the owner's request Claude deleted only its own scratch copies and the 61 MB audit export (2.6 GB free afterwards). Docker installed but not running; pnpm not on the PATH, Corepack present.
- **Limits:** no app code, no live design-system change, no account or setting changes, no spending. Baton to Codex for X-c.
- **Follow-up, D-066:** the owner chose darker edges for G1. `bundle.css` now uses `--control-edge` for `.cx-chip`, `.cx-slot` and `.cx-btn.outline` (3.14:1 on white); `tokens.json` usage notes are updated; after-images `audit-10/44-G1-Button-after.png` and `44-G1-Chip-after.png` (PASS) are added, and the index is updated. The live design-system publish waits for O-2; the closed pack is unchanged.
- **Follow-up, O-2 yes:** published to the live design system version `1793780966-50db` (2026-11-04): `bundle.css` (D-066), `tokens.json` usage notes, the KpiCard subtitle (G14), and the index `lastChange`; removed eight stale generated `api/components/Logo*.md` (F5). Read back: all four files byte-identical to the repo. `api/assets/Logos.md` is regenerated by the page on its next save.

## 2026-11-04 — Codex 10: required component evidence correction

- Reviewed `1e97c78c095f9fcc26a351e4d61940bcf6c5499b` against Codex 09 `2f4ebf63aaa5c4feb9e482af285a22248748024e`; main remains `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3`.
- **AGREE WITH CHANGES:** E2 closed after independent Python verification of all 265 indexed full SHA-256 hashes; current package has 240 PNGs. D-066's repo CSS/after-images inspected. C13 verdicts, guides and T1–T5 issues received.
- **R1/G11 Important for evidence acceptance:** opened NavBar, ServiceKey and StepList images; each loses lower target content, confirmed by three `fitsDeclaredHeight: false` log entries. Claude to provide complete captures and reject incomplete results, update manifest/logs/counts, then return for X-c. Closed-pack Minor findings can remain historic; T3/T4 corrections and D-060 launch checks retained.
- Checks: GitHub refs/PR/issues/delta; isolated git archive; full manifest hashes; source/log inspection; five saved images opened (three clipped components, two G1 after-images). No browser/app tests, new captures, accounts, credentials, deployment or merge. Remaining images not independently accepted after required coverage failed. No new agreement/decision number claimed.
- Baton Claude. Publication scope: Codex 10, current STATUS and appended HISTORY. Owner merge and application implementation remain gated.

## 2026-11-04 — Claude: response to Codex 10 R1

- `audit-10/_tools/mirror.mjs` v4: full content height, logs content and capture sizes, rejects incomplete captures (TF4b in the index).
- Re-captured NavBar (1040 × 522), ServiceKey (1040 × 667) and StepList (1040 × 406) from a `git archive` of `7d28357`, deleted afterwards because C: has about 2 GB free. All three opened in full and complete. Log: `_logs/_mirror-log-v4.json`.
- Index: 266 files, 240 PNGs, all hashes recomputed (0 mismatches); PASS 208, FINDING 41, NOT USED 4, TOOL 8, LOG 5. G11 reclassified as metadata-only Minor; raising the card heights needs an owner-approved live publish.
- Baton to Codex for X-c.

## 2026-11-04 — Owner: design approved, Phase 1 to the cloud (D-067)

- The owner approved the design baseline at `495e448` and waived Codex's final X-c sign-off for this gate. Codex still reviews every Phase 1 pull request.
- The owner created the Claude cloud environment "CarworX Cloud". Phase 1 runs there: a master session `phase1-master`, and one sub-session per task where possible.
- Claude wrote Claude 14 (kick-off) and owner guide 10, and opened the design-branch pull request for the owner to merge.

## 2026-11-04 — Claude T1: monorepo scaffold (draft PR #11)

- Base `ed20950` (PR #10 merged by Claude on the owner's explicit instruction in the `phase1-master` session). Branch `claude/t1-scaffold`, sub-session of `phase1-master`.
- Built: pnpm workspace; `apps/web` on React Router 7.18.5 and `@cloudflare/vite-plugin` 1.67.0 (Cloudflare's official starter layout, without Tailwind, which is T4's); TypeScript strict; ESLint + Prettier; Vitest; `GET /healthz` (fixed JSON, `Cache-Control: no-store`) with three unit tests; PR template; `.gitignore`; names-only `.env.example`. Minimal `wrangler.jsonc` because the build needs it; K2 owns it from here.
- Versions: exact pins read from the npm registry, nodejs.org and Cloudflare's template on 2026-11-04 and listed in the PR. React Router stays on v7 (agreed contract) though v8 is `latest`; TypeScript 6.0.3 because React Router 7 and typescript-eslint don't accept 7.x; wrangler 4.156.1 (the version the Vite plugin bundles, and old enough for pnpm's release-age check).
- Checks: Node 24.22.2 (official tarball, SHA-256 verified) in the container, which has Node 22 installed. `pnpm run check` passes, also inside a network namespace with no interfaces. Each script fails on an injected fault, including zero test files. `/healthz` checked in workerd with `vite preview`.
- Limits: no CI workflow (K1), no deploys, accounts, settings, secrets or spending. A1 is base only until K1's CI runs on the combined head.
- **K1 bootstrap:** Claude reviewed K1 PR #12 at `1b476aa` as CHANGES. Its hosted run was red on K1's own self-tests (the scaffold stages passed): pnpm 12 rejected the symlinked fixture `node_modules`; the `missing-report` fixture died on node flags; Gitleaks ignored the sequential token; and a `generic-api-key` false positive on prose (`codex-vendor-access.md:10`, `668466e`) had no exception path. Codex fixed all four. Claude approved `4b25bf0` (hosted CI green; locally, exactly one exception per scan and a modified line is blocked again) and merged it into T1 at `e5c393c`.

## 2026-11-04 — Codex K1 implementation and combined-T1 review

- K1 #12 passed hosted run 41825875526 at 4b25bf0; Claude approved that exact head and merged it into T1 at e5c393c. Six CI contract tests, ten real quality-fault cases, three health-route tests, full history/checkout scans and the final gate passed. One exact checklist-prose exception was reviewed by Claude; no broad exclusions.
- Codex independently inspected the T1 scaffold and all three sanitized reports from combined-head run [41826670253](https://github.com/CarworX/carworx-new/actions/runs/41826670253), then recorded `REVIEW: APPROVE @7faf5a6af719b5b9973a432229314b96e9b6af88` on #11. RLS/Auth remain not applicable until their implementations; staging acceptance remains open. No merge or deployment by Codex.
- [Codex 11](codex/11-k1-ci-handoff.md) records contracts, checks, limits and the receiving-agent steps. Supplementary real scanner-policy regression tests and records are published on codex/k1-ci-secrets for Claude's follow-up review; that current head requires its own CI evidence. Owner confirmed included Actions minutes/$0 cap.

## 2026-11-04 — Claude T2: schema and RLS with pgTAP (draft PR #15)

- Base `main` at `c87ba46` (T1 merged). Branch `claude/t2-schema-rls`, sub-session of `phase1-master`. Refs #6.
- Built: `supabase/` (CLI 2.122.1 exact, npm registry; Auth defaults untouched); one migration with `profiles`, `organisations`, `memberships`, `audit_log` and the server-controlled `private.platform_admins`. RLS on every table, every policy `to authenticated`, access only through an active membership. Admin policies need a `platform_admins` row **and** `aal2` inline. `audit_log` is written only by triggers and rejects update/delete/truncate for every role. SECURITY DEFINER helpers sit in the non-exposed `private` schema with `search_path = ''`. Default privileges no longer give anon/authenticated access to future objects.
- Tests: 3 pgTAP files, 154 assertions (catalog 23, A4 matrix 85, aal/forged-metadata/revocation/column/append-only 46). `test:rls` writes one raw TAP file per SQL file (K1 contract).
- Checks: Docker image pulls blocked by the cloud network policy, so no local Supabase. Locally the migration, seed and tests ran on the container's Postgres 16 against a scratch Supabase stub and a minimal pgTAP stand-in (not pgTAP, not committed): all pass, and 8 injected weaknesses each make the suite fail. The real pgTAP run is K1 CI.
- **CI and review:** K1's `missing-required-command` fixture assumed `test:rls` did not exist, so K1 CI failed before the pgTAP stage on the first three T2 heads. Codex fixed it in K1 PR #18 (merged at `ec7d658`) and reviewed T2 as CHANGES @`b823b03`: no schema/RLS defect, `rls: true` accepted. Codex's candidate with the repair passed 154 pgTAP assertions and 24 PostgREST probes in CI. T2 merged main for a fresh run and verdict.

