# Status

Sites milestone (2026-11-13): CarworX ChatGPT Site **version 3** is published
with refreshed journeys and a linked Progress page. Restricted access revision
2 and the existing external viewer are preserved. Future refreshes are at
completed-feature milestones, per owner instruction. [Publication evidence](codex/44-sites-milestone-publication.md).
Directory staging approval persists, but private hostname/access and runtime
readiness remain unconfigured; the live coming-soon Worker was not changed.

Context cleanup: 2026-11-12 UTC, based on main `7ec5eb7`. This condenses existing records; it grants no authority and does not transfer the baton.

## Baton and scope

Claude builds Phase 2 under recorded interim authority D-080/D-085; Codex reviews. Read those decisions before relying on an exception. Phase 2 is local/CI and synthetic only; staging operations remain separately bounded by D-071/D-073.

Phase 1 foundations and P2-1/P2-2/P2-3 are merged. Phase 1 staging acceptance remains open. A local or CI pass is not hosted A1–A7 completion.

## Open work and gates

- **Phase 1 staging:** last recorded promotion blockers are connector access, owner configuration and missing hosted evidence. Reverify current access before execution; this cleanup did not probe services. Application-path and direct-Auth timing, recipient restrictions, real OAuth/mail, hosted performance and A7 remain unverified. Use [Codex 19](codex/19-phase1-staging-completion.md) and [guide 11](owner-guides/11-staging-bootstrap.md).
- **Phase 2 bundles:** D-085 assigns A (provider/admin) and C (launch readiness) first, then B after owner inspection/approval. Refresh live PR/owner records before selecting work; this summary does not assert that any bundle has cleared its gates.
- **Reviews:** [Codex 23](codex/23-claim-concurrency.md) records concurrency evidence and follow-ups; exact-head review is still required. Historical checks are not approval of later heads.
- **G-PROD:** Phase 1 hosted A1–A7, D-060 owner-only device/accessibility checks, privacy/Information Officer/retention and recovery evidence remain required.
- **G-LIVEPAY** (formerly G-PAY): company/business bank, provider-paid fees, funded reserve/recovery and payment-provider confirmation remain gated (D-048–D-054, D-076). Revenue, fines integration, outreach and spending retain their separate owner gates.

## Repository snapshot

On 2026-11-12, #77 (onboarding plan) and #79 (data model) merged; D-088–D-090 are now binding on main. [Claude 23](claude/23-onboarding-redesign-build-plan.md) covers slices O1–O8, after the Codex 30 Bundle B review gate. Refresh exact-head review records before continuing; this cleanup grants no slice approval. The old status statement “No product code yet” is superseded by merged #79.

Open PR observed: #76 (CI regression). #80 (Coming Soon) is also merged; no deployment was verified here.

## References and maintenance

- Binding decisions: [DECISIONS](DECISIONS.md); planning procedure: [PROTOCOL](PROTOCOL.md); technical scope: [PLAN](PLAN.md). Search relevant IDs and later amendments.
- The complete pre-cleanup status, including its turn log and prior checks, is preserved verbatim in [STATUS-ARCHIVE-2026-11-12](STATUS-ARCHIVE-2026-11-12.md). It is historical evidence, not current authority.
- Append detailed evidence to [HISTORY](HISTORY.md). Keep this file to current scope, blockers and next actions; do not grow another turn log here.
