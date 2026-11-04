# Owner guides

Step-by-step guides for the jobs only the owner can do (D-063). They are in the order they are needed. Each guide says what to do, how to check it worked, and what to tell Claude or Codex afterwards.

**Two rules hold in every guide:**
- **Keep secrets out of chat and out of Git.** Client secrets, API keys and passwords go only into the place the guide names (a dashboard field, or a local `.env` file that Git ignores). Tell the agents *that* it is done, never the value.
- **Agents don't change accounts, DNS or settings.** You do. The guides tell you what to click.

| # | Guide | Task | Needed before | State on 2026-11-04 |
|---|---|---|---|---|
| 1 | [Make room on C: and start Docker](01-docker-and-pnpm.md) | O-4 | T1 | **Not ready.** C: has 2.6 GB free; Docker is installed but its engine isn't running; pnpm isn't on the PATH |
| 2 | [Merge the design branch](02-merge-design-branch.md) | O-3 | T1 | Waits for Codex's design review (X-c) |
| 3 | [GitHub Actions minutes](03-github-actions-minutes.md) | O-6 | K1 | Pending |
| 4 | [Google sign-in on this computer](04-google-sign-in-local.md) | O-5 | T3 | Staging done; local still to do |
| 5 | [Accounts and DNS list](05-accounts-and-dns.md) | O-7 | K2 | Pending |
| 6 | [Cloudflare staging](06-cloudflare-staging.md) | O-8 | K2 | Pending |
| 7 | [Resend email for staging](07-resend-staging.md) | O-9 | K2 | Pending |
| 8 | [Where backups go](08-backup-destination.md) | O-10 | K4 hosted drill only | Pending; the local drill doesn't need it (D-059) |
| 9 | [Your design checks before launch](09-owner-design-checks.md) | D-060 | G-PROD | Later |

**O-2** (publishing the live design-system clean-up and the darker control edges) was answered yes on 2026-11-04 and is done.

Screens and menu names in the services' dashboards change from time to time. If a button isn't where a guide says, look for the same words nearby, or ask in chat and describe what you see. Never paste a secret while asking.
