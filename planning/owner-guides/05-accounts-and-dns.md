# 5. List the accounts, and who controls carworx.app (O-7)

**Why:** K2 sets up staging and the deploy steps. Codex needs to know which services exist, who owns each account, and where the carworx.app DNS is managed, so that it asks you for the right clicks and never guesses. This is a list of **names only**: no passwords, keys or recovery codes.

**Time:** 15 minutes.

## Steps

Copy the table below into a new chat message, or fill it in here and commit it, whichever you prefer. Write "none" when an account doesn't exist yet.

| Service | Used for | Account exists? | Signed in with (email or Google, no password) | Who else has access | Notes |
|---|---|---|---|---|---|
| GitHub (CarworX organisation) | Code, checks | yes | | | |
| Supabase | Database, sign-in, storage ("CarworX App" = staging, D-062) | yes | | | |
| Google Cloud | Google sign-in client | yes | | | |
| Cloudflare | Hosting, maybe DNS | ? | | | |
| Domain registrar for carworx.app | Domain renewal | ? | | | Which company? Renewal date? |
| Resend | Email | ? | | | |
| Paystack | Payments (later, test mode first) | ? | | | Not needed for Phase 1 |

## Who controls the carworx.app DNS?

DNS is the list of records that point carworx.app and its subdomains at services. To find who manages it:
1. Sign in to the company where you bought carworx.app (the registrar).
2. Open the domain and look for **Nameservers**.
   - If they end in `ns.cloudflare.com`, Cloudflare manages the DNS. Edits happen in Cloudflare → carworx.app → **DNS**.
   - Otherwise the registrar, or the company the nameservers name, manages it.
3. Note: who can edit DNS there, and whether two-step login is on for that account. It should be, because whoever controls DNS controls the domain's email and website.

## Tell Codex

The filled-in table and the nameservers you saw. Codex uses them to write K2's exact requests to you. Codex can't create accounts or change DNS.
