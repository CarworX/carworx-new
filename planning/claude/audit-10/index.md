# C5 evidence package (Claude 09 §4.4)

- **Author:** Claude, 2026-11-04. **Reviewer:** Codex (D-058).
- **Source:** `git archive 5a805b3`, unpacked to `%TEMP%\carworx-audit-5a805b3`. Every script ran in that copy. Nothing ran in the owner's checkout, nothing was installed, and no live account was used.
- **Browser:** headless Chrome via the pack's own `cdp.mjs`.
- **Status:** saved evidence only. **"Saved" is not a pass.** Codex judges each row.

## How to rerun

Run each route in the export root.

| Route | What it runs | Result |
|---|---|---|
| E | `node planning/design/pack/src/export.mjs` | 27 PNGs and the PDF |
| S1 | `node planning/design/concepts/states/qa.mjs stills --approved` | 11 stills |
| S3 | `qa.mjs check --approved` and `qa.mjs contrast --approved` | JSON reports and 3 contrast PNGs |
| Q | `node planning/design/pack/src/qa.mjs > qa-out.txt` | text report |
| C | `node _tools/capture.mjs <root> --jobs _tools/jobs.json <out>` (single-job CLI form also works, see the file header) | captures listed in `_tools/jobs.json` |
| M | `node _tools/mirror.mjs <root> all <out>` | 21 mirror cards |
| P | `python -I _tools/pdfpage.py <pdf> <out>` | 42 PDF pages |
| P | `python -I _tools/sample.py 41-svgtext-390.json <dir> 41-svg-samples.json` | SVG text samples |
| P | `python -I _tools/check.py <dir>` | size and blank checks |

**Deviation from §4.4:** route C runs as a job list in one browser rather than one process per capture. The fields per job are the same, and the CLI form is kept.

## Cycle checks (§4.4: save, open, log)

- **Element count (C, `eval=list`).** 8 phone figures and 31 state panels: home 3, search 4, listing 3, quote 5, checkout 7, dashboard 4, apply 3, fines 2. This matches the expected counts exactly (`00-element-list.json`).
- **Blank or zero-size check (`check.py`).** 133 C/E/S PNGs, 21 mirror PNGs and 42 PDF pages. None failed.
- **Opened with Read** (a sample, not all 259 files):
  - `09-checkout-state-4-…-390.png`
  - `13-thandi-390-05-motion.png`
  - `27-NotFound-mirror.png`
  - `40-focus-1440-05.png`
  - `40-menu-390-trap.png`
  - `41-svg-0.png`

  **Codex should open the rest.**
- **Route M resolver (F6).** 41 distinct `/_blob/` ids across 21 previews. All resolve through `design-system.json` `assetGroups.*.files.*.blob` to a `brand/exports/` file, with 0 unresolved (`_logs/_mirror-log.json`). There are 21 cards: 15 components, Iconography, 4 States cards (NotFound, NotFoundPhone, PageLoader, Loaders) and StickyNote. Every card is **mirror, not live**.

## Observations for Codex (unverified, not findings yet)

1. **Focus stops at 390.** The 390 run captured 23 stops. Tab 24 left focus on `body`, so no file was written for it. Q's 28 stops are measured at 1440. Codex should decide whether 23 is expected at 390, where the nav collapses behind the menu button.
2. **Menu at 390, first attempt.** My CDP `Enter` key event (sent without `text`) did not open the sheet. That is a fault in my tool, not in the pack. The re-run uses `click()`, as Q does:
   - **Open:** the sheet is shown.
   - **Eight tabs:** focus is still in the sheet ("Brand").
   - **Esc:** focus returns to "Open menu".
3. **Thandi journey at 390, motion, scroll 0.5** (`13-thandi-390-05-motion.png`):
   - The fixed nav covers the top of step 01.
   - The area above the steps is blank in that frame.

   The reduced and settled versions are saved alongside for comparison.
4. **SVG text (`41-svg-samples.json`).** The 3 white map-pin numbers "fail" at 1.21:1. **This is a sampler artefact.** The ring sampled 3 px outside the text box lands on the beige map, not on the black pin disc the text actually sits on (seen in `41-svg-0.png`). The other 5 SVG texts pass. A tighter ring, or sampling the disc fill, is needed before row 17 can count.
5. **Row 17a.** The control images per default/focused state are covered by the row 16 focus captures. There are no separate `41a-<control>-*.png`. Computed border, outline and fill are in `41a-nontext-*.json`. Contrast still has to be computed from them.

## Blocked rows (unchanged)

These need the owner (route O):

| Row | What it needs |
|---|---|
| 13 and 14, live cards | The signed-in design system |
| 15 | Screenshots at 200% zoom |
| 19 | VoiceOver or TalkBack |
| 20 | Real phones and browsers |

The folder `owner/` is empty.

## Files

| File | Route | Row | Capture conditions | SHA-256 (first 16) | Result |
|---|---|---|---|---|---|
| `00-element-list.json` | C | 3–10 (count check) | see log | `25f09076055817ad…` | saved |
| `01-cover-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `978c06ff4f86450a…` | saved |
| `01-cover-390.png` | C | 1 | `#skip` `#cover`, 390px ×2, settled | `259351d3ccf841e9…` | saved |
| `02-summary-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `95fb7e155259ebac…` | saved |
| `02-summary-390.png` | C | 1 | `#skip` `#summary`, 390px ×2, settled | `34e2ffd2023922d9…` | saved |
| `03-brand-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `2b1e1df5a8ca574f…` | saved |
| `03-brand-390.png` | C | 1 | `#skip` `#brand`, 390px ×2, settled | `ab7580309aa4e039…` | saved |
| `03-intro-1440.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `ac55dd21bd0538d9…` | saved |
| `03-intro-390.png` | E | 1 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `5a7e694d88a6ef7a…` | saved |
| `04-home-1440.png` | E | 2 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `bf091a9abdf4b2da…` | saved |
| `04-home-360.png` | C | 2 | `#skip` `#s-home`, 360px ×2, settled | `543bd4c0415ddf71…` | saved |
| `04-home-390.png` | E | 2 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `21892ac8ee4f2071…` | saved |
| `04-home-768.png` | C | 2 | `#skip` `#s-home`, 768px ×1, settled | `abc67b91f170d213…` | saved |
| `05-desktop-home-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `ebd75094aef7139e…` | saved |
| `05-desktop-search-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `a9699f3b0fb88e13…` | saved |
| `05-home-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `bf091a9abdf4b2da…` | saved |
| `05-home-phone-390.png` | C | 3–10 | `#skip` `#s-home figure.phone`, 390px ×2, settled | `33b369518c6b69ff…` | saved |
| `05-home-state-1-limited-supply-390.png` | C | 3–10 | `#skip` `#s-home .states > .state:nth-child(1)`, 390px ×2, settled | `7473b105aa026f72…` | saved |
| `05-home-state-2-no-location-yet-390.png` | C | 3–10 | `#skip` `#s-home .states > .state:nth-child(2)`, 390px ×2, settled | `4c0d13af378afebb…` | saved |
| `05-home-state-3-error-390.png` | C | 3–10 | `#skip` `#s-home .states > .state:nth-child(3)`, 390px ×2, settled | `e0f526ee26df1847…` | saved |
| `06-search-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `16d31173d0a86b58…` | saved |
| `06-search-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `cb30f54e8fd4c4db…` | saved |
| `06-search-phone-390.png` | C | 3–10 | `#skip` `#s-search figure.phone`, 390px ×2, settled | `b4f642f56da1e981…` | saved |
| `06-search-state-1-map-optional-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(1)`, 390px ×2, settled | `1c1c9dccc78fc1f5…` | saved |
| `06-search-state-2-nothing-nearby-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(2)`, 390px ×2, settled | `b7a8474504fd7a43…` | saved |
| `06-search-state-3-search-widened-by-you-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(3)`, 390px ×2, settled | `c3f7e7cd9079223b…` | saved |
| `06-search-state-4-could-not-load-390.png` | C | 3–10 | `#skip` `#s-search .states > .state:nth-child(4)`, 390px ×2, settled | `e151889a2ef16210…` | saved |
| `07-listing-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `03e89042d5c94829…` | saved |
| `07-listing-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `5da251cca134c474…` | saved |
| `07-listing-phone-390.png` | C | 3–10 | `#skip` `#s-listing figure.phone`, 390px ×2, settled | `c5c781bf01728e51…` | saved |
| `07-listing-state-1-business-paused-390.png` | C | 3–10 | `#skip` `#s-listing .states > .state:nth-child(1)`, 390px ×2, settled | `02e899eb9cd76071…` | saved |
| `07-listing-state-2-wash-bay-with-an-address-390.png` | C | 3–10 | `#skip` `#s-listing .states > .state:nth-child(2)`, 390px ×2, settled | `dd55bb7b6aa3b6ee…` | saved |
| `07-listing-state-3-enquiries-only-390.png` | C | 3–10 | `#skip` `#s-listing .states > .state:nth-child(3)`, 390px ×2, settled | `e55c773f9022a6d3…` | saved |
| `08-quote-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `c0ea6ba04a34ac5e…` | saved |
| `08-quote-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `24f971bda1be8da5…` | saved |
| `08-quote-phone-390.png` | C | 3–10 | `#skip` `#s-quote figure.phone`, 390px ×2, settled | `8241104d88e1ac67…` | saved |
| `08-quote-state-1-waiting-for-the-business-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(1)`, 390px ×2, settled | `6b63a155d616c7ec…` | saved |
| `08-quote-state-2-no-reply-in-time-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(2)`, 390px ×2, settled | `b0a18a92b324fa2e…` | saved |
| `08-quote-state-3-quote-expired-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(3)`, 390px ×2, settled | `2d84af420c13e7cc…` | saved |
| `08-quote-state-4-change-quote-during-work-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(4)`, 390px ×2, settled | `85c3130225df50b3…` | saved |
| `08-quote-state-5-travel-charge-390.png` | C | 3–10 | `#skip` `#s-quote .states > .state:nth-child(5)`, 390px ×2, settled | `2702a88c2680c59e…` | saved |
| `09-checkout-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `8f3338968a77352c…` | saved |
| `09-checkout-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `ad97c23e1c9d8d29…` | saved |
| `09-checkout-phone-390.png` | C | 3–10 | `#skip` `#s-checkout figure.phone`, 390px ×2, settled | `1bc4117159214ea7…` | saved |
| `09-checkout-state-1-checking-payment-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(1)`, 390px ×2, settled | `5c015906abcc965b…` | saved |
| `09-checkout-state-2-payment-failed-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(2)`, 390px ×2, settled | `9f0f6c9b4f83a8ad…` | saved |
| `09-checkout-state-3-hold-expired-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(3)`, 390px ×2, settled | `fe1b559d357a72b0…` | saved |
| `09-checkout-state-4-paid-needs-sorting-out-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(4)`, 390px ×2, settled | `18eaa00b1a20a67f…` | saved |
| `09-checkout-state-5-confirmed-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(5)`, 390px ×2, settled | `74d2de1f85573168…` | saved |
| `09-checkout-state-6-cancelled-refund-processing-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(6)`, 390px ×2, settled | `36bd924ee8cdc7bc…` | saved |
| `09-checkout-state-7-problem-reported-390.png` | C | 3–10 | `#skip` `#s-checkout .states > .state:nth-child(7)`, 390px ×2, settled | `bbc8324a8e5b2a88…` | saved |
| `10-dashboard-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `67e38363b465eec7…` | saved |
| `10-dashboard-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `f1556fc42fe5e8cc…` | saved |
| `10-dashboard-phone-390.png` | C | 3–10 | `#skip` `#s-dashboard figure.phone`, 390px ×2, settled | `2819ce21b4dc4e51…` | saved |
| `10-dashboard-state-1-write-a-quote-workshop-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(1)`, 390px ×2, settled | `4b4bda512ad43cdd…` | saved |
| `10-dashboard-state-2-confirmed-mobile-job-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(2)`, 390px ×2, settled | `db584a8c5c9d734e…` | saved |
| `10-dashboard-state-3-your-listing-is-paused-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(3)`, 390px ×2, settled | `d85fdf20714f75d7…` | saved |
| `10-dashboard-state-4-dispute-on-a-payment-390.png` | C | 3–10 | `#skip` `#s-dashboard .states > .state:nth-child(4)`, 390px ×2, settled | `7cd596a93c0101ff…` | saved |
| `11-apply-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `7860c7bb29f759a6…` | saved |
| `11-apply-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `9e0f76cf2c8a7c7c…` | saved |
| `11-apply-phone-390.png` | C | 3–10 | `#skip` `#s-apply figure.phone`, 390px ×2, settled | `bc2cea0fc3b15046…` | saved |
| `11-apply-state-1-under-review-390.png` | C | 3–10 | `#skip` `#s-apply .states > .state:nth-child(1)`, 390px ×2, settled | `9d6c2441bfad0295…` | saved |
| `11-apply-state-2-we-need-one-more-thing-390.png` | C | 3–10 | `#skip` `#s-apply .states > .state:nth-child(2)`, 390px ×2, settled | `0485870a6e7cdd52…` | saved |
| `11-apply-state-3-live-with-labels-390.png` | C | 3–10 | `#skip` `#s-apply .states > .state:nth-child(3)`, 390px ×2, settled | `0e024b81b7d22a0f…` | saved |
| `12-fines-1440.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `3a059325f144985f…` | saved |
| `12-fines-390.png` | E | 3–10 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `e4aaa1102c9ff26f…` | saved |
| `12-fines-phone-390.png` | C | 3–10 | `#skip` `#s-fines figure.phone`, 390px ×2, settled | `631f8ba2ee2f6d56…` | saved |
| `12-fines-state-1-leaving-carworx-390.png` | C | 3–10 | `#skip` `#s-fines .states > .state:nth-child(1)`, 390px ×2, settled | `e88097f69407e37c…` | saved |
| `12-fines-state-2-built-in-lookup-not-planned-yet-390.png` | C | 3–10 | `#skip` `#s-fines .states > .state:nth-child(2)`, 390px ×2, settled | `a655a93d6aed0a6b…` | saved |
| `13-thandi-1440-0-motion.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, motion, scroll=0 | `97a574139dbe45f9…` | saved |
| `13-thandi-1440-0-reduced.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, reduced, scroll=0 | `35b817d6c5b484f9…` | saved |
| `13-thandi-1440-05-motion.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, motion, scroll=.5 | `885c869920a17389…` | saved |
| `13-thandi-1440-05-reduced.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, reduced, scroll=.5 | `7394cd47959626e4…` | saved |
| `13-thandi-1440-1-motion.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, motion, scroll=1 | `de99cd5838e739a6…` | saved |
| `13-thandi-1440-1-reduced.png` | C | 11 | `#skip` `#j-thandi`, 1440px ×1, reduced, scroll=1 | `18e8cafc16a22f51…` | saved |
| `13-thandi-1440-settled.png` | E | 11 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `6674236f71115eea…` | saved |
| `13-thandi-390-0-motion.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, motion, scroll=0 | `5e0695e27707a75b…` | saved |
| `13-thandi-390-0-reduced.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, reduced, scroll=0 | `9662c617ca751aec…` | saved |
| `13-thandi-390-05-motion.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, motion, scroll=.5 | `7d121bf56d337bcf…` | saved |
| `13-thandi-390-05-reduced.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, reduced, scroll=.5 | `373078513383acc0…` | saved |
| `13-thandi-390-1-motion.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, motion, scroll=1 | `5454221e0f2b13bd…` | saved |
| `13-thandi-390-1-reduced.png` | C | 11 | `#skip` `#j-thandi`, 390px ×1, reduced, scroll=1 | `aa8f6c57ce8772c3…` | saved |
| `14-pieter-1440-0-motion.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, motion, scroll=0 | `21a0d1e9c391c9db…` | saved |
| `14-pieter-1440-0-reduced.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, reduced, scroll=0 | `d9d324153749ec49…` | saved |
| `14-pieter-1440-05-motion.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, motion, scroll=.5 | `7b9498593177c4bf…` | saved |
| `14-pieter-1440-05-reduced.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, reduced, scroll=.5 | `60ac24d22f1427e2…` | saved |
| `14-pieter-1440-1-motion.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, motion, scroll=1 | `de9fdcafa7d6676d…` | saved |
| `14-pieter-1440-1-reduced.png` | C | 11 | `#skip` `#j-pieter`, 1440px ×1, reduced, scroll=1 | `f6ebe02228709530…` | saved |
| `14-pieter-1440-settled.png` | E | 11 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `e9a48d4fcb761c1e…` | saved |
| `14-pieter-390-0-motion.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, motion, scroll=0 | `48bad5bcd9cfbc5d…` | saved |
| `14-pieter-390-0-reduced.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, reduced, scroll=0 | `557dd1454ee14397…` | saved |
| `14-pieter-390-05-motion.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, motion, scroll=.5 | `1d60ffa65a30e431…` | saved |
| `14-pieter-390-05-reduced.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, reduced, scroll=.5 | `a9ef2778cc4465e3…` | saved |
| `14-pieter-390-1-motion.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, motion, scroll=1 | `6c1f411bf86802af…` | saved |
| `14-pieter-390-1-reduced.png` | C | 11 | `#skip` `#j-pieter`, 390px ×1, reduced, scroll=1 | `d7a4d0f9a0dea5be…` | saved |
| `15-footer-1440.png` | E | 12 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `51a9d58846bb485e…` | saved |
| `15-roadmap-1440.png` | E | 12 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `314a9aaf80f97bff…` | saved |
| `16-BookingTile-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `2b1a7ddb82afad91…` | saved |
| `17-Button-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `ceb8c052601e69f0…` | saved |
| `18-Chip-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `0883b6b8d51c44bf…` | saved |
| `19-Cover-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `38de8730af6473a2…` | saved |
| `20-EmptyState-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `b55114c42ec4cd3f…` | saved |
| `21-Field-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `53982fd1f25bdd44…` | saved |
| `22-HoldDial-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `017e7a598b8e89e8…` | saved |
| `23-Iconography-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `73152aeabd9da98a…` | saved |
| `24-KpiCard-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `fdb1e02501a918de…` | saved |
| `25-Loaders-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `9781ff5b43f0c558…` | saved |
| `26-NavBar-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `60b8b013272c3ab8…` | saved |
| `27-NotFound-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `091a1d712c937ea4…` | saved |
| `28-NotFoundPhone-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `0037dabc3ea870eb…` | saved |
| `29-PageLoader-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `3c6c2c9b3061b36e…` | saved |
| `30-PhoneFrame-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `30a927e8f81c524f…` | saved |
| `31-ReceiptQuote-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `1bf03bd7d3446d8f…` | saved |
| `32-01-404-desktop.png` | S1 | 14 | qa.mjs stills --approved | `f17768e92611c614…` | saved |
| `32-02-404-desktop-still.png` | S1 | 14 | qa.mjs stills --approved | `737bc66efad50d6d…` | saved |
| `32-03-404-phone.png` | S1 | 14 | qa.mjs stills --approved | `c15d5b31e5be1705…` | saved |
| `32-04-404-phone-still.png` | S1 | 14 | qa.mjs stills --approved | `07be35c7033020b0…` | saved |
| `32-05-404-phone-frame.png` | S1 | 14 | qa.mjs stills --approved | `58f65770d1117d99…` | saved |
| `32-06-between-filling.png` | S1 | 14 | qa.mjs stills --approved | `e7f0482bce264779…` | saved |
| `32-07-between-black.png` | S1 | 14 | qa.mjs stills --approved | `3b19ff7f21709bd9…` | saved |
| `32-08-between-draining.png` | S1 | 14 | qa.mjs stills --approved | `1a8690a6cadeb9ac…` | saved |
| `32-09-between-still.png` | S1 | 14 | qa.mjs stills --approved | `1e7c3dee9b0780c1…` | saved |
| `32-10-board.png` | S1 | 14 | qa.mjs stills --approved | `79b02db79c1575e3…` | saved |
| `32-11-board-mobile.png` | S1 | 14 | qa.mjs stills --approved | `8228758e94b859a9…` | saved |
| `32-ResultCard-mirror.png` | M | 14 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `07ca4756c050725c…` | saved |
| `33-ServiceKey-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `4fd14deed67ffd2b…` | saved |
| `34-StatusNote-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `92ef6c7a5c4d2c72…` | saved |
| `35-StepList-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `4c25d4a4d7051221…` | saved |
| `36-StickyNote-mirror.png` | M | 13 | mirror render at @dsCard width/height, MIRROR NOT LIVE | `45b028e37ebdb52a…` | saved |
| `37-states-qa.json` | S3 | 14 | qa.mjs check/contrast --approved | `2b2d0980218e7a19…` | saved |
| `40-focus-1440-01.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=1 | `cfcef24a0ec13aa1…` | saved |
| `40-focus-1440-02.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=2 | `f73e5d7b9bd830fc…` | saved |
| `40-focus-1440-03.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=3 | `84bcc11f0df5a3ec…` | saved |
| `40-focus-1440-04.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=4 | `b7fbc3e95789280d…` | saved |
| `40-focus-1440-05.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=5 | `5ca960e85718f2d5…` | saved |
| `40-focus-1440-06.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=6 | `399d7461a5d921cd…` | saved |
| `40-focus-1440-07.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=7 | `9c1dd70bf4c3d686…` | saved |
| `40-focus-1440-08.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=8 | `5fc29552a225273d…` | saved |
| `40-focus-1440-09.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=9 | `424e784e98c943ba…` | saved |
| `40-focus-1440-10.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=10 | `b895c6e35e115074…` | saved |
| `40-focus-1440-11.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=11 | `3d8abb91f393288c…` | saved |
| `40-focus-1440-12.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=12 | `58dbab114d994325…` | saved |
| `40-focus-1440-13.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=13 | `93f2358bc509ebc5…` | saved |
| `40-focus-1440-14.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=14 | `442f79a892c404b9…` | saved |
| `40-focus-1440-15.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=15 | `970a9e97de30030a…` | saved |
| `40-focus-1440-16.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=16 | `b59ab30614cc7dcf…` | saved |
| `40-focus-1440-17.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=17 | `ba2e89dcb13a2bb6…` | saved |
| `40-focus-1440-18.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=18 | `1764e4b8d5da4a61…` | saved |
| `40-focus-1440-19.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=19 | `819d6e5046cf5ff1…` | saved |
| `40-focus-1440-20.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=20 | `a716b46cf1d37fed…` | saved |
| `40-focus-1440-21.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=21 | `26f1856cf9df2f81…` | saved |
| `40-focus-1440-22.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=22 | `5167138f33c741ca…` | saved |
| `40-focus-1440-23.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=23 | `c1351fb94677556e…` | saved |
| `40-focus-1440-24.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=24 | `459903040dba2af2…` | saved |
| `40-focus-1440-25.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=25 | `288440e10a51c22c…` | saved |
| `40-focus-1440-26.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=26 | `1f423b93de33f47b…` | saved |
| `40-focus-1440-27.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=27 | `e42fcd49fe6a4844…` | saved |
| `40-focus-1440-28.png` | C | 16 | `#skip` `:focus`, 1440px ×1, settled, tabs=28 | `87158e9ca1e83f7b…` | saved |
| `40-focus-390-01.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=1 | `5ce614be05a23e58…` | saved |
| `40-focus-390-02.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=2 | `282bed774cc862d5…` | saved |
| `40-focus-390-03.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=3 | `19bafbaf43f5b7a3…` | saved |
| `40-focus-390-04.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=4 | `1ee7c3c7259c3df7…` | saved |
| `40-focus-390-05.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=5 | `981f378dd4dc3a9a…` | saved |
| `40-focus-390-06.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=6 | `793c9dcca548fc56…` | saved |
| `40-focus-390-07.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=7 | `df20569ce3482feb…` | saved |
| `40-focus-390-08.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=8 | `20510d7fb11a8876…` | saved |
| `40-focus-390-09.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=9 | `b80e48732e238159…` | saved |
| `40-focus-390-10.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=10 | `a2ecd85ba4178556…` | saved |
| `40-focus-390-11.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=11 | `282742620ed033af…` | saved |
| `40-focus-390-12.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=12 | `1cd92a9a43e2cfc6…` | saved |
| `40-focus-390-13.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=13 | `d27937b4763fad73…` | saved |
| `40-focus-390-14.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=14 | `256f45e271220447…` | saved |
| `40-focus-390-15.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=15 | `d70e4c9cdc066214…` | saved |
| `40-focus-390-16.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=16 | `cadfc1097ab9fa46…` | saved |
| `40-focus-390-17.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=17 | `21689533a190ef15…` | saved |
| `40-focus-390-18.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=18 | `17355f4f087e7328…` | saved |
| `40-focus-390-19.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=19 | `f402c38c257b0ac4…` | saved |
| `40-focus-390-20.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=20 | `fd30b8328334cdae…` | saved |
| `40-focus-390-21.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=21 | `31046e5f00640a5e…` | saved |
| `40-focus-390-22.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=22 | `fa0a7183e5955ceb…` | saved |
| `40-focus-390-23.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=23 | `80e0ebe44d74b02a…` | saved |
| `40-focus-390-25.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=25 | `da0703ef707e53c6…` | saved |
| `40-focus-390-26.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=26 | `6e17367766f97836…` | saved |
| `40-focus-390-27.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=27 | `f8398409d4a585f8…` | saved |
| `40-focus-390-28.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=28 | `981f378dd4dc3a9a…` | saved |
| `40-menu-390-esc.png` | C | 16 | `#skip` `.menu-btn`, 390px ×1, settled, keys=Escape, pre=JS (see jobs.json) | `862fdb15a4287683…` | saved |
| `40-menu-390-open.png` | C | 16 | `#skip` `.sheet`, 390px ×1, settled, pre=JS (see jobs.json) | `0084d552bbf195f4…` | saved |
| `40-menu-390-trap.png` | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=8, pre=JS (see jobs.json) | `19b96cfc027d4446…` | saved |
| `40a-targets-360.json` | C | 16 | `#skip` `body`, 360px ×1, settled, eval=targets | `9d260dcf352cc7be…` | saved |
| `40a-targets-390.json` | C | 16 | `#skip` `body`, 390px ×1, settled, eval=targets | `f16b8594b5b9c36f…` | saved |
| `40b-axtree-1440.json` | C | 16 | `#skip` `body`, 1440px ×1, settled, eval=ax | `305b843f1b5a513f…` | saved |
| `40b-axtree-390.json` | C | 16 | `#skip` `body`, 390px ×1, settled, eval=ax | `ce3ef6ff14ac36c8…` | saved |
| `41-states-contrast.json` | S3 | 17 | qa.mjs check/contrast --approved | `38b9674359804af7…` | saved |
| `41-states_contrast-1280.png` | S3 | 17 | qa.mjs check/contrast --approved | `6e2313f8e24ea3b1…` | saved |
| `41-states_contrast-1440.png` | S3 | 17 | qa.mjs check/contrast --approved | `80c9cce643017ac8…` | saved |
| `41-states_contrast-390.png` | S3 | 17 | qa.mjs check/contrast --approved | `b91fbdae7f81d0aa…` | saved |
| `41-svg-0.png` | C | 17 | `#skip` `[data-cx]` nth=0, 390px ×2, settled, pre=JS (see jobs.json) | `dca14042a32bc3f7…` | saved |
| `41-svg-1.png` | C | 17 | `#skip` `[data-cx]` nth=1, 390px ×2, settled, pre=JS (see jobs.json) | `a5df068d536741ea…` | saved |
| `41-svg-samples.json` | C | 17 | see log | `38fed2e4193314e0…` | saved |
| `41-svgtext-390.json` | C | 17 | see log | `d58af2252bdbf81a…` | saved |
| `41a-nontext-1440.json` | C | 17 | `#skip` `body`, 1440px ×1, settled, eval=nontext | `778db305962a52ba…` | saved |
| `41a-nontext-390.json` | C | 17 | `#skip` `body`, 390px ×1, settled, eval=nontext | `4022c1aad3d958ad…` | saved |
| `42-brand-reduced.png` | C | 18 | `#skip` `#brand`, 1440px ×1, reduced | `6cde89944e56e97b…` | saved |
| `42-cover-reduced.png` | C | 18 | `#skip` `#cover`, 1440px ×1, reduced | `61a7f62e0d2e0470…` | saved |
| `42-j-pieter-reduced.png` | C | 18 | `#skip` `#j-pieter`, 1440px ×1, reduced | `cfc9e9ef2de5b1e7…` | saved |
| `42-j-thandi-reduced.png` | C | 18 | `#skip` `#j-thandi`, 1440px ×1, reduced | `df3a345ccf2b6fb3…` | saved |
| `42-s-home-reduced.png` | C | 18 | `#skip` `#s-home`, 1440px ×1, reduced | `3fd44a250438a249…` | saved |
| `43-pack.pdf` | E | 21 | export.mjs fixed list (settled; 1440 ×1 unless named 390 ×2) | `2fb2eb09e0131813…` | saved |
| `43-pdf-p01.png` | P | 21 | PyMuPDF, 110 dpi | `3916fe6183edb05c…` | saved |
| `43-pdf-p02.png` | P | 21 | PyMuPDF, 110 dpi | `0b0f9aa53a73031f…` | saved |
| `43-pdf-p03.png` | P | 21 | PyMuPDF, 110 dpi | `22ed1bf14cf50c82…` | saved |
| `43-pdf-p04.png` | P | 21 | PyMuPDF, 110 dpi | `6836fdb9bb2a6624…` | saved |
| `43-pdf-p05.png` | P | 21 | PyMuPDF, 110 dpi | `1c63d58c6e134596…` | saved |
| `43-pdf-p06.png` | P | 21 | PyMuPDF, 110 dpi | `e4867118cab468a8…` | saved |
| `43-pdf-p07.png` | P | 21 | PyMuPDF, 110 dpi | `4d08dad46426237e…` | saved |
| `43-pdf-p08.png` | P | 21 | PyMuPDF, 110 dpi | `6c069e4607813d58…` | saved |
| `43-pdf-p09.png` | P | 21 | PyMuPDF, 110 dpi | `160bafa876e7db73…` | saved |
| `43-pdf-p10.png` | P | 21 | PyMuPDF, 110 dpi | `461dc4339115d19f…` | saved |
| `43-pdf-p11.png` | P | 21 | PyMuPDF, 110 dpi | `771e4b0c175b070f…` | saved |
| `43-pdf-p12.png` | P | 21 | PyMuPDF, 110 dpi | `55ec4fd5d89dd89e…` | saved |
| `43-pdf-p13.png` | P | 21 | PyMuPDF, 110 dpi | `5231d2da523f5af9…` | saved |
| `43-pdf-p14.png` | P | 21 | PyMuPDF, 110 dpi | `18559fe61d9a221e…` | saved |
| `43-pdf-p15.png` | P | 21 | PyMuPDF, 110 dpi | `f4fecf01e078d391…` | saved |
| `43-pdf-p16.png` | P | 21 | PyMuPDF, 110 dpi | `abba8b0b72741612…` | saved |
| `43-pdf-p17.png` | P | 21 | PyMuPDF, 110 dpi | `d0f394aff61e1e8d…` | saved |
| `43-pdf-p18.png` | P | 21 | PyMuPDF, 110 dpi | `e33b97da4ef36806…` | saved |
| `43-pdf-p19.png` | P | 21 | PyMuPDF, 110 dpi | `59a1b623b0090881…` | saved |
| `43-pdf-p20.png` | P | 21 | PyMuPDF, 110 dpi | `2630141d3dbb809e…` | saved |
| `43-pdf-p21.png` | P | 21 | PyMuPDF, 110 dpi | `5be2c5cfec16f9ea…` | saved |
| `43-pdf-p22.png` | P | 21 | PyMuPDF, 110 dpi | `7b4c4c79771f001d…` | saved |
| `43-pdf-p23.png` | P | 21 | PyMuPDF, 110 dpi | `48152979b97145ea…` | saved |
| `43-pdf-p24.png` | P | 21 | PyMuPDF, 110 dpi | `5ab5a6656d90b248…` | saved |
| `43-pdf-p25.png` | P | 21 | PyMuPDF, 110 dpi | `c74337f638003e76…` | saved |
| `43-pdf-p26.png` | P | 21 | PyMuPDF, 110 dpi | `a54275cac775dba2…` | saved |
| `43-pdf-p27.png` | P | 21 | PyMuPDF, 110 dpi | `4a7ace3ea5af00da…` | saved |
| `43-pdf-p28.png` | P | 21 | PyMuPDF, 110 dpi | `e3851080b79857d1…` | saved |
| `43-pdf-p29.png` | P | 21 | PyMuPDF, 110 dpi | `8c29199b0dea95ec…` | saved |
| `43-pdf-p30.png` | P | 21 | PyMuPDF, 110 dpi | `4e370e75e82214cb…` | saved |
| `43-pdf-p31.png` | P | 21 | PyMuPDF, 110 dpi | `8c997afa04a70d40…` | saved |
| `43-pdf-p32.png` | P | 21 | PyMuPDF, 110 dpi | `05395fa851b885ee…` | saved |
| `43-pdf-p33.png` | P | 21 | PyMuPDF, 110 dpi | `7ac2adc899e4d81a…` | saved |
| `43-pdf-p34.png` | P | 21 | PyMuPDF, 110 dpi | `a4351f82c4916737…` | saved |
| `43-pdf-p35.png` | P | 21 | PyMuPDF, 110 dpi | `491f68a089fd2764…` | saved |
| `43-pdf-p36.png` | P | 21 | PyMuPDF, 110 dpi | `9b4ff12ecf9f0542…` | saved |
| `43-pdf-p37.png` | P | 21 | PyMuPDF, 110 dpi | `b568cfbea32a773b…` | saved |
| `43-pdf-p38.png` | P | 21 | PyMuPDF, 110 dpi | `b57be73c62dd5c91…` | saved |
| `43-pdf-p39.png` | P | 21 | PyMuPDF, 110 dpi | `303d33c26acb9d55…` | saved |
| `43-pdf-p40.png` | P | 21 | PyMuPDF, 110 dpi | `46eb0fa7f8c30f45…` | saved |
| `43-pdf-p41.png` | P | 21 | PyMuPDF, 110 dpi | `8c9e7e1571c2c10d…` | saved |
| `43-pdf-p42.png` | P | 21 | PyMuPDF, 110 dpi | `3137dc4267d36e47…` | saved |
| `_logs/_capture-log.json` | C | tools/logs | see log | `e0ff92ad4f648055…` | saved |
| `_logs/_mirror-log.json` | M | tools/logs | mirror render at @dsCard width/height, MIRROR NOT LIVE | `a8139e4683d4fbeb…` | saved |
| `_tools/capture.mjs` | tool | tools/logs | source / job list | `10adf1b99d237ba0…` | saved |
| `_tools/check.py` | tool | tools/logs | source / job list | `1048ad35145b243d…` | saved |
| `_tools/jobs.json` | tool | tools/logs | source / job list | `427a4a0cd6e39e00…` | saved |
| `_tools/mirror.mjs` | tool | tools/logs | source / job list | `0f6c9bab3a3b6297…` | saved |
| `_tools/pdfpage.py` | tool | tools/logs | source / job list | `8e3ce67df4affe07…` | saved |
| `_tools/sample.py` | tool | tools/logs | source / job list | `f6651ecd03b1963d…` | saved |
| `qa-out.txt` | Q | 16, 17, 21 | pack qa.mjs, all widths | `3375306dcfa56755…` | saved |
| `40-focus-390-24.png` (no file) | C | 16 | `#skip` `:focus`, 390px ×1, settled, tabs=24 | — | FAIL: selector matched nothing |