# 14. Create the production project (G-PROD)

**Why:** the free public site needs its own Supabase project and its own Workers, separate from staging. Agents never create accounts or hold production credentials (PLAN §12, §15), so you do this. The technical detail is in the [production setup runbook](../runbooks/production-setup.md); this guide is the clicks.

**When:** after Phase 1 is closed, the region is chosen ([latency runbook](../runbooks/latency-region.md)) and the production config PR is merged (runbook gaps P-1, P-2). **Don't start early:** a free project pauses after a week without activity.

**Time:** about 1 hour, plus the deploy.

**Cost:** $0 on the free plan (D-044). Supabase's pricing page (read 2026-11-10) says free projects are "paused after 1 week of inactivity" with a "Limit of 2 active projects". **Staging uses one; production uses the other.** Don't create a third.

**Three rules:**
1. **Every password and key goes into your password manager or the dashboard field named here.** Never into chat, Git, a PR or a receipt.
2. **Production values are all new.** Never reuse a staging secret.
3. **Agents don't click.** You do every step. Agents check your receipt.

```
1 checks ─► 2 Supabase project ─► 3 Auth settings ─► 4 migrations ─► 5 database login
                                                                           │
      9 tell Claude ◄─ 8 smoke ◄─ 7 deploy ◄─ 6 Hyperdrive + Worker secrets ◄┘
```

## 1. Checks before you start

- [ ] Your Supabase and Cloudflare logins use two-step sign-in.
- [ ] The region is decided and recorded in DECISIONS.
- [ ] The production config PR (runbook §5) is merged.
- [ ] Staging is the only other active free project.

## 2. Create the Supabase project

1. Supabase dashboard → **New project**.
2. Choose the CarworX organisation. Fill in:
   - **Name:** `carworx-production`
   - **Database password:** use **Generate a password**, then save it in your password manager.
   - **Region:** the **specific** region you chose: **West Europe (London)** or **Central EU (Frankfurt)**. Don't pick a general "Europe" option. Supabase says a general region "may not match a specific jurisdiction" ([Regions](https://supabase.com/docs/guides/platform/regions)).
   - **Plan:** Free.
3. Wait until the project shows as healthy. Write down the **project ref** and the **API URL**. Neither is secret.

## 3. Auth and API settings

| Where | Set |
|---|---|
| **Authentication → URL Configuration** | **Site URL:** `https://carworx.app`. **Redirect URLs:** `https://carworx.app/auth/callback` only. Supabase advises "setting the exact redirect URL path … in production" ([Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)) |
| **Authentication → Sign In / Providers** | Email on. Google on, with the same OAuth client as staging (guide 4), and add the production callback that Supabase shows to the client's **Authorised redirect URIs** in Google Cloud |
| **Authentication → Multi-Factor** | TOTP (authenticator app) on. Phone off |
| **Integrations → Data API → Settings** | Exposed schemas: `public` and `graphql_public` only. **Not** `api` or `private` |
| **Email sender** | **Wait.** The production email path isn't decided yet (runbook gap P-4) |

## 4. Apply the migrations

On your own computer, in a clean checkout of the approved `main` commit:

```
pnpm exec supabase login
pnpm exec supabase link --project-ref <your production ref>
pnpm exec supabase db push
```

Check that the list matches the files in `supabase/migrations/`. **Never run the seed file** against production; it's synthetic test data.

## 5. Give the search login a password

1. In a password manager, generate a 32-character password.
2. Supabase → **SQL Editor** → run (replacing the two placeholders):
   ```sql
   alter role catalogue_server password '<the password>' valid until '<a date about 12 months away>';
   ```
3. Put a reminder in your calendar a month before that date.

## 6. Hyperdrive and Worker secrets (Cloudflare)

1. **Workers & Pages → Hyperdrive → Create configuration**, named `carworx-catalogue-production`. Use the `catalogue_server` login and the password from step 5. **Turn query caching off.**
   - Cloudflare's Supabase guide says to use the **Direct connection** string. On the free plan that's IPv6 only. **Try direct first; if it won't connect, use the Session pooler string** from Supabase's **Connect** panel, and tell Claude which one worked (runbook OQ-1).
2. Send Claude the Hyperdrive **ID**. It isn't secret; it goes into the config file.
3. Create the Worker `carworx-web-production` and attach the custom domain `carworx.app` (the same way as guide 11 step 4).
4. **Settings → Variables and Secrets**, add these **secrets**, each a new random value of 32+ characters unless stated:
   - `SUPABASE_PUBLISHABLE_KEY`: from Supabase **Project Settings → API keys**, the **publishable** key. **Never** the secret or service-role key.
   - `SEARCH_CURSOR_KEY`
   - `SEARCH_LIMITER_SALT`
   - `MAPBOX_SERVER_TOKEN`: a **new** Mapbox server token for production (D-084)
   - `TURNSTILE_SECRET_KEY`: from [guide 12](12-turnstile.md)
5. Check that these **aren't** set: `CARWORX_DEV_PAGES` and every name starting with `STAGING_` or `LOCAL_`.

## 7. Deploy

Follow the [runbook §8](../runbooks/production-setup.md): build with `CLOUDFLARE_ENV=production`, then `wrangler deploy`, using your own Cloudflare login. Note the version ID it prints.

## 8. Smoke checks

Open `https://carworx.app/healthz`, the home page, a category page and a search. The [runbook §9](../runbooks/production-setup.md) lists what "pass" means. If anything fails, roll back in Cloudflare (**Deployments → Rollback**) and tell Claude.

## 9. Tell Claude

Send:
- the project ref and region
- the migration count and the last file name
- the Hyperdrive ID, "caching off", and direct or pooler
- the Worker name, version ID and commit SHA
- the list of secret **names** that `wrangler secret list` shows
- the smoke results, with the date and time in SAST

Never send a value.
