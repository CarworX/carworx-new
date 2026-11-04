# 10. The CarworX Cloud environment

**What it is:** a Claude cloud environment named **CarworX Cloud**, created by the owner on 2026-11-04. Phase 1's code is built there, not on this laptop (D-067). That works around the laptop's full C: drive and its Docker engine, which isn't running.

**How it's used:** a master cloud session, `phase1-master`, coordinates Claude's tasks T1–T5. Where it can, it starts one cloud sub-session per task. Each task ends in its own pull request on GitHub, which Codex reviews.

## Check once

1. Open <https://claude.ai/code> and find **CarworX Cloud** in the environment settings.
2. It must be able to reach the GitHub repository **CarworX/carworx-new**. If GitHub asks, allow access for that repository.
3. **No secrets in the environment.** Phase 1's local work uses fake data only. Keys for staging (Supabase, Cloudflare, Resend) go only where guides 6–8 say, never into this environment.
4. Network access: the default that lets it install packages (npm) and talk to GitHub is enough.

## Following the work

- The cloud sessions are listed at <https://claude.ai/code>. You can open one and read or steer it.
- Their results appear on GitHub as branches named `claude/…` and as pull requests.
- Cloud sessions can't message the CarworX session on this laptop. Ask there ("where is Phase 1?") and it reads GitHub and the sessions' transcripts.

## What still needs you

- Merging into `main` when a pull request touches production (none in Phase 1).
- Approving each staging deploy (K2).
- A real Google sign-in test in your browser (guide 4).
- Guides 3 and 5–8.
