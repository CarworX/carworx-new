# 6. Cloudflare staging address and secrets (O-8)

**Why:** acceptance tests A1–A7 must pass on **staging**, a private copy of the app on the internet with fake data only. The Supabase side of staging exists ("CarworX App", D-062). The app itself is hosted on Cloudflare. K2 (Codex) writes the deploy workflow; you create the Cloudflare pieces and enter the secrets, because agents don't change accounts (D-058).

**When:** after K1 and your accounts list (guide 5). Codex's K2 pull request tells you the exact names it expects. Use this guide alongside it.

## What you'll be asked to do

1. **Pick the staging address.** Usually `staging.carworx.app`. If Cloudflare manages your DNS (guide 5), adding it there is one record that Cloudflare creates for you when you attach the address to the app.
2. **Create or allow the app on Cloudflare.** In the Cloudflare dashboard: **Workers & Pages**. Codex's workflow can create the app on its first deploy, using a token you make (step 3). Or you create it by hand with the name Codex gives you.
3. **Make a deploy token, limited to staging.** Cloudflare dashboard → your profile → **API Tokens → Create Token**. Use the template Codex names, with permission for this one account and the app only.
   - Copy the token once. Paste it **only** into GitHub: repository **carworx-new → Settings → Secrets and variables → Actions → Environments → staging → Add secret**, with the name Codex gives you.
   - Never paste it into chat or a file.
4. **Superseded by [guide 11](11-staging-bootstrap.md), steps 4–5,** which give the exact token scope and secret names K2 checks. Original text, for reference: **Add the staging-only app secrets.** These are the Supabase staging keys the app needs on the server. Supabase dashboard → **CarworX App → Project Settings → API**: copy the values Codex names, and paste each into the Cloudflare app's **Settings → Variables and Secrets** as a **Secret**, with the exact name given.
   - Use the **staging** project's keys only. The production project doesn't exist yet and is created before launch.
5. **Keep staging private.** Codex's K2 plan says how: for example Cloudflare Access in front of `staging.carworx.app`, so only you and the team can open it. You switch it on in **Zero Trust → Access → Applications** if K2 asks for it.

## Check

- Codex runs the staging deploy (the workflow is started by hand and you approve each run). It reports the address.
- You open `staging.carworx.app`. You should see the test page, and a stranger (for example a private browser window not signed in to Access) should not.

## Tell Codex

"Token added to GitHub staging secrets as …", "Cloudflare secrets added: … (names only)", "Access is on". Never the values.
