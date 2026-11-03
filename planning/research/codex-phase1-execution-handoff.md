# Design approval and Phase 1 — execution handoff

**Current state:** WAITING FOR CLAUDE'S CORRECTIONS AND C5 EVIDENCE. Application work has not started. This is a research/handoff note permitted while Claude holds the baton; it does not close findings or change the shared turn record.

## Owner instruction

On 2026-11-03, the owner selected **Design + Phase 1**, **Claude evidence first**, and **Local drill first**, then explicitly requested implementation of the resulting plan in Codex chat.

- Claude produces the C5 design evidence; Codex independently verifies it. Codex does not substitute its own new audit for that handoff.
- K4 starts with export and restore of synthetic data locally. Hosted backup activation waits for an owner-selected private destination and operator.
- The owner merges the design branch after Codex's scoped design review. Application coding follows that merge and the existing prerequisites.
- Codex creates K1–K4 issues after task-plan agreement; Claude creates T1–T5. Each implementation uses its assigned branch and reciprocal review.

These are owner instructions from this chat, not a claim of new Claude/Codex consensus. Claude should incorporate them into the next shared-record update using the next available decision IDs where appropriate.

## Verified baseline

Inspection on 2026-11-03:

| Item | Observed state |
|---|---|
| Design branch | `cd751e622a9534ca7a4a93d84bb0ed0ec13e066d` |
| Main | `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3` |
| Baton | Claude |
| Open PRs / issues | None / none |
| Application scaffold | Absent; the repository contains planning/design material |
| C5 evidence package | Absent from the inspected tree |
| Node / pnpm | `v24.14.0` / `11.25.0` available in the current environment |
| Local Supabase prerequisite | Docker CLI exists; Docker's Linux engine endpoint is unreachable. Owner starts Docker Desktop before local database work |

Source of the open findings: [Codex 08](../codex/08-phase1-and-revenue-review.md). Existing ownership and gates: [PLAN §§11–15](../PLAN.md), [Claude 10](../claude/10-phase-1-build-plan.md), [AGENTS](../../AGENTS.md) and [STATUS](../STATUS.md). Prior checks remain dated evidence, not fresh audit results.

## Next handoff — Claude to Codex

### 1. Corrections and explicit responses

Respond against the exact reviewed revision for each item below, with the changed path/section and a disposition. Preserve historical findings and owner decisions.

| Item | What Codex needs to review |
|---|---|
| R1 | Capture both `figure.phone` and sibling `.states > .state` panels; assert coverage counts and correct the mobile cover/summary/brand mapping |
| B1 | Real Google authentication blocked locally and on staging until the OAuth client exists; fixture tests labelled separately |
| B2 | Direct database and Worker admin-MFA checks, membership revocation, confirmation/reset/failure paths, Auth SMTP recipient restrictions and integrated security protections |
| B3 | Local synthetic recovery first; hosted destination/operator and final staging evidence remain prerequisites |
| Ownership | Non-overlapping CI, environment, performance and backup responsibilities; real required suites cannot silently skip |
| S1 | Current PLAN revenue order/exclusions, company/bank/funded-reserve requirements and other superseded current wording reconciled |
| V1 / V2 | Commission-bearing cohorts and measurement windows; fee/refund accounting and reminder limits answered explicitly |
| C4 | Mirror/API documentation gaps corrected within the existing permission boundaries, or remaining gaps identified precisely |

R2 contrast coverage and R3 current-state wording were already accepted in Codex 08; reopen only if the new changes affect them. D-057's detailed capacity contract remains later work.

### 2. C5 evidence package

Use the corrected Claude 09 coverage matrix. Keep the package under its existing `planning/claude/audit-10/` location, with an `index.md` containing:

| Required field | Meaning |
|---|---|
| Source | Full source commit and, for any live private evidence, its artifact version |
| Step / surface | Matrix row and exact screen, component or named state |
| Capture conditions | Route/tool, viewport, scale, motion preference, selector or URL and relevant action |
| Saved evidence | Relative image/report path and SHA-256; every accepted saved image opened and inspected |
| Result | PASS, FINDING or BLOCKED, with the finding ID or missing prerequisite |

Include the eight phone figures and **31 sibling state panels**, all 15 UI components, Iconography and the four selected state cards/pages. Include the matrix's responsive, focus, contrast, reduced-motion, payment-copy and offline/PDF checks. Preserve each source's identity: resolved repo mirror captures are labelled mirror; private live captures need their own matching version.

Supply script versions/source and raw reports needed to reproduce metrics. A screenshot does not prove keyboard behavior, payment execution or accessibility compliance. Every claimed pass must have the appropriate evidence; a missing capture or inaccessible private/device surface is BLOCKED. Blank, unexpectedly clipped/incomplete, loading or wrong-state captures are rejected; intentional selector crops must show the complete named target. The approved design and framework remain the reference.

### 3. Codex receipt and review

When the owner starts Codex's next review turn:

1. Refresh refs, instructions, baton, PR/issue state and the full Claude response. Pin the source and evidence revisions separately if they differ.
2. Review the correction delta and reconcile every open Codex 08 item. Do not mark a counterproposal agreed before accepting it.
3. Check the evidence index, hashes, state counts and capture conditions; open the saved images. Use Product Design's audit guidance for the independent UX/design/accessibility review.
4. Record findings against the exact evidence and source revision. Missing evidence necessary for the foundation remains a blocker. Device/screen-reader gaps retain the applicable later acceptance requirements.
5. Publish the next numbered Codex review with a scoped verdict and remaining blockers. Design sign-off requires complete required evidence and no unresolved Critical/Important findings affecting the foundation. It does not certify universal accessibility or unseen live surfaces.
6. After an accepted design baseline, the owner merges the design branch. Only then does the application task sequence begin.

## Codex implementation queue after the gate

| Task | Start condition | Deliverable / completion evidence |
|---|---|---|
| K1 | Agreed task plan and Claude's scaffold candidate; CI is included before the scaffold merges | CI and pinned Gitleaks CLI for the exact PR head; lint, types, unit/integration, RLS and build checks. Schema/authentication suites join as those tasks land; final A1/A5 cannot pass with required suites missing |
| K2 | Scaffold, K1 and owner-provided staging setup | Local/staging configuration, secret-name documentation, application/Auth recipient restrictions and manual staging workflow. Owner-controlled execution supplies A2 evidence |
| K3 | Claude's components; K2 for hosted checks | Repeatable mobile lab checks and separate hosted Worker CPU evidence for A6; failed thresholds block promotion |
| K4 | Claude's schema for local work; staging setup for the final evidence | Local synthetic database/object export, manifest, isolated restore and runbook; verify hashes and access controls. Hosted backup activation waits for the chosen destination/operator; A7's final staging evidence remains required |

**CI bootstrap clarification for Claude's agreement:** prepare K1 on its own branch against T1's unmerged scaffold candidate. Claude incorporates the reviewed CI commit into T1 before the scaffold is merged. Claude records approval of Codex's CI work, and Codex reviews the combined T1 head; the required bootstrap checks run on that exact head before its merge. Checks for features not yet introduced are recorded as not applicable, never as passed feature acceptance; their real suites become mandatory as T2/T3/T5 land. This avoids requiring a CI-free scaffold merge. It does not authorise an agent to merge the design branch.

Codex also reviews Claude's scaffold, schema/RLS, authentication, UI/design-system and security changes against their exact PR commits. Claude reviews Codex's K1–K4 changes. Shared-file edits are serialised. No reviewer's own internal helper replaces the other named agent's reciprocal approval.

**Exit evidence:** A1–A7 from PLAN §11. In particular: real Google flow after setup; admin MFA at both access boundaries; tenant isolation and revocation; uncached personal responses; Lighthouse performance ≥90/accessibility ≥95, CLS ≤0.1 and LCP ≤2.5s; hosted Worker CPU p95 ≤8ms with tail failures inspected; restored database **and private object bytes** with access controls checked. A local recovery pass is preparatory evidence, not Phase 1 completion.

## Current blockers and next actor

- **Claude:** correction response, C4 reconciliation and C5 evidence are missing. This is the first dependency; K1–K4 implementation and issue creation are not ready yet.
- **Owner, at the recorded gates:** design-branch merge; Docker running; staging/account/DNS setup; Google client; verified email configuration and CI allowance. Hosted recovery additionally needs the selected destination/operator.
- **Codex:** review the package when supplied, then undertake the queue above as each dependency becomes available.

## History (append-only)

- **2026-11-03, Codex:** refreshed GitHub and confirmed the unchanged baseline, Claude baton, absent C5 package and empty PR/issue collections. Rechecked Node/pnpm and the Docker endpoint. Created this execution handoff to record the owner's choices and the precise next inputs. No visual audit or application checks were run; no new acceptance or merge approval is claimed.
- **2026-11-03, independent handoff review:** a scoped read-only reviewer identified the CI/scaffold bootstrap dependency and clarified intentional screenshot crops. Both corrections were applied before publication. This review concerns this handoff, not the design or Phase 1 implementation.
