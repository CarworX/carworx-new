# Platform limits and costs (free tiers vs paid)

Researched by Claude, 2026-10-27. Prices in USD unless stated. Check again before committing money: vendors change these often.

## Supabase — [pricing](https://supabase.com/pricing), [regions](https://supabase.com/docs/guides/platform/regions)

| | Free | Pro (from $25/mo) |
|---|---|---|
| Active projects | 2 | per project |
| Database | 500 MB, shared CPU | 8 GB disk included |
| Monthly active users (auth) | 50,000 | 100,000 |
| File storage | 1 GB | 100 GB |
| Egress | 5 GB + 5 GB cached | 250 GB + 250 GB cached |
| Edge Function invocations | 500,000 | 2 million |
| Realtime | 200 concurrent connections | 500 |
| **Pauses when idle** | **Yes, after 1 week of inactivity** | Never |
| **Backups** | **None** | Daily, kept 7 days |

**Regions:** there is **no African region**. The list runs from US through EU and Asia to São Paulo, and af-south-1 (Cape Town) isn't offered. Supabase declined it in 2021 ([discussion](https://www.github.com/supabase/supabase/discussions/3515)). The nearest practical choices are `eu-west-2` London, `eu-central-1` Frankfurt or `eu-west-1` Ireland. Expect roughly 150–200 ms round trips from Johannesburg (**UNVERIFIED**; measure it).

**Implications:**
- Free tier is fine for development. **Before real money moves, Pro ($25/mo) is close to mandatory.** Free has no backups, and a paused database during a quiet week would break bookings.
- Data stored in the EU counts as a cross-border transfer under POPIA section 72. EU/UK GDPR is generally treated as "adequate" protection, but say so in the privacy policy (see `compliance-popia.md`).

## Cloudflare Workers — [pricing](https://developers.cloudflare.com/workers/platform/pricing/)

| | Free | Paid ($5/mo minimum per account) |
|---|---|---|
| Requests | 100,000 per day | 10 million/month, then $0.30 per million |
| CPU time | **10 ms per invocation** | 30 million CPU-ms/month, then $0.02 per million |
| KV | 100k reads/day, 1k writes/day, 1 GB | more |
| D1 | 5M rows read/day, 100k written/day, 5 GB | more |
| R2 | 10 GB-month, no egress charges | more |
| Queues | 10,000 operations/day | more |

- Cloudflare has data centres in Johannesburg, Cape Town and Durban, so pages and cached responses are served locally even though the database is in Europe.
- **The 10 ms CPU limit on Free is the main risk.** Server-side rendering of a React app plus verifying a JWT can exceed it. Budget for Workers Paid ($5/mo) at launch, or prove free tier is enough by measuring.
- **Workers with Static Assets** is now the recommended place for new sites, over Pages ([third-party summary](https://www.morphllm.com/comparisons/cloudflare-pages-vs-workers); **UNVERIFIED** against Cloudflare's own docs).
- **Hyperdrive** pools Postgres connections from Workers to Supabase ([Cloudflare docs](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/)). Useful if Workers query Postgres directly rather than through Supabase's REST API.

## Resend — [pricing](https://resend.com/pricing)

- Free: 3,000 emails/month, **100/day**, 3 domains, 30-day log retention.
- Pro: $20/mo for 50,000/month with no daily cap.
- 100/day is enough for the early beta. Booking confirmations plus reminders plus provider notifications will hit it once there are roughly 30 bookings a day.

## Mapbox — [pricing](https://www.mapbox.com/pricing)

| Product | Free per month | After free |
|---|---|---|
| GL JS map loads (web) | 50,000 | $5 per 1,000 |
| Search Box API | 500 sessions / 50,000 requests (preview pricing) | $3 per 1,000 sessions |
| Temporary geocoding | 100,000 | $0.75 per 1,000 |
| **Permanent geocoding** | **none** | **$5 per 1,000** |
| Directions / Matrix / Isochrone | 100,000 each | $2 per 1,000 |

**Important licence trap:** results from the *temporary* geocoding API **can't be stored**. Storing provider coordinates in our database needs *permanent* geocoding, which has no free tier. See `maps-and-provider-data.md` for workarounds.

## Paystack — see `payments-paystack.md`

Per-transaction fees only, no monthly fee. Local cards are 2.9% + R1 excl. VAT, per Paystack's support page.

## Rough monthly running cost by stage (Claude's estimate, to be challenged)

| Stage | Supabase | Cloudflare | Resend | Mapbox | Total |
|---|---|---|---|---|---|
| Build / private beta | $0 | $0 | $0 | $0 | **$0** |
| Public launch (real payments) | $25 | $5 | $0–20 | $0 | **≈ $30–50 (≈ R550–900)** |
| Growth (thousands of bookings/month) | $25+ | $5+ | $20 | depends | ≈ $50–150 |

Not counted: fines data partner fees, WhatsApp/SMS messaging, legal review of terms, and marketing. See Claude's opening proposal, T-11.
