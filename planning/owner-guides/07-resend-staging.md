# 7. Resend email for staging (O-9)

**Why:** staging sends real emails: sign-in links, and later booking messages. They must come from a CarworX address that passes spam checks, and on staging they may go only to a short list of test addresses, so that nobody outside the team ever gets a test email.

**When:** with K2. Codex tells you the exact names.

## Steps

1. **Account.** Sign in to <https://resend.com> (or create the account; that's yours to do).
2. **Add a sending subdomain, not the main domain.** Resend → **Domains → Add Domain**, and enter a subdomain such as `mail.staging.carworx.app` or the name Codex proposes. A subdomain keeps test mail apart from any future mail on `carworx.app` itself.
3. **Add the DNS records Resend shows** (usually SPF, DKIM and a return-path record) at whoever manages your DNS (guide 5). Copy each exactly. Wait for Resend to show **Verified**; it can take from minutes to a few hours.
4. **Superseded by [guide 11](11-staging-bootstrap.md), step 3.** Make the API key as described there. It goes **only** into the hook Worker. **Don't** put it into Supabase's SMTP settings: K2's email hook replaces SMTP, and SMTP stays off.
5. **Superseded by [guide 11](11-staging-bootstrap.md), step 5.** The allowlist stays private to you. **Don't send it to Codex or Claude.** You put it straight into both staging Workers as `STAGING_APPROVED_RECIPIENTS_JSON`.

## Check

Codex triggers a test sign-in email to one allowlisted address and one address not on the list. The first arrives; the second is blocked, and the block is logged.

## Tell Codex

"Domain verified", "key added to … as …", and the allowlist. Never the key.
