# Directory workspace walkthrough

Use a synthetic business and separate synthetic customer, owner, staff and admin accounts on [protected staging](https://staging.carworx.app). Keep credentials and team links in the private handoff. Use staging to review the screens and test real behaviour. ChatGPT Sites is paused.

## Release order

1. Finish the directory's business application and claim journeys. Run the local Worker and database tests, review the exact source with green CI, then deploy that candidate to protected staging.
2. Run the directory walkthrough below, including the application's review outcome and handoff to business setup. Record failures by route and role and repeat the affected journeys on the next reviewed staging build.
3. Prepare the Phase 3 candidate separately under D-093. Bring across the verified directory baseline, configure test payments, then test bookings, quotes, checkout and messaging on protected staging with synthetic users. The [Phase 3 plan](https://github.com/CarworX/carworx-new/pull/134) has the shared test cases.

The [finish-build work](https://github.com/CarworX/carworx-new/pull/140) also covers team controls, notification preferences, cover photos, account data and closure, and business ownership. Add each to the hosted walkthrough when its real route and permissions are ready. Claim selection uses the existing proof reference and admin review. File upload belongs to the media work.

| Account | Open | What to verify |
| --- | --- | --- |
| Applicant | `/provider/get-listed/business` | Start from the home-page business link. Enter a synthetic business, save and exit, sign in again and check the draft. Complete services, location and hours, review and submit. Check the dashboard for the pending state. With a separate MFA admin, approve the application and verify the public listing and Finish setup. |
| Claimant | `/provider/get-listed/claim` | Search by name, verify that pending listings are absent, and select a live synthetic listing. Confirm the business, provide a synthetic proof reference and submit. Check claim status on the business dashboard. Confirm that a submitted claim alone leaves ownership unchanged. |
| Business owner | `/provider` | Switch between businesses. Open Finish setup on a live listing, save hours and team preferences, refresh, and check the resulting setup cards and history. Cover photo explains when uploads will be available. |
| Staff | Share the link from the owner's Team task | An email-restricted link rejects a different account and remains usable by its intended recipient. Accept once, land at the right business, and save your services and days. Have the owner remove access, then confirm the staff profile link is denied on the next request. |
| Customer | `/account/profile` | Save a display name and reload. Your work shows active memberships with their role and no revoked businesses. Check Notifications and follow the Privacy and data support link. Authenticator and session actions are under Security. |
| Admin | `/admin/today` | Verify with an authenticator. Open the applications, claims and support queues, process synthetic records, and check the results and audit log. Repeat the page request as an ordinary customer and as a listed admin before MFA. |

Test the deployed routes at desktop and 390 px. Check keyboard focus, validation, saved state after reload, and empty or unavailable states. Also test home, keyword search, a listing and the enquiry sign-in step.

Record the active Worker version and source commit with the authenticated test results.
