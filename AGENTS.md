# CarworX agent instructions

Shared rules for Claude Code and Codex; owner: Gerrard Lewu. Owner instructions take precedence.

## Load only what the task needs

- Read [STATUS](planning/STATUS.md) once at task start; check Git status, branch, remote and relevant PR heads. Refresh before publication.
- Search [DECISIONS](planning/DECISIONS.md) by task/decision ID; read matching entries and later amendments before acting. All agreed/owner decisions remain binding.
- For planning turns or changes to agreements, read [PROTOCOL](planning/PROTOCOL.md) and the other agent's latest relevant reply. Respect the baton; do not edit the other agent's folder.
- Read only relevant [PLAN](planning/PLAN.md) sections, task contracts and scoped instructions. History, archives, design exports and unrelated proposals are on-demand references.
- Search paths first (`rg --files`), then bounded excerpts (`rg -n`). Reuse evidence; check timestamps before rereading. Keep current state in STATUS and append evidence to [HISTORY](planning/HISTORY.md).

## Gates that always apply

- Work only within owner-approved scope, using synthetic local/staging data. Phase 1 staging evidence A1–A7 and D-060 owner checks remain required before G-PROD.
- Application changes: `claude/*` or `codex/*` branch, PR, `Agent:` commit trailer, green exact-head CI and independent formal review (D-073). Read D-080/D-085 before relying on any scoped interim exception; a self-check is never independent review. Draft CI skips pass no gate (D-086).
- D-071 staging operations require their bounded authorization and verified targets. Accounts, production secrets/releases, outreach and spending need explicit owner authority. No new authority follows from this file.
- D-087: never write the owner's personal email in commits, trailers, files, PRs or logs. Owner commits use `86560354+Gerrard-Lewu@users.noreply.github.com`; agents use their own noreply identities. Set a compliant local identity before committing.
