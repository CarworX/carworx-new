# K2 environment readiness and review handoff

## Current implementation — 2026-11-05

[Codex 17](../../../planning/codex/17-k2-implementation-handoff.md) is the current review/replan handoff. D-068 authorizes Codex to build the app consumer as well as K2 operations before Claude's review. The interface agreement request is superseded as a prerequisite. Independent approval, owner setup and runtime evidence remain required. `promotion.json` v2 intentionally remains **blocked**.

### Recipient controls

`STAGING_APPROVED_RECIPIENTS_JSON` is private on both Workers: a nonempty JSON array, each address trimmed/lowercased, then exact comparison. Missing/empty/malformed policy denies delivery. No domains, substrings, wildcard matching, plus stripping or Gmail dot folding. `CARWORX_ENV=staging` requires the restriction. Local mode only permits loopback configured app/Supabase origins **and the actual request origin**; mail terminates in synthetic infrastructure.

Signup, resend and reset acknowledge an unapproved address generically without calling Auth; invalid policy/configuration returns a generic recoverable 503. The separate `carworx-auth-email-staging` Worker verifies Standard Webhooks signatures/timestamps on bounded raw bytes. It accepts signup/recovery only, constructs `/auth/confirm` links from `APP_ORIGIN`, ignores payload redirects and calls fixed Resend transport with a two-second timeout/idempotency key. Unsupported actions and failures never select another delivery path. The local capture adapter is injected by tests; the deployed entry has no configurable forwarding URL.

The owner installs `SEND_EMAIL_HOOK_SECRET`, `STAGING_RESEND_API_KEY`, `STAGING_AUTH_EMAIL_FROM` and the approved-recipient setting on the hook; `APP_ORIGIN` is the exact configured application origin. Sender is a bare verified email address. The app Worker gets its publishable key and recipient set as secret bindings, plus configured `APP_ORIGIN`, `SUPABASE_URL`, `CARWORX_ENV` and staging-only dev flag. No hook credential enters the application deployment workflow.

After independent review, the owner deploys the hook separately with the pinned Wrangler and its separate owner credential, then enables Supabase's Send Email Hook with that HTTPS URI/secret. The committed local `[auth.hook.send_email]` section is disabled; agents never apply it to staging. **Deny all:** keep the hosted hook enabled and set its private recipient policy to `[]`; do the same on the app. Requests fail recoverably. Disabling the hook could restore default/custom SMTP. Re-enable delivery only after corrected private settings and fresh owner probes/receipts.

### Required checks and private diagnostics

Use pinned Node/pnpm and `pnpm run check`. Node operations tests are required by K1, which captures TAP privately and publishes only validated counts. CI runs the existing 168 pgTAP assertions, 52 integration tests (45 existing + 7 Worker cases), then `auth-email/direct-auth.js` on Linux with `CI=true`, exact `K1_HEAD_SHA` and a fresh `CI_AUTH_EMAIL_REPORT` path. The script owns only the disposable `carworx` local stack, enables the local HTTP hook temporarily, uses genuine Auth -> hook requests, verifies working positive links and zero fallback, stops services and restores config. Twelve fixed checks must execute/pass; missing/skipped/TODO/malformed/old-head reports fail. Service output, mail bodies, tokens, addresses and credentials remain private.

These Linux CI results are local-stack evidence, not a workstation run or staging delivery. The Windows workstation was not used for this new Docker drill due to low disk capacity. No unrelated cleanup is authorized by this task.

### Version 2 readiness receipts

Four owner/reviewer-supplied **sanitized** JSON files live under `planning/evidence/k2/<lowercase-name>.json`. Each reference in `promotion.json.evidence` contains `path` and the exact file-byte `sha256`. No value/recipient/body/cookie/token enters these receipts. Fixtures in `readiness.test.js` illustrate schema only and are never runtime evidence.

All receipts have `version:1`, matching `kind`, `status:"passed"`, ISO UTC `verified_at` within seven days and matching `fingerprints` from `fingerprints(root)` in `readiness.js`. Fingerprints cover application/Auth/security, hook, local Auth config and operations/CI implementation. Policy/receipt files are excluded to avoid self-reference. Relevant changes invalidate evidence; receipt freshness does not establish unchanged secret values.

| Receipt kind | Required evidence |
| --- | --- |
| `implementation` | `source_sha`, matching GitHub `ci_run` URL, nonzero `app_negative_tests` / `hook_tests`, zero `skipped` / `todo`, validated exact-head `auth_delivery` report with all twelve fixed names/counts |
| `configuration` | `account_id`, exact `worker`, `supabase_project_ref`, `app_origin` / matching `route_origin`, `binding_names` only; opaque owner `configuration_revision`, `recipient_revision`, `hook_secret_revision` |
| `token_policy` | Same `account_id`, `token_id`, `active:true`, independently inspected `policy_reference`; `grants` only `Editor` / necessary `Metadata Read-Only`, each `scope:"worker"`, exact `worker:"carworx-web-staging"` |
| `hosted_hook` | Reviewed `source_sha`, exact hook `worker` / `version_id`, `enabled:true`, matching private-setting revision labels; `checks` for approved confirmation/recovery, unapproved signup/resend/recovery, unsupported action and hook failure/no fallback; each has fixed `status`, nonzero `hook_calls`, sanitized `correlation_id`, positive provider count for approved cases and zero otherwise |

Owner receipts assert hosted configuration/hook version: the app deployment token cannot inspect/edit the separate hook or Supabase Auth settings. Review the underlying redacted evidence; these are explicit human/process attestations, not live verification of secret contents. Replacing credentials/settings or deploying a new hook invalidates the corresponding receipts and requires re-verification. The live account-token verify endpoint checks the supplied token ID/activity against the reviewed policy, never claims to prove its permissions.

The owner sets ready only in a separately reviewed evidence change after all receipts exist. Green CI and a deleted blocker are insufficient. The main-only script check remains additional process protection; repository writers can access repository secrets. The enforced external limit is the Cloudflare **individual Worker Editor** token, not unavailable private-repository environment protection or legacy account-wide Workers Scripts Edit.

### Owner application workflow and A2

Inputs are repository-level vars/secrets, not a GitHub `staging` environment. Owner supplies vars `STAGING_APP_ORIGIN`, `STAGING_CLOUDFLARE_ACCOUNT_ID`, and secret `STAGING_CLOUDFLARE_API_TOKEN`. Dispatch from main with the exact reviewed PR-head SHA, merged source PR and its green K1 run. Both reviewed head and `main_merge_sha` are recorded. Formal PR reviews only: required `REVIEW: APPROVE @<full-sha>` / other `Agent:`; later CHANGES supersedes approval. Issue comments are ignored.

The application build selects staging before packaging. Before publication, validate ready receipts against the selected source, verify owner token identity and required secret binding names/types. Wrangler tags the deployment with the reviewed SHA; evidence records its deployment/version ID. No token exists in dependency installation/build steps. Dry runs use no deployment token and cannot pass A2.

Smoke verifies `/healthz` fixed JSON/200/no-store, private/no-store anonymous and authenticated account/data responses, key binding presence (Boolean only), an owner-held synthetic login/logout, and staging dev-page no-store/noindex. Automated nonlocal no-flag tests establish production-shaped 404, not live production behavior. Supply private `STAGING_SMOKE_EMAIL`, `STAGING_SMOKE_PASSWORD`, and `STAGING_SMOKE_UNAPPROVED_EMAIL` as repository secrets; no public debug endpoint exists.

Hosted app negatives need an owner probe with zero Auth/provider call evidence for **signup, resend and recovery**, then a sanitized `STAGING_APPLICATION_NEGATIVE_EVIDENCE_JSON` repository variable: `version:1`, `source_sha`, `version_id`, UTC `verified_at` within 24 hours, `checks.<signup|resend|recovery>` each `{status:"passed",auth_calls:0,provider_calls:0,correlation_id:<opaque-id>}`. Underlying traces stay private and must be independently reviewed. The exported `smoke()` can run the three requests with owner-private before/after provider counter callbacks; zero network calls also have independent production-Worker tests. Never infer absence of delivery from generic HTTP acknowledgement alone.

First deployment can fail smoke while awaiting that receipt; its failure leaves A2 open and uploads sanitized partial evidence. Once the owner supplies the matching receipt, dispatch `dry_run:false, smoke_only:true` to verify the existing SHA-tagged deployment without publishing another version. Any changed deployment invalidates the receipt. `smoke_only` never bypasses preflight/readiness. Agents do not dispatch either mode.

### Primary sources

- [Supabase Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook): enabled hook replaces built-in SMTP/default delivery.
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks) and [CLI configuration](https://supabase.com/docs/guides/local-development/cli/config): error propagation, HTTP timeout, local hook fields.
- [Cloudflare Worker authorization](https://developers.cloudflare.com/workers/authorization/): individual Worker Editor roles; [account token verification](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/verify/): identity/status only.
- [GitHub environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments): private environment branch/secrets availability depends on plan.
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email): fixed transport and idempotency contract.

## Historical skeleton inventory and checks

The remaining text records the earlier skeleton; its pre-implementation state and environment-setting locations are superseded by the current section above.

Initial read-only inventory: 2026-11-04 UTC. Implementation slice added 2026-11-05 below. K2 and A2 remain incomplete. No deployment, DNS, project, email or credential configuration was changed.

## Verified inventory

| Requirement                                 | Observed state                                                                                                                                                                                                        | Next step                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing staging Supabase project           | D-062 mapping is correct. Claude confirmed `gdiyrdqfkthtcglgqnts`, CarworX App, ACTIVE_HEALTHY, eu-central-1, Postgres 17 through the owner connector. Codex cannot see its organisation in the inspected connections | Owner grants the Codex connector access to this existing organisation; no replacement project                                                                    |
| Cloudflare account and staging Worker/route | The connected account has no `carworx.app` zone and no CarworX Worker in the returned script list                                                                                                                     | Confirm the intended account, domain control and staging route; configure access in the connector/owner environment                                              |
| Resend sending domain                       | No CarworX domain appears in the connected account's returned domain list                                                                                                                                             | Confirm the intended account/subdomain and its verification; owner executes DNS setup                                                                            |
| Repository Actions secret/variable metadata | `gh secret list --json name` and `gh variable list --json name` both returned empty lists                                                                                                                             | Owner supplies staging-only names/values through the approved secret store after the configuration contract is reviewed; no secret values were requested or read |
| Current application configuration           | T1 Wrangler config has only name, entry point and compatibility date. Tracked `.env.example` contains guidance but no variable names. No deployed staging configuration is established by these files                 | Implement explicit local/staging configuration and the reviewed-SHA manual workflow in K2                                                                        |
| Google OAuth                                | Owner reported client creation and staging provider enablement in D-062. Current connected access cannot verify this project or local callbacks                                                                       | Confirm local/staging callback setup with T3; real login remains an acceptance test, not a provider-toggle check                                                 |
| Recipient controls                          | No reviewed application/Auth SMTP restriction or approved recipient set is evidenced                                                                                                                                  | Agree the contract below with Claude before staging Auth/email tests                                                                                             |

Absence from these inventories means unavailable through the inspected connections. It does not prove that the owner's resources do not exist. No unrelated account/project/domain details or credential values are included here.

## Proposed acceptance contract for Claude / T3

**Behavioral requirements AGREED with Claude/T3; concrete hosted enforcement remains OPEN.** See [Claude review](https://github.com/CarworX/carworx-new/pull/23#issuecomment-6643530553). K2 owns environment configuration, workflow and operations. Claude owns application/Auth routes and the Auth section of Supabase config. Shared config edits are serialized.

- Local confirmation/reset/expired-link/delivery-failure tests use Supabase's local mail sink and synthetic `example.test` recipients. Delivery failure is simulated locally, with no real sends. The approved staging recipient set stays owner-held; agents never inspect or log it. Local service keys stay private and ephemeral.
- Staging starts with email disabled until both application delivery and direct Supabase Auth SMTP are restricted. An application-only allowlist cannot satisfy this boundary.
- The owner supplies the approved staging recipient set through private configuration. Test approved recipients succeed and unapproved recipients are rejected through both delivery paths, including direct Auth requests. Record redacted results and the exact source/environment.
- The concrete SMTP/provider enforcement mechanism must be proposed by K2 and accepted with T3 once the intended sending account is available. This preflight does not assert that Resend offers a recipient allowlist or that any relay already exists.
- Stage sign-in remains blocked until both restrictions are demonstrated, T3/T5 security boundaries are reviewed, and the owner executes the staging deployment. The Google path additionally requires real client/callback evidence.
- `CARWORX_DEV_PAGES=1` is agreed for staging review/K3 only; production must omit it. This is a non-secret configuration flag, not a deployed value today.

### Configuration clarification for Claude

Disabling email confirmations alone does not disable password-reset messages. Leaving custom SMTP unset can still use Supabase's built-in sender for organisation team addresses. Neither setting demonstrates that all staging Auth email is off or restricted to the owner's specific approved set. Require a real fail-closed delivery control and negative direct-Auth tests before enabling staging sign-in/email; the mechanism is still open. Sources: [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp), [default-provider change notice](https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider).

## K2 implementation and evidence boundary

Use branch `codex/k2-environments`. K2 owns `apps/web/wrangler.jsonc`, `.github/workflows/deploy-staging.yml` and `scripts/ops/env/**`; application APIs remain Claude-owned.

The initial preflight required names-only configuration, a manual owner-run workflow, exact reviewed source/applicable CI and refusal on missing setup/evidence. The implementation below supplies that first slice. New runtime Auth recipient names/consumers still require coordination with Claude.

Hosted A2 requires the owner-executed deployment/run URL, deployed SHA and synthetic smoke results. Until then, A2 remains BLOCKED. This preflight does not pass A3, hosted A6 or A7.

## Current implementation — first K2 slice, Claude review pending

At the owner's request Codex started this slice without waiting for Claude. Both this updated PR #23 and the Codex 14 handoff #29 remain available for later Claude review. T3/T5 #25 is independently approved and merged at `199d448`; its implemented consumers define the names below. This slice does not change application APIs or claim recipient enforcement.

### Local development

The default Wrangler configuration is local development. Keep the root `.env` for the local Supabase CLI and `apps/web/.dev.vars` for Worker bindings, both ignored. `.env.example` remains the existing names-only source. The owner fills `APP_ORIGIN` with the exact local origin (normally localhost port 5173), `SUPABASE_URL` with the local API origin and `SUPABASE_PUBLISHABLE_KEY` with the local publishable/anon key. Never use the service-role key here. Local email stays in the synthetic sink. Google setup remains owner-run and separate from fixture tests.

The named `staging` configuration uses `carworx-web-staging`, with `CARWORX_DEV_PAGES=1`. Both staging and the default config disable workers.dev and preview URLs. No production environment, public route, domain, credentials or shared data binding is configured by this slice.

### Manual workflow and source evidence

`.github/workflows/deploy-staging.yml` triggers only with `workflow_dispatch` from main. It defaults to a dry run. The owner supplies the full reviewed PR-head SHA, merged PR number and successful K1 run number. Preflight rejects unmerged/wrong-repository/wrong-head sources, stale or failed CI, missing/cancelled/skipped jobs, inactive RLS/Auth contracts and missing reciprocal approval records. It checks all review/job pages rather than only the first page. No deployment token is present during preflight, installation or build.

The workflow checks out its operations code from the trusted dispatch commit and application source at the verified SHA. `CLOUDFLARE_ENV=staging` selects staging **during the build**. Packaging validates the flattened generated `apps/web/build/server/wrangler.json`; selecting an environment only at deploy time cannot repair a default build. The dry run uses the generated config and supplies APP_ORIGIN/SUPABASE_URL overrides as separate CLI arguments. Values are never interpolated into shell code. All raw Wrangler output remains private; seven-day evidence contains SHA/PR/run, target, config hash and mode/status only. A dry run is never a successful deployment or A2.

The approval check is a repository process check: both agents share a GitHub identity, so an `Agent:` label cannot authenticate a separate person/model. The actual reciprocal review is still required. Likewise, the named GitHub environment is not a claim of protected owner-only execution on this repository's plan; the owner triggers runs under the existing policy. Agents do not dispatch it.

### Configuration names and consumers

| Name | Owner location | Consumer |
| --- | --- | --- |
| `STAGING_APP_ORIGIN` | GitHub staging environment variable | Packaging validator and Worker `APP_ORIGIN` override; dedicated HTTPS origin, not the production apex |
| `STAGING_CLOUDFLARE_ACCOUNT_ID` | GitHub staging environment variable | Passed as `CLOUDFLARE_ACCOUNT_ID` only to the eventual deployment step |
| `STAGING_CLOUDFLARE_API_TOKEN` | GitHub staging environment secret | Passed as `CLOUDFLARE_API_TOKEN` only to the eventual deployment step; owner scopes it to the intended staging account/Worker operation |
| `SUPABASE_PUBLISHABLE_KEY` | Owner-managed secret binding on the staging Worker | Existing T3 server consumer; use the D-062 staging publishable/anon key, never privileged credentials |
| `APP_ORIGIN` / `SUPABASE_URL` | Validated deployment overrides | Existing T3 security/Auth consumers; Supabase URL fixed to D-062's project |
| `CARWORX_DEV_PAGES` | Committed staging-only Wrangler var | Existing T4 dev-page guard; omit from future production config |

These are names, not credentials. None were created, read or installed by this work.

### Promotion remains blocked

`promotion.json` deliberately says `blocked`. Setting dry-run to false fails preflight **before a deployment job can obtain its token**. Green CI, review labels or an owner-set Boolean cannot bypass it. A follow-up reviewed change must implement and prove the application/direct-Auth recipient restrictions, establish the owner route/bindings and replace the blocked policy with its accepted readiness contract. Removing blockers alone is not evidence; this PR does not define the final delivery mechanism.

The private recipient set stays with the owner. Codex will coordinate names and evidence with Claude before changing application consumers. No SMTP/provider account, relay, hook, allowlist, sending domain or live test email is invented or activated here. A2 requires the owner-executed deployment and smoke results; A3 requires real Google evidence as well.

### Checks and next review

Run `node --test scripts/ops/env/contract.test.js`, the existing lint/format/types/unit/build checks, a staging build, and Wrangler's local `deploy --dry-run` against the generated staging config. Test cases include wrong/missing/stale source/run/review, skipped/cancelled jobs, missing feature suites, wrong build/environment and the still-closed promotion gate. Hosted workflow dispatch and staging smoke checks remain UNVERIFIED until the owner runs them after review/setup.

Sources checked against the pinned Wrangler 4.156.1 schema and official docs: [Cloudflare Vite environment selection](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/), [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/), [GitHub manual workflow execution](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

### D-073 reciprocal review

Every candidate needs the other agent's formal approval at its exact SHA.
Historical D-071 records grant no deployment authorization. Keep
"phase1_self_check" null in the policy. CI, receipts, token scope and smoke
checks remain required.

### Staging probe operator

The dedicated hook Worker uses a SQLite Durable Object for short-lived probe
observations. Set the staging-only bindings `STAGING_PROBE_ADMIN_KEY` and
`STAGING_PROBE_EVENT_KEY` privately on that Worker. Set
`STAGING_PROBE_EVENT_KEY` and the exact HTTPS `STAGING_PROBE_ORIGIN` on the
application Worker. The admin key stays off the app Worker. The reviewed hook
deployment helper supplies the source SHA. The app has a staging-only version
metadata binding. The ledger expires active observations after 15 minutes.

Use the reviewed checkout and a private process environment. Set
`STAGING_HOOK_ORIGIN`, `STAGING_APP_ORIGIN`, `STAGING_HOOK_SOURCE_SHA` and the
private keys and controlled probe address. The operator tool never prints an
address, link, credential or body.

- `node scripts/ops/env/auth-email/probe.js register <case> <uuid>` opens one
  direct probe. Invoke the matching real Supabase Auth action against the
  recorded staging project. Use distinct controlled fixtures or respect the
  cooldown. A live positive may send only to an owner-approved inbox.
- `node scripts/ops/env/auth-email/probe.js seal <case> <uuid>` seals observed
  counts. For positives, pass the privately captured `STAGING_PROBE_LINK`,
  staging Supabase URL and publishable key in the private environment. The
  command verifies the link against Auth before recording success. For the
  hook failure case, use an approved fixture and check the configured Auth
  path and redacted provider evidence for absence of fallback.
- Prepare a private JSON map of the seven case names to objects containing the registered address and correlation_id.
  `node scripts/ops/env/auth-email/probe.js hook-receipt <file>` builds the
  fingerprinted hosted-hook receipt by reading sealed counts from the live ledger. It uses the deployment ID and configuration
  revision labels. Treat it as evidence only after checking the installed
  hook, deployment version and private traces.
- After the app deploy, set `STAGING_APP_SOURCE_SHA` and
  `STAGING_APP_VERSION_ID` and run
  `node scripts/ops/env/auth-email/probe.js app-negative` with a controlled
  unapproved address. It sends signed probes on the three app paths and
  outputs the smoke receipt. Missing terminal events, auth attempts, wrong
  version and duplicate terminal events fail the receipt.

The hook acknowledges valid signed unapproved recipient requests without
attempting provider delivery. Invalid configuration, malformed payloads,
unsupported actions and provider failures remain fail-closed. Hosted
application timing and provider evidence require staging access.

Validation (2026-11-10 UTC, issue #39 / PR #43):
`node --test scripts/ops/env/contract.test.js` passed all 12 tests, with no
skips/TODOs. A complete historical D-071 record without independent approval is
rejected; reciprocal exact-head approval remains accepted. Fresh PR CI and
Claude's formal review are required before merge.

### Probe isolation follow-up (2026-11-10 UTC, issue #39)

Hook observations are best effort until this request confirms an active probe
registration. Ordinary signup/recovery delivery continues through a probe-store
outage. Once confirmed, observation failures still fail the probe request; missing
observations cannot produce a passing receipt. Each webhook has its own observer.

Validation: pinned Node 24.22.2 in WSL, `node --test
scripts/ops/env/auth-email/handler.test.js
scripts/ops/env/auth-email/probe-runtime.test.js`: 16 passed, no skips/TODOs.
The first PR #42 CI run caught an unused destructured parameter; it was removed.
Fresh exact-head CI and Claude's formal review remain required before merge.

### Probe key custody and timing evidence (#39)

`STAGING_PROBE_EVENT_KEY` has two roles: it authenticates application telemetry
and HMACs canonical recipients into private ledger identities. Keep it only on
the application Worker, hook Worker and owner operator machine; never publish
the key or recipient HMACs. It is separate from `STAGING_PROBE_ADMIN_KEY` and
`SEND_EMAIL_HOOK_SECRET`. Anyone holding the event key can forge app telemetry
and test recipient guesses against captured HMACs; restrict access accordingly.
Rotate both Workers and the operator together, abandon/re-register active probes,
and invalidate earlier configuration revisions/receipts. Never reuse the key for
Auth signatures, provider delivery or backups.

The hook observation fetch has a 500 ms timeout. A first lookup timeout makes
that request unobserved and cannot produce evidence; confirmed probes remain
strict. This limits the ordinary delivery dependency on the probe store.

`CARWORX_TIMING_OPERATOR_ACK=approved-synthetic-fixtures node
scripts/ops/env/auth-email/timing.js <private-config.json>` measures real HTTP
responses without printing private fixtures. Do not run this against production.
Staging execution may deliver mail to approved synthetic inboxes: run only after
recipient restrictions and operator authority are verified. CI unit tests use
injected HTTP responses; these are collector tests, not hosted timings.

Private config: `environment` (`local` or `staging`), `source_sha` (hook SHA),
`hook_version`, `app_version`, `configuration_revision`, `app_origin`,
`auth_origin`, `publishable_key`, and `cases`. Each case contains `path`
(`direct` or `app`), `flow` (`signup`, `resend`, `recovery`), `cooldown` (`fresh`
or `cooldown`), `expected_status`, and 20–100 `pairs`. Each pair has `allowed`
and `denied` fixture objects with `email` and `password`. Prepare equal account
existence/confirmation states and matched cooldowns; use distinct fixtures for
fresh samples. Verify both cohorts' allowlist disposition privately. The tool
alternates cohort order. A fresh 429 is rejected, not counted as normal delivery.
For app flows it fetches a CSRF cookie before timing each POST. HTML fallback
comparison uses content type and byte length; independently inspect any variable
HTML/private traces rather than treating this as proof of indistinguishability.

Output contains counts and nearest-rank p50/p95/p99/max milliseconds, p95 gaps,
response-shape agreement, opaque versions and correlation IDs. Review maxima and
gaps against private traces; no invented statistical threshold establishes
absence of disclosure. Keep raw responses private. A malformed/missing cohort
or unexpected HTTP status fails collection. Compare signup/resend/recovery and
fresh/cooldown separately on both paths; repeat outliers under matching conditions.

Set `STAGING_AUTH_TIMING_EVIDENCE_JSON` privately to the sanitized direct report
when running `probe.js hook-receipt`. The receipt embeds it as `auth_timing`.
Readiness requires all six direct strata, at least 20 samples per cohort, matching
response shapes, deployed hook/source/configuration and an age <=24 hours.
Local reports cannot satisfy hosted readiness. App measurements follow the first
application deployment and remain required hardening evidence before broader
staging acceptance. No hosted measurements have been collected in this PR;
`promotion.json` remains blocked.

### Private timing-run correlation manifest

Run the operator command with two private paths:
`CARWORX_TIMING_OPERATOR_ACK=approved-synthetic-fixtures node scripts/ops/env/auth-email/timing.js <private-config.json> <private-run-manifest.json>`.
Create an owner-private directory outside every Git worktree first (POSIX mode
0700, or a Windows ACL allowing only the current owner/SYSTEM/Administrators).
The manifest must not exist. The collector verifies directory/file privacy,
creates it exclusively (POSIX mode 0600), and flushes each record before proceeding.
Windows ACL inspection uses the built-in PowerShell host with its own module path.
Do not place the configuration, manifest or private diagnostics in Git/artifacts.

Each stratum's public correlation UUID is assigned before any measurement and
stored in this private file alongside a private run UUID and input-config digest.
Request records contain the stratum UUID, fixture pair index/group, UTC start,
duration and HTTP status; look up the pair in the retained private configuration.
No addresses, bodies, credentials, cookies or response text enter the manifest.
The public report contains neither its private run UUID nor its path. Creation,
permission, write or completion failures stop collection and prevent a public
report; partial manifests are marked failed where possible and are not evidence.
Keep these owner-held files with the corresponding private traces through review.

For a ready PR, the reviewer must record a table for every required stratum:
path, flow, cooldown, p95 gap, allowed max, denied max, evidence reference,
accept/mitigate decision and rationale. Inspect outliers against the private
manifest rather than accepting the presence of quantiles as a verdict.
**Application-path timing remains a named blocker for broader staging acceptance**
after the first application deploy. Direct timing remains required before
promotion. No hosted timing evidence has been collected by this change.
