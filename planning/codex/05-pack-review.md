# Codex 05: Studio presentation-pack review

Reviewed 2026-10-28 17:57 UTC. Exact remote commit: `6c607e538683efce16dc62ed49eb8153bf5ef3c9`, branch `planning/design-motion-toolkit`. Independent review requested by the owner before sharing with colleagues. Main was not changed. This report is local/uncommitted; the original local handoff remains untouched.

## Verdict

**Nearly ready: correct the checkout expiry copy and regenerate affected exports before sending.** After that, suitable for private colleague feedback as a clearly labelled concept. This is not approval to build, take payments, publish online or merge.

## Required correction

`planning/design/pack/src/parts/screens.html:256` says that when the hold expires, “nothing is charged.” Expiry releases capacity; it does not establish that an already-started payment cannot complete. PLAN §6.3 explicitly requires reconciliation of late successful payments. The adjacent late-payment state correctly shows that outcome, so the generic assurance contradicts both the plan and the pack.

Suggested replacement: **“If time runs out, the slot is released. If a payment arrives afterwards, we'll help you rebook or get a refund.”**

At line 286, either label the expiry example as a *verified no-payment* case or use neutral text such as **“Your 15 minutes ran out. The slot was released. If you started paying, check your payment status before trying again.”** Keep the late-payment reconciliation panel. Update source, assembled HTML, checkout PNG, phone checkout PNG and PDF together. Reopen affected output after regeneration. No change to the agreed payment contract is needed.

## Evidence

- Read the current branch's STATUS, DECISIONS (including owner decisions D-034–D-036), Claude 07, summary, QA record and relevant PLAN sections. Root AGENTS/PROTOCOL match the previously read versions. Main remains at `b104e43`; no open PRs were listed.
- Used a detached local review checkout in the Windows temporary directory to avoid changing the active checkout or Claude's work.
- Opened the exact assembled HTML in local Chrome using Playwright. Visually inspected the desktop cover and mobile home, plus the exported checkout group. No page JavaScript errors, unresolved assembly placeholders, missing images or HTTP requests were observed.
- Independently checked geometry at 360, 390, 768 and 1440 px: page scroll width equals viewport width. Opened the mobile menu, confirmed focus enters its links, and closed it with Escape.
- Reran the repository's `node planning/design/pack/src/qa.mjs` in the review checkout: exit 0. Layout checks passed at 360, 390, 768, 1280, 1440 and 720 px. All five shortcuts are equal and end at 576 px on the 360×640 mockup. Contrast script reported no failures across 1,055 desktop / 1,032 mobile text elements; 28 keyboard stops had visible rings in DOM order; menu focus trap and Escape passed. Reduced-motion and motion-on checks passed; resource list empty. These are bounded scripted checks, not comprehensive accessibility certification.
- Opened the actual 42-page PDF with pypdfium2. Every page has extractable content. Rendered every page into two numbered contact sheets and inspected both visually for page-level clipping, missing sections and export order. This overview does not establish small-text readability on every page at native scale. The full-size checkout PNG was independently opened and read.
- All §22 parts are present: summary, locked Turbine brand and Studio UI language, eight screen groups, desktop home/search, both journeys, roadmap and owner decisions. State coverage includes limited supply, errors, quote changes/expiry, holds, failed/pending/late payments, cancellations/refunds, disputes and suspensions. Fictional-data and concept labels are visible; no working service is implied by the artefact itself.

## Non-blocking improvements and limits

- PDF pagination is usable but inefficient: 42 pages, with sparse/orphan pages such as 5, 12 and 24. Prefer the interactive HTML for presenting, and optionally tighten print pagination before making the PDF the primary handout.
- Some footer links point to repo-relative supporting documents. Send the containing pack folder for its exports, or the PDF alone; a lone HTML file contains the presentation but its supporting-document links won't all work in isolation.
- Real browser 200% zoom, SVG-text contrast, Safari/Firefox and physical phones remain unverified. A 720 px viewport is not a real zoom test. These gaps do not prevent a private concept discussion but remain requirements before application accessibility sign-off.
- The “cancelled and refunded” panel actually shows a refund still processing. Rename the caption to “cancelled, refund processing” for precision.
- Prices are labelled estimates, spending remains unapproved, payments are gated, zero initial supply is disclosed, and the final logo is distinguished from concept screens. No live vendor price or legal advice verification was required for this artefact review.

## Next step

Claude: make the narrow expiry-copy correction, regenerate and inspect affected exports, then record the resulting commit. Owner can then share the pack privately and collect feedback on clarity, service coverage, Studio layouts and journeys. No public hosting or Phase 1 start is implied.
