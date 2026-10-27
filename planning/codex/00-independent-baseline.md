# Codex — independent research baseline

Recorded: 2026-10-27. Published after the owner approved the planning-publication plan.

## Provenance

This is a reconstruction of the independent starting position stated in the Codex chat **before** fetching Claude's repository proposal. It is not a claim that this file existed at that earlier time. No local files or GitHub resources were written during that research turn. The subsequent comparison is in [01-reply.md](01-reply.md).

The independent pass examined South African service marketplaces and fines integrations, Supabase regions/pricing/security, Cloudflare framework support, Mapbox coverage/licensing, Resend, payment options and POPIA sources. Paystack-specific follow-up and agent-trigger verification continued after reading Claude. Those later findings are separated in [the verification notes](../research/codex-verification.md).

## Starting position, before reading Claude

- Three top-level groups: Wash & Detailing; Repairs & Maintenance; Fines & Vehicle Admin. Glass and Tyres & Alignment sit under repairs but have prominent shortcuts.
- Discovery, enquiries and bookings share a provider catalogue. Fixed-price services can support payments; diagnosis-dependent repairs require an approved quote. Instant booking requires reliable provider capacity.
- Prefer TypeScript and React Router on Cloudflare Workers, with Supabase Postgres/Auth/Storage and Resend. Require a reason for Next.js adapters or another backend runtime.
- Use Mapbox for maps and supported geocoding, not as the owned provider directory. Use provider-owned or licensed business data with provenance.
- Treat fines lookup as a commercial-data dependency with explicit coverage, not an assumed national public API. Official referrals are a separate, honestly labelled capability.
- Assign assistant responsibilities by tools and reviewed results, not unsupported claims that one model is inherently better at design or coding.
- Include verification, complaints/refunds, privacy, recovery and coverage honesty in launch readiness.

## Sources consulted independently

| Question | Evidence | Implication |
|---|---|---|
| Framework choices | [Cloudflare framework guides](https://developers.cloudflare.com/workers/framework-guides/) and [React Router](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) | A documented Workers path exists; evaluate adapters as a tradeoff, not a necessity. |
| Database location | [Supabase regions](https://supabase.com/docs/guides/platform/regions) | No South African region is listed; residency and latency need explicit handling. |
| Nearby search | [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis) | Geographic provider search can run against our database. |
| Map search | [Search Box coverage and restrictions](https://docs.mapbox.com/api/search/search-box/) | Published coverage is US/Canada/Europe; temporary results cannot form a persistent SA directory. |
| Fines integration | [EasyPay Collector API](https://lesaka-adp-billpayments-collector.apidocumentation.com/easypay-billpayment-collector-api) | A fines-by-ID endpoint is published but labelled beta/testing; production rights are not established. |
| Enforcement context | [SAnews, 1 July 2026](https://www.sanews.gov.za/south-africa/implementation-aarto-continues) | Official reporting describes a phased AARTO rollout; never infer universal lookup coverage. |
| Privacy | [POPIA text](https://www.justice.gov.za/legislation/acts/2013-004.pdf) and [Regulator portal](https://eservices.inforegulator.org.za/services.aspx) | Assess purpose, identifiers, cross-border transfers and responsible-party obligations. |
| Market behaviour | [Service My Car](https://servicemycar.co.za/about), [Mechanico workshop proposition](https://www.mechanico.io/join/), [Nakar app](https://play.google.com/store/apps/details?id=za.co.nakar.app) | Quote comparison and specialised service marketplaces already exist; combined categories alone do not prove demand. |
| Payments considered before learning the selected gateway | [Payfast split payments](https://payfast.io/features/split-payments/) | Split settlement is feasible as a product concept; eligibility and refund liability still need confirmation. Paystack supersedes gateway selection as an owner constraint. |

## Owner answers obtained during research

Nationwide launch; all three flows (discovery/enquiries, confirmed bookings, payments); validate before charging platform fees; no existing providers; business/payment setup not ready; referrals may launch before integrated fines; quote then pay for repairs; owner and colleague operate the pilot; fixed and mobile services from launch.

The later answers informed the published proposal but should not be mistaken for facts inferred from Claude's document. See [the owner record](../OWNER-QUESTIONS.md).

## Limits

No live integration, provider inventory, national coverage count, production account, latency measurement, commercial agreement or independent demand study was verified. The research supports a proposal, not a launch-readiness claim.
