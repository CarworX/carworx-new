# CarworX customer-facing preview

Approved Studio customer experience and onboarding journeys, using fictional data and simulated actions. This is an inspectable Sites preview; the React Router application remains the real backend foundation.

From this directory run `node --check dist/app.js` and `node test-preview.cjs`. Serve `dist/` to inspect in a browser. No install or external keys are needed. Main app and onboarding assets are local; prototype gallery exports and unused video/image assets are excluded.

Current source is being corrected for independent security review. Passing these checks does not establish real bookings, payments, account security, mail delivery or production readiness. See PR review and deployment records for exact source status.

Publication uses the existing CarworX Sites project and preserves its current restricted audience. GitHub source publication is separate from a successful Sites deployment. The owner has authorized the current refresh and milestone-based future updates; follow [UPDATE-POLICY.md](UPDATE-POLICY.md). Record the verified deployed version before claiming a source revision is live.
