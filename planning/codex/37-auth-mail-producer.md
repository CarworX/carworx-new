# Queued Auth email producer

Updated 2026-11-13 UTC. Source only; not deployed, not production-ready.

The separate `queued.js` Worker verifies Supabase's raw signed Send Email Hook payload before enqueueing signup confirmation or password recovery. Other Auth actions fail closed. It ignores the payload's redirect URL; the dispatcher constructs only the configured app origin's /auth/confirm link. Staging recipient restrictions remain mandatory. No email address or Auth token hash is stored outside the encrypted envelope.

The dedicated `mail_producer` login can execute only private.enqueue_mail. It cannot read tables, claim mail, finish sends or record delivery events. The producer needs the shared encryption key, never a Resend API key or service-role key. Existing dispatch uses mail_server and the same global quota and suppression policy. Hook IDs are hashed into stable logical keys; duplicate hooks cannot extend queue expiry. Auth envelopes expire ten minutes after their first enqueue, and require a new Auth request if not dispatched in time.

## Integration after checks resume

1. Apply the append-only suppression migration in #93, then the Auth producer migration in this PR.
2. Provision a separate expiring mail_producer credential inside a Hyperdrive configuration, with caching disabled. Replace only the placeholder ID in queued.wrangler.jsonc; do not reuse a broader role.
3. Configure names only: APP_ORIGIN, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CARWORX_ENV=staging, STAGING_APPROVED_RECIPIENTS_JSON, MAIL_ENABLED=1, AUTH_MAIL_QUEUE_ENABLED=1, MAIL_ENCRYPTION_KEY and SEND_EMAIL_HOOK_SECRET. No Resend credential belongs on this producer.
4. Configure the existing app dispatcher with its mail_server binding, sender verification and approved recipients. A scheduled drain must be configured and observed before switching the Auth hook. Current source drains one item per invocation; this is not yet a throughput guarantee.
5. Deploy this separate Worker using queued.wrangler.jsonc and point staging Auth's Send Email Hook at its /auth-email path with a fresh signing secret. Preserve the old staging hook for rollback; do not run both producers.
6. Resume signed-hook, SQL grants, expiry, duplicate, suppression and actual delivery checks before activation. Do not enable production emailDecision; production remains unavailable.

No tests, migration execution, deploy, credential provisioning or live mail occurred. Source formatting and syntax inspection are the only checks in this paused-test batch. This depends on #93; coordinate with Claude's current staging deployment.

Sources checked 2026-11-13: [Supabase Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## History

- 2026-11-13 UTC: added encrypted Auth templates, an enqueue-only producer role and a separate opt-in staging hook entry. Existing K2 hook and production Auth policy remain unchanged.
