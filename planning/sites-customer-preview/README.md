# CarworX private Sites prototype

Status, 2026-11-05 UTC: customer and business clickable preview, using the Studio concept at `planning/design/concepts/studio/index.html` and Studio brand assets. All businesses, figures, submissions, bookings and payment outcomes are fictional or simulated. It does not alter the Phase 1 application or authorize a production release.

Site source is maintained in the CarworX Sites project. These files record the task-owned prototype source for review. To reproduce, place `app.html`, `app.css`, `app.js` and `home-links.js` in `dist/`, copy the approved brand exports to `dist/assets/`, and Studio font files to `dist/fonts/`; run `build-home.cjs` from the Site root with the Studio concept at the same repository-relative path. Run `node test-preview.cjs` and `node --check dist/app.js` from that root.

Checks: route rendering, search escaping, form transitions, payment simulations, homepage links and assets pass in Node. Visual browser, real-device and assistive-technology verification are outstanding because browser access is disabled in this execution environment. D-060 and production gates remain open.

History: 2026-11-05 UTC — replaced the initial component-gallery Site with the approved Studio homepage and connected synthetic customer, business and fines journeys. Source baseline `bd5d1f2aaae8fef5135a11994312bf9f1d604e56`. Sites deployment status recorded separately in the Site version history.
