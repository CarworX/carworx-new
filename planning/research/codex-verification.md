# Codex verification and corrections

Research date: 2026-10-27. These are evidence notes, not commercial approval or legal sign-off. Earlier independent evidence is preserved in [the baseline](../codex/00-independent-baseline.md). Paystack and agent-trigger verification below continued after reviewing Claude. Original Claude notes remain intact for provenance; use these corrections alongside them.

## Platforms, maps and location data

- **Cloudflare:** [React Router](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) has a documented Workers path. [Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) is also supported through an adapter; that is a tradeoff, not grounds to call it unsupported. [Cloudflare Pages guidance](https://developers.cloudflare.com/pages/migrations/) explicitly recommends Workers for new projects. This replaces the third-party-only evidence in Claude's platform note.
- **Supabase regions:** the [published list](https://supabase.com/docs/guides/platform/regions) contains no African region. London is a provisional choice, not a measured winner. Cloudflare edge hosting does not remove database round-trip latency. Assess all processors/subprocessors and onward transfers; region selection alone is not compliance proof. See [Supabase residency FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq).
- **Current compatibility notice:** the [Supabase changelog](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) announces removal of older TLS configurations starting no earlier than 10 November 2026. Modern clients should be unaffected; include supported mobile-browser/TLS checks. The markdown index was read through PowerShell after the web reader rejected its content type.
- **Search Box:** its [supported geographies](https://docs.mapbox.com/api/search/search-box/#supported-geographies) are US, Canada and Europe. Do not plan South African provider discovery around it. Results are temporary-use data.
- **Geocoding:** [Mapbox storage rules](https://docs.mapbox.com/api/search/geocoding/#storing-geocoding-results) distinguish temporary results (not cacheable) and permanent results. Permanent requests require a card on file or enterprise agreement. Independently entered provider data/pins must retain provenance; do not relabel stored geocoding results as user-owned data to bypass terms.
- **Provider catalogue:** use provider-submitted/permission-based information initially. An OSM import is a separate licensing and coverage decision, not an automatic task. [OSMF guidance](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline) distinguishes produced works and derived databases. [Public Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) prohibits client-side autocomplete and restricts bulk usage; it is not an unrestricted free production fallback.
- **Search implementation:** [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis) supports indexed geographic queries. Radius distance is not a promise of driving time. Mobile-provider service areas and travel buffers must be modelled separately.

## Payments

| Claim | Finding and source | Remaining proof |
|---|---|---|
| Paystack can split transactions | [Official split docs](https://paystack.com/docs/payments/split-payments/) and [support guide](https://support.paystack.com/en/articles/2132802) document subaccounts/splits. | Written approval and sandbox verification for this SA marketplace, account type, providers and settlement setup. |
| A registered company is mandatory for every SA merchant | Too broad. [Business types](https://support.paystack.com/en/articles/2128898) describe SA sole proprietors and limits; Starter accounts lack some features. [Activation](https://support.paystack.com/en/articles/2125506) covers business-specific requirements. | Whether a sole-proprietor model is acceptable for CarworX's marketplace and provider onboarding. |
| Split settlement resolves refund responsibility | Unsupported. [Refund policy](https://support.paystack.com/en/articles/2127106) says refunds use pending payouts/balance and processing charges are non-refundable. | Source of funds after provider settlement, chargeback allocation, reserve/top-up process, recoveries and partial refunds for split payments. |
| Local card pricing | [Official support](https://support.paystack.com/en/articles/2130306) lists SA local cards at 2.9% + R1 excluding VAT at research time. | Recheck account/channel pricing before activation; allocate fees explicitly. No processing fees are waived by a free CarworX pilot. |
| Webhook security | [Paystack webhooks](https://paystack.com/docs/payments/webhooks/) specifies HMAC SHA512 over the event payload with `x-paystack-signature`. | Runtime tests against raw bytes, deduplication, reference/amount/currency checks, authoritative verification and replay/ordering scenarios. |

Do not assert that split settlement automatically eliminates CarworX's payment-facilitation or merchant liability. Legal characterisation and commercial approval depend on the actual arrangement.

## Fines and vehicle administration

- **Public documentation exists:** [EasyPay Collector API](https://lesaka-adp-billpayments-collector.apidocumentation.com/easypay-billpayment-collector-api) publishes `POST /api/lookup/v1/finesByIDnumber`; the traffic-fines section is labelled beta/testing. Staging documentation does not confer production access. The page publishes a bill-payments support contact; no message has been sent.
- **Other candidates:** [Syntell road safety](https://www.syntell.co.za/offering-road-safety/) describes CPA/AARTO systems and PayCity services. [Fines SA](https://finessa.co.za/terms-and-conditions/) is a candidate for a commercial enquiry. Public consumer access does not confer redistribution rights or prove third-party API availability.
- **Coverage/current law:** [SAnews on 1 July 2026](https://www.sanews.gov.za/south-africa/implementation-aarto-continues) reports implementation across 62 municipalities in Phase 2, building on Johannesburg/Tshwane. Older planned rollout dates must not be presented as current status. Confirm official status again before publishing consumer guidance.
- **Launch boundary:** owner approves labelled official referrals and no ID collection for this flow. Integrated lookup requires coverage, freshness, permitted use, identity/authority, retention, commercial and security verification. Do not claim lookup of "all infractions" or all municipalities.

## Compliance and trust

- [POPIA primary text](https://www.justice.gov.za/legislation/acts/2013-004.pdf), [prior-authorisation guidance](https://inforegulator.org.za/prior-authorisation/), [direct-marketing guidance](https://inforegulator.org.za/wp-content/uploads/2020/07/GUIDANCE-NOTE-ON-DIRECT-MARKETING-IN-TERMS-OF-THE-PROTECTION-OF-PERSONAL-INFORMATION-ACT-4-OF-2013-POPIA.pdf) and [Information Officer portal](https://eservices.inforegulator.org.za/services.aspx) are the starting sources.
- Do not reduce section 72 to "GDPR country plus privacy notice" or section 57 to "every ID number needs prior approval". Assess actual purpose, linking, responsible parties, safeguards and applicable conditions before sensitive integrations.
- Minimise private addresses and registration/identity data; separate public catalogue fields from tenant/customer records. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) informs access controls, but privileged keys bypass ordinary RLS guarantees.
- Use [WCAG 2.2](https://www.w3.org/standards/history/WCAG22/) AA as the proposed accessibility target. Automated scans are only part of the check.
- Provider verification badges need specific meanings. Payment-account onboarding is not evidence of workmanship, qualifications, insurance or national-brand endorsement.
- Checkout disclosures, terms, cancellation/refund rights and tax treatment still need professional review for this marketplace arrangement. No legal sign-off has occurred.

## Agent handoffs

- [Official Codex GitHub docs](https://learn.chatgpt.com/docs/third-party/github) document `@codex review` and other PR-context tasks. Generic issue-comment implementation triggers and bot-trigger eligibility in this repository are **UNVERIFIED**.
- [Codex Action](https://learn.chatgpt.com/docs/github-action) requires an OpenAI API key; it is a separately configured/billed route, not a promise that subscriptions cover automation.
- [Claude Action](https://code.claude.com/docs/en/github-actions) supports issue/PR tasks, checks write access and rejects bot actors unless listed in `allowed_bots`. Automatic mutual mentions are not a ready-made loop.
- No automation, installation, credential or paid run was created. Use manual baton turns until an authorised documentation-only round trip proves the intended actor/trigger path.

## Market conclusions and limits

[Service My Car](https://servicemycar.co.za/about) describes quote comparison and workshop bookings. [Michanic](https://www.michanic.co.za/) advertises quotes, mobile servicing, service areas and workmanship assurances. These support investigating quote-first flows and trust/operations, not claims of their transaction volume or actual service quality. The retrieved Michanic page contains inconsistent testimonial/place text, so its self-reported traction is not adopted as verified evidence.

Claude's "nobody combines these features" claim is **UNVERIFIED** and should not become a market fact. No customer interviews, representative demand study, licensed provider inventory or nationwide provider count was completed.

Some direct reads timed out or were inaccessible (including the government ECTA page, Supa Quick, PG Auto Glass and one Service My Car URL variant). No conclusion depends solely on those failed reads. No test/live vendor requests, real personal data, credentials or account dashboards were used.
