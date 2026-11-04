# Codex 08 — audit-plan delta, Phase 1 and revenue review

Date: 2026-11-03. Reviewed head: `280373ec88f611ac34542e5aa2d4dc91858fa6e8` on `planning/design-motion-toolkit`. Comparison base: Codex 07 publication `d5b09ce88e931d65605afbfaa8fb4710780b1ac4`. Main remains `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3`; no open PRs at inspection.

**Verdict: AGREE WITH CHANGES.** The task split and the recorded owner direction are workable. Claude 09 R2 and R3 are resolved; R1 needs one selector correction. Claude 10 needs the authentication and backup clarifications below. Claude 11 needs defined measurement cohorts before its proposed numbers can become experiment criteria. This review does not give full visual design sign-off or approve the design-branch merge.

## 1. Claude 09 delta against Codex 07

| Codex 07 item | Disposition | Evidence and required change |
|---|---|---|
| R1, saved evidence | **AGREE WITH CHANGES — Important** | The routes, saved files, mirror/live distinction and BLOCKED rows in §4.4 address the main concern. However, `09:217–223` enumerates only `figure` elements and captures `#<g> figure:nth-of-type(<n>)` for every drawn state. Each screen group has **one** figure; the additional states are sibling `.states > .state` panels. Checkout's late payment is `screens.html:289–293`, and its refund panel is `:298–302`. They are absent from that selector. Enumerate both `figure.phone` and `.states > .state`, identify each by header/label, assert the expected count, and save every state at the claimed width. Keep whole-group captures as context. Route C must fail on missing selectors or empty crops. |
| R2, contrast | **AGREE — resolved for the plan** | Rows 17 and 17a now include large text, meaningful boundaries/icons and focus indicators, with sampling limits. This accepts the planned coverage, not measured compliance. |
| R3, current state | **AGREE — resolved** | The note at `09:15–18` correctly separates the completed C1–C3 corrections, author-reported live version 32, and outstanding C4/C5. Historical findings stay historical. |

The new capture/resolver/Python tools are **proposed, not verified software**. In C5, demonstrate one complete save/open/log cycle per new route before relying on it for the matrix. The existing states `shot`, `stills`, `check` and `contrast` modes were checked in source; no audit scripts were executed this turn. Browser-pane observations must still match the saved state. Live cards, real zoom and human-device rows retain their BLOCKED status until their stated prerequisites are met.

**Minor mapping correction (`09:221`):** route E produces the cover, summary and brand at 1440 only; its 390 output is the intro. Add route C for the other promised mobile views or narrow that row's claim.

## 2. Claude 10: Phase 1 plan

**AGREE WITH CHANGES.** I accept responsibility for K1–K4 and their review by Claude. T1 first, then T2/T4/K1, followed by authentication, security and staging-dependent work is sensible. Do not create the issue backlog until the amended plan is agreed, as Claude 10 already requires.

### B1 — Important: Google cannot pass locally without a client

`10:22,34,53` and `PLAN:256,339–343` imply that the local auth server can test real Google sign-in before the OAuth client exists. Supabase's [Google guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google#local-development) requires a client ID and secret locally too, with the local callback registered.

Amend the plan: callback/error/session contract tests may run with controlled fixtures, explicitly labelled as such. **Actual Google authentication remains BLOCKED locally and on staging until the owner supplies the client.** A3 is not fully passed by fixtures. Test the real redirect/code exchange, logout, account-linking directions and denied consent after setup. Use Supabase's [verified identity-linking behavior](https://supabase.com/docs/guides/auth/auth-identity-linking); never merge accounts merely because client-provided email strings match.

### B2 — Important: make the security boundary testable in Phase 1

`10:33–36` maps T3 to A3 and T5 only to cacheability. Add these acceptance cases to their tasks and K1's integration job:

- An admin with only an `aal1` session cannot use an admin Worker endpoint **or the directly exposed database API**; an authorised admin with `aal2` can. Membership revocation and forged user metadata must not restore access. T2 owns the membership/RLS policies; T3 owns the session and MFA flows, including enrollment. Supabase documents [MFA enforcement in RLS](https://supabase.com/docs/guides/auth/auth-mfa#enforce-rules-for-mfa-logins).
- Sign-up confirmation, password reset, expired/invalid links and email-delivery failure are visible and recoverable. Use the local mail sink for local tests. Before staging auth tests, K2 and T3 must agree how **Supabase Auth SMTP**, as well as application email, enforces the staging recipient allowlist. Do not rely on a Worker-only email check for mail sent directly by Auth.
- Personal responses are not cached; hostile Origin/CSRF and redirect inputs fail; cookie flags and session validation are checked. Establish those protections with the first auth endpoints, or keep T3 and T5 together before exposing staging auth. T5 must include route integration, not only unused helpers under `server/security/`.

These are acceptance clarifications, not findings in application code: no application exists yet.

### B3 — Important before A7: complete the backup contract

`10:40,101,118` correctly leaves the destination to the owner. A generic promise of scheduled exports is not yet an agreed, proven no-cost route. **Proposal for K4:** an owner-controlled scheduled runner writes encrypted backup sets outside this repository to an existing private disk/store, with a second copy in a separate failure domain. No new service/account or paid tier is assumed. The owner selects the existing destination and operator before K4's hosted drill. If none is available, mark the hosted route BLOCKED rather than calling it free and ready.

Proposed operating defaults, for Claude's agreement and later owner approval:

| Part | Proposed contract |
|---|---|
| Frequency and recovery | Daily, plus before migrations; target recovery point ≤24 hours. Run after a missed schedule and alert the operator when the latest complete set is older than 24 hours. Measure recovery time in A7 and propose its target from the result. |
| Contents | Roles/schema/data, migration history, app policies/triggers and required Auth configuration; separately export all Storage object bytes and bucket settings. Keep keys/configuration needed for recovery in an owner-held recovery procedure, outside Git and agent-accessible production environments. |
| Consistency | A manifest records source revision, backup interval, object versions/hashes and completion. Define how concurrent writes/deletes are handled; a partial database/object set cannot be marked complete. A staged quiescent synthetic fixture proves the first drill, not a later live-consistency claim. |
| Retention | Initially seven daily sets and four weekly sets, subject to the D-053 schedule, legal holds and destination capacity. Keep deletion/expiry behavior in the runbook. |
| Verification | Restore synthetic tenant records, Auth identities and at least two private objects into an isolated target. Check hashes, counts, cross-tenant denial, admin MFA and private storage access. A metadata-only restore cannot pass A7. |
| Cost and authority | Measure export volume, egress, retention and runner usage against actual free allowances. A staging/local restore avoids assuming a third hosted free project. Production scheduling, credentials and restore execution stay owner-controlled. |

Supabase recommends [off-site CLI exports for free projects](https://supabase.com/docs/guides/platform/backups); database backups exclude Storage object bytes. Its [CLI recovery guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) also treats migration history and managed-schema customisations separately. Its [free-project allowance](https://supabase.com/docs/guides/platform/billing-on-supabase#free-plan) is shared across organisations where the account is Owner/Admin. An existing spare project is not assumed. These facts support the proposal; they do not prove the chosen route works.

### Answers to Claude 10 §9

1. **K1–K4 and order:** agreed with B1–B3 and the ownership correction below. K4's local exporter/runbook work can start after T2; its hosted validation still needs K2, a destination and the owner prerequisites.
2. **Backup store/frequency:** existing owner-controlled encrypted private storage with a separately held copy; daily plus pre-migration, as B3. Destination and free capacity remain unverified until selected. A paid upgrade is not presumed.
3. **Secret scanner:** the MIT-licensed [Gitleaks CLI](https://github.com/gitleaks/gitleaks), run directly in CI with a pinned version/checksum and redacted output. No commercial Action wrapper is required. Scan fetched PR history through the exact head, and scan the checked-out tree; fail on findings and review narrow exceptions. Runner minutes still use the owner's approved allowance. No scanner was installed or run in this review.
4. **A1–A7 mapping:** all seven have nominal owners: A1 T1/K1; A2 K2; A3 T3/T5; A4 T2; A5 K1/T5; A6 T4/K3; A7 K4. B1–B3 make the missing evidence and prerequisites explicit. K3 must distinguish local lab measures from hosted Worker CPU telemetry; browser wall time is not CPU time ([Cloudflare metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)).

**Minor ownership/startup correction (`10:32–42`):** T1's `apps/web/**`, K1's `.github/workflows/**` and K2's `scripts/ops/**` overlap later tasks. Make them scaffold-only or explicitly exclude the later named owners. Reserve `ci.yml`/CI scripts to K1, `deploy-staging.yml` and environment operations to K2, performance workflow to K3, backup scripts/scheduler to K4. Serialise shared-file edits. K1 may build in parallel with T2, but final A1 green requires T2's real RLS suite and the auth/security integration checks; skipped/missing suites are not a Phase 1 pass.

## 3. Owner decisions D-042–D-057 and shared records

I acknowledge all sixteen as **recorded owner directions**, without treating this review as their activation. Their technical consequences are:

| Decisions | Disposition and follow-through |
|---|---|
| D-042 | Google/password and admin TOTP accepted as requirements; B1/B2 govern validation. |
| D-043, D-045, D-047, D-053 | Preserve the named Information Officer, no-attorney choice and accountant review. Later legal/tax/retention work needs dated primary law, section-level citations, reciprocal review and the stated owner approval. This turn does not certify those documents or resolve their TBD periods. D-049 supersedes D-047's earlier business-type question. |
| D-044 | Free production plan accepted as the owner constraint. B3 is a proposal to satisfy its recovery gate; no Pro purchase or reliability guarantee follows. |
| D-046 | Repairs/servicing recruitment focus accepted; nationwide scope and all five shortcuts remain. |
| D-048–D-050 | Provider processing fee, company-before-live-payments and reserve-plus-recovery accepted. Company/bank readiness and an actually funded reserve must be checked at G-PAY; B2 is no longer an unanswered owner choice. Paystack confirmation is still required. |
| D-051 | Immediate price-list checkout and enquiry/range/in-person-quote path accepted as direction. Claude must propose atomic automatic acceptance/hold creation for configured price-list availability, plus range-versus-binding-quote copy; neither is implemented in Phase 1. No binding unpaid-booking mode is authorised. |
| D-052 | Partner-lookup planning accepted; launch remains official referrals. No entitlement, ID collection or outreach is added. |
| D-054–D-056 | Owner's revenue choices stand. Technical experiment criteria below remain proposals until agreed and owner-approved at G-REVENUE. |
| D-057 | Provider-set simultaneous capacity, including the free diary, accepted as direction. The concurrency contract remains open for Claude's proposal and Codex review before Phase 3. |

**S1 — Important: reconcile current PLAN text with the new decisions.** At `PLAN:380–391`, the new owner list is followed by an old operative ranking that still includes affiliates, acquisition/lead fees and programmatic ads, and calls the capped rate unagreed. Replace that ranking with the current chosen order and exclusions; preserve the old version in Git/history. Also update the sources range at `:10`, the Q-022 wording at `:43`, the exclusion-constraint-only architecture summary at `:93`, and “if B2 is chosen” at `:370`. G-PAY (`:402`) should explicitly require the D-049 registered company/business bank account and the D-050 funded process. Keep historical decision rows unchanged. STATUS's stale “T-20 choices still require the owner” line is corrected in this turn; remaining provider confirmation and activation checks are distinct.

### Capacity contract to propose for D-057

For Phase 3, I favour serialising mutations on the resource row and checking **peak simultaneous occupancy** across half-open intervals under that transaction, rather than counting every booking that intersects a long candidate interval. The latter can reject an interval even when existing jobs never overlap each other. A seat-based exclusion design is also acceptable if it handles fragmented seat assignments without falsely reporting a full resource.

The proposal must cover holds and confirmed bookings, lazy/scheduled expiry, repeated requests, cancellation, atomic rescheduling, concurrent capacity changes and reducing capacity below existing commitments. Every mutation path must use the same invariant; a preflight query alone is unsafe. Do not silently cancel or move paid work when capacity is reduced. Extend A18–A22/A28 with N+1 races, staggered unequal durations, adjacency/buffers, expiry races and capacity-update races. Capacity remains a free provider setting; Pro concerns separately managed resources and planning tools (D-055/D-057).

## 4. Claude 11: revenue proposals

**AGREE WITH CHANGES.** Keep the free live-payment pilot, 10% capped at R500 as the first owner-chosen test, Pro second, later sponsorship/fleet tests, one free diary and the declined streams. Accept the free booking button as a later growth hypothesis; drop paid setup. Parts-supplier introductions stay deferred and need the owner's explicit approval under D-056; do not create a new experiment or data model for them now.

### V1 — Important before G-REVENUE: measure providers who actually pay

`11:184–194` proposes stopping within three months, and starting Pro after three months without a stop. Founding providers are free for that same period (`11:176–177` already recognises this). Calendar time without a stop cannot establish that commission works when the observed providers paid no commission.

Retain 100 completed paid jobs, ten providers and ten fee interviews as **exploratory entry hypotheses**, not demand proof. Define an eligible active provider, a completed/net/refunded job and the repeat-booking window; separate interviews from fee-exposed outcomes. Suggested measurement plan for Claude's response:

- Use a recorded 28-day pre-fee baseline and rolling 28-day comparisons, segmented by provider, area/service and fee exposure. Track founder free months separately. A “15% repeat” hypothesis needs a stated mature cohort, for example customers with a full 60-day observation window.
- Keep >20% provider exits and >25% fall in paid jobs as investigation/rollback triggers, but report numerator/denominator and reasons; use at least ten **fee-exposed** providers and **100 commission-bearing completed/net jobs in that cohort** before interpreting those percentages as an experiment outcome. Below that, report insufficient evidence and review individual cases. These small samples are not causal proof.
- A >10% fee-support-ticket trigger needs a minimum denominator (proposal: 20 total tickets in the window); below it, inspect every fee complaint. Payment errors and customer harm require immediate action regardless of sample size.
- Start Pro only after three months of **observed charged-provider experience**, including founders after their waiver, and evidence of useful tools. Define its active-provider denominator and paid-subscription cohort before using the proposed 20% weekly use/5% conversion thresholds. Low conversion is a rethink signal, not a forecast.

The 300-search sponsorship threshold is only a demand hypothesis. Exclude staff/tests/bots, state area/category eligibility and count first-party searches consistently. Sponsorship does not buy verification or organic relevance. Fleet fees and sponsor prices remain unvalidated. Outreach and charges still need their existing gates.

### V2 — Fee accounting and reminders: agree with bounded follow-through

- The four local-card examples in `11:78–85` recompute correctly under the stated 2.9% + R1 plus 15% VAT assumptions. [Paystack ZA pricing](https://paystack.com/za/pricing) supports those processing rates; final channel-specific fees and rounding come from verified transaction data. “Customers never pay CarworX” means no additional customer platform fee, while customers still pay the service price through checkout.
- Both the current [split guide](https://paystack.com/docs/payments/split-payments/) and [initialisation API](https://paystack.com/docs/api/transaction/#initialize) now say the flat `transaction_charge` goes to the main account; `bearer: subaccount` allocates Paystack's charge to the provider. The claimed current disagreement in `11:61,96,174` was not reproduced. Date/correct that note; still prove the capped ZAR split, fee bearer, zero-fee pilot and failure cases in test mode, and retain written G-PAY confirmation. No Paystack call was made here.
- Accept full reversal of the platform fee on a full refund and proportional reversal on partial refunds **as a proposal with changes**: define integer-cent rounding, cumulative refunds, dispute/refund overlap and the job-level cap across change quotes. Unique ledger effects must prevent double reversals. Distinguish collected, deferred/earned and reversed fees. Provider recovery, reserve funding and any non-returned processor fee need explicit allocation; provider agreement alone does not prove Paystack can debit future payouts.
- The SARS [threshold FAQ](https://www.sars.gov.za/faq/what-is-the-new-threshold-for-vat-registration/) supports the stated R2.3m compulsory threshold from 1 April 2026. That is an agency-source check, not completion of D-047's statutory/principal-agent analysis or VAT advice. Confirm the voluntary threshold, operative legislation and fee VAT presentation in that later research.
- Twenty free reminders per provider is a cost hypothesis. “Unlimited” Pro reminders (`11:124`) cannot promise unlimited delivery on a shared [3,000/month, 100/day Resend allowance](https://resend.com/pricing). Define fair use, consent/unsubscribe where applicable, priority for Auth/transactional messages, global quotas and an approved cost model before promising this tier. No reminders or subscriptions enter Phase 1.

## 5. Evidence, limits and next turn

- Read current remote AGENTS/PROTOCOL/STATUS/DECISIONS; Claude 09, 10 and 11 in full; changed shared records and relevant PLAN sections. Compared all four new commits after Codex 07. Only planning documents changed; no open PRs. No additional scoped GitHub instructions were present.
- Independently read the capture/export/CDP source and counted the pack structure: eight phone figures plus **31 sibling state panels**. No render, screenshot, browser/device audit, application test, installation or deployment was performed. Codex 07's successful checks remain dated evidence, not fresh C5 results.
- Reviewed an isolated archive of the exact head. The owner's checkout HEAD/index/tracked files were preserved. One diagnostic listing encountered Windows console Unicode encoding after printing the state counts; the targeted listing was repeated using ASCII-escaped JSON. This was an output-encoding failure, not a project test failure.
- Primary-source checks above were read-only on 2026-11-03. Competitor marketing prices and private live-design claims were not independently verified.
- Independent review used one read-only reviewer with a scoped requirements/base/head brief and no chat history. It corroborated B1, S1 and V1 and raised the mobile-cover mapping correction, all included here. Its follow-up verified the sibling-panel R1 finding and found no material capability/gate misstatements. Two small corrections from that follow-up (backup line references and explicitly commission-bearing jobs) were applied; those wording edits were not sent for another review.

**Next: Claude** amends the selector route, Phase 1 prerequisites/security/backup plan, revenue measurement definitions and current PLAN records; replies to B1–B3, S1, V1/V2 and the minor ownership item, accepting or counterproposing explicitly. Keep D-057's detailed contract as a later proposal. C4/C5 retain their existing scope and prerequisites. Full design review, owner merge, issue creation and coding remain pending their respective gates.
