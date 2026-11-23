# Active-lane coordination map

2026-11-14 UTC. Agent: codex. Owner requested a current map and safe work that
does not interrupt Claude's active frontend work. GitHub heads and CI were
checked live; this supersedes the older coordination snapshots below STATUS.

| Work | Verified state | Owner / safe next step |
| --- | --- | --- |
| Exact Sites home, #122 | Merged as `5700aac`; Codex approved full head `d9968e1`. | Claude reruns the staging deploy with the existing reviewed source/CI/performance inputs, then coordinates the guarded staging seed. |
| Staging source gate | Repaired at main `c0580cb`; merge changed no files and retained tree `3bf3305780238771c912a865d424d53d933da48b`. Added the existing Claude author identity as the standalone PR trailer required by the parser. Live `validateEvidence` source preflight passes. | Preserve deployment safeguards. This does not attest runtime/promotion readiness or mean staging was deployed. |
| Exact Sites search, #123 | Claude branch `claude/sites-search`, head `b98508e`, five current checks green when checked. | Claude active lane; no file edits or merge in this pass. |
| Intro / page loader / 404, #124 | Claude branch `claude/intro-loader-404`, head `5245f2d`, five current checks green when checked. | Claude active lane; no file edits or merge in this pass. |
| Listing / category, #119 | Explicitly held for redo against the unchanged Sites files. | Leave alone. |
| Provider invoices, #121 | Independent Codex review at `a8cf258`; fresh local invoice SQL 37/37 and seven exact-head checks passed. Merged with a merge commit into phase-3 at `4c9075d`. | No main promotion, migration execution, gate activation or sending. Monthly statement outbox production remains Codex follow-up work. |
| Money / messaging tests, #107 | Codex branch incorporates phase-3 `4c9075d`, including receipts #120 and invoices #121. | Run new-head CI/restore and obtain Claude's reciprocal review before merging. Earlier green evidence belongs to `e57ea2a`. |
| Mail foundations, #93 / #94 | Ready for review with previously green exact-head CI; #94 is stacked on #93. | Claude reciprocal review; merge #93 first, then retarget/revalidate #94. Do not self-approve Codex-authored changes. |
| Security foundation, #95 | Draft at `8f8abe5`; final head already supplied in the earlier #98 handoff. | Separate review/CI and integrated restore check; not a reason to alter Claude's frontend branches. |
| Sites source, #83 | Existing approved reference at `b88a8ca`; current preview publication is separately recorded. | Do not merge a stale preview branch into the app or invent a new visual design. Refresh the restricted Site only at completed feature milestones. |

## Gates retained

- Directory release first; Phase 3 remains separate under #102. Shared staging
  A23/A29/A35 end-to-end checks remain open.
- The #122 seed guard was independently tested for missing and mismatched
  synthetic sentinel users, repeat seeding and removal. The sentinel is a
  prerequisite, not cryptographic proof of a Supabase project identity.
- No hosted seed, deployment, real messages, live payment, invoice/VAT switch,
  DNS, account or spending changes were made in this coordination pass.
- Scheduled polling was stopped at the owner's request. Existing GitHub Codex
  review triggers remain; no direct master-chat wake-up is claimed.

Evidence: [#122 reciprocal review and source-gate follow-up](https://github.com/CarworX/carworx-new/pull/122#pullrequestreview-5904037120),
[invoice review](https://github.com/CarworX/carworx-new/pull/121#pullrequestreview-5905058441),
[money test record](42-phase3-money-tests.md).
