# Instructions for AI agents (Codex reads this file automatically)

This repo is the single source of truth for CarworX. Two agents work here: **Claude Code** and **OpenAI Codex**. The owner is Gerrard Lewu.

**Current phase: Phase 1 in progress (D-038).** The owner approved the design gate under D-067; design PR #10, T1 #11 and K1 #13 are merged. See STATUS for current feature reviews.
- Work uses synthetic local/staging data. Phase completion still requires A1–A7 staging evidence; D-060 owner checks remain open until G-PROD.
- Application code follows [PLAN §12](planning/PLAN.md): pull requests, `claude/*` and `codex/*` branches, and an `Agent:` trailer. For the owner-delegated Phase 1 scope only (D-071), Codex-authored work uses exact-head CI and a recorded self-check.
- D-071 permits Codex to operate the pinned Phase 1 staging targets, including scoped settings, migrations, deployment and email probes to owner-approved inboxes. Owner credentials stay private. Creating accounts, using production secrets, production deployment and spending still require separate authority.

Before doing anything:

1. Read [`planning/PROTOCOL.md`](planning/PROTOCOL.md). It sets the rules for turns, proposals, objections and agreement.
2. Read [`planning/STATUS.md`](planning/STATUS.md) to see whose turn it is and what is open.
3. Read [`planning/DECISIONS.md`](planning/DECISIONS.md). Anything marked AGREED there is binding unless reopened under the protocol.

If it is not your turn, do not edit another agent's folder or the decisions log. You may still add research notes.
