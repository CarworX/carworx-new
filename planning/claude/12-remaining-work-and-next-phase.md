# Claude — 12: What's left, who does it, and the next phase

**Date:** 2026-11-04. **Branch:** `planning/design-motion-toolkit`. **Head when written:** `e3541c6`.

**Status: PROPOSAL for Codex approval.** The owner will put this to Codex. Planning only: no application code, issues, accounts or spending.

The owner's answers on 2026-11-04 are recorded as D-060 to D-063. The language is plain on purpose, so that the owner can follow every line.

## 1. Where the project is

| Stage | What it is | State |
|---|---|---|
| 0a. Technical plan | PLAN 2.1 | **Done.** Signed by Codex (D-033), approved by the owner for Phase 1 (D-038) |
| 0b. Presentation pack | Brand, screens, journeys, PDF | **Done** (D-037) |
| Design baseline | Studio design system, the 404 page and loaders, the review evidence | **Nearly done.** The evidence is captured (`e3541c6`). Section 2 lists what's left |
| Phase 1 planning | Claude 10 tasks T1–T5 and K1–K4 | **Agreed with changes** (Codex 08). The changes are made (`5a805b3`) and wait for Codex to confirm them |
| **Phase 1. Foundations** | Project setup, database, sign-in, design system in code, staging, backups | **Not started.** It starts after the design branch merges |
| Phases 2–5 | Public free site, bookings in test mode, live payments, growth | Later. PLAN §3 |

No application code exists yet. That is expected: Phase 1 is where coding starts.

## 2. What's left before Phase 1 can start

### 2.1 Claude

| # | Task | What "done" means |
|---|---|---|
| C-a | **Finish C5: the verdicts.** | The package `claude/audit-10/` holds 259 saved files, but its Result column says only "saved". The handoff note (`research/codex-phase1-execution-handoff.md` §2) needs **PASS, FINDING or BLOCKED** for every row, and every accepted image opened and inspected. So far only a sample of 6 images was opened. Done when every image has been opened, every row of Claude 09 §4.4 carries a verdict with a finding ID where needed, and the five observations in the index are settled as findings or closed |
| C-b | **Finish C5: the open measurements.** | Re-run the SVG text sampler on the pin disc fill, not the ring outside the box (index observation 4). Compute non-text contrast from `41a-nontext-*.json` (observation 5) |
| C-c | **C4, part F7 (repo only).** | Seven Turbine-era cards exist only in the live design system. State that in `design/brand/README.md`, or mirror them |
| C-d | **C4, part F5 (live design system).** | Remove the retired logo concepts from the design system's machine-readable docs. **This needs the owner's OK to publish the live design system.** Without that OK, F5 stays open as Minor, recorded as such |
| C-e | **Owner guides.** | Write one plain-language, step-by-step guide per owner task in §2.3, in the order the tasks are needed (D-063). Location: `planning/owner-guides/` |
| C-f | **Shared records.** | Keep STATUS, HISTORY and DECISIONS current. This file records D-060 to D-063 |

### 2.2 Codex

| # | Task | What "done" means |
|---|---|---|
| X-a | **Approve or amend this plan** (Claude 12). | Each section marked AGREE, or AGREE WITH CHANGES with the changes listed |
| X-b | **Confirm the Codex 08 corrections** at `5a805b3`. | Each of R1, B1, B2, B3, ownership, S1, V1 and V2 is closed, or named as still open |
| X-c | **Design review**, after C-a to C-d. | The next numbered Codex review checks the C5 index, hashes, counts and images. It gives a scoped verdict on the design baseline. Per the handoff note, sign-off needs complete required evidence and no unresolved Critical or Important finding that affects the foundation. The owner-only checks are recorded as open until before launch (D-060), not as passes |
| X-d | **Create issues K1–K4** after X-a. | One issue per task, as Claude 10 §5 describes. Claude creates T1–T5 at the same time |

### 2.3 Owner

Each of these gets a step-by-step guide (C-e).

| # | Task | Needed by | State |
|---|---|---|---|
| O-1 | Put Claude 12 to Codex, and bring back its answer | Now | Pending |
| O-2 | Say yes or no to the live design-system clean-up (C-d) | Before C-d | Pending |
| O-3 | **Merge the design branch** `planning/design-motion-toolkit` into `main`, after Codex's design sign-off (X-c) | Before T1 | Pending |
| O-4 | Start **Docker Desktop**, and turn on **pnpm** (`corepack enable pnpm`) | Before T1 | Pending. On 2026-11-03, Docker's engine wasn't running |
| O-5 | **Google sign-in client** | T3 | **Done in part.** On 2026-11-04 Claude confirmed through Supabase's public settings that Google and email sign-in are on in the project "CarworX App". Still to do: add the **local** return address to the same Google client so sign-in also works on this computer (B1), and keep the client secret out of chat and out of the repo. The guide covers both. Claude can't see the Google Cloud console |
| O-6 | Make sure **GitHub Actions minutes** are available | K1 | Pending |
| O-7 | List the **accounts**, and who controls the **carworx.app DNS** | K2 | Pending |
| O-8 | **Staging:** "CarworX App" is the staging project (D-062). Add a Cloudflare staging route and staging-only secrets | K2 | Supabase part done. Cloudflare part pending |
| O-9 | **Resend** sending subdomain, with a staging allowlist | K2 | Pending |
| O-10 | Choose an existing private place for backup copies, a second copy elsewhere, and who runs the backups | K4 hosted drill only | Pending. The local drill doesn't need it (D-059) |

## 3. The next phase: Phase 1, Foundations

**Who handles it:** the agreed split (D-061, Claude 10 §2).
- **Claude** builds the app side.
- **Codex** builds the infrastructure side.
- Each reviews the other's work before anything merges. Nobody approves their own work.

| Task | What it is, in plain terms | Lead → reviewer | Can start when |
|---|---|---|---|
| T1 | Project skeleton: the empty app, its tools, one test page | Claude → Codex | O-3 and O-4 |
| K1 | Automatic checks on every change, including the secret scan | Codex → Claude | Built next to T1. T1 merges only with K1 inside it |
| T2 | Database: the first four tables, with "who can see what" rules and their tests | Claude → Codex | T1 |
| T4 | Design system in code: colours, fonts, components, and the 404 and loaders page | Claude → Codex | T1 (in parallel with T2) |
| T3 + T5 | Sign-in (email, Google, admin second code) and the security rules around it, as one series | Claude → Codex | T2. Real Google needs O-5 finished |
| K2 | Local and staging settings, and deploying to staging | Codex → Claude | K1, then O-7, O-8 and O-9 for staging |
| K3 | Speed and accessibility tests | Codex → Claude | T4 locally. K2 for staging |
| K4 | Backups and a restore test, first on this computer with fake data | Codex → Claude | T2 locally. K2 and O-10 for staging |

**Phase 1 is finished when** acceptance tests A1–A7 (PLAN §11) pass on staging. A local pass is preparation, not completion. Everything uses fake data, with no payments, maps, providers or real customers.

**Order:**
1. T1 with K1.
2. T2 and T4, in parallel.
3. T3 with T5.
4. K2, K3 and K4 as their prerequisites arrive.

All the local work can finish before staging exists.

## 4. Work for later phases (not Phase 1)

Each needs its own proposal before it starts. Every proposal is reviewed by the other agent and approved by the owner. **Who writes what is a proposal for Codex to agree.**

| Item | Needed by | Proposed writer → reviewer |
|---|---|---|
| Phase 2 plan (free public site: catalogue, search, listings, applications) | Near the end of Phase 1 | Claude → Codex |
| Legal documents, cross-checked against South African law: POPIA, CPA and ECTA (D-045) | Before G-PROD | Claude → Codex |
| Retention schedule (D-053; the accountant checks the financial records) | Before G-PROD | Claude → Codex |
| D-051 booking flows: book and pay now, and enquiry → range → quote | Phase 3 | Claude → Codex |
| D-057 capacity contract: how many jobs at once per bay | Phase 3 | Claude → Codex |
| Fines partner lookup plan (D-052) | Before G-FINES | Codex → Claude |
| Tax and accounting research for the accountant (D-047) | Before G-PAY | Codex → Claude |
| **Owner-only design checks** (D-060): live design-system screenshots, 200% zoom, phone screen reader, real phones and browsers | **Before launch (G-PROD)** | Owner. Claude writes the guide |
| Register as Information Officer (D-043) | Before G-PROD | Owner |
| Register the company with the cofounders (D-049), and fund the refund reserve (D-050) | Before G-PAY | Owner |

## 5. Decisions recorded today

| ID | Decision |
|---|---|
| D-060 | The four owner-only design checks happen **before launch (G-PROD)**. Design sign-off can go ahead without them, provided they are marked open, never as passes |
| D-061 | Phase 1 keeps the agreed split: Claude does T1–T5, Codex does K1–K4, with reciprocal review |
| D-062 | The Supabase project "CarworX App" is the **staging** project. It holds fake data only. A separate production project is created before launch. Google sign-in is configured there by the owner |
| D-063 | Claude writes step-by-step owner guides for each owner task. **The Coming Soon page is scrapped:** its unpushed branch and its session were removed at the owner's request, and it isn't part of any plan |

## 6. Questions for Codex

1. Do you agree with §2 (what's left before Phase 1) and its split?
2. Do you agree that the owner-only checks can stay open until G-PROD (D-060), without blocking design sign-off?
3. Do you agree with the writer and reviewer split for later work in §4?
4. Is anything missing that blocks Phase 1?
