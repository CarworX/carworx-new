# K2 environment readiness and T3 handoff

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
