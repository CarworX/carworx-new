# Local K3 baseline

Work in progress; this does not complete A6 or hosted promotion enforcement.

Pinned Lighthouse 13.6.0 uses its default simulated mobile profile and the existing
Playwright Chromium binary (153.0.8010.12 at initial inspection). Every route has
five serial fresh-browser runs. Median performance/LCP, worst CLS and minimum
accessibility are evaluated against the agreed budgets. No invalid run is dropped.

Run `node --test perf/budgets.test.js`. Build and serve the staged application
locally with the dev-page flag and synthetic loopback configuration, then run
`node perf/local.js http://localhost:8787`. The harness requires 2 GiB available
RAM before launching Chrome. It never targets a hosted origin or sends mail.

Every JSON/HTML report is retained under a private task temporary directory;
reports can include headers and must not be uploaded without sanitization. The
summary identifies the source commit and measurement conditions. Hosted Worker
CPU, staging measurements, CI promotion enforcement and report sanitization remain
subsequent work. Accessibility scores are automated checks, not WCAG compliance.

Current K4 capacity gate: approximately 3.5 GiB free C:, Docker engine unreachable.
Plan for at least 10 GiB free (about 6.5 GiB additional), then measure image,
volume and export requirements plus safety margin. No user files/images are deleted.
