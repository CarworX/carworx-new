# 12. Cloudflare Turnstile for the visitor forms (Bundle B)

**Why:** the enquiry and "need a provider here" forms (P2-5, Bundle B) are open to anyone. Turnstile is Cloudflare's free check that a visitor is a person, without picture puzzles. It's paired with a per-IP limit (Claude 17 §3).

**When:** before Bundle B's forms go to staging. The code can be built and tested without it, using Cloudflare's official **test keys**.

**Time:** about 15 minutes.

**Cost:** $0. Cloudflare's Turnstile plans page (read 2026-11-10) lists the Free plan with "Up to 20 widgets", "Unlimited challenges" and "10 hostnames per widget". Turnstile "can be used independently without requiring other Cloudflare services" ([Plans](https://developers.cloudflare.com/turnstile/plans/)).

**Two rules:**
1. The **sitekey is public**; it goes into the page. The **secret key is private**; it goes only into the Worker secret named below. Never into chat, Git or a receipt.
2. You make **two widgets**, one for staging and one for production, so a staging leak can't touch production.

## Steps

Source: [Create and manage widgets](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/), read 2026-11-10.

1. Log in to the Cloudflare account that holds the CarworX Workers (guide 5).
2. Open **Turnstile** (in the left menu, or the [direct link](https://dash.cloudflare.com/?to=/:account/turnstile)). Select **Add widget**.
3. Fill in:

   | Field | Staging widget | Production widget |
   |---|---|---|
   | Widget name | `carworx-staging-forms` | `carworx-production-forms` |
   | Hostname management | `staging.carworx.app` only | `carworx.app` only |
   | Widget mode | **Managed** | **Managed** |
   | Pre-clearance | Leave off | Leave off |

   *Why Managed:* Cloudflare decides when a visitor needs to tick a box, and most never do. It gives people using assistive technology a way through, and Cloudflare lists "WCAG 2.2 AAA compliance" on the plans page.
   *Why one hostname each:* Cloudflare advises "Restrict your hostnames. Only allow widgets on domains that you control" ([Get started](https://developers.cloudflare.com/turnstile/get-started/)).
4. Select **Create**. Cloudflare shows the **sitekey** and the **secret key**.
5. Copy the **secret key** straight into the Worker secret, then close the page:
   - staging: Worker `carworx-web-staging` → **Settings → Variables and Secrets** → add secret `TURNSTILE_SECRET_KEY`.
   - production: Worker `carworx-web-production`, the same name. Do this one only when production is set up ([guide 14](14-production-project.md)).
6. Copy the **sitekey**. It isn't secret.

> **Names.** `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` are the **proposed** names. Bundle B fixes the final names in its PR. If they differ, use Bundle B's.

## Check it worked

- The widget list shows both widgets, each with exactly one hostname.
- The Worker's **Variables and Secrets** page lists `TURNSTILE_SECRET_KEY` as a secret, with its value hidden.

## If a key leaks

Open the widget → **Settings** → rotate the secret key. Paste the new one into the Worker secret. Cloudflare also advises rotating regularly.

## Tell Claude

"Turnstile widgets made: staging `<sitekey>`, production `<sitekey>`; staging secret set." Never the secret key.
