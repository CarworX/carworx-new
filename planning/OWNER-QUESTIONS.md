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
- **Q-009 Your colleague's 5-feature request.** The agents will recommend a structure with reasons. Does your colleague need to approve it, or is your sign-off enough? *(Answered later: see round 04 and round 06 below.)*

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
- Q-006: Information Officer identity/registration and responsible-party assessment, before launch. *(Identity answered 2026-11-03: the owner, D-043. Registration and the responsible-party assessment remain before G-PROD.)*
- Q-008: permission for external fines-partner outreach, before sending anything; referral launch is already accepted.
- Q-009: whether colleague sign-off is required for the final structure; not assumed. *(Since answered: round 04 below, and closed in round 06, D-037.)*
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

## Owner answers — 2026-10-27, Claude chat (round 04)

- **Q-018 ANSWERED:** No brand assets yet. Brand will be worked out during the design work. Agents propose provisional directions; nothing is final until the owner chooses.
- **Q-021 ANSWERED: YES.** The reviewing agent may merge staging-only PRs without the owner, once CI is green and the other agent's approval is recorded against the exact commit. This covers merges only. It does not cover production releases (including Supabase production migrations), credentials, spending, extra agents or automatic triggering.
- **Q-009 ANSWERED:** The owner will show **two colleagues** (not technical) the first finalised plan. That plan must include **design directions and images of potential layouts**, so a non-technical presentation pack is part of planning (PLAN §22). Colleague sign-off isn't formally required, but their feedback is expected before owner approval.
- **Q-022 (new, Phase 3) Unpaid reservations?** Before live payments are switched on, should providers be able to take binding bookings with no online payment? Agents' default: **no**. Discovery and enquiries still work.
- **Q-023 (new, Phase 1) Agent helpers.** May each agent use its own built-in helpers (sub-agents or parallel tasks for searching, reviewing or testing) within its assigned work, at no extra cost? Reviews by the other agent still apply.

## Codex round 04 — current approval state

- Technical PLAN 2.1 is **Codex-signed**. This closes the technical review, not the owner's application-build decision. Presentation/colleague review and the owner's brand choice remain next, followed by a separate Phase 1 decision.
- Q-022 is optional; binding unpaid reservations stay disabled unless selected. Q-023 is optional; no helpers are used while unanswered, and no guarantee of cost-free usage is made. Neither blocks local presentation artefacts.
- The presentation pack can be shown/shared as bundled local files and static exports. Public hosting, DNS or third-party publication is a separate permission; none is inferred from technical sign-off.
- Fee bearer, funded refunds, real-user retention/legal review, production costs and all activation gates remain pending at their already-defined stages. No need to repeat those questions before creating the concepts.

## Owner answers — 2026-10-27, Claude chat (round 05)

- **Q-018 UPDATED: Turbine logo locked.** The owner chose concept 01 *Turbine* (five impeller blades, Sora wordmark) as the CarworX logo and asked for the other eight concepts to be removed. Further brand work (UI palette, type, imagery, tone, app icon) continues in Claude Design. Files: [design/brand/](design/brand/README.md). This is a brand choice only; it is not Phase 1 approval.

## Owner answers — 2026-11-02 and 2026-11-03, Claude chat (round 06)

These answers are recorded as decisions in [DECISIONS.md](DECISIONS.md), round 06.

- **Q-009 CLOSED (D-037):** the two colleagues saw the §22 pack (Studio rebuild, `6c607e5`) and asked for no changes. Phase 0b is closed.
- **Plan approval (D-038):** the owner approves PLAN 2.1 for **Phase 1 only**: foundations on local and staging, with synthetic data, subject to the §15 prerequisites. It starts local-only. No later phase, gate, spend or production release is approved.
- **Q-023 ANSWERED: YES (D-039).** Each agent may use its own sub-agents or parallel sessions within its assigned work, at no extra spend. The other agent still reviews.
- **Design system (D-040):** the Studio design system is built in Claude and mirrored into `design/brand/` as the source for Phase 1 code. It stays a concept until Codex reviews it.
- **System states (D-041):** the owner chose the 404 page and the loaders by scenario. They stay concepts until Codex reviews them.
- **2026-11-03:** the owner asked for [Claude 09](claude/09-product-design-assessment.md) to be published, and for the hold-expiry copy correction that Codex 05 required. Both are done on `planning/design-motion-toolkit`.

**Still open:**
- Q-022 (optional), plus Q-005, Q-006, Q-008, Q-016, Q-017 and Q-019, at the stages listed in PLAN §20.
- The §15 Phase 1 prerequisites.

## Owner answers — 2026-11-03, Claude chat (round 07)

These answers are recorded as decisions in [DECISIONS.md](DECISIONS.md), round 07.

- **Sign-in (D-042):** Google, or email and password. Admins also need a TOTP code. No SMS or WhatsApp sign-in in v1.
- **Q-006 ANSWERED (D-043):** asked "Will you be CarworX's Information Officer?", the owner answered "Yes, me". No deputy is named for now. The owner registers with the Information Regulator before G-PROD.
- **Q-017 ANSWERED FOR THE DATABASE (D-044):** "we won't be using supabase pro for now, the site will go live without it". The public site launches on the Supabase free plan. The agents agree a no-cost backup route and a plan for pausing before G-PROD. The automation budget (G-AUTO) is still open.
- **Legal documents (D-045):** "we won't be getting an attorney, just make sure you and codex cross reference with actual south african law". The agents draft and cross-reference every legal document against the primary law; no attorney review.
- **First supply (D-046):** servicing and repairs first.
- **Q-005 PARTLY ANSWERED (D-047):** "one of my colleagues is an accountant, but need you to still find south african tax and accounting laws, you and codex will have full research and decision making, but he will then review after... are there any reliable payment providers that would not need us to register the business? if not, we can go ahead and do that and use paystack after we have registered the business".
- **Q-016 (a) ANSWERED (D-048):** the provider pays the card fee (A1).
- **Q-005 ANSWERED (D-049):** "don't draft any emails and this is not a sole proprietorship, I have cofounders/colleagues, so will likely require us to register the business, add that to the backlog, we will test payments with a non live account for now and register the business and access live payments once everything else has been built".
- **Q-016 (b) ANSWERED (D-050):** reserve plus recovery (B2).
- **Q-022 ANSWERED (D-051):** "I would say no, but it depends, for example, car washes, should not be enquiry based, they would likely have a price list, therefore people should be able to make immediate payments, any other services that also have a similar price list structure should allow for immediate payments, other services will obviously have an initial enquiry process maybe first on the app, to get a range, then the actual amount after in person enquiry and then have them send the quote through the app and pay from there".
- **Q-008 ANSWERED (D-052):** after the explanation, "Plan a partner lookup". Referral links at launch; the owner contacts partners later.
- **Retention (D-053):** "Agents set, accountant checks".
- **Revenue streams (D-054 to D-056):** discussed in a separate session on 2026-11-03. All 20 answers are quoted in [Claude 11](claude/11-revenue-streams.md) §2. Asked whether one bay or diary stays free for every provider, the owner answered "Yes, one free" (D-055).
