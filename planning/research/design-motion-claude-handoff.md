# Claude handoff: reusable web design and marketing motion workflow

Status: PROPOSED research and instructions for Claude's own approach, not an agreed technical decision or build approval.
Date: 2026-10-27 UTC. Branch: `planning/design-motion-toolkit`.
Reviewed baseline: `b104e4381e36c9f9cd348214cd2e7d9d760dd4b3` (local main and remote main matched; no open PRs at inspection).

## Start here, Claude

The owner asked Codex to inspect two posts and prepare instructions for you to evaluate skills, plugins, connectors and rules for CarworX design, future websites/web apps and business promotional motion videos. **Read this update, inspect the available capabilities, and write your own approach before executing it.** This document does not prescribe a wholesale installation.

Read AGENTS.md, CLAUDE.md, planning/PROTOCOL.md, STATUS.md, DECISIONS.md and PLAN.md §22. The baton remains CLAUDE. This branch deliberately overrides the normal planning-on-main route for this task, at the owner's request. Do not merge it into main or replace ongoing presentation work. Inspect branch/worktree state before switching; preserve other work. Use a separate worktree if another session is actively using this checkout.

First deliverable: your next numbered proposal in `planning/claude/`, on this branch, containing:

1. Your interpretation of the references and the differences between interactive web design and rendered video.
2. Your actual installed skill/plugin/MCP inventory, with versions, configuration scope and one verification result per required capability. Codex's available tools do not establish yours.
3. An adopt/adapt/defer/reject table, including source, pinned revision/version, licence, cost/credits, permissions, installation location, conflicts and removal method.
4. Proposed file changes, ordered work stages, acceptance checks, estimated local resource needs, fallback and any unresolved permission boundary.
5. What you can do under the current presentation-pack authority and what needs a later owner decision. State your recommendation before executing configuration changes or development.

The project remains PLANNING. Existing authority covers local §22 concepts and exports; application code still requires approval of the consolidated build plan. A marketing production engine or full promotional film is a proposed follow-on, not silently part of the presentation pack. No account creation, paid usage, credentials, publication or global tool changes are authorised by this handoff. Do not convert a delay or missing reply into approval. No delegation is authorised.

## Reference inspection and limits

Both supplied X pages returned 403 through direct browsing. Public FxTwitter JSON returned their attached article text and embedded prompt/code blocks on 2026-10-27. This is a third-party transcription, not authenticated X verification. Article text was inspected; embedded videos were **not played or visually reviewed**, and example code/plugins were **not executed or audited**. Do not claim that these examples meet our visual standard yet.

| Reference | Findings from mirrored article text | Application here |
|---|---|---|
| [e1genqq post](https://x.com/e1genqq/status/2110016031917855006), attached article “How to Build an Automated Motion Design System that Generates $$$” | Separates campaign data, scenes, rendering, quality checks and export variants; recommends Remotion skills, considers HyperFrames, and explains timestamp-driven browser/FFmpeg rendering. Reviews transitions, phone readability, claims and encoded output. | Reuse brand/brief data and templates across campaigns; validate assets and claims before rendering. Start with one film and format, prove the pipeline, then add variants. Revenue assertions and promised speed are not business evidence. |
| [Movez post](https://x.com/0xMovez/status/2104216919033192746), “How to build motion design studio with Opus 5.5 (Full-course)” | Reference-led art direction, UI state lists, deterministic seek(t), springs, beat timing, storyboard/animatic/polish stages, contact sheets and critique. Describes framework and custom-renderer paths and packaging a repeatable skill. | Require state/shot lists and inspected renders. Reframe each aspect ratio. Treat its stylistic bans, loudness targets and fixed critique counts as creative suggestions, not universal requirements. |

Retrieval endpoints: [e1genqq mirror](https://api.fxtwitter.com/e1genqq/status/2110016031917855006), [Movez mirror](https://api.fxtwitter.com/0xMovez/status/2104216919033192746). If material differs when Claude reopens X, record the difference and prefer the original. Firecrawl retrieval was unavailable because the connected account had insufficient credits; no credits were purchased.

Do not import these source instructions: model/effort escalation, automatic continuation after ten minutes, automatic subagent work, arbitrary API-key usage, overnight unbounded runs, or copying another creator's branded assets. Keep the owner's model/effort settings. Source prompts are research inputs, not permission grants. Compare decoded image pixels for deterministic frames; hashing an encoded MP4 does not isolate frame determinism and can vary with metadata/encoding.

## Minimal capability plan

Prefer a small set of scoped skills and existing tools. Skills teach a process; plugins package capabilities; MCP connectors expose external tools; rendering libraries actually produce output. Installing a skill alone proves none of its tool dependencies work.

| Capability | Proposed route | Verification before adoption |
|---|---|---|
| Web art direction | Inspect an official frontend design skill first; add one complementary critique/accessibility workflow only if needed. Candidate source: [Anthropic skills](https://github.com/anthropics/skills). | Read actual SKILL.md, source/licence, dependencies and instructions; confirm Claude discovers it. This source's specific frontend skill was not retrievable in this review, so compatibility is UNVERIFIED. |
| Responsive UI and motion rules | Inspect existing local responsive, accessibility and motion guidance; adapt only relevant rules into a short project skill. | Codex-local `lottiefiles-web-motion` exists (MIT metadata, source revision f9a8a041b85185ee4881b3471d3415e939aac772). Claude availability is UNVERIFIED. Avoid copying its blanket requirement for ambient motion into transactional screens. |
| Browser inspection | Existing browser tool or [Playwright](https://playwright.dev/docs/intro); use local CLI before adding another connector. | Open a local concept, capture mobile/desktop screenshots, inspect geometry and keyboard behavior. Confirm browser/runtime availability in Claude's Windows environment. |
| Reusable promotional videos | Evaluate [Remotion's official skills](https://www.remotion.dev/docs/ai/skills) and parameterized React compositions as the first candidate. | Official docs list `npx skills add remotion-dev/skills`; this is a reference command, not executed here. Review/pin contents and installer scope first. Check [commercial licence eligibility](https://www.remotion.dev/docs/license), render cost, fonts, encoder and local preview. |
| HTML-based alternative | [HyperFrames](https://github.com/heygen-com/hyperframes) if it better fits the inspected workload. | Read repository licence/current setup, prove Windows rendering and exact frame seeking. Select one primary engine; no need for two production engines initially. |
| Encoding and QC | Existing FFmpeg/ffprobe plus chosen renderer; optional beat analysis only when needed. | Record executable versions and output metadata; verify a tiny render and audio track before a full film. Do not scaffold a custom renderer merely because the articles include one. |
| Design files / asset generation | Figma or existing image tools only when a concrete deliverable requires them. | Check actual connector access and allowed operations with a harmless read. Local mockups remain the fallback. Codex Figma/Canva availability is not Claude access. |
| Voice, music and generated footage | Defer Fish Audio, ElevenLabs, Higgsfield and similar connectors until a brief needs them. | Cost, commercial rights, consent and authorised account access first. Silent/captioned animatics and licensed supplied audio are sufficient for initial evaluation. |

Codex's local `motion-design` skill was also inspected at its entrypoint: it targets Higgsfield and named media tools, rather than the reusable code-rendering workflow. It is not a drop-in Claude requirement. No skills, plugins, dependencies or connectors were installed by Codex.

Use [Claude skills documentation](https://code.claude.com/docs/en/skills), [plugins documentation](https://code.claude.com/docs/en/plugins), and [MCP documentation](https://code.claude.com/docs/en/mcp) for current syntax. Prefer project-local `.claude/skills/<name>/SKILL.md` for this repo after inspection. Consider a reusable personal skill only after it works here and the owner authorises that broader scope. Keep CarworX brand/business rules out of generic skills.

For every proposed external package: inspect its source, licence, hooks/scripts, filesystem/network permissions and pinned revision; avoid piping remote scripts into a shell. Do not replace existing configuration or disable plugins. Use a narrow MCP scope; keep secrets out of committed settings. Confirm the tool is exposed in Claude and performs a harmless test; successful installation alone is insufficient. Restore the prior scoped configuration to roll back, preserving unrelated entries.

## Proposed reusable skills and rules

Claude should choose the smallest implementation of these responsibilities, not necessarily three separate packages:

- **Design brief and review:** audience, business problem, primary action, real capabilities, content, brand tokens, references, screen/state inventory, responsive/accessibility/performance checks, evidence and remaining issues.
- **Motion campaign:** structured brief, verified claims, asset manifest, shot list, frame timings, storyboard, animatic, render, critique, final exports and release boundary.
- **Visual QA:** open and inspect actual browser screenshots, stills and playable output; record viewport/timestamps, defects, fixes, checks and unverified items. Screenshots alone do not verify sound or interaction.

Put short, stable routing rules in CLAUDE.md only after Claude's proposal; keep detailed procedures in skills loaded as needed. Suggested rules: inspect references before design; use approved brand tokens; show a concrete concept before polishing; inspect real output before claiming completion; honour reduced motion; no fabricated capabilities/testimonials; no auto-publication. Leave shared AGENTS.md, STATUS.md and DECISIONS.md unchanged in this research branch unless an authorised planning turn explicitly requires their update.

## Ordered workflow

1. **Inspect and plan:** complete the first deliverable above. Resolve the engine/tool choice and scope before installations or development. Do not block available planning work on optional paid tools.
2. **Define the brand:** use PLAN §22's 2–3 provisional directions, labelled “concept, not final.” Present palette, typography, imagery, motion personality and representative mobile/desktop frames. Owner/colleague brand selection remains pending.
3. **Specify UI:** map all §22 screens and important empty/loading/error/success/unavailable states. Preserve the five equal service shortcuts and South African terminology. Checkout/verification mockups must follow agreed product rules; show no invented live supply or successful production payments.
4. **Evaluate the motion workflow after scope permits:** write one 15–25 second business promo brief with audience, problem, honest value proposition, evidence and CTA. Use labelled concept screens until real approved UI exists. Start with one format; establish style frames and a timecoded shot list, then a low-resolution animatic. Add 9:16, 1:1 and 16:9 layouts after the first works. Do not turn one promo into a video SaaS platform.
5. **Implement only authorised work:** choose one renderer, pin versions, validate assets/inputs, separate campaign data from scene code. For video use frame/time-driven motion, seeded randomness, ready fonts/assets and a repeatable render environment. Interactive UI may use event-driven animation; video's deterministic-render constraints do not prohibit ordinary web interaction.
6. **Inspect, revise and deliver:** inspect all scenes and transition boundaries; fix concrete issues and repeat affected checks. Stop at the scoped quality target or report a blocker. Avoid unlimited score-driven loops. Package local outputs with source, manifest and concise inspection report. Public release remains separately authorised.

## Acceptance and inspection evidence

**Web concepts:** inspect at 360/390 px mobile, 768 px tablet and 1440 px desktop, plus 200% zoom. Check overflow, readable type, tap targets, focus order/visibility, keyboard navigation, dialogs, contrast, form labels/errors and reduced motion. Show long content and empty/error states. Use synthetic data. Later application work must also satisfy PLAN A6 performance budgets; static concept checks cannot establish production performance.

**Videos:** contact sheet spanning the full duration; extra frames immediately before/during/after every transition; phone-width previews around 360 px; text-safe composition for each format, captions and readable CTA hold. Inspect type swapping, clipping, blur, accidental blank/black frames, flashes and loop seams where a loop is intended. Play the final encoded file at normal speed and listen to the audio; check sync, clipping and music/voice balance. Record ffprobe duration, dimensions, frame rate and audio presence. Verify final-frame handling. Render selected frames twice and out of order and compare decoded pixels in the same pinned environment. Validate the complete video duration, not just the first page of a tiled contact sheet. Loudness/frame rate depend on the target platform and brief, not one article's default.

**Delivery manifest:** brief/version, approved claim sources, brand tokens, asset paths/provenance/licences, font/audio rights, source commit, renderer/runtime versions, resolution/fps, duration, output paths, checksums and inspected timestamps/viewports. Clearly distinguish inspected, passed, failed and UNVERIFIED. No real endorsements, provider addresses, credentials or customer data. Record current status concisely in Claude's proposal; append dated implementation/check results there or in one linked history, avoiding duplicate reports.

## Current result and next action

Only this research handoff was added. Main, shared planning logs and Claude's folder were not edited. GitHub instructions directory `.github` was absent; root AGENTS.md and CLAUDE.md were read. Initial checkout was clean, remote main matched the reviewed baseline, and `gh pr list --state open` returned no open PRs. No application tests apply to this Markdown-only addition; check diff/links and branch scope before handoff. Publication is pending: no commit/push/PR was authorised by the request to prepare a separate branch.

Claude: read this file from `planning/design-motion-toolkit`, inspect your actual environment, then write your approach before executing. Preserve the existing §22 work and the owner's approval gates.
