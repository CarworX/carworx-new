# K2 environment readiness and T3 handoff

Read-only inventory, 2026-11-04 UTC. This is preflight evidence, not K2 completion or A2. No deployment, DNS, project, email or credential configuration was changed.

## Verified inventory

| Requirement                                 | Observed state                                                                                                                                                                                                                      | Next step                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing staging Supabase project           | D-062 identifies `gdiyrdqfkthtcglgqnts` as staging. It is absent from the connected CarworX Org and general Supabase project inventories checked this turn. A different CarworX dev project is visible; it has not been substituted | Owner supplies access to the existing intended project or explicitly corrects the project mapping                                                                |
| Cloudflare account and staging Worker/route | The connected account has no `carworx.app` zone and no CarworX Worker in the returned script list                                                                                                                                   | Confirm the intended account, domain control and staging route; configure access in the connector/owner environment                                              |
| Resend sending domain                       | No CarworX domain appears in the connected account's returned domain list                                                                                                                                                           | Confirm the intended account/subdomain and its verification; owner executes DNS setup                                                                            |
| Repository Actions secret/variable metadata | `gh secret list --json name` and `gh variable list --json name` both returned empty lists                                                                                                                                           | Owner supplies staging-only names/values through the approved secret store after the configuration contract is reviewed; no secret values were requested or read |
| Current application configuration           | T1 Wrangler config has only name, entry point and compatibility date. Tracked `.env.example` contains guidance but no variable names. No deployed staging configuration is established by these files                               | Implement explicit local/staging configuration and the reviewed-SHA manual workflow in K2                                                                        |
| Google OAuth                                | Owner reported client creation and staging provider enablement in D-062. Current connected access cannot verify this project or local callbacks                                                                                     | Confirm local/staging callback setup with T3; real login remains an acceptance test, not a provider-toggle check                                                 |
| Recipient controls                          | No reviewed application/Auth SMTP restriction or approved recipient set is evidenced                                                                                                                                                | Agree the contract below with Claude before staging Auth/email tests                                                                                             |

Absence from these inventories means unavailable through the inspected connections. It does not prove that the owner's resources do not exist. No unrelated account/project/domain details or credential values are included here.

## Proposed acceptance contract for Claude / T3

**AGREEMENT PENDING.** K2 owns environment configuration, workflow and operations. Claude owns application/Auth routes and the Auth section of Supabase config. Shared config edits are serialized.

- Local confirmation/reset/delivery-failure tests use Supabase's local mail sink and synthetic recipients. Local service keys stay private and ephemeral.
- Staging starts with email disabled until both application delivery and direct Supabase Auth SMTP are restricted. An application-only allowlist cannot satisfy this boundary.
- The owner supplies the approved staging recipient set through private configuration. Test approved recipients succeed and unapproved recipients are rejected through both delivery paths, including direct Auth requests. Record redacted results and the exact source/environment.
- The concrete SMTP/provider enforcement mechanism must be proposed by K2 and accepted with T3 once the intended sending account is available. This preflight does not assert that Resend offers a recipient allowlist or that any relay already exists.
- Stage sign-in remains blocked until both restrictions are demonstrated, T3/T5 security boundaries are reviewed, and the owner executes the staging deployment. The Google path additionally requires real client/callback evidence.
- `CARWORX_DEV_PAGES=1` is agreed for staging review/K3 only; production must omit it. This is a non-secret configuration flag, not a deployed value today.

## K2 implementation and evidence boundary

Use branch `codex/k2-environments`. K2 owns `apps/web/wrangler.jsonc`, `.github/workflows/deploy-staging.yml` and `scripts/ops/env/**`; application APIs remain Claude-owned.

The next K2 implementation must document actual configuration/secret names without values, supply a manually triggered owner-run staging workflow, identify the exact reviewed source SHA and applicable successful CI, and fail on missing setup or evidence. It must not deploy on push or reuse production credentials. Add runtime environment names only with their actual consumers and Claude-reviewed contracts; this inventory introduces none beyond the previously agreed dev-page flag.

Hosted A2 requires the owner-executed deployment/run URL, deployed SHA and synthetic smoke results. Until then, A2 remains BLOCKED. This preflight does not pass A3, hosted A6 or A7.
