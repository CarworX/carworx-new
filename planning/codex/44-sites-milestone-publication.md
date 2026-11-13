# CarworX Sites milestone publication

2026-11-13 19:58 UTC. Owner authorized the current refresh and future updates at
completed-feature milestones rather than frequent small edits.

## Published

- Existing Site: `appgprj_6aecdc5ca79c8191948a85eb1e971c94`.
- URL: https://carworx.gerrardlewu.chatgpt.site
- Version **3**, Site source `d3fa09df63f187add507c9c66b8f31073b83ff2b`.
- Deployment `appgdep_6af76baf46ec8191919aec47b6cabe60`: native result
  `succeeded`. Readback confirms version 3, `custom` access revision 2 and one
  existing external visitor. No access-policy write occurred.
- Refreshed approved Studio journeys: provider application, setup, staff,
  account and admin screens, with customer-facing entry points. Added a linked
  Progress page distinguishing directory readiness from second-release work.
- Retained fictional data and simulated-action labels. This Site does not
  perform real bookings, sends, payments or authentication.

## Checks and fixes

- `node --check dist/app.js` and `node test-preview.cjs` passed: 17 customer
  routes, 17 onboarding pages, 302 local URLs/assets, all five role menus,
  restricted sign-in fallbacks and recovery simulation.
- Malformed/duplicate role selectors fall back to the fictional driver;
  prototype-key admin fixture selectors fall back to the known fixture.
  Fixed the VM test's missing browser location base, with role-query regressions.
- In-app browser: Progress rendered at 1280px with no horizontal overflow;
  application Start opened the Business step at 390px, with document width
  390px. Temporary viewport reset. This is representative responsive QA, not
  a D-060 physical-device or full accessibility acceptance claim.
- Pushed/saved the Site's exact source and packaged archive before deploying.
  The public coming-soon Worker and directory staging Worker were not changed.

## Staging remains distinct

Cloudflare reconnection now works. Read-only API inspection verified the three
staging Hyperdrive configs target the recorded Supabase project with scoped
logins and caching disabled. `carworx-web-staging` has no version/settings;
`carworx-auth-email-staging` does not exist. No staging custom domain is
attached. Access API reports `access.api.error.not_enabled`.

The owner was asked for the approved staging hostname/Access application, not
for renewed deployment permission. Existing approval persists. Runtime and
Auth-hook readiness evidence in the committed promotion policy is still
missing. No deployment with missing controls or public staging fallback.

Future Site updates follow [the milestone policy](../sites-customer-preview/UPDATE-POLICY.md).
No timer, unattended monitor or automatic publish pipeline was created.
