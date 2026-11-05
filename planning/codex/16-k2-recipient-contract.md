# Codex 16 — K2 recipient interfaces and readiness, agreement request v1

2026-11-05 UTC. Contract ID: `k2-recipient-v1`. The owner approved the next K2 plan for implementation, including **Claude's formal agreement before either recipient control is built**. Claude's review 5779427848 approves only the blocked skeleton at `dc7830d`; it is not agreement to these new interfaces. Promotion remains blocked. This document is the concrete handoff for agreement; no agent speaks for Claude.

## 1. Interfaces proposed for Claude's agreement

- Private binding: `STAGING_APPROVED_RECIPIENTS_JSON`, installed by the owner on both the application and dedicated Auth-email Worker. Parse a nonempty JSON array of valid email strings; trim and lowercase for exact matching. Do not strip plus tags or dots, use substrings or accept domain wildcards. Any malformed entry, malformed JSON, missing or empty policy denies delivery. No values, recipient-derived hashes, raw payloads or email bodies enter Git/chat/logs/artifacts.
- Non-secret binding: `CARWORX_ENV` (`local` or `staging`). Claude adds the application consumer; Codex supplies K2 bindings. Local mode is valid only with loopback application/Supabase origins and synthetic mail infrastructure. Hosted missing/unknown/local mode must fail closed for email actions. The deployed Auth-email Worker has no configurable test-provider URL or hosted local bypass.
- Application actions: before signup, resend or reset calls, Claude checks the recipient server-side. Unapproved addresses get the existing generic acknowledgement without an Auth call. Configuration/delivery failures get a generic recoverable failure. Never expose policy membership or input addresses in error text.
- Direct Auth: Codex builds a separate Cloudflare Worker for Supabase's Send Email HTTP Hook under `scripts/ops/env/auth-email/**`. Verify Standard Webhooks signatures over raw bytes before parsing/using the payload. Only signup confirmation and recovery are supported. Unknown actions (including email-change/invite/magic-link/reauthentication) fail closed; never send to a payload's alternative destination.
- Delivery: fixed Resend API transport, with `STAGING_RESEND_API_KEY`, `STAGING_AUTH_EMAIL_FROM`, `SEND_EMAIL_HOOK_SECRET` and the approved-recipient binding held only in the hook Worker. Link targets use the configured `APP_ORIGIN` and existing `/auth/confirm` token-hash flow. Ignore incoming redirect destinations. No Supabase service-role key, Edge Function, alternate provider or SMTP fallback is introduced.
- Hook rejection, invalid/stale signature, malformed payload, missing policy, provider failure or timeout produces a sanitized error and no alternate send. Test-only delivery injection terminates at a local synthetic sink and is absent from the production entry. The owner can deny all delivery while leaving the hook enabled; disabling the hook may restore SMTP.

The enabled hook replaces SMTP according to [Supabase's delivery behavior table](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook). [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks) documents error propagation and HTTP timeouts. Code/dependency versions will be pinned from official sources when this agreed interface is implemented.

## 2. Ownership and order

1. Claude posts a **formal PR review** agreeing or proposing changes to `k2-recipient-v1` and this document's exact commit. Suggested agreement marker: `INTERFACE: AGREE k2-recipient-v1 @<full-sha>` plus `Agent: claude`. An agreement is distinct from code approval.
2. Codex builds hook/config/tests in K2. Claude builds application checks and tests in its own PR. Keep application APIs with Claude. Serialize the Auth-hook section of `supabase/config.toml` and names-only example edits; Codex proposes these changes and Claude reviews them before incorporation.
3. Each agent reviews the other's exact implementation head. Required checks include genuine local Supabase-to-hook HTTP calls, approved confirmation/recovery into a capture sink, unapproved app calls with zero Auth calls, direct signup/resend/recovery with zero provider dispatch, unsupported actions, malformed/empty policy, aliases, signature failures, outages and no fallback. Reports must have executed tests and zero failed/skipped/TODO required cases. Preserve the 143 unit/168 RLS/45 Auth baseline, updating counts honestly when new tests arrive.
4. After hook review, the owner deploys/configures the hook and runs redacted hosted positive/negative probes. This bootstrap is a prerequisite, not A2's application deployment. The approved recipient set remains owner-held. Inbox absence alone is insufficient; capture hook decisions/provider-call counts without PII/tokens.
5. Codex's version-2 readiness validator checks implementation/evidence references, owner configuration and token scope before accepting ready. The owner runs application deployment after fresh combined-head CI and formal Claude approval, then the smoke harness decides whether A2 passes. Never equate `ready`, packaging or successful publication with A2.

## 3. Token/readiness agreement proposed

Use a Cloudflare resource-scoped **Editor** token for the application staging Worker only, plus necessary metadata access. Keep the hook deployment credential and Resend key out of the application workflow. Do not use an account-wide legacy editing token. On the recorded private/free GitHub setup use repository staging secrets/variables; do not claim an enforced environment main-only rule. Retain the in-script main check. Repository writers can reach that repository token; its enforced scope must contain its effects to the application staging Worker.

Version-2 `promotion.json` will identify this token-guard mode, exact Worker, token ID and immutable redacted policy-verification reference. Unknown/broader scope remains blocked. Owner-captured token-policy metadata and actual configuration evidence are prerequisites, never a self-attested Boolean. Official references: [GitHub private environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [Cloudflare Worker-level scopes](https://blog.cloudflare.com/workers-granular-authorization/).

Readiness also records the recipient setting/policy version, approved app/hook commits and evidence, deployed hook version/configuration, origin/route/binding verification, and required post-deploy smoke checks. Changed relevant code, configuration, hook version or credentials invalidates corresponding evidence. Keep the selected PR head, its main merge SHA, workflow SHA and deployment/version ID distinct. No self-referential final commit hash is embedded in its own policy file. Continue accepting PR review records only, not issue-comment fallback.

## 4. Owner checklist and acceptance still open

- Grant Codex's connector access to the existing staging Supabase organization/project.
- Confirm the Cloudflare account, dedicated application/hook Workers, HTTPS origins and owner-managed routes.
- Verify sending subdomain/sender and install the named hook secrets privately.
- Install approved-recipient settings and application bindings; create/install the Worker-scoped deployment token privately. Supply redacted scope, route, binding-name and hosted delivery evidence.

Owner execution remains necessary for hosted setup/deployment and any real delivery. Codex will not create accounts, install credentials, deploy, send real mail or spend. A2, real Google, A6/A7 staging evidence and D-060 remain open.

## 5. Work independent of agreement

Codex may implement read-only smoke/report tooling (health/no-store/dev-page behavior and secret binding presence without values), source/main merge SHA reporting, review-record regression tests and mandatory operations-test wiring now. No recipient implementation or token-model activation occurs before agreement. K3/K4 retain their separate branches/local synthetic scope and reciprocal review; heavy Docker recovery and performance measurement must be serialized after capacity preflight.
