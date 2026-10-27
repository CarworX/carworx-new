# Questions for the owner

Answer inline under each question (or in chat, and an agent will copy it here). Questions marked **BLOCKING** stop part of the plan until answered.

## Answered

- **Q-001 Business model?** Customers book and pay through CarworX. Payment provider: Paystack. *(owner, 2026-10-27)*
- **Q-002 Budget?** Free tools for now. Flag where money would get better results. Only marketing spend is currently expected. *(owner, 2026-10-27)*
- **Q-003 Does Codex have repo access?** Yes, with write permissions. *(owner, 2026-10-27)*

## Open

- **Q-004 Launch area (BLOCKING for go-to-market, not for architecture).** Which city or province do we launch in first? Marketplaces live or die on having enough providers in one area. Claude suggests one metro, for example Johannesburg/Pretoria (Gauteng) or Cape Town, rather than the whole country on day one.
- **Q-005 Registered company (BLOCKING for Paystack live mode).** Is CarworX registered with CIPC, and does it have a business bank account? Paystack's live mode and payouts to providers need a verified business. **UNVERIFIED** for Paystack SA specifically; Codex or Claude to confirm.
- **Q-006 Information Officer (POPIA).** By law, the head of the business is the Information Officer and must register with the Information Regulator (free, online). Is that you?
- **Q-007 Commission model.** Do you have a view on how CarworX earns money: commission per booking (typical marketplaces take 10–20%), a provider subscription, a customer booking fee, or a mix? The agents will propose options if you have no view.
- **Q-008 Fines data partner outreach.** No official public API exists for fine lookups (see `research/fines-data.md`). The realistic route is a commercial partner. Are you willing to contact one or two providers if the agents draft the email?
- **Q-009 Your colleague's 5-feature request.** The agents will recommend a structure with reasons. Does your colleague need to approve it, or is your sign-off enough?

## Owner answers and corrections — 2026-10-27, Codex chat

The original questions above are preserved as history. The entries below supersede them where applicable; see STATUS for the current open list.

- **Q-004 ANSWERED:** Nationwide immediately. Do not constrain the product to one city. Honest local availability and provider recruitment remain implementation requirements.
- **Q-005 PARTIALLY ANSWERED:** Owner selected "Not set up yet" for business/Paystack readiness. Plan activation and banking prerequisites; this answer does not independently establish exact CIPC/bank status. Paystack's [business types](https://support.paystack.com/en/articles/2128898) include SA sole proprietors, so the earlier blanket CIPC requirement is corrected. Marketplace eligibility still needs confirmation.
- **Q-007 ANSWERED FOR PILOT:** Validate before charging. Long-term monetisation and who absorbs processing/refund costs are not yet decided.
- **Q-008 PARTIALLY ANSWERED:** Launch with clearly labelled official referrals; do not delay launch for production lookup. Outreach permission remains unanswered. The earlier absolute "no official public API" claim must not be read as proof that no integration exists: [EasyPay publishes a beta/testing endpoint](https://lesaka-adp-billpayments-collector.apidocumentation.com/easypay-billpayment-collector-api).
- **Q-010 ANSWERED — Customer flows:** Owner selected "All 3": discovery/enquiries, confirmed bookings and payments. Do not cut payments from the intended product; live activation still needs operational/commercial gates.
- **Q-011 ANSWERED — Supply:** Starting from zero providers. Recruitment and verification are launch work, not existing assets.
- **Q-012 ANSWERED — Repairs:** Quote, then pay; priced diagnostic appointments may precede customer approval/payment for repairs. A default deposit/offline-balance model was not chosen.
- **Q-013 ANSWERED — Operations:** Owner and colleague recruit/verify providers and handle complaints, cancellations and refunds during the pilot.
- **Q-014 ANSWERED — Service mode:** Fixed and mobile providers from the first release; include travel fees/time, service areas and private addresses in planning.
- **Q-015 ANSWERED — Current authorisation:** "Implement the proposed plan" authorises this planning-publication round. It does not approve application code, production deployment, accounts, credentials, contracts, outreach or spending.

## Still open / later activation dependencies

- Q-005: exact business/bank readiness and Paystack marketplace approval, before paid activation.
- Q-006: Information Officer identity/registration and responsible-party assessment, before launch.
- Q-008: permission for external fines-partner outreach, before sending anything; referral launch is already accepted.
- Q-009: whether colleague sign-off is required for the final structure; not assumed.
- Q-016: processing-fee bearer, refund funding and chargeback responsibilities, before paid activation.
- Q-017: approved production and automation budget/credentials, before any spending or setup.

- Q-016 options are now proposed in [Claude 02, T-20](claude/02-reply.md): fee bearer A1/A2/A3 and refund funding B1/B2/B3. Wait for Codex's reply before deciding.
- **Q-018 (new) Brand assets.** Do you have a logo, colours, fonts or a tone of voice for CarworX? If not, Claude will propose 2–3 design directions for you to pick from (T-22).
- **Q-019 (new, later) GitHub plan.** The CarworX organisation is on GitHub Free, which can't protect branches in a private repo. Before paid launch, the agents will likely recommend upgrading to GitHub Team (per-seat monthly fee) (T-21). No decision needed yet.

The assistants should first propose concrete options for the unresolved operating/payment questions. Do not ask the owner again for answers already recorded above.

## Round 02 — new owner request and recommendations

- **Q-020 ANSWERED — Revenue scope:** Owner requested various revenue streams, including potential website ads, in the next planning round. This authorises assessment/proposal, not ad activation, prices, charges, data sales, outreach or a reversal of the free-validation decision. See [revenue options](research/revenue-streams.md) and Codex 02 T-23/T-24.
- **Q-016 recommendation, not owner answer:** Codex recommends provider-borne processing fees (A1) during the free pilot, with full provider disclosure. Live payments remain gated on verified refund/chargeback mechanics and an owner-approved funded process. Weekly settlement is not accepted as a proven refund solution. No reserve spend is authorised. See [Codex 02 T-20](codex/02-reply.md).
- **Q-019 correction:** GitHub Team can support private branch protections, but official docs do not provide required private-environment reviewers on Team. Keep owner-controlled release credentials/operation pending a verified alternative. No upgrade is approved or performed.
- Q-018 brand inputs and the other activation questions remain unanswered; do not infer answers from the instruction to take another planning turn.

## Round 03 — Claude

- **Q-016 update:** Claude and Codex jointly recommend **A1** (provider pays the processing fee, fully disclosed). For refund funding, Claude added **B4, "pay close to the service"**: for bookings more than 48 hours away, the slot is reserved and the customer pays by Paystack payment link 48 hours before. This limits how long CarworX carries paid-but-not-delivered jobs. B2 (reserve plus provider recovery) and B4 can be combined. No live payments until GATE G-PAY in [PLAN.md](PLAN.md) §18. Waiting for Codex's view on B4.
- **Q-021 (new) Standing staging-merge permission.** To keep your effort low during the build: will you allow the *reviewing* agent to merge staging-only PRs once CI is green and approval is recorded? Production releases would stay yours. Needed at the start of Phase 1. See PLAN §12.
- **Plan approval:** [PLAN.md](PLAN.md) draft 1 is waiting for Codex's sign-off. Once it's signed, approving it authorises **Phase 1 (foundations, staging only)**, nothing more.

## Round 03 — Codex review clarification

- PLAN draft 1 was reviewed and **not signed**. [Codex 03 R1–R8](codex/03-reply.md) requests draft 2; no build approval is being sought until the corrections are resolved.
- **Q-016 correction:** B4 (later payment) is optional exposure mitigation, not an alternative funding source. A funded/approved refund and chargeback arrangement remains required. Defer B4 implementation unless selected and fully specified. Normal server-initialised checkout can support a CarworX payment-due action; a separate vendor payment-link product is not assumed necessary. Actual account eligibility remains gated.
- **Q-021 clarification:** standing staging-merge permission is optional. Without it, agents prepare reviewed PRs and the owner merges; it need not block local/PR work. It does not authorise extra agents, credentials, deployment, spending or automatic task triggering.
- **Q-018 clarification:** missing brand assets can be handled with provisional design directions; no approval of a final brand is inferred. Staging access/setup permission and any spend remain distinct prerequisites.
- **Q-017 timing:** any production plan that requires paid backups/compute needs budget approval before the Phase 2 production launch, even if it takes no payments. Do not postpone that approval to paid activation.
