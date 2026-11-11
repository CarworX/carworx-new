# Codex 23 — legal re-review and guide correction

2026-11-11 UTC. Re-reviewed #58 at
`bad1cdb0202558623541595215106f66fd77c13e`.

## Finding reconciliation

1. **Repealed ECTA authority: resolved.** The privacy notice now uses POPIA
   s69(4), not ECTA s45. Independently read the
   [Cybercrimes Act s58 Schedule](https://www.justice.gov.za/legislation/acts/2020-019-Cybercrimes.pdf),
   entry for Act 25 of 2002: it deletes ECTA ss85–88 and substitutes s89;
   it does not amend ss43/48. This closes the previously inaccessible
   Cybercrimes Schedule cross-check, not OQ-L5's separate applicability question.
2. **2025 Regulations: resolved in the legal draft; guide correction supplied.**
   Checked the [operative notice](https://www.justice.gov.za/legislation/notices/2025/20250417-gg52523gon6126-POPIA-Regulations-Amendment.pdf)
   and [linked final text](https://inforegulator.org.za/wp-content/uploads/2025/04/POPIA-2021-Regulations-FINAL-21-Jan-2025.pdf).
   Rights channels and marketing notes now account for amended regulations
   2, 3 and 6. Guide 13 still listed the deleted regulation 4 manual duty;
   this PR corrects that independently of the database work. PAIA s51 itself
   remains unassessed; deleting a POPIA regulation does not decide PAIA scope.
   Regulation 3.6's wording anchors notification to receipt of the outcome;
   the privacy draft's shorter operational promise must be understood as a
   chosen service commitment, not a verbatim statutory deadline.
3. **Section 72: partly resolved, still CHANGES.** Backups are now UNASSESSED,
   encryption is correctly a safeguard, and Google no longer assumes a DPA.
   However T1a/T2a label broad account-holder processing EVIDENCED merely by
   reference to the contract; T1b/T4/T5 still depend on future forms, a notice
   before Google sign-in and the email-provider decision. The conclusion
   calls these "Evidenced now". Mark them conditional/proposed until the
   specific data and foreign transfer's necessity, or the implemented
   informed consent, are supported by evidence. An account or button alone
   is not that evidence. Keep all relevant production prerequisites open.
   [POPIA s72(1)(b)/(c)](https://www.treasury.gov.za/POPIA/POPI%20Act%204%20of%202013.pdf).

## Limits and handoff

No vendor DPA, owner identity, destination, registration or hosted behaviour
is certified. The legal drafts remain unpublished and G-PROD stays blocked.
Claude reviews this guide PR at its exact head and amends #58's remaining
status/necessity claims in its own PR. No legal text is deployed.

This draft deliberately defers Actions while the separate workflow trimming
in #64 is open. A skipped run never counts as passing CI; an unskipped final
head with the applicable checks and Claude's exact-head review is required
before this PR can merge. No workflow/configuration files are changed here.
