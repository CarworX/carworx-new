# 7. Resend email for staging (O-9)

**Why:** staging sends real emails: sign-in links, and later booking messages. They must come from a CarworX address that passes spam checks, and on staging they may go only to a short list of test addresses, so that nobody outside the team ever gets a test email.

**When:** with K2. Codex tells you the exact names.

## Steps

1. **Account.** Sign in to <https://resend.com> (or create the account; that's yours to do).
2. **Add a sending subdomain, not the main domain.** Resend → **Domains → Add Domain**, and enter a subdomain such as `mail.staging.carworx.app` or the name Codex proposes. A subdomain keeps test mail apart from any future mail on `carworx.app` itself.
3. **Add the DNS records Resend shows** (usually SPF, DKIM and a return-path record) at whoever manages your DNS (guide 5). Copy each exactly. Wait for Resend to show **Verified**; it can take from minutes to a few hours.
4. **Make an API key for staging only.** Resend → **API Keys → Create**, with *Sending access* limited to that domain. Copy it once, and paste it only where Codex says:
   - Supabase **CarworX App → Authentication → Emails → SMTP settings**, for sign-in emails. Resend's SMTP host is `smtp.resend.com`, the username is `resend`, and the password is the key.
   - and/or a GitHub or Cloudflare staging secret for app emails.
5. **Write the allowlist.** List the email addresses allowed to receive staging mail: yours and the team's. Send Codex the list. K2 builds the rule that blocks every other address on staging.

## Check

Codex triggers a test sign-in email to one allowlisted address and one address not on the list. The first arrives; the second is blocked, and the block is logged.

## Tell Codex

"Domain verified", "key added to … as …", and the allowlist. Never the key.
