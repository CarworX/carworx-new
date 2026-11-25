# Claude → Codex: backend brief for the November redesign

Written by Claude (coordinator), 2026-11-26 (SAST), from `main` @ `45a6ff5`. The owner approved the mockups A1–A8 (`planning/design/redesign-2026-11/`, gallery: https://claude.ai/artifact/3yWRDt2H25uCBUo6aRPTx6) and decisions D-099 and B-21 to B-23 (`planning/claude/BACKLOG.md`).

**Split.** Codex builds everything in this file: migrations, RPCs, RLS, server adapters, webhooks, seed data, config and deploys. Claude builds the screens (`apps/web/app/routes/*`, components and CSS) on top of the contracts named here, and reviews each Codex PR at its exact head (`REVIEW: APPROVE|CHANGES @sha`). If a contract below doesn't fit the code, change it in your PR and say so in the PR body. **Don't silently diverge, because Claude's screens import these names.**

**Rules for every K-PR:**
- a `codex/*` branch, a noreply commit and an `Agent:` trailer;
- pgTAP plus integration tests;
- green exact-head CI, never skipped;
- synthetic data only, no secrets in Git;
- each migration applied to staging verbatim after merge, then `main` deployed to `carworx-web-staging` (`pnpm install --frozen-lockfile`; `CLOUDFLARE_ENV=staging pnpm run build`; `pnpm --filter @carworx/web exec wrangler deploy --config build/server/wrangler.json --tag <sha>`, with no `--var` overrides);
- reply on #102 with the commit and the Worker version.

## Order

```
K0 seed names (#164)  ─┐
K1 account_terms       ├─► K2 identity (Didit) ─► K3 fines adapter + payments ─► K4 existing-screen hooks
K5 reviews  ───────────┘                                                         K6 customer-home data
```
Do K1 first: Claude's builder is waiting on it, because B-10 part 2b is parked. K5 can run in parallel with K2 and K3.

## K0 · Seed names
Finish #164 (staging fixtures with realistic South African business names; none called "Synthetic …"). They stay synthetic.

## K1 · Record acceptance of the account terms (B-10 part 2b)
- **Migration:** widen the check on `public.consents.purpose` (`20261111140000_p2_5_forms.sql:32`) to add `'account_terms'`. Add a nullable `user_id uuid references auth.users(id) on delete set null` column with an index, if the table doesn't already link to users. Add a `terms_version text` column, or reuse the existing notice column, which stores the notice text and version.
- **RPC `public.accept_account_terms(p_version text)`** (security definer, `search_path=''`): inserts one consent row for `auth.uid()` with purpose `account_terms`. It is idempotent per user and version.
- **RPC `public.my_terms_status() returns table(accepted boolean, version text, accepted_at timestamptz)`.**
- **Write it on sign-up.** The email sign-up action (`auth/routes/sign-up.tsx`) and the Google paths (`auth/google.server.ts` `startGoogle`/`exchangeGoogle`, and the callback) call `accept_account_terms` once the user exists, because the box was ticked before the user was redirected. Pass the tick through the existing return cookie.
- **Decline path for a user with no password.** Add `public.decline_terms_and_close()`. It needs no password or TOTP step-up, and it is allowed **only** when `my_terms_status().accepted` is false and the account is less than 24 hours old. It starts the existing close-account flow (#148) with the reason `declined_terms`. Add a pgTAP test that an older or consented account is refused.
- **Retention:** `account_terms` consents are kept for 3 years after the account is closed, the same as the existing consent records (owner approval, 25 Nov).
- **Claude then builds** the `/auth/terms` consent page and a backstop in the signed-in loader that redirects users who haven't accepted.

## K2 · ID check with Didit "Option A" (B-21, D-099)
**Facts.**
- Didit organisation "CarworX". Sandbox app `c20d6f1a-8bcf-4af4-b5dd-dffe86cf5746`. Workflow "Basic KYC" `0ccc342d-6da5-4a68-9c34-28101b2b727b`: OCR, liveness, face match and IP analysis, about $0.33 a check.
- API: `POST https://verification.didit.me/v3/session/` with the header `x-api-key`. The body is `{workflow_id, vendor_data: <our user id>, callback: <return url>, metadata}`. The response has `session_id` and `url`.
- Webhook: v3, event `status.updated`, signed HMAC-SHA256 with `X-Signature-V2` over canonical JSON (sorted keys) plus a timestamp. Verify it per https://docs.didit.me/integration/webhooks#signature-verification and reject anything older than 5 minutes.
- **Secrets already on `carworx-web-staging` (set by the owner):** `DIDIT_API_KEY` and `DIDIT_WEBHOOK_SECRET`. Add `DIDIT_WORKFLOW_ID="0ccc342d-6da5-4a68-9c34-28101b2b727b"` to the staging `vars` in `apps/web/wrangler.jsonc`. Production gets no Didit config until G-PROD.
- **The Access bypass is done** (separate Access application for `staging.carworx.app/api/identity/didit`). It also covers sub-paths, so the route must answer only the exact path and only POST, with 404 for everything else.

**Migration: `private.identity_checks`.**

| Column | Type |
|---|---|
| `id` | uuid primary key |
| `user_id` | uuid not null, references `auth.users`, on delete cascade |
| `provider` | text, check = `'didit'` |
| `provider_session_id` | text unique not null |
| `status` | text: not_started, in_progress, approved, declined, in_review, expired, abandoned |
| `decline_reason` | text: a plain-language code, e.g. `document_expired`, `face_mismatch`, `liveness_failed`, `document_unreadable` |
| `id_last4` | char(4): from the OCR result, nothing else from the document |
| `attempt` | smallint, 1–3 |
| `decided_by` | text: `didit` or `admin` |
| `admin_id` | uuid, null |
| `admin_reason` | text, null |
| `created_at`, `updated_at`, `decided_at` | |

- **Never store** the ID number, the photos, the selfie, the date of birth or Didit's raw payload. Keep only the fields above. Log a hash of the payload if you need replay protection.
- **RPCs:**
  - `public.my_identity_status()` returns the latest row's status, reason, attempt, tries left and `decided_at`.
  - `private.identity_start(p_user uuid, p_session text, p_attempt smallint)` is server-only, granted to a new login or to `forms_server` (your choice; document it). It refuses a 4th attempt in a 30-day window and an already-approved user.
  - `private.identity_apply_webhook(p_session text, p_status text, p_reason text, p_last4 text)` is idempotent and keyed on session and status.
  - `public.admin_identity_queue()` and `public.admin_decide_identity(p_id uuid, p_decision text, p_reason text)` are for platform admins at aal2 only (`private.is_platform_admin()`). A decision needs a reason. A decline uses up one try. Every action writes to `public.audit_log`.
- **Server code:**
  - `apps/web/app/server/identity/didit.server.ts` exports `createIdentitySession(env, userId, returnUrl) → {url}` and `verifyDiditWebhook(request, secret) → payload | null`.
  - `apps/web/app/routes/api.identity.didit.ts` is POST only. It verifies the signature, maps Didit's status to ours, calls `identity_apply_webhook`, and returns 200. A bad signature gets 401. It never echoes the body.
  - Contract type for Claude: `apps/web/app/server/identity/types.ts` exports `IdentityStatus = {state: 'none'|'checking'|'approved'|'declined'|'in_review'|'locked'; reason?: string; triesLeft: number; decidedAt?: string}`.
- **Retention** (owner to approve; propose the row in `planning/legal/retention-schedule.md`): keep `identity_checks` for the life of the account, delete it when the account is closed, and set Didit's own biometric retention to the **shortest setting Didit allows** (the default is 1 year). Record which setting you chose.
- **Tests:** all four statuses through the sandbox (`didit_session_simulate` works in the Didit sandbox), a bad signature, a replay, a 4th attempt and the admin decision at aal1 (refused).

## K3 · Fines adapter and payments (B-22)
- `apps/web/app/server/fines/adapter.ts` defines this interface:
  - `lookup(userId)` → `{checkedAt, coverage: string[], fines: Fine[]}` or `unavailable`;
  - `startCheckout(userId, noticeIds[])` → `{url, paymentId}`;
  - `verifyCallback(request)` → `{paymentId, status: 'paid'|'failed'|'cancelled'|'pending_issuer'}` or null.
- `Fine` = `{id, issuer, offence, location?, issuedAt, dueAt?, discountUntil?, cents, discountedCents?, payable: boolean, reasonNotPayable?}`.
- Move the existing `sandbox.server.ts` behind this interface. It stays the staging implementation, and it uses neutral wording ("Fines checked" rather than "sandbox" in anything shown to users). `FINES_PROVIDER=sandbox` goes on staging, and production stays unset until a partner (Pay@ first, Electrum as fallback) is signed.
- **Gate:** `lookup` and `startCheckout` refuse unless `my_identity_status().state = 'approved'`.
- **Migration `public.fines_payments`:** id, user_id, notice_ids text[], cents, status (`created|pending_issuer|paid|failed|cancelled`), provider_ref, an idempotency key (unique), receipt_number, created_at and settled_at. The owner can read their own rows; admins at aal2 can read all.
- **Callback route:** `api.fines.callback.ts`. It verifies the signature and is the **only** way a payment becomes `paid`. A browser return can only show "awaiting confirmation". It is idempotent, so a duplicate callback changes nothing.
- **Retention:** payment records are kept 5 years (tax, D-096).

## K4 · Hooks into existing screens
- "Download my data" (#147, `account.privacy.download.ts` and its RPC `personal_data`) adds the identity status (last 4 digits only), the `account_terms` consent and fines payments.
- Close account (#148) deletes `identity_checks` at the end of the grace period (payments are kept, per K3), and calls Didit's session delete API for the user's sessions. Log it.
- Admin Today (`routes/admin.today.tsx` loader) gains `pending_identity_reviews` and `reported_reviews` counts.

## K5 · Business reviews (B-23, A8)
- **`public.reviews`:**

| Column | Type / rule |
|---|---|
| `id` | uuid |
| `listing_public_id`, `organisation_id` | fk listings |
| `author_id` | uuid references `auth.users`, on delete set null |
| `author_display` | text: first name and initial, captured at write time |
| `rating` | smallint 1–5 |
| `body` | text, 10–1000 characters |
| `service_slug` | text, null |
| `status` | text: `visible`, `hidden` |
| `hidden_reason` | text, null |
| `created_at`, `edited_at` | |

  - unique (listing, author);
  - RLS: anyone can read visible reviews; authors read and edit their own; admins at aal2 read all.
- **Eligibility:** `public.can_review(p_listing uuid) returns boolean` is true when an `enquiries` row exists with `sender_user_id = auth.uid()` for that listing (column from `20261122130000_enquiry_accounts.sql`). Check it at write time; editing later is always allowed.
- **RPCs:** `upsert_review(listing, rating, body, service)`, `delete_my_review(id)`, `reply_to_review(id, body)` (owners and managers of that organisation, one reply, editable), `report_review(id, reason)` (signed-in, once per user per review), and `admin_review_queue()` / `admin_moderate_review(id, decision, reason)` (aal2; a reason is required; audit-logged).
- **`public.review_replies`** and **`public.review_reports`** tables back these RPCs.
- **Aggregates:** `rating_avg numeric(2,1)` and `rating_count int` on the public listing view used by search and cards. A business with 0 reviews returns `rating_count = 0`, and the screens show "New".
- **Rules:** D-056 (no paying for ratings or badges). Rating alone is never a reason to hide, so the admin RPC refuses a hide reason that is empty or generic.
- **Retention:** reviews last as long as the listing. When the author's account is closed, the review keeps its text, but the author is anonymised to "Former customer" (propose the row for owner approval).

## K6 · Data for the customer home (A4)
- Confirm, or add, a search parameter for **"comes to you"** (mobile or travel radius) and a near-me sort on the existing catalogue search (`server/search`, `api.search.ts`), returning `rating_avg` and `rating_count`. Recently viewed is stored in the browser only, so it needs no backend.

## Not in this brief
The frontend: Claude's C1–C5 (shell, category, customer home, landing and copy, fines and ID screens, reviews UI). Phase 3 (unchanged, #102). The hosted email change (B-33) stays in your queue.

## Owner items this depends on
Approving the retention rows (Didit, reviews and fines payments), the Didit operator agreement and the Section 72 check, the Information Officer, and the fines partner contract (needed for production only).
