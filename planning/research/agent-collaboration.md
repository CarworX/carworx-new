# How Claude and Codex can work together without the owner relaying every turn

Researched by Claude, 2026-10-27.

## What each tool can do on GitHub

**Claude Code**
- **Claude GitHub App + `anthropics/claude-code-action@v1`:** mentioning `@claude` in an issue or PR comment runs Claude in GitHub Actions. It can analyse code, push commits and open PRs. Setup is `/install-github-app` from Claude Code, or manual. The credential is stored as a repo secret: `ANTHROPIC_API_KEY` or a subscription token `CLAUDE_CODE_OAUTH_TOKEN`. Needs repo admin rights ([Claude Code docs](https://code.claude.com/docs/en/github-actions)).
- Optional automatic PR review workflow.
- Claude Code desktop and CLI sessions (like this one) can also run scheduled or looping tasks.

**OpenAI Codex**
- **Codex code review:** comment `@codex review` on a PR, or turn on automatic reviews. Needs Codex cloud set up and code review enabled for the repo. Reads `AGENTS.md` for repo guidance ([OpenAI docs](https://developers.openai.com/codex/integrations/github.md)).
- **Tasks from issue comments** (asking `@codex` to implement something): reported by a third-party course ([Educative](https://www.educative.io/courses/mastering-openai-codex-for-agentic-coding/codex-in-the-github-workflow-issues-pull-requests-and-ci)). **UNVERIFIED** in OpenAI's docs. **Codex: please confirm what you can be triggered to do from GitHub comments.**
- Codex also has a GitHub Action for CI use (**UNVERIFIED** details).

## Proposed autonomy levels (owner chooses)

| Level | How turns pass | Owner effort | Risk |
|---|---|---|---|
| **L0 — Relay** (now) | Owner tells each agent "your turn" | High | None |
| **L1 — Baton in repo** | Owner just says "go" to whichever agent `STATUS.md` names | Low | None |
| **L2 — GitHub mentions** | Each planning topic or code task is a GitHub issue or PR. An agent ends its turn by commenting `@codex` or `@claude`, which triggers the other | Very low | Loops and cost. Needs a round cap and an owner kill switch |
| **L3 — Build loop** | Agent A opens a PR, Agent B auto-reviews, CI runs, and the PR merges when B approves and CI is green. The owner reviews milestones, not individual PRs | Lowest | Needs strong CI, branch protection and a human merge gate on production deploys |

**Safety rails for L2/L3:**
- Max 3 automated back-and-forth rounds per issue, then label it `needs-owner`.
- Agents never trigger each other on issues labelled `needs-owner` or `paused`.
- Only the owner can merge to `main` while the project is in production, or production deploys need manual approval in GitHub Environments.
- Secrets (Paystack live keys, Supabase service role) live only in Cloudflare and GitHub secrets, never in the repo, and production secrets are available only to the deploy job.
