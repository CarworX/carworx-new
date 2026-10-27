# Vendor access and activation checklist

Prepared 2026-10-27. **Planning only.** Do not create accounts, request credentials in chat, change DNS, contact vendors, enable billing or deploy from this checklist without applicable owner authorisation.

| Service | Owner action/access required | Evidence before implementation or activation |
|---|---|---|
| GitHub | Existing CarworX/carworx-new repo; inventory apps, plan and review identities. | Main/branch state, permitted planning writes, CI permissions and available private-repo protection/approval features. Connected GitHub and local CLI read/write access verified; enforcement features not yet verified. |
| Supabase | Inventory/create organisation and isolated staging/production projects when authorised; assess region and plan. | Auth redirect configuration; RLS/storage access tests; private keys only in approved secret stores; restore strategy/drill; backups for database and uploaded files; documented processors/transfers; approved production cost. |
| Cloudflare | Verify account, zone ownership, registrar/DNS setup and scoped Workers access. | Domain/preview routes, staging isolation, secrets, CPU measurements and deployment/rollback procedure. No DNS or account access has been verified. |
| Resend | Verify account and authorised sending subdomain; publish DNS only when authorised. | SPF/DKIM/DMARC, staging recipient restrictions, auth SMTP configuration, delivery/bounce webhook verification, retry/suppression and daily/monthly quota handling. |
| Mapbox | Verify account and scoped public map token; separate server token if necessary. | Restrict origins, confirm SA geocoding sample quality, record data provenance and storage rights, map/list fallback and usage budget. Permanent geocoding can require billing setup; do not enable silently. |
| Paystack | Owner arranges suitable SA business activation/banking and marketplace approval; test credentials through secret store. | Hosted checkout, approved provider/subaccount onboarding, supported channels, fee bearer, settlement schedule, split/refund/chargeback obligations and tested reconciliation. Live credentials only after paid-launch approval. |
| Information Regulator | Confirm responsible party and Information Officer; owner handles required registration. | POPIA assessment, operator agreements, request/deletion process, incident plan and any prior-authorisation determination for future lookup. |
| Fines partner | Owner-authorised outreach to EasyPay, Syntell/PayCity and/or Fines SA; no outreach authorised yet. | Production entitlement, issuer coverage, identity/authority model, usage/redistribution rights, freshness, charges, test access and DPA/security review. Official referrals are launch fallback. |
| Monitoring | Choose platform logs first; optional error-monitoring account after scope/cost review. | PII scrubbing, alert recipients, operational access and retention; no secrets/customer payloads in client logs. |
| Agent automation | Owner chooses manual turns or approves configured integrations and credential/billing route. | Allowlisted identities, exact commit/task context, concurrency, timeout, round/spend caps, stop labels, no production secrets and successful documentation-only round trip. |

## Paystack support questions to prepare, not send

1. Is this South African multi-provider automotive marketplace approved on the intended account/business type? What approval/KYB is required for CarworX and each provider, including sole proprietors?
2. Are subaccounts/splits supported for the intended SA channels? What fees, fee bearer options and settlement schedules apply?
3. After split settlement, who funds full/partial refunds and chargebacks? How are provider recoveries, insufficient balances, reserves and top-ups handled?
4. Are platform-zero-commission pilot transactions supported? What minimum charges or provider onboarding constraints apply?
5. What sandbox cases and production validation are required? Which webhook/verification/settlement reports are authoritative?

## Fines-partner questions to prepare, not send

1. Is the documented lookup production-ready and available to an independent consumer marketplace?
2. Which issuers, municipalities, notice types and identifiers are supported, and how current are results?
3. What consent/authority checks, contractual roles, retention limits and cross-border conditions apply?
4. May CarworX display/cache results, link to payment, or collect payment? What are the fees, service levels and reconciliation requirements?

## Cost and activation gates

Free tiers first is an owner constraint, not proof of production suitability. At research time [Supabase Pro](https://supabase.com/pricing) starts at USD25/month and [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) at USD5/month; these are candidate costs, not an approved total. [Resend](https://resend.com/pricing), [Mapbox](https://www.mapbox.com/pricing), [Paystack](https://support.paystack.com/en/articles/2130306) and agent/CI billing must be rechecked against usage. No FX conversion or spending commitment is made here.

Before paid bookings: verified supply and calendars; approved marketplace/payment terms; funded refund process; appointed owner/colleague support duties; reviewed consumer/provider terms; security/concurrency/payment tests; measured runtime performance; restore drill; explicit production approval. Integrated fines has its own independent commercial/privacy gate.

## Round 02 additions — 2026-10-27

- Ask Paystack whether settlement schedules can be changed per SA subaccount, which values are supported, whether provider pending settlements actually fund split refunds, what happens after settlement, and how future-dated bookings/chargebacks are covered. Weekly/manual capability and refund sourcing are **not verified** by response samples or third-party wrappers.
- Keep the production release credential outside agent-accessible environments. GitHub Team private-repo branch protection is not the same as required environment reviewers; [official deployment docs](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) restrict those reviewers to public repos on Free/Pro/Team.
- Revenue/ads are planning options only: [revenue portfolio](revenue-streams.md). Before activation verify advertiser/affiliate agreements or ad-network eligibility, payer/price/tax/refund terms, consent/data handling, moderation, measurement and conversion/performance checks. No outreach, billing or tracking activation is authorised by adding this checklist.
