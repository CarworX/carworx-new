# Business, staff, account and admin screens on staging

Owner request, 2026-11-22 SAST. Complements [booking staging plan](phase3-staging-test-plan.md). This is the page-by-page implementation and verification plan, not a claim that any of these hosted journeys has passed.

## Baseline and design contract

Inspected main `70d10b5fb9f8de119a58d3f9a85316134dc52964`, particularly `apps/web/app/auth/routes.ts`, `routes/provider.tsx`, `routes/provider.setup.$task.$step.tsx`, `routes/account.$tab.tsx` and registered admin routes. Many pages have existing loaders/actions; they need design ports and hosted verification rather than wholesale backend replacement. Whether a page is missing, unreachable, unstyled, blocked by membership/MFA or genuinely unavailable must be recorded separately during the route audit.

Use the existing CarworX app layout, components and design tokens. Use protected staging to review actual screens, actions and data. The owner paused ChatGPT Sites on 2026-11-23.

These groups target `main` for the directory release. Booking, quote, earnings, payment, chat and review functionality that depends on Phase 3 remains on `phase-3`; link only when that capability is actually deployed. Integrate directory changes into the separate Phase 3 candidate before its hosted test round. Do not promote #102 just to expose a directory settings page.

## Group 1 — business home and setup

Reference: `dist/onboarding/setup/index.html`, plus the existing provider dashboard preview. App: `routes/provider.tsx`, `routes/provider.setup.$task.$step.tsx`, `routes/provider.hours.$publicId.tsx`, team/onboarding modules.

| Screen | App destination / behavior | Completion evidence |
|---|---|---|
| Business home / organisation selection | `/provider`; choose only an active membership's organisation; show actual application, claim and listing states | Owner with two synthetic organisations can switch; unrelated organisations never appear |
| Setup hub and progress | Provider dashboard or a registered setup-hub route; derive completion from persisted records, not local switches | Refresh preserves completed tasks; no fabricated booking/revenue counts |
| Team start, role choice and share | `/provider/setup/team/start`, `/role`, `/share`; call existing invite action | Link created for selected organisation and allowed role; expiry/revocation shown; no secret in logs |
| Booking assignment preference | `/provider/setup/assign/start`; save the existing business preference | Reload confirms persistence; directory does not imply live booking allocation |
| Staff contact visibility | `/provider/setup/contact/start`; existing owner-only setting | Owner can save; manager/staff cannot view or change protected owner setting |
| Services and working days | `/provider/setup/profile/start`; current staff-profile action | Allowed services/days persist; cannot edit another membership by changing identifiers |
| Business opening hours | `/provider/hours/:publicId`; preserve per-day editor from #113 | Valid hours survive reload; invalid/overlapping input produces inline errors |
| Cover photo | `/provider/setup/cover/start` currently says uploads are deferred | Preserve design and honest unavailable state. A real uploader requires a separately scoped storage/privacy implementation before its button can claim success |
| Team changes | `/provider/setup/history/start`; existing sanitized team history | Persisted changes appear without invite secrets or unnecessary personal data; empty/failure states work |

Keep application approval, listing publication and claim/dispute/resubmission actions server-authoritative. Connect the setup entry after application acceptance; a user cannot make their application approved by following a preview URL.

## Group 2 — staff invitation and staff home

Reference: `dist/onboarding/staff/index.html`, relevant setup/team screens. App: `routes/join.$token.tsx`, provider setup/profile/team server modules; inspect existing membership operations before adding any endpoint.

| Screen | App destination / behavior | Completion evidence |
|---|---|---|
| Invite landing | `/join/:token`; load bounded invite state without exposing private team details | Valid, expired, used, revoked and unknown links have distinct safe outcomes |
| Sign in / sign up and return | Existing Auth routes with validated `returnTo` | Invite survives the Auth round trip; wrong-account flow cannot consume another person's invite |
| Accept invitation | Existing join action; membership created transactionally | One acceptance creates one membership; repeat/racing acceptance causes no duplicate access |
| Staff profile and working days | Existing profile setup route, using caller's active membership | Staff saves only their permitted profile; removed staff loses access immediately under the existing session/access contract |
| Staff home / navigation | Staff view of `/provider` or a newly registered route if required by the preview | Only allowed business/team actions appear; owner/admin tools are inaccessible through direct URLs |
| Team management | Reuse existing actions where present; explicitly inventory gaps for removal, role change, revoke and decline | Supported controls change real records with audit evidence; unsupported controls stay unavailable until implemented and reviewed |

Email invitation delivery is not currently available in the team share screen. Keep a functional copy/share-link route without claiming email was sent. Wire actual delivery only after the mail path and approved-recipient policy are verified; preserve token confidentiality. Keep real invite links out of screenshots.

## Group 3 — account, settings and security

Reference: `dist/onboarding/account/index.html` and `sign-in.html`. App: `routes/account.$tab.tsx`, `account/forms.ts`, `auth/routes/account.tsx`, existing Auth routes and session helpers.

| Screen | App destination / behavior | Completion evidence |
|---|---|---|
| Account entry and role navigation | `/account`; redirect/select the correct existing tab without trusting a browser-supplied role | Customer, owner, manager, staff and admin see appropriate links; unknown tabs return 404 |
| Profile | `/account/profile`; existing validated display-name update | Save, inline validation, loading/failure and reload behavior verified |
| Security overview | `/account/security`; list authenticators and supported session controls from existing backend | No credential/factor secret leak; sensitive responses remain private/no-store |
| Add an authenticator / MFA challenge | Existing `/auth/mfa` flow; preserve native verified-factor/AAL2 requirements | Real synthetic-account enrollment/challenge, invalid code and cancelled enrollment verified |
| Remove authenticator / sign out other sessions | Existing security actions and guards | Wrong user, missing verification, replay/CSRF and valid removal cases checked; do not infer all sessions revoked from a success toast |
| Sign-in and recovery | Existing sign-in/up, confirmation, forgotten/reset-password and callback routes | Validated return path preserved; recovery errors are generic; actual email verification is gated on mail delivery |
| Notifications | `/account/notifications`; inspect persisted preference support before wiring switches | Only supported preferences save; essential transactional notices cannot be silently disabled by a cosmetic switch |
| Privacy and data | `/account/privacy`; inspect export/closure backend support | No fake download or deletion success. For unsupported requests show the approved real request path/unavailable state; backend implementation is an explicit follow-up |
| Your work | `/account/work`; current memberships and business roles | Real membership list; no cross-tenant links or static demo organisations |

The #95 email step-up backend and further recovery policies are not assumed merged or configured. Do not make an entire account page depend on that optional work, and do not remove native admin AAL2 to accommodate the preview.

## Group 4 — admin review and operations

Reference: `dist/onboarding/admin/{index,review,claim}.html` and `admin.css`. App: `auth/routes/admin.tsx`, `routes/admin.*.tsx`, existing admin queries/actions and audit infrastructure.

| Screen | App destination / behavior | Completion evidence |
|---|---|---|
| Admin entry and MFA | `/admin` with actual admin identity and native AAL2 | Signed-out, normal-user and AAL1 accounts cannot access admin data; MFA return works |
| Today / queue overview | `/admin/today`; real pending counts and links | Counts match synthetic queue fixtures; zero/error states visible |
| Listing/application queue | `/admin/listings` | Filters/paging operate on authorized queries; no hidden unbounded fetch |
| Listing/application review | `/admin/listings/:publicId`; reuse actual publish/reject/request-change actions available in the route | Allowed transitions persist, stale/double submissions are safe, required reasons/audit recorded |
| Claim queue and detail | `/admin/claims`, `/admin/claims/:id`; verified existing claim actions | Reviewer can decide seeded claims; non-admin cannot read private proof; public listing projection remains safe |
| Support queue and case | `/admin/support`, `/admin/support/:id` | Existing status/case actions persist; redact private contact/message content from screenshots/logs |
| Unmet demand | `/admin/demand` | Authorized paging/filtering of actual demand records; no public exposure |
| Audit history | `/admin/audit` | Sensitive changes can be traced; actor/action/time shown without exposing raw secrets |
| Money, delivery and review moderation | Phase 3 `/admin/money`, `/admin/reviews` and only the actually registered delivery tools | Keep out of the directory release; connect in the booking staging plan with test-only financial data |

Only preview controls backed by a permitted action become enabled. For any missing admin operation, document its data/permission/audit contract and add tests in that group's implementation PR; do not let the UI grant itself privileges.

## Implementation order and PR acceptance

1. **Route/access inventory and shared shell:** one checklist mapping every owner journey to an app route, existing action and authorized role. Capture baseline screenshots and distinguish permission/data problems from missing UI. Do not deploy an old branch over D-097. Shared shell changes remain narrow and preserve directory navigation.
2. **Business setup PR:** implement Group 1; add customer-to-provider entry links and organization switching. Keep booking-dependent cards and cover upload capability honest.
3. **Staff PR:** implement Group 2 against Group 1. Make valid synthetic invite, sign-in, acceptance and restricted profile journeys usable end to end.
4. **Account/security PR:** implement Group 3. Reuse existing session/MFA logic; audit and test sensitive actions independently from styling.
5. **Admin PR:** implement Group 4. Reuse existing server actions; supply a private synthetic admin/MFA testing procedure.
6. **Final integration and hosted test PR:** check all role navigation and deep links, refresh the frozen main staging build, apply only reviewed additional migrations if actually needed, and publish sanitized evidence. Each group can deploy as a coherent milestone with the same checks; do not wait for Phase 3 to expose directory settings.

Each application PR requires tests appropriate to its behavioral changes, exact-head green CI and reciprocal review under the current D-091 process. Preserve other agents' work. Before each batch check current branch/PR ownership to avoid concurrent edits; no delegation is assumed. Re-audit current migrations, configuration and deployed version before every hosted operation. No new account, production release, real mail or paid service is implied by this plan.

## Definition of ready for the owner's staging round

- Use separate synthetic customer, owner, manager, staff, removed-staff and admin fixtures; no credentials or invite links in Git. Supply private sign-in instructions, not publicly documented passwords.
- Through Cloudflare Access, verify each authorized route, form action and return path against the same version. Repeat direct-URL access with a wrong role, wrong organisation and missing MFA. Do not count Access's redirect as an application pass.
- For each screen cover default, empty, loading, validation error, server failure, success/reload, denied and unavailable states where applicable. Forms retain input after recoverable failures. Personal pages use private/no-store headers.
- Test the actual staging screen at desktop, tablet and 390 px phone widths. Check the menu, scrolling, focus, keyboard, zoom and accessible labels. Record the manual checks completed.
- Owner walkthrough: accepted provider -> setup -> invite staff -> staff joins -> own profile -> owner changes permitted settings -> customer updates profile/security -> admin reviews a synthetic application/claim/support case -> audit entry appears. Include opening hours and membership isolation.
- Publish a short route and role guide, screenshots, expected results and known gaps with the exact staging SHA and Worker version.

## Boundaries and follow-up capabilities

Cover-photo storage, unsupported privacy export/account closure, unimplemented notification controls, and optional email step-up require explicit implementation contracts if selected; a pixel-perfect port cannot fabricate these backends. Existing task tests are evidence only for the exact source they ran on; a page list or successful build is not a hosted acceptance result. Keep the mail/hook, scoped workflow-token, backup/restore and launch gates visible alongside these screens.

## 2026-11-23 staging delivery

The first four groups are merged as #135–#138. Start with the end-to-end business application and claim walkthrough in [#141](https://github.com/CarworX/carworx-new/pull/141). The remaining team, notifications, media, data and business controls follow the [finish-build plan](https://github.com/CarworX/carworx-new/pull/140). Use the protected staging walkthrough for acceptance.
