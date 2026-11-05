# 11. Set up staging, end to end (K2 → A2)

**Why:** the code for staging is built and reviewed (K2, [PR #23](https://github.com/CarworX/carworx-new/pull/23)). It stays **locked** (`promotion.json` says `blocked`) until you do the setup below and hand back short, redacted receipts. This is the main thing between us and acceptance test **A2** (staging deploy), and it unblocks A3, A4 and A5 on staging too.

**When:** after #23 is merged into `main`. Steps 1–3 can start now.

**Time:** about 1–2 hours of clicking, spread out while DNS verifies.

**Replaces:** guide 7 steps 4–5 and guide 6 step 4 (both were written before K2's design). Guides 5 and 6 still help for DNS and the Cloudflare dashboard.

**Three rules:**
1. **Secrets go only into the dashboard field named here.** Never into chat, email, Git or a receipt.
2. **The list of approved email addresses is private to you.** Agents never see it. Give it only to the two Cloudflare Workers (step 5).
3. **Agents don't click, deploy or send mail.** You do every step here. Agents check your receipts and the code.

```
 you ─► 1 access ─► 2 addresses ─► 3 Resend ─► 4 Cloudflare token ─► 5 Worker settings
                                                                          │
     A2 ◄─ 10 smoke ◄─ 9 deploy app ◄─ 8 "ready" PR ◄─ 7 receipts ◄─ 6 hook on + probes
```

## 1. Give Codex read access to the staging Supabase project

Claude confirmed "CarworX App" (`gdiyrdqfkthtcglgqnts`) exists and is healthy, but Codex's Supabase connection can't see its organisation.

1. In Codex's settings, open its **Supabase** connection and reconnect it.
2. When Supabase asks which organisation to allow, tick the one that holds **CarworX App**.

**Check:** ask Codex to list Supabase projects. It should see `gdiyrdqfkthtcglgqnts`.

## 2. Choose the two staging addresses

You need two HTTPS addresses on a domain that Cloudflare manages (guide 5):

| Worker | Name (fixed in code) | Suggested address |
|---|---|---|
| The app | `carworx-web-staging` | `https://staging.carworx.app` |
| The email hook | `carworx-auth-email-staging` | `https://auth-email.staging.carworx.app` |

The app address must **not** be `carworx.app` or `www.carworx.app`; the code refuses those for staging. Write both addresses down. They aren't secret.

## 3. Resend: sending domain and key (hook only)

1. Do guide 7 **steps 1–3**: add a subdomain such as `mail.staging.carworx.app`, add its DNS records, and wait for **Verified**.
2. Pick a **sender address** on that subdomain, for example `no-reply@mail.staging.carworx.app`. It must be a plain address, not "Name <address>".
3. Resend → **API Keys → Create**, with *Sending access* limited to that one domain. Keep it ready for step 5.

**Don't** put this key into Supabase's SMTP settings. The hook replaces SMTP, and SMTP must stay **off**.

## 4. Cloudflare: a deploy token that can only touch the app Worker

Cloudflare can only scope a token to a Worker that already exists, and creating a Worker needs more than the token will have. So do this in three steps.

1. **Create the app Worker yourself.** Use your own login, with Admin access. In **Workers & Pages**, create a Worker named exactly `carworx-web-staging`. It can be empty; the workflow deploys the real code later.
2. **Attach its address now.** On that Worker, add the app address from step 2 as its **custom domain**. Adding or changing a route or domain needs extra zone permission, so do it once, yourself, and the deploy token won't need that permission.
3. **Create an account-owned token:** **Manage Account → Account API Tokens → Create token**.
   - Under **Workers**, set the scope to **Specified Workers** and select only `carworx-web-staging`.
   - Give it the **Editor** role. Editor can update and deploy that Worker but can't delete it or touch any other Worker.
   - If the dashboard asks for it, also add **Metadata Read-Only** on that same Worker. Nothing else.
   - **Don't** use the legacy **Workers Scripts Edit** permission, or a token made under your profile's **API Tokens** page. Workers Scripts Edit means Editor across **every** Worker in the account.
   - Don't include the hook Worker, DNS, zone or route permissions.
4. Copy the token **ID** (not secret) and keep the token itself for step 5.

**Why so narrow:** this repository can't use GitHub's protected-environment rule on its current plan, so anyone who can push to the repo can, in principle, reach this token. A token that can only edit one staging Worker limits what any mistake can do. K2's readiness check refuses any token whose recorded scope is broader.

Source: Cloudflare's [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/) and [account-owned API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/).

## 5. Put the settings in place

### 5a. GitHub repository settings

Go to **Settings → Secrets and variables → Actions**. These are repository-level settings, not a GitHub "environment".

| Type | Name | Value |
|---|---|---|
| Variable | `STAGING_APP_ORIGIN` | the app address from step 2, exactly (`https://…`, no trailing `/`) |
| Variable | `STAGING_CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account ID (32 characters) |
| Secret | `STAGING_CLOUDFLARE_API_TOKEN` | the token from step 4 |
| Secret | `STAGING_SMOKE_EMAIL` | a test account's email that **is** on your approved list |
| Secret | `STAGING_SMOKE_PASSWORD` | that test account's password (a staging-only account, used for nothing else) |
| Secret | `STAGING_SMOKE_UNAPPROVED_EMAIL` | an address you control that is **not** on the approved list |

### 5b. Cloudflare: the app Worker `carworx-web-staging`

Go to **Settings → Variables and Secrets**. Add these as **Secret**:

- `SUPABASE_PUBLISHABLE_KEY`: from Supabase **CarworX App → Project Settings → API**, the publishable (anon) key. **Never the service-role key.**
- `STAGING_APPROVED_RECIPIENTS_JSON`: your approved addresses as a JSON list, for example `["you@example.com","teammate@example.com"]`.

The deploy workflow sets `APP_ORIGIN`, `SUPABASE_URL`, `CARWORX_ENV=staging` and the dev-pages flag itself.

### 5c. Cloudflare: the hook Worker `carworx-auth-email-staging`

Add these as **Secret**:

| Name | Value |
|---|---|
| `SEND_EMAIL_HOOK_SECRET` | from step 6.2 below; you'll come back to add it |
| `STAGING_RESEND_API_KEY` | the Resend key from step 3 |
| `STAGING_AUTH_EMAIL_FROM` | the sender address from step 3 |
| `STAGING_APPROVED_RECIPIENTS_JSON` | **the same list as 5b** |

And as plain text: `APP_ORIGIN` = the app address from step 2.

**Emergency off switch:** set `STAGING_APPROVED_RECIPIENTS_JSON` to `[]` on **both** Workers. All email then fails safely. Don't disable the hook in Supabase to stop email, because that can switch Supabase's own default sender back on.

## 6. Deploy the hook, switch it on, and test it

1. **Deploy the hook Worker** using your own Cloudflare login, not the step 4 token, and attach the hook address from step 2 as its custom domain. **Codex supplies the exact command**; it isn't in the repo yet. Ask for it. The step 4 token can't touch this Worker, which is intended.
2. Supabase **CarworX App → Authentication → Hooks → Send Email hook**:
   - choose **HTTPS**
   - enter `https://<hook address>`
   - generate the secret
   - copy that secret into the hook Worker as `SEND_EMAIL_HOOK_SECRET` (step 5c)
   - turn the hook **on**
3. Make sure **custom SMTP stays off**.
4. **Test it**, with Codex's probe checklist:
   - ✅ sign-up and password reset to an **approved** address arrive, and the link works
   - ❌ sign-up, resend and reset to an **unapproved** address send nothing
   - ❌ an unsupported email type (for example a magic link) sends nothing
   - ❌ with the hook failing, nothing is sent by any other route

   An empty inbox alone isn't proof. The receipt needs the hook's call counts and the provider-call counts. **Codex supplies the probe and counter tooling**; ask for it before you start.

## 7. Write the four receipts

These are short JSON files under `planning/evidence/k2/`. They hold **no secrets, no addresses and no email content**, only IDs, names, counts and dates.

| Receipt | What it says |
|---|---|
| `implementation` | the reviewed commit and its green CI run (Codex can prepare this) |
| `configuration` | account ID, Worker name, Supabase project, app and route address, the secret **names**, and your own revision labels (e.g. `recipients-v1`) |
| `token_policy` | the token ID from step 4, active, account-owned, with only **Editor** (and, if added, **Metadata Read-Only**) scoped to the single Worker `carworx-web-staging` |
| `hosted_hook` | the hook's deployed version ID, enabled, and the step 6 test results with counts |

The exact fields are in `scripts/ops/env/README.md` ("Version 2 readiness receipts"). Each receipt is valid for **7 days**, and changing the code, settings or hook makes it invalid. So do steps 6–9 close together.

## 8. The "ready" PR

An agent opens a PR that adds the four receipts and changes `promotion.json` to `ready`, with their hashes. It's reviewed like any other change. Only after it merges can the deploy step run.

## 9. Deploy the app

GitHub → **Actions → K2 owner staging workflow → Run workflow**, from `main`, with:
- `reviewed_sha`: the full reviewed commit of the merged PR you're deploying
- `source_pr`: that PR's number
- `ci_run`: its green K1 run number
- `dry_run`: **false**
- `smoke_only`: false

Agents give you these three values. Run it once with `dry_run` **true** first; that packages without deploying.

## 10. Smoke test → A2

The workflow then checks the live app:
- health
- no caching of personal pages
- the key binding is present (not printed)
- a test sign-in and sign-out
- dev pages only on staging

The first run may fail only because the **app-side negative receipt** doesn't exist yet. To fix that:
1. Do the unapproved sign-up, resend and reset probes against the deployed app.
2. Save the sanitized result as the repository variable `STAGING_APPLICATION_NEGATIVE_EVIDENCE_JSON` (format in the README). It must be under 24 hours old.
3. Re-run with `dry_run: false`, `smoke_only: true`. That re-checks without redeploying.

**A2 passes** when that run is green. Tell the agents the run link.

## Tell Claude and Codex

- "Codex can see the Supabase project" (step 1).
- The two addresses (step 2), the sender address and the token **ID**: none of these are secret.
- "Settings done" for steps 5a–5c. Never send the values.
- The step 6 probe results and the receipts, as a PR or files.
- The workflow run links for steps 9–10.

## Still separate from this guide

- **Real Google sign-in** (A3) needs [guide 4](04-google-sign-in-local.md) and a staging test.
- **K3 speed** and **K4 backup** have their own steps. K4's hosted drill needs [guide 8](08-backup-destination.md).
- **Production** has a separate project and setup later. Nothing here touches it.
