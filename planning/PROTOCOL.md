# Planning protocol (Claude ↔ Codex)

Status: **proposed by Claude, not yet accepted by Codex.** Codex accepts or amends it in its first turn. Until then, these rules apply as written.

## 1. Goal of the planning phase

Produce one plan both agents sign off on, which the owner then approves. It must cover:

- the product scope and feature structure
- the architecture and tech stack details (within the owner's fixed choices)
- the data model, security and compliance approach
- the third-party APIs and accounts needed, and how to get access
- who does what: which agent leads and which reviews each area, and which sub-agents and tools each uses
- testing, CI/CD, release and operations
- costs: free tier first, with every paid item flagged
- how the two agents work together with as little owner hand-holding as possible

**No application code is written until the owner approves the plan.**

## 2. Files

| File | Who edits it | Purpose |
|---|---|---|
| `planning/STATUS.md` | The agent whose turn it is | Holds the baton (whose turn) and the list of open topics |
| `planning/DECISIONS.md` | Either agent, only under rule 4 | The binding record of agreed decisions |
| `planning/OWNER-QUESTIONS.md` | Either agent | Questions for the owner, and the owner's answers |
| `planning/research/*.md` | Either agent, at any time | Facts with sources. Mark anything unverified as **UNVERIFIED** |
| `planning/claude/NN-*.md` | Claude only | Claude's numbered proposals and replies |
| `planning/codex/NN-*.md` | Codex only | Codex's numbered proposals and replies |

## 3. Taking a turn

1. Pull `main` and read `STATUS.md`. If it isn't your turn, stop. You may add research notes only.
2. Read the other agent's latest file in full.
3. Write your reply as the next numbered file in your own folder, for example `planning/codex/01-reply.md`.
   - Reply to each open topic by its ID (`T-01`, `T-02`, …) with one of: **AGREE**, **AGREE WITH CHANGES** (say exactly what changes), **OBJECT** (give the reason and an alternative), or **NEEDS OWNER**.
   - Back claims with sources, or move them into `research/`.
   - You may open new topics. Give them the next free `T-` number.
4. Update `DECISIONS.md` for anything that is now agreed (rule 4).
5. Update `STATUS.md`: pass the baton, refresh the open topics, and add a one-line summary of your turn to the log.
6. Commit with a message starting `planning(claude):` or `planning(codex):` and push to `main`.

Planning documents go straight to `main`, because they carry little risk and the owner wants to see them immediately. **Application code always goes through pull requests** (see `T-12` in Claude's opening proposal).

## 4. When something counts as agreed

- A topic is **AGREED** once one agent has proposed it and the other has replied AGREE, or replied AGREE WITH CHANGES and the proposer then accepted those changes.
- The agent who closes the topic copies the final wording into `DECISIONS.md`, with the decision ID, the topic ID and links to both files.
- To reopen an agreed decision, give a new reason (new facts, owner input, or a discovered problem). Agents can't reopen things just to relitigate them.

## 5. Deadlock and escalation

- If a topic has gone **3 rounds** without agreement, the agent whose turn it is moves it to `OWNER-QUESTIONS.md`. It writes both positions side by side, at most 150 words each, with a recommendation from each agent. The owner decides.
- Anything that costs money, needs an account in the owner's name, signs a contract or has legal effect always goes to the owner, even if both agents agree.

## 6. Honesty rules

- Don't claim to have checked something you haven't. Use **UNVERIFIED** liberally.
- Each agent speaks for itself about its own abilities. You may give your view of the other agent's abilities, but the other agent has the final say on its own self-assessment.
- Prefer the simplest plan that works. "We might need it later" is not enough reason to add something.

## 7. Finishing the planning phase

Planning ends when:

1. every topic is AGREED or decided by the owner,
2. one agent has merged everything into `planning/PLAN.md` and the other has signed it off, and
3. the owner has approved it in `OWNER-QUESTIONS.md` or in chat.

After that, `AGENTS.md` switches from "planning" to the build rules set out in the plan.

## 8. Codex amendments — AGREED (D-007)

Proposed 2026-10-27 in [Codex 01, T-01](codex/01-reply.md); accepted by Claude in [Claude 02, T-01](claude/02-reply.md). These amendments are now part of the protocol. Owner instructions always take precedence, including the owner's instruction to publish this planning round without starting application development.

- Cite the exact reviewed commit. Preserve the independent baseline separately from the comparison and identify later verification honestly.
- Owner decisions override topic agreements and baton order. Approval to publish planning is distinct from approval of the consolidated build plan.
- Publish planning as a single fast-forward commit; refresh before pushing and reconcile new work rather than force pushing or overwriting the other assistant's proposal.
- AGREE WITH CHANGES stays open until the proposer accepts the changes. Record owner decisions separately from assistant consensus.
- Require independent reciprocal review of security-critical changes; no author signs off their own work as an independent reviewer.
- Treat the baton as a record, not an automatic trigger. Enable automation only with explicit credential/spending authority, verified actor/trigger support, bounded runs and stop controls.
