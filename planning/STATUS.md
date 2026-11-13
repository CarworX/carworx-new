# Status

Phase 3 money test round (Codex, 2026-11-13 UTC): isolated `codex/p3-money-tests`
from `phase-3` @`4b97de8`. Local unit/type/SQL/concurrency results and outstanding
restore/staging gates: [test record](codex/42-phase3-money-tests.md). Claude owns
the separate bookings test PR; do not merge it. Shared A23/A29/A35 end-to-end
checks wait for staging. No Phase 3 acceptance-complete claim.
Local A36 passed at `2ef8951` (1,099 RLS assertions / 76 restored tables).
Money test PR #107 targets `phase-3`; #97 is ready with green required CI.

## Earlier finish checkpoint (2026-11-12; historical)

Updated 2026-11-12 UTC. Owner authorized the finish plan in chat: Codex may build, use Codex workers/review, publish and safely merge without waiting for Claude. Latest execution choice: continue through GitHub only while local disk space is exhausted. See D-091 and [finish record](codex/35-autonomous-finish.md).

## Current work

- Main includes foundations, Phase 2 Bundles A/B/C, onboarding designs #72, O1 #78, build plan #77 and O2 #79. CI regression #76 and context cleanup #81 were independently reviewed and merged on green exact-head CI during this task.
- O3 provider steps, O4 admin flows, O5 encrypted email foundation, O6 team setup and account tabs are in progress on the Codex finish branch. These are not acceptance-complete or approved for merge yet. Remote Actions will provide pinned-runtime verification.
- Sites preview changes exist locally but remain CHANGES: role/query handling, Google-only eligibility, reflected markup and main application entry need correction. Publication is pending security fixes and the packaging path; current restricted Site audience is preserved.

## External blockers and gates

- C: exhausted; local WSL and browser/runtime writes failed. Automatic approval review rejected cleanup commands. Owner chose GitHub-only continuation; local personal files remain untouched.
- Cloudflare connector requires reauthentication. Supabase connection lists CarworX MVP Dev; it has not been established as the approved staging target. No migrations or real sends were performed there.
- Hosted A1–A7, real OAuth/mail, application-path timings, backup/restore, physical-device/accessibility evidence and G-PROD remain open.
- G-LIVEPAY requirements remain open; payment implementation is test mode only. No live collection or public-domain cutover is claimed.

## Next

Complete and independently review coherent slices, run exact-head CI, merge passing work, then continue O7/O8 and Phase 3 sandbox flows. Keep incomplete or inaccessible checks explicit.
