<!--
CarworX pull request. Fill every section; write "n/a" with a reason rather than
deleting one. Synthetic data only. Never paste a secret, token, key, signed URL
or personal data into this description, a comment or a log excerpt.
-->

## Task / issue

<!-- Task ID (T1–T5, K1–K4, …) and issue link. Use "Refs #N" until the task is fully accepted. -->

- Task:
- Issue: Refs #
- Branch: `claude/…` or `codex/…` · Agent: claude | codex

## Summary

<!-- What changed and why, in a few lines. Name any decision (D-…) it relies on. -->

## A-tests covered (with evidence)

<!-- Quote each A-test (PLAN §11) this PR touches. Say "base", "partial" or "pass", and link or paste the evidence. Never claim a pass that ran on fixtures only or on a different head. -->

| A-test | Scope in this PR | Evidence |
| ------ | ---------------- | -------- |
|        |                  |          |

## Tool versions pinned

<!-- Every new or changed tool: exact version (no ^ or ~) and the official source it was read from at the time of work. Never from memory. -->

| Tool | Version | Official source |
| ---- | ------- | --------------- |
|      |         |                 |

## Files owned

<!-- Confirm every changed path is inside this task's ownership (Claude 10 §2). List any shared file (root package.json, supabase/config.toml) and confirm no other open PR edits it. -->

- [ ] All changed paths are within this task's ownership in Claude 10 §2
- Shared files touched:

## Tests run

<!-- Exact head SHA the results belong to. Paste trimmed outputs. -->

- Head SHA: ``
- Local: `pnpm run check` (lint, format:check, typecheck, test, build) →
- CI: run link →

## Not done / blocked

<!-- Anything left out, deferred, waiting on the other agent or on the owner. -->

## Security & secrets checklist

- [ ] No secrets, tokens, keys or credentials in the diff, history, description or logs
- [ ] `.env` / `.dev.vars` stay ignored; `.env.example` lists names only
- [ ] Synthetic data only; no real personal data
- [ ] Personal responses are `Cache-Control: private, no-store` (or n/a)
- [ ] No deploy, account, DNS, settings or secret changes; no spending
- [ ] New install scripts (`allowBuilds`) or network calls in scripts are named and justified (or none)
- [ ] Security-sensitive change flagged for the reviewer (or n/a)

## Review record

- [ ] For a `promotion: ready` PR, the reviewer records **each timing stratum's**
      path/flow/cooldown, p95 gap, allowed and denied maxima, evidence reference,
      and acceptance or required mitigation with a rationale. Mark n/a only if
      this PR does not request promotion; missing required strata cannot be waived.

<!-- The reviewing agent (never the author) adds one line per reviewed head. -->

REVIEW: APPROVE|CHANGES @<sha>
