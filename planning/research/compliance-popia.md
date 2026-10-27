# Legal and compliance (South Africa)

Researched by Claude, 2026-10-27. **This isn't legal advice.** Before launch, a South African attorney should review the terms, privacy policy and payment flow. That's a recommended paid item.

## POPIA (Protection of Personal Information Act)

- **An Information Officer must be registered** with the Information Regulator. By default it's the head of the business. Registration is free and online through the Regulator's eServices portal ([Michalsons guide](https://www.michalsons.com/blog/information-officer/12231), [Regulator](https://inforegulator.org.za/?p=7081)). No deadline applies, but it's required, and in May 2026 the Regulator issued an enforcement notice partly for failing to register ([Mondaq, 2026](https://www.mondaq.com/southafrica/data-protection/1796688/information-regulators-first-enforcement-notice-for-2026)). → Owner question Q-006.
- **Unique identifiers (ID numbers):** section 57 can require *prior authorisation* from the Regulator before processing unique identifiers in some situations, such as linking them with data from another responsible party. **UNVERIFIED** whether this applies to our fines use case. This is another reason to keep ID numbers out of the MVP (see `fines-data.md`, option b).
- **Cross-border transfer (section 72):** Supabase has no South African region, so personal data will be stored in the EU or UK. That's allowed when the recipient country has adequate protection (GDPR qualifies) or with consent. State it in the privacy policy.
- **Direct marketing (section 69):** electronic marketing (email, SMS, WhatsApp) needs opt-in consent from people who aren't existing customers. Build consent flags into the data model from day one.
- **Location data** from customers and mobile providers is personal information. Collect only what's needed and set retention periods.

## Consumer Protection Act and ECTA

- **ECTA** (Electronic Communications and Transactions Act) section 43 requires online sellers to show specific information: full business details, prices, cancellation and refund terms, and security of payment. Our checkout and footer must cover these.
- **CPA:** service quality and cancellation rights. A marketplace has to decide whether it is an agent of the provider, and say so clearly.
- **Booking cancellations:** publish a clear, fair cancellation and no-show policy.

## Provider-side

- **Provider vetting:** check CIPC registration (where it applies), bank details (Paystack subaccount verification), and for repair shops optionally RMI membership. The Retail Motor Industry Organisation is a South African trust signal.
- **Insurance work:** glass replacement is often paid by insurers. A direct-to-insurer flow is out of scope for the MVP, but note it.

## Accessibility

- Aim for WCAG 2.1 AA. There's no specific South African legal mandate for private sites, but it's good practice and widens the market.
