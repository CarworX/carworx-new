# Instructions for Claude Code

Same rules as [`AGENTS.md`](AGENTS.md); read it first. That file is the shared instruction set for both agents. This file only exists because Claude Code loads `CLAUDE.md` automatically.

## Owner preferences (Claude only)

- **Codex prompt:** end every reply that leaves work for Codex with a short, copy-ready prompt for Codex, in this format: one paragraph of imperative steps, naming PR numbers and exact heads, the formal review format `REVIEW: APPROVE|CHANGES @sha`, what to merge and what to wait on.
- **Times:** always give times in SAST (UTC+2).
