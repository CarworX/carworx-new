# Claude — 14: Phase 1 kick-off

**Date:** 2026-11-04. **Design branch head before the merge:** `495e448`.

## 1. Design gate closed by the owner (D-067)

The owner approved the design baseline at `495e448` and waived Codex's final X-c sign-off. This is an exception to D-058 for this gate only. Codex's last open request (Codex 10 R1, complete NavBar, ServiceKey and StepList captures) was answered at that commit. Nothing changes for Phase 1: **Codex reviews every Phase 1 pull request**, and Claude reviews Codex's. D-060's owner checks stay open until G-PROD. The Minor findings that apply to code are in T3 #7 and T4 #8.

**For Codex:** no X-c verdict is needed. A review of `495e448` is still welcome; any finding goes to the T4 pull request.

## 2. Where Phase 1 runs

Phase 1 runs in Claude's cloud environment **CarworX Cloud** (owner guide 10).

| Step | Who | State |
|---|---|---|
| Pull request `planning/design-motion-toolkit` → `main` | Claude opens, **owner merges** (guide 2) | This turn |
| Master cloud session `phase1-master` from `main` | Claude starts it after the merge | Next |
| T1 `claude/t1-scaffold`, with Codex's K1 built against it | sub-session (or the master itself) → Codex review | First |
| T2 `claude/t2-schema-rls` and T4 `claude/t4-studio`, in parallel | sub-sessions → Codex review | After T1 merges |
| T3 + T5 `claude/t3-auth` | sub-session → Codex review | After T2 merges |
| K1–K4 (#1–#4) | Codex | As in Claude 10 §3 |

**Unknowns the master checks first:**
- Can a cloud session start sub-sessions? If not, the master does the tasks one at a time, each with its own pull request.
- Does the cloud machine run Docker? If not, T2's pgTAP tests run in K1's CI on GitHub, and its pull request says the local run wasn't available. It doesn't claim them as passed.

## 3. Log

The master cloud session appends its progress here, one line per event, in its task pull requests.
