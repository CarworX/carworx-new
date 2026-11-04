# Codex 06: Claude handoff — Product Design fit and CarworX review plan

Prepared: **2026-11-03 02:34 UTC**. Owner-approved assignment: assess Product Design's fit for Claude and plan a review of the existing CarworX designs. The owner selected **assessment and plan only** for Claude's first pass, then requested implementation of this local handoff.

**Current status:** ready for Claude's assessment-and-plan first pass. Independent handoff review passed with no Critical, Important or Minor findings; documentation and preservation checks passed. The owner subsequently authorised publishing this handoff and its linked Codex 05 review on `planning/design-motion-toolkit`. That publication does not grant Claude further publication or merge authority. Claude's assessment and the later visual audit have not been performed by this handoff.

## 1. Start here, Claude

Read this handoff, the current project instructions and the pinned sources below. Inspect your actual available capabilities and the source documents, then write your own assessment and proposed approach before executing a visual audit or making corrections.

Your first-pass deliverable is **one new report**, `planning/claude/09-product-design-assessment.md`, in your own folder. If that number has been used by the time you start, use the next free number and record the change. Leave existing reports intact. Finish by returning the report's path, key findings, proposed review sequence and blockers to the owner.

The report must answer:

1. Which Product Design methods and capabilities should Claude adopt, adapt, defer or reject, and what evidence supports that choice?
2. How should the existing presentation pack, Studio design system and approved system states be reviewed against PLAN 2.1 and the owner's decisions?
3. Which source-level issues can already be confirmed, which claims still need fresh visual evidence, and what corrective work should be proposed next?

**Stop after that report.** Do not run the proposed visual audit, capture new screenshots, render or regenerate assets, fix the pack, redesign screens, install/configure tools, change shared planning records, write application code, or begin Phase 1 in this assignment. Read-only capability checks may inspect tool exposure, access status, versions and source metadata; a listed tool is not proof of a working integration.

The owner is providing this assessment task despite the existing Codex baton. That is a bounded request for your own report, not a transfer of independent Codex approval. Do not speak for Codex, mark the design review complete, or alter agreed decisions.

## 2. Source of truth and exact revisions

Repository: **CarworX/carworx-new**, private. Relevant branch: `planning/design-motion-toolkit`.

| Reference | Exact commit | Meaning |
|---|---|---|
| Main and active local HEAD | `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3` | PLAN 2.1 technical sign-off; older planning records |
| Last independent pack review | `6c607e538683efce16dc62ed49eb8153bf5ef3c9` | Studio presentation pack reviewed on 2026-10-28 |
| Remote design source head checked before handoff publication | `e1897756a48f63cd0415209192466995b8fa51a6` | Design system, owner approvals and selected 404/loaders |

Before this handoff's publication, the remote design branch was **15 commits ahead of main**; **five commits** followed the last pack review. Publishing the handoff adds a documentation commit without changing that design-asset baseline. The active local checkout still has the older main content even though its branch label is `planning/design-motion-toolkit`; its remote-tracking refs are not current evidence of GitHub state. Preserve that checkout when reading the newer remote sources.

Refresh accessible live branch/PR metadata before substantive work. Record the actual UTC check time and exact reviewed SHA in your report. If the remote head advances, retain the last-review baseline and assess the additional delta rather than silently treating the new work as already reviewed.

Use read-only GitHub access or an isolated source snapshot for newer files. Preserve the active checkout, index, HEAD and branch state; do not pull, switch, reset, rebase, force-push or overwrite existing work. An isolated export may be prepared outside this checkout if needed; do not execute project scripts for this first pass. If current source cannot be read, identify the inaccessible paths and complete the available capability/document assessment without substituting stale files.

### Required reading, in order

All GitHub links below pin the checked design head, not a moving branch:

1. [AGENTS](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/AGENTS.md), [CLAUDE](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/CLAUDE.md), [PROTOCOL](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/PROTOCOL.md), [STATUS](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/STATUS.md), [DECISIONS](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/DECISIONS.md). Apply current owner instructions and applicable global/scoped instructions too.
2. [PLAN 2.1](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/PLAN.md): focus on §§6.2–6.6, 10–15, 18 and 20–22. The approval checklist is stale; compare it with D-037–D-041 rather than inferring that approval was revoked.
3. [Claude 07: Studio pack](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/claude/07-pack-studio.md), [pack summary](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/pack/SUMMARY.md), [pack QA](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/pack/QA.md).
4. [Claude 08: design system](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/claude/08-design-system.md), [brand README](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/brand/README.md), [Studio brand book](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/brand/studio/README.md), [tokens v4](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/brand/tokens.json), [design-system index](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/brand/design-system.json).
5. [Approved states and limits](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/states/NOTES.md), [state QA record](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/states/qa-report.json).
6. **Companion:** [Codex 05 pack review](05-pack-review.md), published with this handoff. Its references to being local/uncommitted describe its original review on 2026-10-28; the historical report is preserved verbatim. If it cannot be read in your environment, mark that limit and use the source-linked seeds below without claiming to have read the review.
7. [Earlier motion/design handoff](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/research/design-motion-claude-handoff.md) and [Claude 05 approach](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/claude/05-design-motion-approach.md), for relevant workflow history only. The 2026-10-27 tool inventory is not current capability proof.

Reuse these sources; do not load unrelated conversations or create a second project-wide status report.

## 3. Binding project context

| Record | What the assessment must preserve |
|---|---|
| D-033 | PLAN 2.1 is technically signed; prior technical sign-off does not certify later design artefacts. |
| D-034–D-036 | Turbine is the locked logo; Studio is the selected UI direction. Do not reopen brand selection or generate replacement directions. |
| D-037 | Colleagues saw the Studio pack and requested no changes; Phase 0b is closed. This is not proof that the technical copy issue was fixed. |
| D-038 | Phase 1 is owner-approved, initially local-only with synthetic data; not yet started. Staging prerequisites and later production/payment gates remain separate. This handoff neither revokes that approval nor starts implementation. |
| D-039 | Own helpers may work within assigned scope at no extra spend, with explicit file ownership and the other agent's review. Apply current owner restrictions; this is not authority to delegate another agent's approval. |
| D-040 | The design system is maintained in Claude and mirrored in the repo for future code. Private live-page access and source freshness must be verified, not assumed. |
| D-041 | 404: Dot-grid lens. Buttons and watched multi-step waits: Hold dial. Known-layout cards/lists/pages: Skeleton. Between pages: Dot-grid ripple with alternating hub-to-tip fill and tip-to-hub drain on 72° indexes. Rotor spool and Blade index are retired as loaders; the brand loader rhythm remains. |

Keep the five equal home shortcuts: Wash & Detailing; Repairs & Maintenance; Glass Repair & Replacement; Tyres & Wheel Alignment; Fines & Vehicle Admin. Keep South African English, honest initial supply, fixed and mobile providers, private mobile-base locations, quote-then-pay repairs, free-pilot fee rules and labelled official fines referrals. No wallet, escrow, invented providers, successful live payments or new monetisation activation is implied.

No API, schema, application runtime or production configuration changes belong to this assignment.

## 4. Assess Product Design in your actual environment

The owner explicitly requested **Product Design** (`product-design@openai-curated-remote`) plus the **requesting-code-review** workflow. Codex inspected Product Design **0.1.56**. Guidance sources inspected in that environment were the Product Design router, audit skill and audit framework, critical overrides and user-context skill, plus the owner-provided requesting-code-review skill and its code-reviewer prompt template. These guides are not repository files and their availability in Codex does not establish Claude access, tool compatibility or persistence support.

If the corresponding guidance is exposed in your environment, inspect it there and record its actual version. If unavailable, state that explicitly and assess the adapted workflow specified in this handoff. The required audit and reviewer procedures are captured below so this GitHub document does not depend on Codex-local filesystem links. Do not claim the native plugin ran, or copy/install the plugin or its skills merely because Codex has them.

For this existing-product review, **audit** is the relevant Product Design route. `design-qa` compares a coded prototype with its visual target; it does not replace a user-facing experience audit. `ideate`, prototype/build, asset generation and share/deploy workflows are deferred for this assignment.

Your capability matrix must have: **capability; current evidence and date; availability/access status; adopt/adapt/defer/reject; reason; dependency/permission/cost; proposed validation**. For proposed installations, redistribution or configuration changes, add **source/version, licence and rollback**. Use not applicable where nothing is being added.

Cover available design/UX/copy/accessibility guidance, source access, browser/DOM controls, screenshot saving/inspection, local previews and asset resolution, keyboard/zoom/reduced-motion checks, assistive-technology support, Claude Design access and independent reviewer support. Distinguish tools exposed, access blocked, and operationally verified capabilities. Missing browser access blocks a future visual audit, not the available first-pass source and capability assessment.

Prefer existing native Claude capabilities. If adapting the Product Design method, label it **adapted workflow** and name the actual tools. Do not invent equivalents for tool APIs, browser identifiers or Codex state directories. Codex's read-only context preflight found no saved Product Design context; no onboarding or context saving is requested. A different environment must establish its own applicable context without creating new persistent settings for this task.

Respect the user's browser choice and the selected workflow's browser rules. Any fallback needing Playwright, a new permission or an installation must be proposed with its requirements, not silently activated. Private sign-in is not authority to run DesignSync: use that tool only through its owner-started workflow if subsequently authorised. Do not start authorisation flows, create accounts, change credentials, save plugin memory, change model/effort settings, enable automation or spend money.

## 5. Source findings to verify, not a fresh visual audit

Use a finding table with **ID, source and line, evidence type, finding, user impact, severity, proposed remedy, owner/dependency, acceptance check**. Label each item as confirmed source finding, historical report or visual hypothesis. Do not infer a new screenshot-based result from an old report.

- **Expiry copy:** [screens source, line 256](https://github.com/CarworX/carworx-new/blob/e1897756a48f63cd0415209192466995b8fa51a6/planning/design/pack/src/parts/screens.html#L256) says, “If the time runs out, the slot is released and nothing is charged.” Line 286 similarly says nothing was charged. PLAN §6.3 requires reconciliation when payment succeeds after hold expiry. The assembled HTML repeats the statements; the previous review located them on PDF pages 22–23. No pack or export files changed between the last reviewed commit and the pinned design head. Verify this source mismatch; do not erase the late-payment resolution state.
- **Approval/document drift:** D-037/D-038 and current remote STATUS record completed colleague feedback and Phase 1 approval. Root AGENTS/README, PLAN's header checklist and parts of OWNER-QUESTIONS retain earlier wording. STATUS's review list also stops at D-040 although D-041 is present. Propose a reconciliation list that preserves historical entries and separates approval from readiness; do not rewrite shared records in this pass.
- **Evidence limits:** earlier pack QA includes responsive, keyboard, reduced-motion, offline and PDF checks, but real browser zoom, SVG-text contrast, other browsers and physical devices remain gaps. State QA reports 16 Chromium loads with zero console errors/horizontal overflow; that is author-reported evidence, not an independent run. Device frame rates and screen readers remain unverified.
- **Private design-system surface:** Claude 08 reports that the live signed-in page and generated API cards were unverified, including obsolete logo concepts in those cards at that time. Recheck accessible source/metadata and clearly identify what would require a later live inspection. Do not claim those stale cards are still present without current evidence.

The old findings are review inputs, not a reason to regenerate or correct artefacts now. Cosmetic preferences must not reopen agreed product or payment contracts.

## 6. Specify the later visual audit

Return one coverage matrix: **ordered step/surface, user goal, exact source revision, viewport/state, proposed tool, numbered evidence filename, observation/check, evidence limit and responsible reviewer**. Reuse the pack's existing order and component inventory; no new routes or redesign are needed.

| Area | Required planned coverage |
|---|---|
| Customer screens | Home, search, listing, booking/quote, checkout; all five service shortcuts and sensible next actions. |
| Provider/admin-related concepts | Business dashboard, provider application, fines/admin; both existing customer/provider journeys. Synthetic data only; no real submissions. |
| Components | All 15 base components in Claude 08; Iconography; NotFound, NotFoundPhone, PageLoader and Loaders state cards. Check consistency with tokens v4, brand book and D-041. |
| Failure and waiting states | Empty/limited supply, quote revision/expiry, holds, provisional/expired/paid-needs-resolution, pending/failed/late payment, cancellation/refund/dispute, suspended provider, travel charges and private exact mobile eligibility. |
| Responsive/accessibility | 360/390/768/1440 px, real 200% browser zoom, keyboard and visible focus, menu behaviour, labels/reading order, target sizes, text/control contrast including SVG text, reduced motion, relevant timing/status announcements. |
| Feasibility/limits | Browser and device coverage, screen-reader checks, fonts/assets/offline packaging where applicable, and how design-system `/_blob/` asset IDs resolve against mirrored files or the authorised live surface. No new app scaffold. |

The later audit must capture what is actually visible in that run, save numbered screenshots, open/inspect each saved image before accepting it, and pair each finding with its step and evidence. Reject blank, blocked, loading or wrong-state captures. Compare matched viewport/state when checking fidelity. Old screenshots may guide coverage but cannot be passed off as newly captured evidence.

Identify drawings and static mockup controls as such. Do not claim to have completed a working booking, payment, authentication or backend flow from concept screens. Screenshots alone do not establish WCAG compliance, keyboard behaviour, screen-reader support or production performance. State which checks require interaction and which cannot yet be performed; do not replace real zoom with a narrower viewport and label it passed.

Default output for the later audit is a concise Markdown report with accepted screenshots in flow order and source links. No Figma/canvas creation or uploads are requested. If valid flow capture is unavailable, name the blocker and return the available source assessment rather than claiming an audit.

For a later **separately scoped correction**, propose updating source, assembled HTML, affected checkout PNGs and PDF together, then reopening the regenerated output. The copy must allow a payment already in progress to finish and require a status check/reconciliation; expiry itself does not prove that no money arrived. Keep this as a proposal in the first pass.

## 7. Report structure, independent review and acceptance

Your assessment report should contain:

1. **Current state and evidence:** UTC, exact revisions, accessible sources and blockers; approval history distinguished from readiness.
2. **Capability/fit matrix:** the classifications and supporting evidence required above.
3. **Source findings:** strengths, confirmed issues and hypotheses with calibrated Critical/Important/Minor severity, references, impact and remedy.
4. **Proposed approach:** ordered audit coverage/evidence matrix, prerequisites, achievable checks, named limitations, corrective backlog and ownership. Keep implementation and visual audit execution deferred.
5. **Assessment:** readiness to begin the proposed audit — Yes / With prerequisites / No, with reasons. **Design readiness and Phase 1 readiness: Not assessed in this pass** unless supported by a separately authorised independent review. Do not erase D-038's existing approval or add a new approval requirement for preparing this report.

Apply the requesting-code-review pattern to review the completed assessment and audit-plan feasibility. Use one independent reviewer if available and permitted by current owner instructions; no model changes or paid capacity. Give the reviewer only a carefully crafted brief, exact requirements, source SHA ranges and the new report — **never the full conversation history**. Reviewer access is read-only; it must not change the checkout, approvals or sources. If unavailable, record the limit and leave independent review pending; a self-check is not independent sign-off.

The reviewer receives **Description / Plan or requirements / Base SHA / Head SHA**, followed by scope and evidence limits. The source ranges here are context, not a claim that the new local report is committed. Identify the report by its path and current content hash; use its actual diff/revision if it is subsequently committed with separate authority. Require strengths, Critical/Important/Minor findings with file:line references, user impact, remedy, recommendations and a verdict. Adapt “Ready to merge?” to **“Assessment complete and audit plan feasible?”** for this documentation pass.

Resolve confirmed Critical and Important assessment/plan gaps before presenting the report as ready. If a remedy needs inaccessible evidence or broader authority, report it as pending and do not claim readiness. Record Minor items with rationale. For source defects whose correction is outside this first pass, triage them in the backlog and retain the relevant downstream gate; do not treat the assignment as permission to fix them. Re-review substantive changes. The author cannot provide the independent cross-agent approval of their own design work.

Acceptance checks:

- Source links, exact SHAs and dates are accurate; old and current evidence are labelled honestly.
- Every required capability has a verdict and evidence or a named access limit.
- Every important future audit step has a source, expected evidence/check, feasible route or blocker and a responsible reviewer.
- Expiry copy and approval/document drift are explicitly triaged; the payment contract and recorded Phase 1 approval are preserved.
- Missing browser/device/assistive-technology evidence remains visible; unsupported compliance or working-app claims are absent.
- The completed report adds only the agreed assessment document; shared instructions/status/decisions, existing reports, assets, app code and Git state remain unchanged.
- Documentation links/formatting and content scope pass proportionate checks; independent review is recorded accurately, with no unresolved Important/Critical assessment gaps claimed as complete.

## 8. Authority and delivery boundary

This handoff was prepared as local documentation; the owner then explicitly requested its publication to GitHub. That authority covers a documentation commit containing this handoff and the linked historical Codex 05 review on `planning/design-motion-toolkit`, preserving the existing remote history. It does not authorise a main merge, app deployment or a new prototype. Claude's assignment remains its own assessment report, with no further commit, push, PR, merge, public hosting, account setup, credentials, DNS change, external message, installation or spend. Return the report to the owner; do not automatically send it to another chat or third party.

The owner retains the recorded design-branch merge handoff. Any actual visual audit, corrective pass or Phase 1 implementation is subsequent work with its own scope. Existing grants are not revoked; none is expanded by this report. Keep current status and an append-only check/history section inside your own assessment rather than duplicating project-wide reports or editing another agent's folder.

## 9. Handoff preparation history

Append-only execution evidence for this local document. Current status is at the top.

- **2026-11-03 02:34 UTC — Codex:** refreshed live GitHub branches and all-state PR collection. Main is `b104e43`, design head is `e189775`, PR collection is empty. Re-read pinned STATUS, D-037–D-041 and Claude 08. Checked local/global instruction timestamps; unchanged since the prior planning read. Active HEAD remains `b104e43`. Existing untracked Codex 05 and earlier motion handoff preserved. Only this documentation file is being added; independent review and final checks follow.
- **2026-11-03 04:49 UTC — Codex, finalisation:** independent reviewer returned **Ready for local handoff**, with zero Critical/Important/Minor findings. It read the handoff at SHA-256 `9a3e8173e84c147a9eb454e3a8b0c748848ce07d5b1e80d20384ffae2e007db9` using the scoped requesting-code-review brief; no session history was supplied. Only current-status and preparation-history metadata changed after that review. Read-only Python checks passed for UTF-8, final newline, trailing whitespace, eight existing local Markdown targets, and preservation hashes for six existing reports/instruction files. All 19 pinned GitHub targets matched the verified `e189775` source tree. `git diff --check`, tracked-file/index cleanliness and unchanged HEAD checks passed. Final live GitHub refresh still shows main `b104e43`, design `e189775` and no PRs. No application tests apply to this Markdown-only addition. No commit, push, PR, merge, audit, installation or Claude report was executed; the owner receives the local document. The same documentation/preservation checks are rerun after this metadata update.
- **2026-11-03 05:02 UTC — Codex, publication preparation:** owner requested “push the handoff to github.” Refreshed live branches, PRs, parent commit/tree and the full source tree: design head remains `e189775`, main `b104e43`, no PRs and neither Codex 05 nor 06 exists remotely. Publication includes only this handoff and its required Codex 05 companion; the companion is copied verbatim. Updated delivery/authority wording and removed Codex-local Markdown links so the GitHub handoff is self-contained. Source revisions and the assessment-only contract remain unchanged. Publish using a commit parented by the checked design head, preserve its base tree and update only the design branch with an expected-head check; never force or merge. Final source/blob/ref verification is reported in the publishing chat, avoiding a self-referential follow-up commit.
- **2026-11-03 05:07 UTC — Codex, publication review/checks:** independent reviewer returned **Ready**, with no publication blockers or scope contradictions, after checking the revised handoff and verbatim companion against their content hashes. UTF-8, newline/whitespace, relative-link portability and credential-pattern checks passed for both files; all 19 pinned GitHub targets exist in the checked source tree. Six existing-file preservation hashes, active HEAD and tracked-file/index checks passed. Only this history entry is added after that publication review. The two-file payload is rechecked before creating the remote commit; post-publication commit/tree/blob/ref verification follows in the publishing chat. Application tests remain not applicable.
- **2026-11-03 05:10 UTC — Codex, upload verification:** byte-level Git blob checks rejected the first unreferenced commit candidate before any branch update. Its text had been altered during command-output transport. The original local files and remote branch were preserved. The transfer is retried with ASCII-escaped JSON to preserve Unicode exactly; full existing-file and new-blob comparisons must pass before the expected-head branch update. Only preparation-history metadata changed after the publication review.
