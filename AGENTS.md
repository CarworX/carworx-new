# Instructions for AI agents (Codex reads this file automatically)

This repo is the single source of truth for CarworX. Two agents work here: **Claude Code** and **OpenAI Codex**. The owner is Gerrard Lewu.

**Current phase: Phase 1 approved by the owner (D-038), not started.**
- **When it starts:** Phase 1 starts local-only with synthetic data once Codex has reviewed the design work and the owner has merged `planning/design-motion-toolkit` to `main` (see STATUS).
- **Until then:** do not write application code. Planning documents, research notes, design artefacts and repo housekeeping are allowed.
- **Once it starts:** application code follows [PLAN §12](planning/PLAN.md): pull requests, `claude/*` and `codex/*` branches, an `Agent:` trailer, and the other agent's review.
- **Never, for agents:** creating accounts, handling production secrets, deploying, or spending money (PLAN §15, §18).

Before doing anything:

1. Read [`planning/PROTOCOL.md`](planning/PROTOCOL.md). It sets the rules for turns, proposals, objections and agreement.
2. Read [`planning/STATUS.md`](planning/STATUS.md) to see whose turn it is and what is open.
3. Read [`planning/DECISIONS.md`](planning/DECISIONS.md). Anything marked AGREED there is binding unless reopened under the protocol.

If it is not your turn, do not edit another agent's folder or the decisions log. You may still add research notes.
