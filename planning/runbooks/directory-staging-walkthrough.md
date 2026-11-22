# Directory workspace walkthrough

The [directory screen plan](https://github.com/CarworX/carworx-new/pull/134) maps each route to its Sites reference and staging acceptance. Use a synthetic business and separate synthetic customer, owner, staff and admin accounts on [protected staging](https://staging.carworx.app). Keep credentials and team links in the private handoff.

| Account | Open | What to verify |
| --- | --- | --- |
| Business owner | `/provider` | Switch between businesses. Open Finish setup on a live listing, save hours and team preferences, refresh, and check the resulting setup cards and history. Cover photo explains when uploads will be available. |
| Staff | Share the link from the owner's Team task | An email-restricted link rejects a different account and remains usable by its intended recipient. Accept once, land at the right business, and save your services and days. Have the owner remove access, then confirm the staff profile link is denied on the next request. |
| Customer | `/account/profile` | Save a display name and reload. Your work shows active memberships with their role and no revoked businesses. Check Notifications and follow the Privacy and data support link. Authenticator and session actions are under Security. |
| Admin | `/admin/today` | Verify with an authenticator. Open the applications, claims and support queues, process synthetic records, and check the results and audit log. Repeat the page request as an ordinary customer and as a listed admin before MFA. |

At desktop and 390 px, compare backed screens with the corresponding [Sites preview](https://carworx.gerrardlewu.chatgpt.site/progress.html). Check scrolling navigation, keyboard focus, form validation, saved state after reload, and empty or unavailable states. Also test home, keyword search, a listing and the enquiry sign-in step.

Record the active Worker version and source commit with these results. Staging deployment, authenticated pages and Sites simulation are separate evidence. Phase 3 covers test bookings, payments and messaging.
