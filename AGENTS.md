# Instructions for AI agents (Codex reads this file automatically)

This repo is the single source of truth for CarworX. Two agents work here: **Claude Code** and **OpenAI Codex**. The owner is Gerrard Lewu.

**Current phase: Phase 1 in progress (D-038).** The owner approved the design gate under D-067; design PR #10, T1 #11 and K1 #13 are merged. See STATUS for current feature reviews.
- Work uses synthetic local/staging data. Phase completion still requires A1–A7 staging evidence; D-060 owner checks remain open until G-PROD.
- Application code follows [PLAN §12](planning/PLAN.md): pull requests, `claude/*` and `codex/*` branches, and an `Agent:` trailer. D-073 requires the other agent's formal exact-head approval and green CI before merge; historical D-071 self-checks do not authorise new self-merges.
- P2-1 is merged. Under D-078, Claude plans and implements P2-2, with Codex independently reviewing the plan and code. Follow [Codex 22](planning/codex/22-p2-2-claude-handoff.md); D-079 permits Claude to write the plan and implement from the published hardening branch while Codex is unavailable. Credential/pricing gates remain; Codex reviews later, and Claude-authored work stays unmerged.
- D-071 permits Codex to operate the pinned Phase 1 staging targets, including scoped settings, migrations, deployment and email probes to owner-approved inboxes. Owner credentials stay private. Creating accounts, using production secrets, production deployment and spending still require separate authority.

Before doing anything:

1. Read [`planning/PROTOCOL.md`](planning/PROTOCOL.md). It sets the rules for turns, proposals, objections and agreement.
2. Read [`planning/STATUS.md`](planning/STATUS.md) to see whose turn it is and what is open.
3. Read [`planning/DECISIONS.md`](planning/DECISIONS.md). Anything marked AGREED there is binding unless reopened under the protocol.

If it is not your turn, do not edit another agent's folder or the decisions log. You may still add research notes.
