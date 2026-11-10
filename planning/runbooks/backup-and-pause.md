# Production backup, pause plan and A7 re-run (D-044)

**Status:** draft for owner review, 2026-11-10 (SAST). Nothing here has been run against a hosted project. The owner runs or approves every hosted step.

**Why:** the free plan gives **no automatic backups** and **pauses** a project after a week without activity. G-PROD needs a working no-cost backup route, a pause plan and a passed restore drill on the final schema (PLAN §18, D-044).

## 1. What the free plan gives, from Supabase's own pages

Read 2026-11-10.

| Fact | Source |
|---|---|
| "Automatic backups: Not included in free"; "Point in time recovery: Not included in free" | [Pricing](https://supabase.com/pricing) |
| "We recommend that free tier plan projects regularly export their data using the Supabase CLI `db dump` command and maintain off-site backups" | [Backups](https://supabase.com/docs/guides/platform/backups) |
| "Database backups do not include objects you store via the Storage API" | [Backups](https://supabase.com/docs/guides/platform/backups) |
| "Daily backups do not store passwords for custom roles"; after a restore "you will need to reset their passwords" | [Backups](https://supabase.com/docs/guides/platform/backups) |
| "Free projects are paused after 1 week of inactivity. Limit of 2 active projects." | [Pricing](https://supabase.com/pricing) |
| A paused project can be restored "with a single button click" for 1 year; after that, the backup and Storage objects can only be downloaded | [Upgrading](https://supabase.com/docs/guides/platform/upgrading) |
| "Paused projects do not count towards your free project limit" | [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase) |
| Deleting a project "permanently remove[s] all associated data, including any backups" | [Backups](https://supabase.com/docs/guides/platform/backups) |

## 2. The no-cost backup route

The same route as the K4 drill ([restore-drill.md](restore-drill.md)), pointed at production.

```
production project ──pg_dump (schemas, data, roles inventory)──┐
                   └─Storage API (object bytes, if any)────────┤
                                                               ▼
                                       manifest + SHA-256 ─► encrypt to owner's public key
                                                               │
                         ┌─────────────────────────────────────┴──────────────┐
                         ▼                                                    ▼
             copy 1: owner-only cloud folder                 copy 2: separate offline folder
```

| Item | Proposed default | Why |
|---|---|---|
| What | `public`, `private`, `auth`, `storage`, `supabase_migrations` schemas; the role and membership inventory; Storage object bytes; a manifest with counts and hashes | The same scope K4 proved locally |
| How often | Daily, plus one **before every migration** | 24-hour recovery point, as K4 proposed |
| Kept | 7 daily and 4 weekly sets | K4 proposal; must match the retention schedule (legal PR) |
| Encryption | Encrypt **before** upload, to a public key the owner holds. The private key stays offline | D-072 |
| Destinations | Two existing private places the owner already controls, separate from staging's (D-072). **Owner to name them (OQ-B1)** | One compromised account can't delete both |
| Who runs it | The owner, or an owner-approved scheduled job that holds a **read-only** database login, never the owner's password | PLAN §12 |
| Cost | $0: existing storage, included GitHub Actions minutes (D-070) | D-044 |
| Alert | The owner hears about a missed backup the same day | K4 proposal |

**Open questions for the owner:**
- **OQ-B1.** Which two destinations hold production copies? Production copies shouldn't share a folder with staging copies.
- **OQ-B2.** Who may run a restore if you're away?
- **OQ-B3.** The encryption tool isn't chosen yet. The automation PR must pin one from its official source and record it.

## 3. The pause plan

A paused production project means the public site shows "unavailable" for every search. That's a launch-blocking outage, not a cost saving.

| Step | What | Who |
|---|---|---|
| 1 | The daily backup job also makes one small, real read query, so the project is never idle for a week | Owner-approved job |
| 2 | A weekly check that the project state is **active** | Owner (2 minutes, from the dashboard) |
| 3 | If it pauses anyway: restore from the dashboard; it takes one click inside the 1-year window | Owner |
| 4 | After a restore: reset the `catalogue_server` password and update Hyperdrive (custom-role passwords aren't kept), then run the smoke checks in [production-setup.md](production-setup.md) §9 | Owner |
| 5 | Record the outage in the incident log if it was visible to visitors | Owner |

**Open question OQ-B4.** Supabase doesn't define "inactivity" on the pages read. Step 1 is a reasonable keep-alive, not a documented guarantee. **Check with the Supabase dashboard after the first week.** If the project still pauses, the honest fixes are an owner decision: accept it, or upgrade to Pro (not approved, D-044).

**Two-project limit.** Staging plus production uses both free slots. A restore drill into a third project needs one of them paused first, or a local target (section 4).

## 4. Plan to re-run A7 on the final Phase 2 schema

PLAN §3 says A7 is repeated after material schema changes. Phase 2 added catalogue, search and (Bundle A) provider and admin tables.

| Step | What | Evidence |
|---|---|---|
| 1 | Freeze the schema: the last Phase 2 migration is merged | Migration count and latest file name |
| 2 | Run the K4 synthetic drill in CI on that `main` commit (`recovery.yml`) | Green run link, the TAP assertion count (it must cover the new tables) |
| 3 | Seed **staging** with synthetic data across every Phase 2 table, plus two private Storage objects | Seed receipt |
| 4 | Export staging through the route in section 2, encrypt and copy to both destinations | Ciphertext SHA-256 from **both** copies matches |
| 5 | Restore into an isolated target (local native stack, or a third free project only while another is paused) | Counts and hashes match; object bytes match |
| 6 | Run the RLS suite on the target; check the `catalogue_server` grants, that `api` and `private` aren't exposed, and the search boundary tests | TAP counts; zero failures |
| 7 | Reset the `catalogue_server` password on the target and prove one search works | One search response |
| 8 | Destroy the target; keep only the sanitized receipt | Receipt JSON, reviewed |

**Pass:** every count and hash matches, every RLS assertion passes and admin TOTP works on the restored target. A local or CI pass is **preparatory** (D-059). A7 passes only on the hosted staging restore.
