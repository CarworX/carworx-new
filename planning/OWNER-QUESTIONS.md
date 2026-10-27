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
