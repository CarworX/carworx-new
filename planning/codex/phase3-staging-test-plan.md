# Booking journeys on staging

Requested by the owner on 2026-11-22 (SAST). Plan for a private, synthetic-data staging release the owner can try. This document does not record a deployment or a passed hosted test.

The [business, staff, account and admin screen plan](directory-remaining-screens-plan.md) now provides the complementary page-by-page directory work, implementation order and role-based staging acceptance criteria.

## Verified starting point

- Directory staging runs main `70d10b5fb9f8de119a58d3f9a85316134dc52964`, Worker version `7ad34838-fff7-4d4e-bba7-344b96c8146b`. Keyword-search and account-enquiry migrations are applied.
- `phase-3` contains customer bookings, provider bookings, quote, checkout, payment-result, review and admin-money route implementations. Their presence does not establish a complete or usable hosted journey.
- #107 has green exact-head checks at `9eb16a63e94f4b9d06fddceeb7e0ecd281602595`; Claude's receiving review is still required by the current handoff. #102 remains draft. Shared A23/A29/A35 checks await a Phase 3 staging deployment.
- Main's D-097 changes postdate Phase 3. The staging candidate must retain keyword search, account enquiries, latest listing/category and application work. Do not deploy the older Phase 3 branch over these without integration.
- Sites remains an interactive simulation; its examples are not connected bookings, payments or customer traction. Existing Site audience is preserved.

## Delivery sequence

1. **Assemble a candidate.** Claude reviews #107's exact head, findings are resolved, then it merges into `phase-3` with green checks. Integrate current main into a separate `codex/*` candidate based on `phase-3`, reconcile routes/Auth/enquiry signatures and migration order, and publish a PR back into `phase-3`. Keep #102 out of main until its release gates pass.
2. **Make every entry point reachable.** Match the existing Sites design for listing-to-booking, booking request, provider acceptance, customer/provider booking lists and detail, written quote and acceptance, checkout/result, reschedule/cancel/refund state, message delivery state and completed-booking review. Preserve D-097 home browsing/sign-in behavior. Audit actual route registration and links; a source file alone does not count as a screen. Show clear unavailable/error states for any backend capability not ready.
3. **Prepare staging infrastructure.** Inventory the actual staging migration ledger and pending Phase 3 files, including #107's fixes and receipt/invoice migrations, before producing the exact ordered apply list. Verify existing privileged-function ownership/wrappers, scoped DB roles, no-cache Hyperdrive bindings, review access, retention and the minute drain/daily retention cron. Provision only the required staging MONEY_DB/MAIL_DB bindings against the designated staging project; do not invent IDs or share production resources.
4. **Configure bounded test behavior.** Use Paystack test mode and test subaccounts only; explicitly configure the existing adapter's key, fee-bearer and webhook-verification requirements. Keep real charges unavailable. Resolve #93 then #94 and verify approved-recipient-only mail before claiming email works; in-app states must remain inspectable if external delivery is unavailable. Do not send real mail without the owner's existing applicable recipient/sending authority. Provide separate synthetic customer, provider/staff and admin fixtures, using native admin MFA.
5. **Validate then deploy a frozen candidate.** Run the combined candidate's required unit, route/integration, SQL/RLS, security, performance and restore checks. Record exact SHA and migration hashes. Build and dry-run before applying hosted migrations. Plan the compatibility window and rollback limits; restore old code only if the resulting schema is compatible. Apply reviewed staging migrations and deploy the matching Worker together, with build-time CLOUDFLARE_ENV=staging and no APP_ORIGIN/SUPABASE_URL --var overrides. Keep Cloudflare Access and existing audience restrictions.
6. **Run hosted journeys.** Through Access, verify directory pages, sign-in return/draft preservation, customer request -> provider acceptance -> test payment -> confirmation -> completion/review. Run quote acceptance, cancellation/reschedule and negative/cross-account cases. Complete A23 (late payment/rebook/refund choice), A29 (refund/dispute interactions) and A35 (checkout/payment path) against the same candidate; record exact versions and sanitized evidence. Repeat final-schema restore coverage where integration changes it. No skipped checks count as a pass.
7. **Owner handoff.** Supply the staging URL, exact candidate/version, private account-access instructions, a short click-through checklist and known gaps. Let the owner try customer and provider journeys without needing developer tools. Separate simulated Sites actions from real staging test-mode actions. Promotion.json only becomes ready when its implementation/configuration/scoped-token/hosted-hook receipts actually validate; a manual deployment is not a waiver.

## Owner click-through acceptance

| Journey | Visible result |
|---|---|
| Browse/search/listing | No app account needed to browse; business/service keywords work with or without an area |
| Request | Sign-in step when needed; draft retained; request appears in the correct customer/provider lists |
| Quote | Provider supplies written quote; customer sees price/travel/version before accepting |
| Checkout | Only test payment; pending/failure/success states reflect verified backend events |
| Manage booking | Correct reschedule/cancel/late-payment/refund states with no duplicate effects |
| Delivery/review | In-app event state visible; external mail only when verified; review limited to own completed booking |

## Sites update for this milestone

Update the existing CarworX Site, keeping its audience and other screens. Reflect D-097's browse-first home, business/service keywords and enquiry sign-in gate. Keep booking/quote/payment previews interactive and clearly simulated. Add a compact progress/test guide linking to protected staging and this plan, so the owner can distinguish implemented staging work, existing preview journeys and remaining hosted checks. Update on completed milestones rather than a timer; no scheduled follow-up is introduced.

## Current blockers and evidence

- Access service-token credentials are not present locally; protected 200/sign-in checks remain outstanding despite successful Worker and schema verification.
- No staging auth-email hook Worker or approved-recipient binding was present at the latest read-back; promotion receipts/scoped workflow-token evidence remain incomplete.
- #133 corrects workflow secret overrides; its CI/review/merge must complete before using that promotion packaging path.
- Production release and live payments remain separately gated. This plan calls for synthetic private staging testing only.

## Published planning milestone

2026-11-22: existing restricted CarworX Site published as version 4 at https://carworx.gerrardlewu.chatgpt.site (Site source 9a9c59aeae65c71a50b0faf1b30f088d8a512562; deployment appgdep_6b034bcbb3c881918427d08550c24803, succeeded). /progress.html records current directory staging, the outstanding hosted checks and links to /staging-plan.html and existing simulated booking/quote/checkout journeys. Home adds the browse-first entry and three-step explanation; search supports sample business/service keywords without a required area; the listing request includes a simulated account gate. No real credentials, enquiries, bookings or charges are collected on Sites. This is a milestone refresh, not a claimed exact visual match to the deployed D-097 home.

Verified customer route/form/payment simulations, keyword/no-area/no-result/account-gate cases, 17 onboarding pages, role menus and 307 local URLs/assets. Browser rendering/desktop/mobile checks remain unverified because browser access is unavailable in this chat. Native Sites publication succeeded. Older local Site edits were preserved in their original checkout; publication used a fresh checkout of hosted source.
