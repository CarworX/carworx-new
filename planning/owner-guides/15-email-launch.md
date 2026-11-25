# 15. Email: what's done and your 3 steps

**Why:** CarworX sends emails: "invite a helper", "your account has been deleted", sign-in links, and later booking messages. Customers also need somewhere to write *to* (support@). Checked on 25 Nov 2026 (SAST) by Claude.

## ✅ Already done (nothing to do)

| What | Status | Kid version |
|---|---|---|
| `carworx.app`, `mail.carworx.app`, `mail.staging.carworx.app` in Resend | ✅ **Verified**, sending on, EU (Ireland) | 📮 The post box is built |
| SPF, DKIM, DMARC records in Cloudflare DNS | ✅ All present | 🏷️ Stamps that prove the letters are really from us |
| Incoming mail for `@carworx.app` | ✅ Goes to **Zoho Mail** | 📬 Letters *to* us land in Zoho |
| Sign-in emails on staging (the hook Worker) | ✅ Resend key + test-address list set | 🔑 Hosted signup and reset delivery checks are pending |

So the old to-do "verify carworx.app in Resend" is **finished**.

## 🧑‍💼 Your 3 steps (about 20 minutes)

```
① support@ mailbox (Zoho) ─► ② 2 things in Resend ─► ③ 3 secrets into the staging Worker ─► tell Claude "email done"
```

### ① Make `support@carworx.app` (Zoho Mail, 5 min)

Customers and businesses write here. It needs a real inbox.

1. Go to **mailadmin.zoho.com** and sign in.
2. Left menu: **Users** (to make a new mailbox), **or** **Groups** (cheaper: support@ forwards to your own mailbox; recommended).
3. **Groups → + Create** → name `Support`, email `support@carworx.app` → add yourself as a member → **Create**.
4. Send a test email from your phone to support@carworx.app and check it arrives.

**`no-reply@` needs no mailbox.** It's only a "from" name that Resend uses (`no-reply@mail.carworx.app`). Replies go to support@.

### ② Two things in Resend (10 min) · resend.com

**a. An API key for the staging app** (the one that sends invites and "account deleted" emails):
1. **API Keys → + Create API Key**
2. Name: `carworx-web-staging`. Permission: **Sending access**. Domain: **mail.staging.carworx.app** only.
3. **Copy the key** (it starts with `re_`). You only see it once. Keep it for step ③. **Don't paste it into the chat.**

**b. A webhook** (Resend tells us if an email bounced, so we stop sending to bad addresses):
1. **Webhooks → + Add Webhook**
2. Endpoint URL: `https://staging.carworx.app/api/mail/events`
3. Events: tick only **email.bounced** and **email.complained** (the two the app acts on)
4. **Add**, then open it and **copy the Signing secret** (starts with `whsec_`). Keep it for step ③.

After the app mail deploy, verify that the exact webhook path reaches the Worker through Cloudflare Access. An unsigned request should be rejected by the Worker. An Access sign-in redirect means Resend cannot reach the webhook.

### ③ Three secrets into the staging Worker (5 min) · dash.cloudflare.com

1. **Workers & Pages** → **carworx-web-staging** → **Settings** → **Variables and Secrets** → **+ Add**
2. Add each one with **Type: Secret** (never "Text"):

| Name (type exactly) | Value |
|---|---|
| `RESEND_API_KEY` | the `re_…` key from ②a |
| `RESEND_WEBHOOK_SECRET` | the `whsec_…` secret from ②b |
| `MAIL_ENCRYPTION_KEY` | a random 43-character code: see below |

**Making `MAIL_ENCRYPTION_KEY`:** on a Mac or Linux terminal, run
`openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`
and paste the result (exactly 43 letters, numbers, `-` and `_`). On Windows, ask Claude for a one-line PowerShell version. This key scrambles email addresses while they wait in the send queue.

3. **Deploy** when the dashboard asks.

### Then tell Claude: "email done"

Only say *that* it's done. **Never send the keys.** Claude then asks Codex to add the non-secret settings (`MAIL_ENABLED`, `MAIL_FROM=no-reply@mail.staging.carworx.app`, `MAIL_SENDING_DOMAIN`, `MAIL_DOMAIN_VERIFIED`, and the `MAIL_DB` database link) in the next staging deploy, and tests one email to an address on your test list.

## ⚠️ Good to know

- **Staging only sends to your test-address list** (`STAGING_APPROVED_RECIPIENTS_JSON`, already set). Use owner-approved, controlled inboxes for staging delivery checks.
- **Production email comes later**, with the production checklist ([guide 14](14-production-project.md)): its own key for `mail.carworx.app`, its own webhook and secrets. The code keeps production mail switched off until then.
- If a key ever leaks, delete it in Resend (**API Keys → ⋯ → Delete**), make a new one, and replace the Worker secret.
