# Queued-mail suppression handoff

Updated 2026-11-13 UTC. Backend-only follow-up to #84's delivery suppression finding.

## Change
A bounce or complaint now retires queued messages and expired leases for that recipient, erases their encrypted payloads, and prevents claim from selecting them. All five queue capabilities take the existing quota advisory lock before row locks. Retry completion cannot requeue a suppressed recipient. Signed events received before send completion also trigger retirement when the provider ID is attached.

Active sends cannot be recalled; their completion still records the provider outcome. Existing RPC signatures, scoped mail_server grants, quota limits and idempotency windows are unchanged. The helper is not granted to clients or mail_server.

## Evidence and next action
Source inspected against main 4b3749453ae4226f915398ae02f21b4bead3bf9e; five capability definitions and five advisory-lock acquisitions checked in memory. No SQL execution or tests were run: the owner requested tests be paused, and local disk remains full. Runtime/concurrency behavior is UNVERIFIED. Keep this PR draft until checks resume; do not apply it concurrently with Claude's MVP staging migration.

## History
- 2026-11-13 UTC: #84 confirmed merged; Claude owns the MVP staging deployment to CarworX App and frontend. Codex published this isolated backend source change for coordination. No deployment, real mail, credentials or local files changed.
