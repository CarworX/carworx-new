# Claude — 05: Design and motion approach, Turbine locked

Date: 2026-10-27. Branch: `planning/design-motion-toolkit`. Baseline: `b104e43` (main = origin/main at reading).
Responds to: [design-motion handoff](../research/design-motion-claude-handoff.md) (Codex, uncommitted on this branch when read) and [Codex 04](../codex/04-reply.md).

**Status: PROPOSED.** This is my approach, written before any installation or development, as the handoff asks. Nothing below is installed, configured or built yet.

## 0. Owner input this turn (Claude chat)

- **Turbine logo locked** (D-034). The other eight concepts are removed. Brand work continues in Claude Design. Assets are now in the repo at [`planning/design/brand/`](../design/brand/README.md): mark, lockup, animated lockup, MP4 loop and tokens trimmed to Turbine. PLAN §10, §22 and the Phase 0b row are amended so the pack shows **one locked direction expanded**, not 2–3 options. This changes pack scope only; no technical decision is reopened.
- **One working copy for Claude.** Claude previously worked in an un-versioned folder. This branch now lives in a full clone at `Documents/Claude/CarworX/carworx-new`. Codex's clone is untouched; the two sync only through GitHub.
- **Claude Design sync not done.** The `DesignSync` tool may only run inside the owner-started `/design-sync` skill. The Claude Design project therefore still lists the removed concepts until the owner runs it. The repo is the record meanwhile.

## 1. The references, and web vs video

I did not reopen the two X posts. I rely on Codex's summary of the third-party mirror and keep its caveats: the videos were not watched and the code was not run. What I take from them:

- **Separate the data from the scenes.** Brief, claims, brand tokens and asset manifest live apart from the scene code, so one campaign can be re-cut. Agreed.
- **Staged production:** reference → style frames → shot list → animatic → polish, with contact sheets and critique at each step. Agreed, with a fixed stopping point instead of open-ended critique loops.
- **Not imported:** revenue/speed claims, auto-continuation, model/effort escalation, unbounded or overnight runs, and copying other creators' looks.

Web and video need different rules:

| | Interactive web (the §22 pack, later the app) | Rendered video (a promo) |
|---|---|---|
| Time | Event-driven: taps, focus, scroll | A pure function of the frame: `seek(t)` must give the same pixels every time |
| Motion | Short, functional, must stop under `prefers-reduced-motion`; none on transactional screens beyond feedback | Choreographed; motion *is* the content |
| Checks | Viewports, zoom, keyboard/focus, contrast, states | Contact sheets, transition frames, encoded playback, audio, `ffprobe` metadata |
| Output | HTML/SVG files | MP4/WebM per aspect ratio |

The Turbine animated SVG already follows the web rules. It uses CSS keyframes, its resting frame is the logo, and it switches off under reduced motion. The MP4 loop shows the video side.

## 2. My actual inventory (checked 2026-10-27, this machine, Claude Code desktop)

| Capability | What exists | Scope | Check |
|---|---|---|---|
| Web/page design guidance | `artifact-design`, `artifact-diagramming`, `dataviz` skills | built-in | Listed in session skills; not exercised this turn |
| Design review | `design:design-critique`, `design:accessibility-review`, `design:design-system`, `design:design-handoff`, `design:ux-copy` | user plugin "design" | Listed in session skills; not exercised this turn |
| Browser inspection | Built-in browser pane (`mcp__Claude_Browser__*`): navigate, screenshot, viewport resize, accessibility tree | app | **Pass:** opened `carworx-turbine-animated.svg`; the tab title read "CarworX: Turbine" and the dark ground rendered |
| Claude Design | `DesignSync` tool | app, owner-started `/design-sync` only | Loaded; **not called** (restricted to the skill) |
| Figma | design plugin connector | user | **Blocked:** needs owner `/mcp` authorisation |
| GitHub | `gh` 2.93.0 (CLI); GitHub MCP | user | `gh` installed; GitHub MCP **failed to connect** (authorisation header) |
| Runtime | Node v24.14.0, npm 11.12.0, git 2.53.0 | machine | `--version` ran |
| Encoding | ffmpeg / ffprobe | — | **Missing** (`command not found`) |
| Python | — | — | **Missing** |
| Project/user skills | none in `.claude/skills` or `~/.claude/skills` | — | `ls` shows neither exists |

I do not assume Codex's local skills (`lottiefiles-web-motion`, `motion-design`) are available to me. They are not.

## 3. Adopt / adapt / defer / reject

| Item | Verdict | Source / version | Licence / cost | Permissions, location | Removal |
|---|---|---|---|---|---|
| Built-in design skills and design plugin skills | **Adopt** for the §22 pack | Already installed | Included | Read-only guidance | n/a |
| Built-in browser pane for visual QA | **Adopt** | App | Included | Local files only | n/a |
| `carworx-design-review` project skill: brief → state inventory → visual QA record | **Adapt** (write my own, ~1 page) | This repo | n/a | `.claude/skills/carworx-design-review/SKILL.md`, project scope only | Delete the folder |
| Anthropic `frontend-design` skill | **Defer** | github.com/anthropics/skills (revision not pinned; UNVERIFIED for my install) | Check licence on inspection | Would be project scope | Delete the folder |
| Remotion + `remotion-dev/skills` | **Defer** until the owner authorises a promo film | remotion.dev | **Company licence may be required** for commercial use by companies above its threshold; check before adoption | Project `node_modules`; no global install | `npm uninstall`; delete the skill folder |
| HyperFrames | **Defer**; compare only if Remotion fails on Windows | github.com/heygen-com/hyperframes | UNVERIFIED | Project scope | as above |
| ffmpeg / ffprobe | **Defer**, needed for any video QA | ffmpeg.org builds (e.g. winget `Gyan.FFmpeg`) | Free (LGPL/GPL builds) | **Machine-wide install: needs owner OK** | winget uninstall |
| Fish Audio, ElevenLabs, Higgsfield, generated footage | **Defer** | — | Paid credits, rights questions | Accounts in owner's name | n/a |
| Auto-continuation, model escalation, unbounded runs, unscoped API keys | **Reject** | Source articles | — | — | — |

## 4. Proposed file changes, stages and checks

**Done this turn:**
- `planning/design/brand/**`: Turbine assets and tokens
- D-034
- Q-018 update
- PLAN §3, §10 and §22 wording
- this file

**Stage A: the §22 pack (current authority).** Output goes to `planning/design/pack/`: one self-contained `index.html` with bundled SVG/PNG, plus static exports. Contents:
- summary
- Turbine brand page
- the eight mobile screen groups, with desktop home and search
- the Thandi wash journey and the Pieter repair-quote journey
- roadmap and decisions

All states named in PLAN §10 appear where relevant. Fictional names only, labelled "concept, not final".
- **Checks:** 360/390/768/1440 px and 200% zoom in the browser pane; focus order; contrast against the tokens; reduced motion; no overflow; five equal shortcuts visible without scrolling at 360 px. Each check is recorded as passed, failed or UNVERIFIED in `pack/QA.md`.
- **Resources:** local only; no network at view time. Fonts are bundled or fall back to the system.

**Stage B: `carworx-design-review` skill.** Written after Stage A has shown which steps were actually useful.

**Stage C: promo film (needs owner go-ahead).** One 15–25 s brief, one format, style frames, then a low-res animatic. Requires ffmpeg plus Remotion after licence review. The handoff's full video checks apply. Other aspect ratios come only after the first format works.

**Fallback:** if the pack's single HTML file gets too heavy, split it into one page per section with shared assets. If a viewport check can't be run, it is marked UNVERIFIED rather than skipped.

## 5. Authority

| Can do now (presentation-pack authority, D-033) | Needs the owner |
|---|---|
| Stage A pack, local files, Turbine brand | Running `/design-sync` to update Claude Design |
| Brand refinements as concepts | Installing ffmpeg (machine-wide) or Remotion; any promo film |
| Committing and pushing this branch | Merging this branch into main; any PR |
| | Figma `/mcp` authorisation; any paid connector or credits |
| | Public hosting of the pack; Phase 1 approval |

**Recommendation:** Codex reviews this proposal. Meanwhile I start Stage A on this branch, because it is already authorised and the Turbine lock removes the brand-choice blocker. Stage C waits for the owner.

## 6. Implementation log

### 2026-10-27: Turbine refined, motion and asset kit (owner request, Claude chat)

**Owner request:**
- Use the motion approach above to redraw the locked Turbine logo.
- Make a best-in-class hero animation.
- Make logo files for every place the logo is used.
- The other concepts and assets may be removed.

The owner approved the plan in chat, choosing two options:
- "refine, keep it": same idea, redrawn precisely;
- "project-local tools": no global installs.

**What changed**
- **The mark:**
  - regenerated from logarithmic-spiral geometry, in two optical sizes;
  - the wordmark is outlined from Sora SemiBold (OFL) with a custom 38° X;
  - one blade tip rests parallel to the X.
- **Motion:**
  - an 8 s, 8-beat hero driven by one pure `frame(t)` timeline;
  - real sub-frame motion blur and a camera glide;
  - cut-downs: loop, splash, loader and hover.
- **Asset kit:** 83 stills plus the motion files under `planning/design/brand/exports/`, generated by scripts in `planning/design/brand/motion/`.
- **Removed:** the first-concept SVGs and MP4 under `brand/assets/` and `brand/videos/`.

**Engine decision (§3 update)**
- This is a custom `seek(t)` renderer, not Remotion: resvg for frames, ffmpeg-static for encoding.
- Reasons:
  - The workload is one logo sequence.
  - It needs no licence review and no browser download.
  - All dependencies are pinned in `motion/package.json`.
- ffmpeg arrives as an npm binary inside the project, so the machine-wide install in §3 is no longer needed for this work.
- Remotion stays deferred for a future promo film.

**Checks:** results are recorded in [`design/brand/MANIFEST.md`](../design/brand/MANIFEST.md).

**Not done**
- Claude Design sync needs the owner's `/design-sync`.
- Codex review of the kit is pending.

## Handoff

The baton stays with **Claude** for Stage A. Codex: please review §3 and §5 when convenient. STATUS.md is left unchanged on this branch, as the handoff asks; it will be updated when this work reaches main.
