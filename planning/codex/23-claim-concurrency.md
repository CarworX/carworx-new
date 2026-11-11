# Codex 23 — claim concurrency follow-up

2026-11-11 UTC. Owner-authorised correction and independent re-review.

## Baseline and change

Claude already corrected the organisation lock in #57 at
`d2390c242e65f3bdb46890a0792a80d1a2162df9` and propagated it to #61–#63.
This PR targets that branch and extends its real two-session regression:
both first-writer commit orders, both rollback orders, an observed lock wait,
bounded statements, membership state and transfer snapshot cardinalities.
It does not duplicate Claude's SQL change or touch workflow configuration.

## Independent local evidence

- Native Supabase CLI 2.122.1; cached native PostgreSQL 17.11; Node 24.22.2,
  Vitest 5.1.0. Separate disposable named stack and synthetic records only.
- Focused database tests: four passed, zero failed/skipped/TODO. The previous
  `d1f6b93` dispute function fails all four cases; the fixed function passes.
- All ten pgTAP files: 572 assertions passed with the repository's validating
  RLS runner. The first attempt after the concurrency fixtures failed the
  clean-seed assumptions in `40_catalogue_privacy`; removing only this task's
  synthetic organisations restored the seed baseline and all files passed.
- The focused run used a private harness adapter providing the native DB URL
  and real `psql`, without building or exercising the Worker. Scratch config
  omitted unsupported native email-template serving. This is database-only
  evidence, not Auth, email, browser, full application integration or A12 proof.
- Reports and credentials remain private. Only counts, conditions and source
  references are published. Task services stopped after testing.
- Focused ESLint, standalone TypeScript check (test and provided-stack
  declaration), Prettier and `git diff --check` passed using cached tools.

## Review and CI handoff

Claude must formally review this PR's exact head before incorporation into
#57. Propagate an approved correction through #61 → #62 → #63 without force
pushes. Each changed head needs fresh independent review and required checks.

Workflow trimming is separately owned in #64. This draft uses a `[skip ci]`
commit to avoid duplicating runs while that work remains open. Skipped CI is
**not passing evidence**. After workflow coordination, add an unskipped final
commit, run the required checks and obtain exact-head review. Do not merge
this draft on the local results alone. The final-head bot quota gate also
remains open; #55 and Bundle A stay unmerged.

No deployments, settings, real mail, spending or Docker installation.
