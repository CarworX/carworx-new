# C5 evidence package (Claude 09 §4.4): verdicts

- **Author:** Claude, 2026-11-04. **Reviewer:** Codex (X-c, D-058).
- **Status: complete for the rows Claude can do.** Every file below was opened and has a verdict: PASS, FINDING (with an ID), BLOCKED, NOT USED, TOOL or LOG. Rows 13 and 14 (live cards), 15, 19 and 20 stay BLOCKED for the owner until G-PROD (D-060). They are not passes.
- **No final design verdict is claimed here.** That is Codex's X-c. No WCAG compliance claim is made.

## Identities

| What | Commit |
|---|---|
| Source captured (every route) | `5a805b3058cfe048ef0bb3d4a86f999f2b141c40`, as a `git archive` unpacked to `%TEMP%\carworx-audit-5a805b3` |
| First package (v1, "saved" only) | `e3541c6c3d093dc315b86644c6c65b456f4955b2` |
| Review that asked for this pass | Codex 09 at `2f4ebf63aaa5c4feb9e482af285a22248748024e` (E1, E2) |
| This package | the commit that adds this index; Claude 13 and STATUS name it |

The re-captures in this pass ran in the same `5a805b3` export. That export was then deleted at the owner's request (the C: drive was full). `git archive 5a805b3` recreates it.

**Hashes (E2).** The SHA-256 column is computed from the committed bytes: each file is staged, then hashed with `git cat-file blob :<path>`. The repo stores text with LF (`.gitattributes`: `* text=auto eol=lf`), so the four v1 CRLF mismatches cannot recur. Hashes are full, not prefixes.

## How to rerun

Run each route in an export root. Same as v1, with the tool versions in `_tools/`.

| Route | Command | Notes |
|---|---|---|
| E | `node planning/design/pack/src/export.mjs` | 27 PNGs and the PDF |
| S1, S3 | `node planning/design/concepts/states/qa.mjs stills --approved`; `qa.mjs check --approved`; `qa.mjs contrast --approved` | S3 contrast measures nothing on the approved page (G15) |
| Q | `node planning/design/pack/src/qa.mjs > qa-out.txt` | |
| C | `node _tools/capture.mjs <root> --jobs _tools/jobs.json <out>`, then `_tools/jobs-rerun.json` and `_tools/jobs-brand-reduced.json` | v2 fixes, below |
| M | `node _tools/mirror.mjs <root> all <out>` | v3 fixes, below. MIRROR, NOT LIVE |
| P | `python -I _tools/pdfpage.py <pdf> <out>`; `python -I _tools/sample.py 41-svgtext-390.json <dir> 41-svg-samples.json`; `python -I _tools/check.py <dir>` | sampler v2 |

`check.py` on the final package: 238 PNGs, none blank or zero-size.

## Faults in my own tools, found and fixed in this pass

None of these is a design finding. Each affected image was re-captured and reopened.

| # | Tool | Fault | Effect in v1 | Fix |
|---|---|---|---|---|
| TF1 | capture.mjs | `settled` waited 500 ms | `01-cover-390` caught mid-fade (grey ink) | 1500 ms |
| TF2 | capture.mjs | the pack sets `scroll-behavior: smooth` when motion is on; the screenshot was taken while the page still scrolled | the 12 motion journey frames had a blank band, a pushed-down nav and half-faded booking objects. This was observation 3 and Codex's "blank area" | jump instantly, wait for a stable `scrollY` |
| TF3 | capture.mjs (one job) | the logo film iframe loads lazily and was off-screen | `42-brand-reduced` showed a black panel | scroll the film into view and load it first |
| TF4 | mirror.mjs | cards without `width=` rendered at 720 px | Cover cut off; responsive cards wrapped and overflowed | try 720, 960 and 1040 px; keep the first that fits the declared height |
| TF5 | mirror.mjs | `tokens.css` loads fonts from a path the repo lacks (G13) | every card in a system font | re-declare the faces from `exports/studio/fonts/` |
| TF6 | sample.py | ring 3 px outside the text box, median colour | white pin numerals read 1.21:1 (observation 4) | 1 px ring, modal backdrop colour |
| TL1 | capture.mjs (limit, kept) | crops of fixed elements taken while scrolled show other content | `40-focus-390-26/27` (wrap-around past the last stop) | marked NOT USED |

## The five v1 observations, settled

1. **Focus at 390: 23 stops is correct.** The six nav links are hidden below 1060 px and the menu button joins the order: 28 − 6 + 1 = 23. Tab 24 leaves the page and 25–28 wrap. Closed.
2. **Menu at 390.** My first Enter key event was a tool fault. With `click()`, the sheet opens with focus on Summary, eight Tabs stay inside, and Esc returns focus to the button. PASS.
3. **Thandi motion frame.** A tool fault (TF2). Re-captured: the motion frames match the reduced-motion frames, and the nav sits correctly. PASS.
4. **SVG pin numbers.** A sampler fault (TF6). White on the `#0d0f12` disc is 19.19:1. All 8 SVG texts pass. PASS.
5. **Row 17a.** Computed: the focus ring is a 2 px ink outline with a 2 px offset, 16.99:1 on canvas and 19.19:1 on white. Component edges are measured from `bundle.css` tokens: G1.

## Verdict per matrix row (Claude 09 §4.1)

| Row | Surface | Verdict | Basis |
|---|---|---|---|
| 1 | Cover, summary, brand | FINDING G2, G3 | Turbine unaltered; "concept, not final" throughout; brand rules match `brand/README.md` except the invoice sample (G3); stale attorney line (G2) |
| 2 | Home | PASS (G4 Minor) | five equal shortcuts above the 360 × 640 line at 360, 390, 768 and 1440 (Q: heights equal, last bottom 576 at 360) |
| 3–10 | Phone groups, 8 figures and 31 panels | FINDING G5–G9 (all Minor) | each row's check passes: straight-line labels, mobile area only and no base pin, demand capture; listing checks with method and date; versioned quote, expiry blocks approval; checkout F1 copy, rebook or refund, hold dial exposed as "14 minutes 32 seconds left"; F3 refund stages; demo numbers labelled and the paused state; private base; no ID field and "no results ≠ no fines" |
| 11 | Journeys | PASS | steps readable without motion; motion and reduced frames match after TF2 |
| 12 | Roadmap and decisions | FINDING G10 | the check "matches D-037 to D-041" fails: the roadmap stops at D-036 |
| 13 | 15 components + Iconography | Mirror: G1 fixed in the repo (D-066); FINDING G11–G14. **Live: BLOCKED** (D-060) | against tokens v4 and the brand book |
| 14 | NotFound, NotFoundPhone, PageLoader, Loaders | States page: PASS (G15 for the contrast tool). **Live: BLOCKED** | lens, pulse, hold and loader roles per scenario; 0 errors, no overflow (S3 check) |
| 15 | Real 200 % zoom | **BLOCKED** (owner, D-060) | |
| 16 | Keyboard and focus | PASS | 28 stops at 1440 and 23 at 390, all ringed, in DOM order; menu trap and Esc |
| 16a | Target sizes | FINDING G17 (Minor) | sub-24 px targets are inline links in sentences (WCAG 2.5.8 exception); pack menu button 40 px and logo link 27 px are under the Studio 44 px rule |
| 16b | Labels and reading order | PASS | every control named (22 at 390, 27 at 1440); h1 then section headings in order |
| 17 | Contrast, including SVG text | PASS (sampling) | Q: 0 fails of 1055 and 1032 text nodes; SVG 8/8; states text by tokens and the concept run (G15) |
| 17a | Control and non-text contrast | PASS after D-066 (repo mirror) | focus ring passes; chip, slot and outline-button edges were 1.37:1 and are now 3.14:1 (`--control-edge`); live system pending publish |
| 18 | Reduced motion | PASS | designed stills; the film shows the still lockup (after TF3) |
| 19 | Screen reader | **BLOCKED** (owner, D-060) | |
| 20 | Real phones and browsers | **BLOCKED** (owner, D-060) | |
| 21 | Offline pack and PDF | FINDING G16 (+ G2, G10 copy) | 42 pages complete; F1 correct in the PDF; no network resources |

## Findings

| ID | Severity | Finding | Proposed fix and owner |
|---|---|---|---|
| G1 | **Important → fixed in the repo mirror (D-066)** | `.cx-chip`, `.cx-slot` and `.cx-btn.outline` drew their edge in `--line` `#dedcd6` (1.37:1 on white), below the Studio 3:1 rule for control edges. **The owner chose darker edges (D-066):** `bundle.css` now uses `--control-edge` `#8b929b` for all three (3.14:1 against the white fill; 2.78:1 against bare canvas, so controls keep their white fill). `tokens.json` usage notes updated. Evidence: `44-G1-Button-after.png`, `44-G1-Chip-after.png`. The earlier rows keep their pre-fix verdicts as a record | **Still to do:** the live design system (needs the owner's OK to publish, with O-2); T4 [#8](https://github.com/CarworX/carworx-new/issues/8) implements it. The closed pack (D-037) keeps its old drawing |
| G2 | Minor | The summary's "What it costs" (screen and PDF p4) still lists an attorney; D-045 removed the attorney | Pack copy fix, or keep as a dated snapshot (see G10) |
| G3 | Minor | The "Quote and invoice header" sample: the mark touches the card's left edge (`invoice-quote-header.svg` has about 20/2400 left margin) | Pad the sample in the pack, or note that the document margin supplies the clear space |
| G4 | Minor | The "Bottom of a 360 × 640 screen" label covers words of the info note | Move the label clear of the text |
| G5 | Minor | Desktop search says "5 businesses" but draws four rows and pins 1, 3, 4 | Add the fifth row or say 4 |
| G6 | Minor | The map label "Bubbleworks: area, approx." runs to the map's right edge | Pull it inside the frame |
| G7 | Minor | The dispute card says "Evidence due" with no date | The later dispute contract supplies the deadline; the copy then names it |
| G8 | Minor | Consent boxes are drawn ticked | T3/T4: unticked by default (POPIA). The Field card already shows both states |
| G9 | Minor | The Fines phone screen highlights the Search tab | T4 nav marks the current section |
| G10 | Minor | The roadmap and footer stop at D-036 (0b "now", Phase 1 undecided, attorney) | Refresh, or label the pack as a snapshot from before D-037 |
| G11 | Minor | Mirror: NavBar, ServiceKey and StepList are taller than their declared card heights (380, 560, 360), so their last rows are cut. The live viewer is unverified (BLOCKED) | Raise the declared heights |
| G12 | Minor | StepList: `bundle.css:166` `.cx-steps .k span{position:absolute…}` also positions the icon, so the number sits on the icon | Target the number only. T4 must not copy the selector |
| G13 | Minor, documented | `studio/tokens.css` loads fonts from `fonts/…`, which the repo does not have beside it | Documented in `brand/README.md` with F7 (C-c). T4 bundles the fonts |
| G14 | Minor | The KpiCard card subtitle names another product ("EquipFlow-style") | Reword with the F5 docs clean-up (owner OK to publish) |
| G15 | Minor | `qa.mjs contrast --approved` measures nothing: its selectors exist only on the concept page | Fix the selectors before T4 relies on the check |
| G16 | Minor | PDF only: phone figures split across pages; input and outline-button edges don't print; the desktop frames are clipped on the right | Print CSS fix if the PDF is reissued |
| G17 | Minor | Pack menu button 40 × 40 below 600 px and the logo link 27 px tall, under the 44 px Studio rule | Pack only; the design system's `.cx-menu` is 44 px |

C4 status: **F7 documented** (C-c, `brand/README.md`). **F5 stays open as Minor**: it needs the owner's OK to publish the live design system (O-2), and G14 joins it.

## Blocked rows (owner, before G-PROD, D-060)

| Row | What it needs |
|---|---|
| 13, 14 live cards | Owner screenshots of the signed-in design system |
| 15 | Screenshots at real 200 % zoom |
| 19 | VoiceOver or TalkBack |
| 20 | Real phones and browsers |

`owner/` is empty.

## Files

| File | Route | Row | Capture conditions | SHA-256 of committed bytes | Verdict | What was seen |
|---|---|---|---|---|---|---|
| `00-element-list.json` | C | 3–10 (count check) | see log | `25f09076055817ad0ec783a823202976236030e87c754dee7031997bc6bc1339` | PASS | 8 phone figures and 31 state panels, matching the source |
| `01-cover-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `978c06ff4f86450a1f6ef1481305994635787753417ec79afc9438bfcc9d0af4` | PASS | Turbine nav, concept badge twice, pills ink/white; matches brand |
| `01-cover-390.png` | C | 1 | `#skip` `#cover`, 390px ×2, settled; **capture.mjs v2 (settle 1500 ms)** | `a250f3a7103473007d42d84f151f1cf1da15de8a11a7367f8291c83815bd0d66` | PASS | RECAPTURED (settle wait 1500 ms): hero, concept badge, both pills at full ink; v1 was caught mid-fade |
| `02-summary-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `95fb7e155259ebacb5bf423cc329ee31915eb5baa516d2882565063f5b064c5d` | FINDING G2 | layout fine; "What it costs" still says "An attorney and an accountant before payments go live", contradicting D-045 (no attorney) |
| `02-summary-390.png` | C | 1 | `#skip` `#summary`, 390px ×2, settled | `34e2ffd2023922d901a6d560c3443801efde028ae68d785b438c9f790c0a83a5` | FINDING G2 | same attorney line; single column, nothing clipped; tall page downscaled for viewing |
| `03-brand-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `2b1e1df5a8ca574f51fa5427589c546877d4dc99bb9da3a8a126e70cc1f3414e` | FINDING G3 | invoice header sample flush left (see 390); otherwise Turbine locked, lockups with ratios, misuse rules, Studio roles, type, shadows, motion, tone |
| `03-brand-390.png` | C | 1 | `#skip` `#brand`, 390px ×2, settled | `ab7580309aa4e0399737c0dcf160f5b9ad58b6c3ceddfeba978f34ec6fc4c190` | FINDING G3 | 10 slices opened; single column readable, no clipping; Turbine film shows its ignition frame (settled mode does not stop the film; still shown in 42-brand-reduced). "Quote and invoice header" sample: mark touches the card's left edge (asset invoice-quote-header.svg has ~20/2400 left margin); also at 1440 |
| `03-intro-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `ac55dd21bd0538d9530ba4602460323a91a640baba55c47c51ded0eaa1b49e8f` | PASS | intro frame: still Turbine lockup, "Concept, not final", skip hint |
| `03-intro-390.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `5a7e694d88a6ef7a460ef9d8d02434a677f3c24d4a4624896121b2c036028dfb` | PASS | stacked lockup, nothing clipped |
| `04-home-1440.png` | E | 2 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `bf091a9abdf4b2dadd2e9ae3ce096b994a5469b11c4a81dabaa8f25972e3f43a` | PASS | five equal shortcuts above the 360x640 line; three states; note: G4 label overlap |
| `04-home-360.png` | C | 2 | `#skip` `#s-home`, 360px ×2, settled | `543bd4c0415ddf718920550eb00e670ad181b1995636b8a8fd7fcdbdead03fa5` | PASS | 4 slices; five shortcuts above the line (two-line wraps for Glass/Tyres), states stack; G4 label overlap |
| `04-home-390.png` | E | 2 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `21892ac8ee4f20712c01b605c041352600fac281a294fe790e1fd4e1f4626b99` | PASS | 2 slices; five shortcuts above the line, nav, caption "Fictional location"; G4 label overlap |
| `04-home-768.png` | C | 2 | `#skip` `#s-home`, 768px ×1, settled | `abc67b91f170d21351fcb53b6c848b107e52b18ba8451e2013467c0da1e0ac69` | PASS | 2 slices; phone centred, states in two columns; G4 label overlap |
| `05-desktop-home-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `ebd75094aef7139ea2138f2255bb8926f7a2071c9cd6c72729be40ddaea334e5` | PASS | desktop home: five equal keys, honest-supply banner, "Free pilot, CarworX fee R0", concept footer |
| `05-desktop-search-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `a9699f3b0fb88e1398fc3e45be3b401a0050b56a9d51b71fd218888b44d14e56` | FINDING G5 | straight-line labels, mobile business area only with no base pin; heading says "5 businesses" but 4 rows show with no scroll cue or fifth item |
| `05-home-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `bf091a9abdf4b2dadd2e9ae3ce096b994a5469b11c4a81dabaa8f25972e3f43a` | PASS | group at 1440 (same frame as 04-home-1440); G4 label overlap |
| `05-home-phone-390.png` | C | 3–10 | `#skip` `#s-home figure.phone`, 390px ×2, settled | `33b369518c6b69ff1b59321baf6127752401ddf1f3a8d68b0e9bc915973f75f3` | PASS | phone figure; five shortcuts above the line; G4 label overlap |
| `05-home-state-1-limited-supply-390.png` | C | 3–10 | `#skip` `#s-home .states > .state:nth-child(1)`, 390px ×2, settled | `7473b105aa026f72f765642db106aa2856ef311178b09402351b1df8a8d53287` | PASS | counts stated, demand capture "Tell us what you need" |
| `05-home-state-2-no-location-yet-390.png` | C | 3–10 | `#skip` `#s-home .states > .state:nth-child(2)`, 390px ×2, settled | `4c0d13af378afebbd68483c63c40e42aacb4d97163dadc9108ac123d4b91b749` | PASS | suburb-only browsing explained |
| `05-home-state-3-error-390.png` | C | 3–10 | `#skip` `#s-home .states > .state:nth-child(3)`, 390px ×2, settled | `e0f526ee26df18473b30766fdbe8917f5dbcb6c5692f11f7344cf427d89aa113` | PASS | error says nothing was lost, Try again |
| `06-search-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `16d31173d0a86b58160fd6cfbee505009b6fd00079c2cfdf22e085b8ed538fcd` | PASS | list first, map optional, mobile shows area only, nothing-nearby offers 50 km and demand capture; widened-by-you banner with Back to 25 km |
| `06-search-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `cb30f54e8fd4c4dbe019995891a2485213a78e4966e153cd974293e3034d4549` | PASS | phone list: straight-line distances, approx area for mobile, DEMO tags, labels |
| `06-search-phone-390.png` | C | 3–10 | `#skip` `#s-search figure.phone`, 390px ×2, settled | `b4f642f56da1e9812ea29bfebf3e7ac3cb713c18a96372ff2b45c4b29dfb3a2a` | PASS | same as group 390: list first, straight-line, mobile approx area, DEMO |
| `06-search-state-1-map-optional-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(1)`, 390px ×2, settled | `1c1c9dccc78fc1f51de590f273853ed75148cce78a5ae4666cceb4a39b77e209` | FINDING G6 | no base pin for the mobile business; the "Bubbleworks: area, approx." label runs to the map's right edge |
| `06-search-state-2-nothing-nearby-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(2)`, 390px ×2, settled | `b7a8474504fd7a4342b29462f56029e669a9849bc258986bef9c1331bc7ca22b` | PASS | says none within 25 km, offers 50 km, demand capture with purpose-limited email consent; input edge visible |
| `06-search-state-3-search-widened-by-you-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(3)`, 390px ×2, settled | `c3f7e7cd9079223bd32bb7a37ee1bd215c3e98718ab153f35f696728c848550c` | PASS | widening is user-initiated and reversible |
| `06-search-state-4-could-not-load-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(4)`, 390px ×2, settled | `e151889a2ef162105e80707753dc9a2c6bde0b8378e3707e9f37512868322555` | PASS | filters kept, Try again |
| `07-listing-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `03e89042d5c94829f2a8c2c3fd71ea2a9309a6a94cc6c2ef2037e32b9d5b9794` | PASS | mobile listing (area approx, base never shown), what was checked with method and date, travel bands straight-line, request not instant; paused, address-with-permission and enquiries-only variants |
| `07-listing-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `5da251cca134c474d6fef0c6806ec24bdab281cfa012e038292205daa0296b3c` | PASS | 2 slices; same content, nothing clipped |
| `07-listing-phone-390.png` | C | 3–10 | `#skip` `#s-listing figure.phone`, 390px ×2, settled | `c5c781bf01728e5137217f604380d60645592dbd2679356d7ca7231454330b7d` | PASS | 2 slices; same as group 390 |
| `07-listing-state-1-business-paused-390.png` | C | 3–10 | `#skip` `#s-listing .states > .state:nth-child(1)`, 390px ×2, settled | `02e899eb9cd76071b90c146c83058055fd776d09d73b49ba423933722f3d085d` | PASS | paused reason and what happens to existing bookings |
| `07-listing-state-2-wash-bay-with-an-address-390.png` | C | 3–10 | `#skip` `#s-listing .states > .state:nth-child(2)`, 390px ×2, settled | `dd55bb7b6aa3b6eef9fcdc0f6d458a51e9288299f3d8b8c54c02d00c89814dc7` | PASS | address shown with permission; three labelled checks |
| `07-listing-state-3-enquiries-only-390.png` | C | 3–10 | `#skip` `#s-listing .states > .state:nth-child(3)`, 390px ×2, settled | `e55c773f9022a6d3c2dee60de072c45d273435631ac5a86db0320648c97c79f8` | PASS | enquiries-only explained, Ask a question |
| `08-quote-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `c0ea6ba04a34ac5edb4ca8b30f8ead49d0d5e6cf6aab2468ec004840a522abe9` | PASS | written quote v2 with expiry, v1 struck and unpayable, slot chooser, hold explained; five states |
| `08-quote-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `24f971bda1be8da5b6e3ad5d9b0210f4c089562261aca2feff3a95f32a6bcccb` | PASS | phone quote: version, expiry, replaced-version note, unavailable slot struck |
| `08-quote-phone-390.png` | C | 3–10 | `#skip` `#s-quote figure.phone`, 390px ×2, settled | `8241104d88e1ac6707e2a4311993542bd55047756d2d97679bfa4d9fd67b6199` | PASS | same as group 390 |
| `08-quote-state-1-waiting-for-the-business-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(1)`, 390px ×2, settled | `6b63a155d616c7ecf82a483ef78d90c54248d9aca0d496d24281e2bb7e6b26a8` | PASS | deadline time, "You haven't paid anything", business hours |
| `08-quote-state-2-no-reply-in-time-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(2)`, 390px ×2, settled | `b0a18a92b324fa2e612e1b5d9049ec2eb1fc96eba35c374a41c96d16dc921fda` | PASS | lapsed, nothing charged, next action |
| `08-quote-state-3-quote-expired-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(3)`, 390px ×2, settled | `2d84af420c13e7ccf5ec6bebc8aa829ce875f631d3aef75a2c8e70d4d7b468aa` | PASS | expired version cannot be approved; ask for new quote |
| `08-quote-state-4-change-quote-during-work-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(4)`, 390px ×2, settled | `85c3130225df50b3007f736ae68b8cb11414bfb126bb1cf60af50b164353fd00` | PASS | separate change quote, paid quote unchanged |
| `08-quote-state-5-travel-charge-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(5)`, 390px ×2, settled | `2702a88c2680c59ec48339710327cd1537062f3bd002e435f8b1e8ddfaa10ec0` | PASS | travel band straight-line, itemised |
| `09-checkout-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `8f3338968a77352cdd7fd5f633713ae10c601a3de449fd96128a8f6d5defd5c7` | PASS | hold dial, itemised R330, pay on partner page, confirm only on partner notice; all seven states incl. late payment with rebook/refund choice (F1 copy fixed) |
| `09-checkout-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `ad97c23e1c9d8d299d2280cb1e0afde11d87106c0e54f517809d27a19815dc10` | PASS | phone checkout; hold explanation; cancellation terms labelled demo |
| `09-checkout-phone-390.png` | C | 3–10 | `#skip` `#s-checkout figure.phone`, 390px ×2, settled | `1bc4117159214ea7729bb27b77a4541b06bd3f690dd7201ff68e88ee9fbdebca` | PASS | same as group 390; dial exposed as img "14 minutes 32 seconds left" (40b-axtree-390.json node 1798) |
| `09-checkout-state-1-checking-payment-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(1)`, 390px ×2, settled | `5c015906abcc965b157dba95d60a57972473a2c64b1b7c822181f6a42dd56972` | PASS | "Please don't pay again", page updates by itself |
| `09-checkout-state-2-payment-failed-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(2)`, 390px ×2, settled | `9f0f6c9b4f83a8ad702463dcfa6fd6ef71e7d3267728c6424eac2788338848ae` | PASS | nothing taken, remaining hold time, Try again |
| `09-checkout-state-3-hold-expired-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(3)`, 390px ×2, settled | `fe1b559d357a72b00863dbf7dd3aa39ec1d052f3def22a821cff20bad4355039` | PASS | slot released, check payment status before retrying |
| `09-checkout-state-4-paid-needs-sorting-out-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(4)`, 390px ×2, settled | `18eaa00b1a20a67f23060b86260aed858465579d8dfdd5eb27012a785123a131` | PASS | F1: payment acknowledged, booking not confirmed, rebook or full refund |
| `09-checkout-state-5-confirmed-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(5)`, 390px ×2, settled | `74d2de1f855731685e480ee0bce3152bf006dbc98ef77398a2cedfd599a018a7` | PASS | paid to the business, ref, address released only to assigned staff after confirmation |
| `09-checkout-state-6-cancelled-refund-processing-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(6)`, 390px ×2, settled | `36bd924ee8cdc7bc94a401268d6f96e48d39efd5225ea66a4a422cc6f7302d3f` | PASS | F3: refund stages requested, processing, paid back; bank timing |
| `09-checkout-state-7-problem-reported-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(7)`, 390px ×2, settled | `bbc8324a8e5b2a888c666b68a1daf05247603e4fc3cdba436e9a02a220a2fff8` | PASS | case ref, open status, reply time |
| `10-dashboard-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `67e38363b465eec7c7617c0911465b6301e0cfa0823ff434189d67b747c01fdb` | PASS | reply-by deadlines, suburb only until confirmed, payment status per job, Test payments tag; desktop KPIs labelled demo numbers; address hidden 7 days after job matches PLAN :153/A31 |
| `10-dashboard-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `f1556fc42fe5e8cccc3fb8f7d068032cd764b9ab0b684760287c36a1a71dcd34` | PASS | phone dashboard, nothing clipped |
| `10-dashboard-phone-390.png` | C | 3–10 | `#skip` `#s-dashboard figure.phone`, 390px ×2, settled | `2819ce21b4dc4e51b2b2b856b23978daf2553c5b8db7af83affad298557d11df` | PASS | same as group 390 |
| `10-dashboard-state-1-write-a-quote-workshop-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(1)`, 390px ×2, settled | `4b4bda512ad43cddca306b0b6883fb2f73a9aa7a6bd201a67c8ddba4e6f0bf33` | PASS | line items, validity 7 days, sent quotes immutable; field edges visible |
| `10-dashboard-state-2-confirmed-mobile-job-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(2)`, 390px ×2, settled | `db584a8c5c9d734e773ca571ef9623bb46ab62e359010d5b731b58175a60f2f9` | PASS | address to assigned team only, hidden after 7 days |
| `10-dashboard-state-3-your-listing-is-paused-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(3)`, 390px ×2, settled | `d85fdf20714f75d7ce1495c33cf091e3c7268cf875af8527c31aad87f74e873d` | PASS | suspended state with case ref and next action |
| `10-dashboard-state-4-dispute-on-a-payment-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(4)`, 390px ×2, settled | `7cd596a93c0101ff80ec263213c1a655ef092b980a61b56c90ae9bc382858f79` | FINDING G7 | "Evidence due" gives no due date or time, unlike every other deadline in the pack |
| `11-apply-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `7860c7bb29f759a6ddeb7f524f19d79cd3fd9ed565724b7a24246ff683dacc4e` | FINDING G8 | private base kept private with inference caveat; labels say what and how, "Labels can't be bought"; consent checkbox drawn ticked; unselected distance chips show the faint --line edge (G1) |
| `11-apply-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `9e0f76cf2c8a7c7caf4b8d1a70eca4d4f6edc04a3f53a65cdfcb57963027b686` | FINDING G8 | same; base field and band field edges visible (control-edge) |
| `11-apply-phone-390.png` | C | 3–10 | `#skip` `#s-apply figure.phone`, 390px ×2, settled | `bc2cea0fc3b15046d2add3f36a65515dbceb11e740ff2708d488436309859e61` | FINDING G8 | same as group 390 |
| `11-apply-state-1-under-review-390.png` | C | 3–10 | `#skip` `#s-apply .states > .state:nth-child(1)`, 390px ×2, settled | `9d6c2441bfad0295d82b870338b7fd8cbbfaa84af6f3554d1b5caf472cbb4675` | PASS | human review, call or video call, email when live |
| `11-apply-state-2-we-need-one-more-thing-390.png` | C | 3–10 | `#skip` `#s-apply .states > .state:nth-child(2)`, 390px ×2, settled | `0485870a6e7cdd52bf02a1005a74982185d82c70ae698d67849af69440e6fcc5` | PASS | photo purpose and 30-day deletion stated |
| `11-apply-state-3-live-with-labels-390.png` | C | 3–10 | `#skip` `#s-apply .states > .state:nth-child(3)`, 390px ×2, settled | `0e024b81b7d22a0f2708573d0f04962552db4d5897e03dea6dad7cbc12117737` | PASS | each label says how; pending ones shown as not yet; labels can't be bought |
| `12-fines-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `3a059325f144985f9f257cb81787ed098ce4a73cdfdd06442be7ff2ebb7b7668` | FINDING G9 | no ID field, "never ask for your ID number", no-results is not no-fines, official links marked and leaving-site interstitial, towing referral only; tab bar highlights Search on the Fines page |
| `12-fines-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `e4aaa1102c9ff26fe1c2f502723aaa5072a5bdac09a12f654788c460f9de5f77` | FINDING G9 | same content as 1440; Search tab highlighted |
| `12-fines-phone-390.png` | C | 3–10 | `#skip` `#s-fines figure.phone`, 390px ×2, settled | `631f8ba2ee2f6d56261c46032493ecd75e6da97a9a4c4266480c55d75d34e3e2` | FINDING G9 | same as group 390 |
| `12-fines-state-1-leaving-carworx-390.png` | C | 3–10 | `#skip` `#s-fines .states > .state:nth-child(1)`, 390px ×2, settled | `e88097f69407e37cc0d0ab0e676b1ceab5ae31698ac324759636e44841a9ce77` | PASS | leaving interstitial, Continue/Stay |
| `12-fines-state-2-built-in-lookup-not-planned-yet-390.png` | C | 3–10 | `#skip` `#s-fines .states > .state:nth-child(2)`, 390px ×2, settled | `a655a93d6aed0a6beda483583746ad3e10b66c2706102e40f195947e4e87102f` | PASS | lookup gated on partner, legal checks, owner |
| `13-thandi-1440-0-motion.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, motion, scroll=0; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `35b817d6c5b484f944993c6407d476129c51099074ccd451ea2752205f6077f6` | PASS | RECAPTURED (capture.mjs v2): note state "Request sent"; matches reduced |
| `13-thandi-1440-0-reduced.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, reduced, scroll=0 | `35b817d6c5b484f944993c6407d476129c51099074ccd451ea2752205f6077f6` | PASS | nav at top, step 03 active, no motion needed |
| `13-thandi-1440-05-motion.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, motion, scroll=.5; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `7394cd47959626e48cee6ae11c89a56af851c897988573062798fa996139ff35` | PASS | RECAPTURED: hold dial "14:32 PAY R330" at step 05 |
| `13-thandi-1440-05-reduced.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, reduced, scroll=.5 | `7394cd47959626e48cee6ae11c89a56af851c897988573062798fa996139ff35` | PASS | same state as motion |
| `13-thandi-1440-1-motion.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, motion, scroll=1; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `18e8cafc16a22f51f990d1517fdbebf22d76c1fdf41eaf335c5421bfebc5cc1a` | PASS | RECAPTURED: "Booked and paid" tile at step 06, what-if list |
| `13-thandi-1440-1-reduced.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, reduced, scroll=1 | `18e8cafc16a22f51f990d1517fdbebf22d76c1fdf41eaf335c5421bfebc5cc1a` | PASS | same state as motion |
| `13-thandi-1440-settled.png` | E | 11 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `6674236f71115eeaaf8bb6a3ea28dce18a7e29337fab9ee7f94d5deb0cd9dc06` | PASS | seven steps with actor tags, booking object, what-if list; readable without motion |
| `13-thandi-390-0-motion.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, motion, scroll=0; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `9662c617ca751aec6806ee2787f2f8ee572dea98ae83f8a452ac2f2634b6691c` | PASS | RECAPTURED: section top sits under the fixed nav at this forced scroll position (expected for a fixed nav; sections have scroll-margin-top 96 px for links) |
| `13-thandi-390-0-reduced.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, reduced, scroll=0 | `9662c617ca751aec6806ee2787f2f8ee572dea98ae83f8a452ac2f2634b6691c` | PASS | same |
| `13-thandi-390-05-motion.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, motion, scroll=.5; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `373078513383acc02194a0112c5971cb2c6cd9ef17441fdceb713381d10ff19f` | PASS | RECAPTURED: steps readable; the booking object is not sticky at 390, by design |
| `13-thandi-390-05-reduced.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, reduced, scroll=.5 | `373078513383acc02194a0112c5971cb2c6cd9ef17441fdceb713381d10ff19f` | PASS | same |
| `13-thandi-390-1-motion.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, motion, scroll=1; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `aa8f6c57ce8772c371de051b011714f64acc4a3e7210ea844008aee76b231e06` | PASS | RECAPTURED: what-if list readable |
| `13-thandi-390-1-reduced.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, reduced, scroll=1 | `aa8f6c57ce8772c371de051b011714f64acc4a3e7210ea844008aee76b231e06` | PASS | same |
| `14-pieter-1440-0-motion.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, motion, scroll=0; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `d9d324153749ec497dcfec887467b81b9a9ad0b647137883fe6bf79338df3551` | PASS | RECAPTURED: quote v1 receipt at step 03 |
| `14-pieter-1440-0-reduced.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, reduced, scroll=0 | `d9d324153749ec497dcfec887467b81b9a9ad0b647137883fe6bf79338df3551` | PASS | same state |
| `14-pieter-1440-05-motion.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, motion, scroll=.5; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `60ac24d22f1427e236f0206eb804ba1af8393b4ca086b9f9b49d53a00fdb9207` | PASS | RECAPTURED: dial "FRI 08:00 HELD" at step 05 |
| `14-pieter-1440-05-reduced.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, reduced, scroll=.5 | `60ac24d22f1427e236f0206eb804ba1af8393b4ca086b9f9b49d53a00fdb9207` | PASS | same state |
| `14-pieter-1440-1-motion.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, motion, scroll=1; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `f6ebe022287095309eb2523fc500a16cc75f1f74c7366ac9121e871255059481` | PASS | RECAPTURED: change quote C1 at step 06 |
| `14-pieter-1440-1-reduced.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, reduced, scroll=1 | `f6ebe022287095309eb2523fc500a16cc75f1f74c7366ac9121e871255059481` | PASS | same state |
| `14-pieter-1440-settled.png` | E | 11 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `e9a48d4fcb761c1ed6cac3651aa9ac8aea514e95eb98f5efa289e3ff3529acf1` | PASS | seven steps, quote v1 then v2, change quote C1, what-ifs |
| `14-pieter-390-0-motion.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, motion, scroll=0; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `557dd1454ee14397db8c8557a8d5ad984074db5ac6472f78a1620e28929b3a37` | PASS | RECAPTURED; as Thandi 390 |
| `14-pieter-390-0-reduced.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, reduced, scroll=0 | `557dd1454ee14397db8c8557a8d5ad984074db5ac6472f78a1620e28929b3a37` | PASS | same |
| `14-pieter-390-05-motion.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, motion, scroll=.5; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `a9ef2778cc4465e3356d5d9e9aa466a030064ad12cb7850bc19f17bd21f396fe` | PASS | RECAPTURED |
| `14-pieter-390-05-reduced.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, reduced, scroll=.5 | `a9ef2778cc4465e3356d5d9e9aa466a030064ad12cb7850bc19f17bd21f396fe` | PASS | same |
| `14-pieter-390-1-motion.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, motion, scroll=1; **capture.mjs v2 (instant scroll, waits for a stable scrollY)** | `9e9fcae4a2f73c12289c953e8bf797a0c3f1ff1f216bee9e04a549db7a446327` | PASS | RECAPTURED |
| `14-pieter-390-1-reduced.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, reduced, scroll=1 | `d7a4d0f9a0dea5be84c85d58996aff2d3581cef9c229ae705922a4b3fa5ff6dd` | PASS | same |
| `15-footer-1440.png` | E | 12 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `51a9d58846bb485e1b54c647b49800d623e619e34bc69a439196e633a8008cae` | FINDING G10 | footer cites "decisions D-001-D-036" |
| `15-roadmap-1440.png` | E | 12 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `314a9aaf80f97bff63f9a32ca996df5fee755fb2e3f02d3bae515e663a7e6515` | FINDING G10 | phases, decisions, earn-later list; but shows "0b This pack (now)", "Start building (Phase 1)?" still open, decisions only to D-036, and "attorney" in phase 4; row 12's check (matches D-037 to D-041) fails |
| `16-BookingTile-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `29b01f5812b5350222277ad3f82d779c47bfcf1ba0672a380b413ea17badf2b2` | PASS | MIRROR v3 (repo fonts): accepted and booked-and-paid tiles |
| `17-Button-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `7aeaaee5b5ac28d4703b03c2e2305005a370a60f641a4568fb5cbb938811d82f` | FINDING G1 | MIRROR v3 at 960: primary, secondary, outline, link, small, pressed, focused (ring visible), disabled; outline edge uses --line |
| `18-Chip-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `28edd91e61aed3f757b14bd0fc26c46452a6fb728dfaa1e9eb1ed47fe3bab245` | FINDING G1 | MIRROR v3 at 960: filter chips edge --line (faint on canvas); status labels always a word; slots; actor chips |
| `19-Cover-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `f559a1a481f959a6ed62a86bf381a6a8e22c1cba67e3c5d9eebd04cdc37adf4f` | PASS | MIRROR v3 at 960 (v1 at 720 cut off the right-hand objects): lockup, tagline, desk objects |
| `20-EmptyState-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `3a9cd192bd4b70387e89bbf38cf60e385bb5a8692f68d82de0ebea9b1af0e63e` | PASS | MIRROR v3 at 960 (fits declared height): three states, one sentence and one action each |
| `21-Field-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `84de8cf9bcf0f352d1eb4c3bd0c4cb181c3a82f61be4a917d6e605aa0acbd6dd` | PASS | MIRROR v3: inputs use --control-edge (visible), segmented controls, checkbox ticked and unticked (supports G8 default) |
| `22-HoldDial-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `11ebbe85a40652d8f7f5573f8c13a1d4a966a28b997cabdc767c2b0d882e6983` | PASS | MIRROR v3: held, left, paid states; paid uses a word, not colour alone |
| `23-Iconography-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `b098ec89e4ee0f60cbf18a04e4d2591befd7c5fa7d8e08c665f2ad5e7f621994` | PASS | MIRROR v3 at 960: 5 objects, 10 illustrations, 25 glyphs (counted) |
| `24-KpiCard-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `b2cbfc998a543e0d2f084f6b70369bd6b5c5facd67f4f57dc91f90fb587793ea` | FINDING G14 | MIRROR v3 at 960: demo KPIs; card subtitle in the source names another product ("EquipFlow-style") |
| `25-Loaders-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `878cd8e8428306540931477a5e7510681e4250660439b1b09d22da9ff1b24ab3` | PASS | MIRROR v3: hold-dial steps, skeletons, button arc, row skeleton, ripple; each with when-to-use |
| `26-NavBar-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `e9bb7882c9dc8a5aa89c2de4e320751d2b075e027de53479db5da5b62253094d` | FINDING G11 | MIRROR v3 at 1040: desktop pill nav and compact sheet; sheet's last row cut by declared height 380 |
| `27-NotFound-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `25fada46bf4d8fcd6825f7792f4966f3449b62ffd6b3a97e11f354d9242d37db` | PASS | MIRROR v3: dot-grid 404 with lens at rest (D-041), copy, two actions, five shortcuts |
| `28-NotFoundPhone-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `125a73c9daf0bc1af12a6fb6c03270936906cb8c3fae4f9863daa2657ae9cb89` | PASS | MIRROR v3 at 390: same, shortcuts wrap |
| `29-PageLoader-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `df8b774f2c78fdba63c14130694537c3a4cbb30bacdfa9f6a8ef1198e3cbb942` | PASS | MIRROR v3: ripple frame, LOADING label |
| `30-PhoneFrame-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `c34dcb840d096a496b5ae38fe75c0fa85fca0d1ca288c35f433a475d6d8b1126` | PASS | MIRROR v3: frosted shell, five key rows, tab bar |
| `31-ReceiptQuote-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `2679b4beea5204ee92a89ddeb5888f12dfa7191eb159f5d9e68e8432cc95c975` | PASS | MIRROR v3: versioned quote with expiry and replaced version, paid receipt "CarworX never holds the money" |
| `32-01-404-desktop.png` | S1 | 14 | qa.mjs stills --approved | `f17768e92611c614aedb6bd745c6e03fc74acfa51e66b7836beb522ee7cfb7a2` | PASS | S1: 404 at 1440, lens over the Turbine middle glyph, copy, two actions, five shortcuts |
| `32-02-404-desktop-still.png` | S1 | 14 | qa.mjs stills --approved | `737bc66efad50d6d414c8144456c22679286fd87c00e8cfb649442bb9dfb1a82` | PASS | S1 still: lens at rest |
| `32-03-404-phone.png` | S1 | 14 | qa.mjs stills --approved | `c15d5b31e5be1705ab79d0e9a467c8236e537ea5c386041006485204e816acda` | PASS | S1 390: lens, copy, shortcuts wrap |
| `32-04-404-phone-still.png` | S1 | 14 | qa.mjs stills --approved | `07be35c7033020b0c3f3082d1bf1c33e259ade25cfc1d72aeccba75fb930c4b6` | PASS | S1 390 still |
| `32-05-404-phone-frame.png` | S1 | 14 | qa.mjs stills --approved | `58f65770d1117d995da4c85510ad538e8f126fea2b8dcce1860e01057cd5bfae` | PASS | phone frame with "The same page, live" explainer |
| `32-06-between-filling.png` | S1 | 14 | qa.mjs stills --approved | `e7f0482bce26477931e53f36c7d67591233b52ec1b6687f0dba68fd136d214f7` | PASS | ripple wave, blades filling |
| `32-07-between-black.png` | S1 | 14 | qa.mjs stills --approved | `3b19ff7f21709bd9ad5b5b00adb78b0e60f0be3260bfc5574659b5ab2ff1b8d1` | PASS | blades fully black, wave outward |
| `32-08-between-draining.png` | S1 | 14 | qa.mjs stills --approved | `1a8690a6cadeb9ac0b9441cba0377ca9e44924123a7a2f2bfbc9841133eaa75b` | PASS | blades draining |
| `32-09-between-still.png` | S1 | 14 | qa.mjs stills --approved | `1e7c3dee9b0780c17a97bdae00bfcf6802ff31db2965377324d6eaa608e4efb5` | PASS | reduced-motion still: full mark, static rings, LOADING |
| `32-10-board.png` | S1 | 14 | qa.mjs stills --approved | `79b02db79c1575e3d58bae7d12fe118c5d9dc38e79cddfda19566beedb2849cc` | PASS | board at 1440: four loader kinds plus ripple, each with when-to-use |
| `32-11-board-mobile.png` | S1 | 14 | qa.mjs stills --approved | `8228758e94b859a9f4bcee743f77674132c43c8687704db198fe863b393335a6` | PASS | 4 slices; board at 390, cards stack (button loader first), rows truncate with ellipsis |
| `32-ResultCard-mirror.png` | M | 14 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `4b043fe9bc3d98241eca60ef50eea9830fececc80905c0d3c89f6ae6bfb25b50` | PASS | MIRROR v3: straight-line distance, mobile approx area, labels, DEMO |
| `33-ServiceKey-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `e70b912118c792fded5cfefbe590c8ad08649554a6a965b6a58f5c452cb781ff` | FINDING G11 | MIRROR v3 at 1040: five equal keys, hover/pressed/focus, phone rows; last rows cut by declared height 560 |
| `34-StatusNote-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `b6b2a137e68cf7e7a8bdcf8ddb49153c7ebaae29d493dc392dc135e8d38800b5` | PASS | MIRROR v3: info, waiting, problem, done; each has an icon and a bold lead word |
| `35-StepList-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `20eedfb8c37faf5f43e9a7018ae522c2fdcd97446d5f048fe294269e6795b1f0` | FINDING G11,G12 | MIRROR v3 at 1040: step number drawn on top of the icon (bundle.css:166); third step cut by declared height 360 |
| `36-StickyNote-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE; **mirror.mjs v3 (width fitted, repo fonts); MIRROR, NOT LIVE** | `5a90ce93ec4cbe22b4a2c472d9a26d6233ba12a273b375434d2374e77ccc5ace` | PASS | MIRROR v3: Caveat loaded, two notes |
| `37-states-qa.json` | S3 | 14 | qa.mjs check/contrast --approved | `2b2d0980218e7a19162c32786d504fc01bafaa8008672fa82f03af8827947d20` | PASS | states page: 0 errors, no horizontal overflow at 1440 and 390, motion and reduced |
| `40-focus-1440-01.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=1 | `cfcef24a0ec13aa1927c4f14efb24c3ee961cedec054210121e46ac29ee6eb3f` | PASS | stop 1: skip link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-02.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=2 | `f73e5d7b9bd830fccbb77ce1afdcfdde820c30815fe7790c71ca2769f2f3b9dd` | PASS | stop 2: logo link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-03.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=3 | `84bcc11f0df5a3ecefb4e638e3222ff85fab2934518a2707d96cff16e96c8e26` | PASS | stop 3: nav Summary; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-04.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=4 | `b7fbc3e95789280d2bc4d0b3a65f0cce2c19ffc8a556835f2ba3bc4694109645` | PASS | stop 4: nav Brand; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-05.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=5 | `5ca960e85718f2d54d110688e26a716ad6c005652d1e7db6ee348f984665fbf4` | PASS | stop 5: nav Phone screens; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-06.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=6 | `399d7461a5d921cdf015290c1333ce7be715e0882336a43e94918d89efbf4f90` | PASS | stop 6: nav Desktop; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-07.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=7 | `9c1dd70bf4c3d686745ff6e775a61e70a529208c030b14e217e0d7d43c434dd1` | PASS | stop 7: nav Journeys; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-08.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=8 | `5fc29552a225273d7a4c8fc77ef0fa103ff970f0b9192e29784afcff8a057e57` | PASS | stop 8: nav Roadmap; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-09.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=9 | `424e784e98c943ba608c65e82e4fd740f300a024ae00dc3fa06a9276d9eafe53` | PASS | stop 9: primary pill; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-10.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=10 | `b895c6e35e115074fd6918bf2cf59bb6150474c5214690bf05a2f62061fa5050` | PASS | stop 10: secondary pill; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-11.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=11 | `3d8abb91f393288c9aa52274486a6fc8f8be576695ccdbccc614295c4439de1b` | PASS | stop 11: inline link Roadmap and decisions; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-12.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=12 | `58dbab114d994325be2ca028080ec3a900d9520713fbe416b95ffa8bdb416bfa` | PASS | stop 12: Play the logo animation again; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-13.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=13 | `93f2358bc509ebc55ffb85eda0203c96c53aead82823d7bcdd50cb579f6fc961` | PASS | stop 13: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-14.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=14 | `442f79a892c404b9b1f9e535727eeaf70c508c50ec985592a09a783d7fe743ee` | PASS | stop 14: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-15.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=15 | `970a9e97de30030a68cf4f36ff413666ef77b8968fd0fee19859eaad1a1db0ea` | PASS | stop 15: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-16.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=16 | `b59ab30614cc7dcff1e22236674a621dbe975768b9c2632b9e7f48b1c36eda75` | PASS | stop 16: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-17.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=17 | `ba2e89dcb13a2bb63bb5862a674d403b6704abf9efc6c1511bb32cb355d84d63` | PASS | stop 17: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-18.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=18 | `1764e4b8d5da4a6136732dfb5e60ff780b7c3c9af8b83fde1d760463c90263b6` | PASS | stop 18: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-19.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=19 | `819d6e5046cf5ff1984d82a41e178fd53a721c6691993a58278dec847e7cb458` | PASS | stop 19: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-20.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=20 | `a716b46cf1d37fed9079575c2fde138f91dd74e69284cb9ddfabf1b6d578ac19` | PASS | stop 20: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-21.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=21 | `26f1856cf9df2f81350c46c057e793d67e8c32696940d6f9d31714184182e1ae` | PASS | stop 21: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-22.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=22 | `5167138f33c741cacb4f3c6bec9f1914b1008b1617529e80cd7155840e6c0a27` | PASS | stop 22: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-23.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=23 | `c1351fb94677556e72089975fe20c73f81ffbbc38ab8e0903951b863c72230d4` | PASS | stop 23: journey inline link; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-24.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=24 | `459903040dba2af228811453a8e184556d4ba68fd3d7e933d78e179ace9eaaea` | PASS | stop 24: scrollable decisions table (focusable region); 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-25.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=25 | `288440e10a51c22c79c5bd44d5f459e37c149b5393454d8269b40013322a3ff6` | PASS | stop 25: footer PLAN 2.1; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-26.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=26 | `1f423b93de33f47b49afa9a8b400e4c3ab3041ab6c4a8c9b5636d9ec478bec18` | PASS | stop 26: footer design/brand; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-27.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=27 | `e42fcd49fe6a48448208120ab3c2c5ca1c41282a72be44b957daf82873f3fe16` | PASS | stop 27: footer exports/; 2 px ink ring with offset visible, DOM order |
| `40-focus-1440-28.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=28 | `87158e9ca1e83f7b82339e9cfde671b2199aac66f10739aefa76ba7de1ff5f67` | PASS | stop 28: footer QA.md; 2 px ink ring with offset visible, DOM order |
| `40-focus-390-01.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=1 | `5ce614be05a23e5894c08e95764f82ec8f9d1af116a9a6a2620ef6a620796e58` | PASS | stop 1: skip link; ring visible |
| `40-focus-390-02.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=2 | `282bed774cc862d5fd16ab93779da25a275fbf8fe40af6cd145c28da0dc6754e` | PASS | stop 2: logo link; ring visible |
| `40-focus-390-03.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=3 | `19bafbaf43f5b7a34d4f99c078afc815281d4647162309e3fe26a932a82a08a7` | PASS | stop 3: menu button (nav links hidden below 1060 px); ring visible |
| `40-focus-390-04.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=4 | `1ee7c3c7259c3df78236245c251326a3456f45f888af337f128d2513ea27fae2` | PASS | stop 4: primary pill; ring visible |
| `40-focus-390-05.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=5 | `981f378dd4dc3a9aab22e8519f4945456a14c868c7bbf45707206c6589dfc2c9` | PASS | stop 5: secondary pill; ring visible |
| `40-focus-390-06.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=6 | `793c9dcca548fc5612e895f65ec2749df6bb14ffd3162421c96d07178405f412` | PASS | stop 6: inline link Roadmap and decisions; ring visible |
| `40-focus-390-07.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=7 | `df20569ce3482febf33499dc1e8609ba454a0a28bfd8bc969a4ebad18b97356e` | PASS | stop 7: Play the logo animation again; ring visible |
| `40-focus-390-08.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=8 | `20510d7fb11a8876baef3f2cba03f5fab9ce26f589b5f6d3aff8e61e9e0264c1` | PASS | stop 8: journey inline link; ring visible |
| `40-focus-390-09.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=9 | `b80e48732e2381597c65faa2de1a05a709500de78e26f4623fefe89307813ebc` | PASS | stop 9: journey inline link; ring visible |
| `40-focus-390-10.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=10 | `a2ecd85ba4178556de20832184a14bd13a893a80e529a05ebf0e407e93453301` | PASS | stop 10: journey inline link; ring visible |
| `40-focus-390-11.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=11 | `282742620ed033afc4a8562706acbee93ee9620a968f0461dbd1c9556130ff2c` | PASS | stop 11: journey inline link; ring visible |
| `40-focus-390-12.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=12 | `1cd92a9a43e2cfc6216663ecf74e16aa7f55d88e668713d5c671c157a9d1b8c6` | PASS | stop 12: journey inline link; ring visible |
| `40-focus-390-13.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=13 | `d27937b4763fad739d5daccddf91ec0324a3ae091487f920e2f5bf08486d46f6` | PASS | stop 13: journey inline link; ring visible |
| `40-focus-390-14.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=14 | `256f45e271220447785db4291d0a65efcbf19da55541537ac3941f190727c817` | PASS | stop 14: journey inline link; ring visible |
| `40-focus-390-15.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=15 | `d70e4c9cdc066214f71ed395c642df6d72e780526333fd893cfc2acfcf6ef2ef` | PASS | stop 15: journey inline link; ring visible |
| `40-focus-390-16.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=16 | `cadfc1097ab9fa463e74a02755f3ded81b28522c5282275b52fccbec7e80233e` | PASS | stop 16: journey inline link; ring visible |
| `40-focus-390-17.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=17 | `21689533a190ef155b1d282a7c3eac36ec2224f3355d21e0b69613d77f07d0c3` | PASS | stop 17: journey inline link; ring visible |
| `40-focus-390-18.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=18 | `17355f4f087e7328783a97f6897e6190f55290e1b7b36d66cb7fbe7ca4924a9d` | PASS | stop 18: journey inline link; ring visible |
| `40-focus-390-19.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=19 | `f402c38c257b0ac4fe5f4f903971460eccc778b5ce04e7e0a1a58306d9ad4281` | PASS | stop 19: scrollable decisions table; right columns scroll; ring visible |
| `40-focus-390-20.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=20 | `fd30b8328334cdae1299cb085abcc197067570a558977814afe5daf2d695538e` | PASS | stop 20: footer PLAN 2.1; ring visible |
| `40-focus-390-21.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=21 | `31046e5f00640a5e20f753b44b62de868168f4d69bccead906fae51dea1df1e8` | PASS | stop 21: footer design/brand; ring visible |
| `40-focus-390-22.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=22 | `fa0a7183e5955cebf6518a515bee2a0047c23d18e8f917b45ccf124ca3a1862e` | PASS | stop 22: footer exports/; ring visible |
| `40-focus-390-23.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=23 | `80e0ebe44d74b02a2d095acd9cb9da22634631e222cb40430171ec9e416ebd3c` | PASS | stop 23: footer QA.md; ring visible |
| `40-focus-390-25.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=25 | `da0703ef707e53c6cf2851151d1d6a9abaef948d0f78e47dd97384f975527154` | NOT USED | past the last stop: 23 stops at 390 (28 minus 6 hidden nav links plus the menu button); Tab 24 leaves the page, 25 wraps to the skip link |
| `40-focus-390-26.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=26 | `6e17367766f978360c491f854e3c2ba99e0dd5a678bf6c8bb8315a76fe4fc9b2` | NOT USED | wrap-around; crop of a fixed element taken while the page was scrolled shows other content (tool limit) |
| `40-focus-390-27.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=27 | `f8398409d4a585f8d20605bf43faf94cf960262333121a1aee4d59113822af23` | NOT USED | wrap-around; same tool limit as 26 |
| `40-focus-390-28.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=28 | `981f378dd4dc3a9aab22e8519f4945456a14c868c7bbf45707206c6589dfc2c9` | NOT USED | wrap-around duplicate of stop 5 |
| `40-menu-390-esc.png` | C | 16 | `#skip` `.menu-btn`, 390px ×1, settled, keys=Escape, pre=JS (see jobs.json) | `862fdb15a4287683ae7e3927acf60134019ed1d572ba5323b0585743bf04c892` | PASS | Esc closes the sheet and returns focus to the menu button |
| `40-menu-390-open.png` | C | 16 | `#skip` `.sheet`, 390px ×1, settled, pre=JS (see jobs.json) | `0084d552bbf195f43d6b8ba422e9bb57d611ba8826ea820fe6951cc331302794` | PASS | sheet open, focus on Summary with ring (click(), as Q does) |
| `40-menu-390-trap.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=8, pre=JS (see jobs.json) | `19b96cfc027d44468570db6fb1579efb4f8e098efa166adc62f64e51671a7214` | PASS | after 8 Tabs focus is still in the sheet (Brand) |
| `40a-targets-360.json` | C | 16 | `#skip` `body`, 360px ×1, settled, eval=targets | `9d260dcf352cc7be74672cee662381198e566a13f7d751aae19e5312efac3050` | FINDING G17 | 30 targets; the 16 under 24 px are inline links inside sentences (WCAG 2.5.8 inline exception); menu button 40x40 and logo link 27 px tall are under the Studio 44 px rule |
| `40a-targets-390.json` | C | 16 | `#skip` `body`, 390px ×1, settled, eval=targets | `f16b8594b5b9c36fc50c305145def82e66434412c62aaa6dc79c7447157712c8` | FINDING G17 | same pattern as 360 |
| `40b-axtree-1440.json` | C | 16 | `#skip` `body`, 1440px ×1, settled, eval=ax | `305b843f1b5a513f44c1c3f2a1a8c2c0cf561fbc7631ced71cc277f4f7e06aa9` | PASS | 27 controls, all named; 55 headings in document order |
| `40b-axtree-390.json` | C | 16 | `#skip` `body`, 390px ×1, settled, eval=ax | `ce3ef6ff14ac36c8eb8b0921272d4dddb29e008a7bd59c764530c2029d00bcd9` | PASS | 22 controls, all named; h1 present; hold dial exposed as img with its time |
| `41-states-contrast.json` | S3 | 17 | qa.mjs check/contrast --approved | `38b9674359804af7cbbe4b52b49a586f939e53ad940460a0ada1d76d732f68f7` | FINDING G15 | empty "lines" at all three widths: approved-page selectors missing |
| `41-states_contrast-1280.png` | S3 | 17 | qa.mjs check/contrast --approved | `6e2313f8e24ea3b135cbb646aabdb645d6a584df460bed71da65c5e1f7642d38` | PASS | S3 still at 1280 |
| `41-states_contrast-1440.png` | S3 | 17 | qa.mjs check/contrast --approved | `80c9cce643017ac8c9f03317fad096db9285bac55aa64d8b715a9e036b1c2a04` | PASS | S3 still at 1440: copy visible, lens moved aside for sampling |
| `41-states_contrast-390.png` | S3 | 17 | qa.mjs check/contrast --approved | `b91fbdae7f81d0aa04464b14e50e6e1ac191df48c670bf8b5b8510ad1deb0a43` | PASS | S3 still at 390 |
| `41-svg-0.png` | C | 17 | `#skip` `[data-cx]` nth=0, 390px ×2, settled, pre=JS (see jobs.json) | `dca14042a32bc3f794249d4eed0143ffddeec8a3eaa8602fa0bf00d0b26f5167` | PASS | map SVG at 390 x2: pins, You, area label (G6) |
| `41-svg-1.png` | C | 17 | `#skip` `[data-cx]` nth=1, 390px ×2, settled, pre=JS (see jobs.json) | `a5df068d536741ea810ae64c13c544cdb2b7e5e425f4fc245eacf83ce7cd8cd0` | PASS | desktop search map rendered under CSS zoom .55 at 390 (thumbnail of the desktop mock) |
| `41-svg-samples.json` | C | 17 | see log | `0451224259c686de1b002670086917e3287a98c886db3b738f7baa5c5557adbf` | PASS | v2 sampler (1 px ring, modal backdrop): 8/8 SVG texts pass; pin numerals 19.19:1 on the #0d0f12 disc |
| `41-svgtext-390.json` | C | 17 | see log | `d58af2252bdbf81ac71f8194099753392f7616711bb68d35400722f3d2ce3255` | PASS | 8 SVG text boxes; svg 1 boxes are under CSS zoom (h=5), sampled correctly by v2 |
| `41a-nontext-1440.json` | C | 17 | `#skip` `body`, 1440px ×1, settled, eval=nontext | `778db305962a52bacb0f75686889e3a3fd733963fccd5e81cc326dfa04b874f7` | FINDING G1 | same; component edges measured from tokens in bundle.css (G1) |
| `41a-nontext-390.json` | C | 17 | `#skip` `body`, 390px ×1, settled, eval=nontext | `4022c1aad3d958ad9d83e9e98bab42d9a04b9c21ccafd4b5d3b82d10fb4a58c6` | FINDING G1 | computed styles: focus ring 2 px ink with offset (16.99:1 on canvas); white pills rely on text plus shadow; icon-only menu bars ink on white 19.19:1 |
| `42-brand-reduced.png` | C | 18 | `#skip` `#brand`, 1440px ×1, reduced; **capture.mjs v2 job, film loaded before capture** | `e218b84edbe13ba68d201d20abad1f761d538a35884925919a1be59039085b5b` | PASS | RECAPTURED: v1 film panel was black because the lazy iframe never loaded off-screen; v2 scrolls it into view first and shows the still Turbine lockup, as the caption promises |
| `42-cover-reduced.png` | C | 18 | `#skip` `#cover`, 1440px ×1, reduced | `61a7f62e0d2e0470e5e9cd84163a8cbb71bf150d939f78495defc7276df9b6db` | PASS | reduced: floats at rest, no entrance offsets, full ink |
| `42-j-pieter-reduced.png` | C | 18 | `#skip` `#j-pieter`, 1440px ×1, reduced | `cfc9e9ef2de5b1e72bf9faca2240262fe060cf86eb2ac6c534b4889613330dbd` | PASS | reduced: same |
| `42-j-thandi-reduced.png` | C | 18 | `#skip` `#j-thandi`, 1440px ×1, reduced | `df3a345ccf2b6fb36061dcdf10879e04e443072e5c0b8f1751cfdba3c752c0ad` | PASS | reduced: steps and booking object static and readable |
| `42-s-home-reduced.png` | C | 18 | `#skip` `#s-home`, 1440px ×1, reduced | `3fd44a250438a2490723024a43347f24cc8eed152db95b31760613cfd69b4d66` | PASS | reduced: home group static, identical to settled |
| `43-pack.pdf` | E | 21 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `2fb2eb09e013181387eaed9a4efa39494e744fafce0b60a85d13664985721b4e` | FINDING G2,G10,G16 | 42 pages, all opened as 43-pdf-p01..p42; complete; bundled fonts render (Q resources: none) |
| `43-pdf-p01.png` | P | 21 | PyMuPDF, 110 dpi | `3916fe6183edb05c788b92de1b2103f8d374bd2dde54ce7b9fcb2f4633e8ac21` | PASS | cover: badge, h1, pills; floats hidden for print |
| `43-pdf-p02.png` | P | 21 | PyMuPDF, 110 dpi | `0b0f9aa53a73031f6a46e7b9a7d610a46d70e2ba5d8b484cc625f9e1498e8190` | PASS | summary, five equal keys |
| `43-pdf-p03.png` | P | 21 | PyMuPDF, 110 dpi | `22ed1bf14cf50c82c5c52bbb3e6d0b730ea7fe72694d20d8a9741c249ecef85d` | PASS | booking steps and how paying works |
| `43-pdf-p04.png` | P | 21 | PyMuPDF, 110 dpi | `6836fdb9bb2a6624cd7010fcf436599654591b96c9ca21dfcedc7ab1b22a60d4` | FINDING G2 | costs list still names an attorney (D-045) |
| `43-pdf-p05.png` | P | 21 | PyMuPDF, 110 dpi | `1c63d58c6e13459650110b3e6fbcf470ecac347eeabc596188d6bc4e8978a98b` | PASS | still-open note (mostly empty page after a break) |
| `43-pdf-p06.png` | P | 21 | PyMuPDF, 110 dpi | `e4867118cab468a8ede840617072b55e998b103a01160190dceb148469863bb4` | PASS | brand intro, Turbine film shows the still lockup |
| `43-pdf-p07.png` | P | 21 | PyMuPDF, 110 dpi | `4d08dad46426237ebe12fd78031b5b31afa26001dd81fcc02acc59d0a863cdfa` | PASS | four lockups with ratios, clear space |
| `43-pdf-p08.png` | P | 21 | PyMuPDF, 110 dpi | `6c069e4607813d5868ccd924f13f91bd8f8a3d6662e70af3a658edacd6e58fc5` | PASS | minimum sizes, misuse rules, app icon |
| `43-pdf-p09.png` | P | 21 | PyMuPDF, 110 dpi | `160bafa876e7db73dfc9df5180917fb47a9fb20083193861181e168efb2b34fd` | FINDING G3 | in-use samples; invoice header mark flush left |
| `43-pdf-p10.png` | P | 21 | PyMuPDF, 110 dpi | `461dc4339115d19fa5cc3dca3958cb2cb0b4347fa40d2585aaed493777d41c79` | PASS | colour roles, type, shadows, spacing |
| `43-pdf-p11.png` | P | 21 | PyMuPDF, 110 dpi | `771e4b0c175b070f0c57266c40adbc1dfe0fe86faf916494f66497e69d440c68` | PASS | frosted, objects, motion, tone |
| `43-pdf-p12.png` | P | 21 | PyMuPDF, 110 dpi | `55ec4fd5d89dd89e1308698f072fe55fbd7c35a55ea23288d3973bdc6151c6a1` | PASS | tone examples |
| `43-pdf-p13.png` | P | 21 | PyMuPDF, 110 dpi | `5231d2da523f5af91678f445072dcac07125e35f4f053727063d98c4d33efedb` | PASS | part 3 opener |
| `43-pdf-p14.png` | P | 21 | PyMuPDF, 110 dpi | `18559fe61d9a221e42d21a917c630933e8baa17da63ee15fb77e5475bf68f522` | FINDING G16 | home phone split across pages 14-15 (tab bar labels on p15) |
| `43-pdf-p15.png` | P | 21 | PyMuPDF, 110 dpi | `f4fecf01e078d391677e6a309b6478814583fb5b240805a377a79ec9085517e1` | FINDING G16 | home states; outline button "Tell us what you need" has no visible edge in print |
| `43-pdf-p16.png` | P | 21 | PyMuPDF, 110 dpi | `abba8b0b72741612134e8011eb08942cb54e93c416952face3185af0014af457` | PASS | search phone |
| `43-pdf-p17.png` | P | 21 | PyMuPDF, 110 dpi | `d0f394aff61e1e8d72f7882c2287f6d3255736233c2bd2d2c9fe7e6012b43053` | FINDING G16 | search states; "Look within 50 km" and the "Tyres & Wheel Alignment" input lose their edges |
| `43-pdf-p18.png` | P | 21 | PyMuPDF, 110 dpi | `e33b97da4ef3680643244cb09e97e14a71de0a01124b30f1132dbf0d28041419` | FINDING G16 | listing phone split across pages 18-19 |
| `43-pdf-p19.png` | P | 21 | PyMuPDF, 110 dpi | `59a1b623b00908813bfbf796df60e1520a058e36bf08d7cda7d19d9ea40c735e` | PASS | listing variants |
| `43-pdf-p20.png` | P | 21 | PyMuPDF, 110 dpi | `2630141d3dbb809e3615ba200fa941bbbd95a71a7f1cefc81605963cee1c2a9c` | PASS | quote phone: version, expiry, replaced version |
| `43-pdf-p21.png` | P | 21 | PyMuPDF, 110 dpi | `5be2c5cfec16f9eafbeb44b83dd8ac8b5680aebe3e30593cc009a83f04476539` | PASS | quote states |
| `43-pdf-p22.png` | P | 21 | PyMuPDF, 110 dpi | `7b4c4c79771f001dff06cf031a5295f457345cb58dbb8f83a3fba8b1e580dc5a` | PASS | checkout phone and hold dial |
| `43-pdf-p23.png` | P | 21 | PyMuPDF, 110 dpi | `48152979b97145ea6b406072133c5a7654671e2653abc22e5f6a9eec7cf1e52e` | PASS | checkout states; F1 late-payment copy correct in the PDF |
| `43-pdf-p24.png` | P | 21 | PyMuPDF, 110 dpi | `5ab5a6656d90b2484903f977d8583b215737cdaad5cc20dcf4565fe81ddd3a0a` | PASS | problem reported |
| `43-pdf-p25.png` | P | 21 | PyMuPDF, 110 dpi | `c74337f638003e76dc293b095a0ece92558bfbff71d12664d8b94a37459f83f3` | PASS | dashboard phone |
| `43-pdf-p26.png` | P | 21 | PyMuPDF, 110 dpi | `a54275cac775dba21c5e81bb89a3ce905770851d460d2e9976ea3cd347e79754` | FINDING G7,G16 | dashboard states; quote line-item fields have no edges; "Evidence due" undated |
| `43-pdf-p27.png` | P | 21 | PyMuPDF, 110 dpi | `4a7ace3ea5af00dabe11e0bfbfaee684936dec888e3754e36fd8eb81bec0b2f4` | PASS | desktop KPIs labelled demo |
| `43-pdf-p28.png` | P | 21 | PyMuPDF, 110 dpi | `e3851080b79857d1b79c87dfdbc6a8ce05c2cc138bdd99412f28b23ca7029173` | FINDING G8,G16 | application; address and band fields have no edges; consent drawn ticked |
| `43-pdf-p29.png` | P | 21 | PyMuPDF, 110 dpi | `8c29199b0dea95ecece37155ba666e6bec88c713df66dfce4fcae2d7a09a623b` | PASS | application states |
| `43-pdf-p30.png` | P | 21 | PyMuPDF, 110 dpi | `4e370e75e82214cb91410cd794d914e80b0a55a6435e57fb83f5191afbed5432` | FINDING G16 | fines phone split across pages 30-31 |
| `43-pdf-p31.png` | P | 21 | PyMuPDF, 110 dpi | `8c997afa04a70d40b43b2e7c54a0263e75e64130c946ef905234bafec6166534` | FINDING G9 | fines states; Search tab highlighted |
| `43-pdf-p32.png` | P | 21 | PyMuPDF, 110 dpi | `05395fa851b885eef018ffea597a113438fb56a04d516bc592518113ff94abdf` | PASS | desktop opener (label orphaned at page foot) |
| `43-pdf-p33.png` | P | 21 | PyMuPDF, 110 dpi | `7ac2adc899e4d81a96b486ced270c7da378fe9a567d220183121364e2e7fe105` | FINDING G16 | desktop home frame clipped on the right ("List your busines", accepted tile cut) |
| `43-pdf-p34.png` | P | 21 | PyMuPDF, 110 dpi | `a4351f82c49167376e14f5f9eec94f29c081546e0ade808305ad05e191dc5337` | FINDING G5,G16 | desktop search clipped on the right ("Sign" cut); 5 businesses vs 4 rows |
| `43-pdf-p35.png` | P | 21 | PyMuPDF, 110 dpi | `491f68a089fd27645a9af4488fcdf88be5866a64a7cc1478594ce70e5334c9dc` | PASS | walkthrough opener and Thandi 01-02 |
| `43-pdf-p36.png` | P | 21 | PyMuPDF, 110 dpi | `9b4ff12ecf9f054229ba86dae148f8c60900239cab0bd7beec64cd25b605b0eb` | PASS | Thandi 03-07, what-ifs |
| `43-pdf-p37.png` | P | 21 | PyMuPDF, 110 dpi | `b568cfbea32a773b8dbfee4e018935b8e681bd407351f835cf694cf259965681` | PASS | Pieter 01-05 |
| `43-pdf-p38.png` | P | 21 | PyMuPDF, 110 dpi | `b57be73c62dd5c91c49767275c8a8d38c576cd9ba27b43970a393270ecadb669` | PASS | Pieter 06-07, what-ifs |
| `43-pdf-p39.png` | P | 21 | PyMuPDF, 110 dpi | `303d33c26acb9d5550729bc5dc801d8a6d532fe9d6d720d6b764a7dbb3254088` | FINDING G10 | roadmap: 0b now, attorney in phase 4 |
| `43-pdf-p40.png` | P | 21 | PyMuPDF, 110 dpi | `46eb0fa7f8c30f45e380f2afebc89cc39bb328875af262f46eddd5a5da2c8060` | FINDING G10 | decisions listed to D-036 |
| `43-pdf-p41.png` | P | 21 | PyMuPDF, 110 dpi | `8c9e7e1571c2c10d4f942ac10a74a5c244c17e302c7a2fce34576f09227f05e5` | FINDING G10 | "Start building (Phase 1)?" still open |
| `43-pdf-p42.png` | P | 21 | PyMuPDF, 110 dpi | `3137dc4267d36e4779161e38dc1b5e229787d2067aaefdb4f2445722f2159d24` | FINDING G10 | footer D-001-D-036 |
| `44-G1-Button-after.png` | M | 13, 17a | mirror.mjs v3 on the working tree after D-066, Button card at 960 px; MIRROR, NOT LIVE | `6372f7dfdc00b1ea57376f13dcfd52196e598831562ff79ee7f96f8a2bc80858` | PASS | G1 fix: outline buttons now edged in --control-edge (3.14:1 on white), clearly visible |
| `44-G1-Chip-after.png` | M | 13, 17a | mirror.mjs v3 on the working tree after D-066, Chip card at 960 px; MIRROR, NOT LIVE | `b17acd51c552cd99313ebed417599d0a8723e172ea63fe0bb8ee629f6de887e9` | PASS | G1 fix: filter chips and time slots now edged in --control-edge (3.14:1 on white), clearly visible |
| `_logs/_capture-log-rerun.json` | C | tools/logs | v2 re-run log: 01-cover-390, 12 motion journey frames, 42-brand-reduced | `d25c8691af35ca599ab9592eece2b0d4b0d928f4f3ab746b3f5147b0b884c1f7` | LOG | reproducibility record, not evidence of design quality |
| `_logs/_capture-log.json` | C | tools/logs | see log | `dc59f33976f5ca397de226c099f7e110cc5dabf822b345dd7be9695523e668aa` | LOG | reproducibility record, not evidence of design quality |
| `_logs/_mirror-log-v2.json` | M | tools/logs | v3 mirror log: width chosen to fit the declared height, fonts loaded per card | `15f20b956956f315cd588029be3f5cfbcfd93e0bc39269cd2b264e918a5f83a1` | LOG | reproducibility record, not evidence of design quality |
| `_logs/_mirror-log.json` | M | tools/logs | mirror render at @dsCard width/height, MIRROR NOT LIVE | `a8139e4683d4fbeb75e7bde7df30098137c3e2d376c813b84eb590cf194bb1b6` | LOG | reproducibility record, not evidence of design quality |
| `_tools/capture.mjs` | tool | tools/logs | source / job list | `ef510156c82863b277526e584443002fb93a89e4c2ab85b9d9e82e6c5456bc0a` | TOOL | reproducibility record, not evidence of design quality |
| `_tools/check.py` | tool | tools/logs | source / job list | `1048ad35145b243dff5f83f615dbc5887fe0f6c16dd60c8ae6d3822cf86e8873` | TOOL | reproducibility record, not evidence of design quality |
| `_tools/jobs-brand-reduced.json` | tool | tools/logs | job for 42-brand-reduced v2 (loads the lazy film first) | `49046c57d68f318faadab1c117dda6020613a2b3304d620d75e9beb023c87254` | TOOL | reproducibility record, not evidence of design quality |
| `_tools/jobs-rerun.json` | tool | tools/logs | job list for the v2 re-run | `0c11143af865c0d6796a69436f9893f29a45fea9773a7bdb5d556ea9c3da8e98` | TOOL | reproducibility record, not evidence of design quality |
| `_tools/jobs.json` | tool | tools/logs | source / job list | `a1b2fe3e236f7e1efb165b8d68a18e23e353b67bbb1fb886369e3f7c51c5ea40` | TOOL | reproducibility record, not evidence of design quality |
| `_tools/mirror.mjs` | tool | tools/logs | source / job list | `bfa63748c4b405235e25e732623127b8f5bb878cc3f423ebe0408f3dcd2913af` | TOOL | reproducibility record, not evidence of design quality |
| `_tools/pdfpage.py` | tool | tools/logs | source / job list | `8e3ce67df4affe0702edfca170d45a961e187684d0f6ca5940b075b597c7f046` | TOOL | reproducibility record, not evidence of design quality |
| `_tools/sample.py` | tool | tools/logs | source / job list | `bba77d97d10789f4d10a585e14b90b9815286ec1b23a3756d8ac4946ed238a8a` | TOOL | reproducibility record, not evidence of design quality |
| `qa-out.txt` | Q | 16, 17, 21 | pack qa.mjs, all widths | `3375306dcfa56755bca129d68305e2f11050bfe3769181d3a0574900e94f5a3d` | PASS | Q: layout equal at all widths, 0 contrast fails at 1440/390 (1055/1032 checked), 28 focus stops all ringed, menu trap and Esc, reduced motion still, no network resources |

Verdict counts: FINDING 43, LOG 4, NOT USED 4, PASS 206, TOOL 8; 265 files in all, plus this index and `owner/.gitkeep`.
