# K4 local recovery drill

Run `pwsh -File scripts/ops/backup/drill.ps1` from a committed Windows
checkout. The launcher archives the exact revision and runs it under the
unprivileged user in `CarworX-Native` with Supabase 2.122.1, Node 24.22.2
and the matching PostgreSQL 17 clients from Supabase's verified cache.
It requires 7 GiB free on C:, checks a 2 GiB margin before each stack
start and locks out concurrent K4 runs.

## Recovery steps

1. Start the disposable native source on dynamically assigned loopback ports.
   Disable seed replay and omit the two unsupported local Auth mail templates
   in the scratch copy. Populate synthetic identities, tenants, memberships,
   audit rows, a TOTP factor and two private Storage objects. Quiesce writes.
2. Export the selected application and Auth tables and audit sequence using
   `pg_dump`. Save the exact config and migrations, schema and role inventory,
   migration history count and digest, bucket settings and Storage bytes.
   The manifest records the source revision, export window, counts, object
   versions and SHA-256 hashes. Validate every payload before the manifest is
   finalized. Keep the bundle and raw logs private inside WSL.
3. Stop the source. Verify the saved manifest and bootstrap a fresh native
   target from the same baseline. Compare schema, role and migration history
   inventories. Decode the custom database archive and replay it with
   `psql --single-transaction`. Pause only the two application audit triggers
   during replay and re-enable them in the same transaction. Auth triggers
   and FK checks stay active.
4. Compare table counts and hashes. Recreate the private bucket and upload the
   saved objects through the Storage API as their owners. Verify object
   ownership, bytes and access. The restored Storage versions are newly assigned.
5. Run the existing RLS suite against the target and verify tenant boundaries,
   revoked access and admin TOTP with genuine local sessions. Stop the target.
   Record the sanitized JSON receipt. If a command fails, use the reported
   private run directory to diagnose it. Review stopped stack IDs and their
   paths before cleanup. Preserve the development stack and the evidence bundle.

This procedure covers a quiet synthetic fixture. Live database and object
snapshot coordination, Auth email flows and hosted recovery are separate.
The runner retains the private bundle and stopped test data for review.

## Hosted recovery remains blocked

After K2, the owner selects an existing private destination, a separate
second copy and an operator. Use authenticated client-side encryption to
an owner-controlled recovery public key before transfer. Keep the private
key offline, keep a separate recovery copy and exercise decryption and
manifest verification before the staging restore. Owner approval is
required for capacity, egress, runner usage and retention.

Proposed defaults are daily and pre-migration exports, a 24-hour RPO and a
missed-backup alert, with seven daily and four weekly sets subject to approved
retention and legal holds. Measure a staging restore before setting RTO.
A7 remains open until a staging restore verifies database data, object bytes
and access controls. Scheduling and hosted execution remain owner-controlled.

The K4 recovery workflow runs the same synthetic drill on standard Ubuntu with
Docker-based Supabase. It validates every expected TAP report using the K1
validator and derives the assertion count from those reports. Its only artifact
is the sanitized summary. The WSL launcher is optional.
