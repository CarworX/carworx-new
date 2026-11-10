# Codex 21 — P2-1 catalogue foundation

2026-11-10 (SAST). The owner authorised starting P2-1 from Claude 17 using
§3 defaults, locally/in CI with synthetic data. Claude must formally review
the exact head before merge. No Phase 2 deployment or production authority.

## Schema and privacy contract

Seven tables: categories, services, coordinate_sources, branches, listings,
service_areas and verifications. Random public UUIDs are independent of private
row IDs. Composite foreign keys bind branches, locations and verifications to
their organisation. Client updates cannot reassign organisation/private/public
identities. Checks constrain coordinate ranges, positive radius, modes, status,
source type, labels and text sizes. Temporary geocoding is not a supported
coordinate source. There is no geocoding client or stored customer query point.

`listing_public` is an exact-column security-barrier view owned by
`listing_projection`, which has column-only grants and live-row RLS. Joins use
public IDs/slugs: the owner cannot read organisation/private IDs, provenance,
service-area columns or verification evidence. Mobile rows have no pin/address,
radius or base-derived distance. Public text requires admin content review:
column security cannot recognise coordinates typed into a description.

`listing_eligibility` is separate and can read only live mobile geometry and the
public matching key. P2-2 supplies its bounded helper, stable public-key paging,
coarse inputs, signed cursors and rate limits. No eligibility/search RPC ships
here. `private` stays unexposed.

Server role choice: a dedicated `catalogue_server` NOLOGIN/NOBYPASSRLS role, not
the broad built-in service_role. It has no data/function grants and no
authenticator membership in this slice. P2-2 must demonstrate a supported
server-only credential path and narrowly grant only the wrapper before calling
it. Do not install the project's JWT signing secret in the application merely
to mint custom-role tokens. If a safely scoped credential path cannot be
demonstrated, stop and revise the access contract before search implementation.
PostgREST role switching requires explicit membership:
[official authentication model](https://docs.postgrest.org/en/stable/references/auth.html).

All base tables have RLS and no anonymous grant/policy. Active members read
their own tenant data; verification evidence and global taxonomy administration
remain admin-only. Every client mutation is admin-only at aal2. Provider writes
and application transitions are deliberately deferred to P2-4. Catalogue audit
triggers append IDs/actions but never copy coordinates, prose or evidence into
audit details. Existing audit immutability is preserved.

## Defaults and migration operation

Claude 17's six category defaults and three method-based labels are represented.
Gauteng is one reversible synthetic fixture metro; the proposal left the launch
metro for the owner to name, so this does not confirm a real launch region.
Seeds are labelled synthetic, including the fixed/mobile published fixtures and
the hidden submitted fixture. No real providers or evidence are introduced.
Claims, applications, consent/retention execution and Turnstile arrive in their
assigned slices, not this migration.

This is an additive migration with small synthetic tables and no backfill.
Existing Phase 1 tables are not rebuilt. Dedicated roles survive a local reset;
creation is guarded. Test their exact privileges on every run. Rollback is a
reviewed operation: remove the view/triggers and new tables in reverse dependency
order, then drop unused roles after checking dependents. Do not run destructive
rollback against hosted data. Prefer a forward migration once data is retained.

## Checks and limits

- Extended A4: seven tables × anonymous/self/member/other/admin × four operations
  = 140 pgTAP assertions. Writes are rolled back in subtransactions; FK-protected
  deletion is distinguished from permission denial. Seed fixtures are verified when present; recovery tests construct the same
  transaction-local fixtures when seeding is disabled.
- 38 catalogue assertions cover exact columns, grants, view owner, mobile JSON
  invariance under base/radius changes, revocation, labels, audit redaction,
  tenant FKs, coordinate checks, forged metadata, aal1 denial and immutable IDs.
- The existing 23-assertion catalogue guard now allows only the named capability
  policies and anonymous SELECT on listing_public. It still rejects other new
  client grants and checks every table's RLS/default privileges.
- K1 discovers every SQL suite and requires nonzero matching TAP with no failures,
  skips or TODOs. Heavy execution stays in GitHub CI (D-070). No Docker reinstall.

No hosted acceptance is claimed. A10 coverage here is the database projection;
SSR, HTTP logs and caches await P2-2/P2-3. K4 currently exports the Phase 1 table
set: extend/review its payload and restore/access checks for catalogue data
before Phase 2 staging/G-PROD. Search eligibility, rate-limiter free-tier proof,
P2-4 publication completeness checks and real owner design checks remain open.

Agent: codex

### CI follow-up

Initial CI failed during stack startup, before TAP execution. A second attempt
also failed at source-start despite explicit ownership-transfer capability.
Added fixed-label database diagnostics to K1/K4 so private service output remains
unpublished while permission/syntax/role failures can be assigned correctly.
The unseeded recovery path now constructs its fixtures transactionally. These
changes do not turn missing runtime evidence into a pass. See the current PR
checks and subsequent commits for the final result.

The diagnostic run at e092d5d reported `database-ownership` during source-start.
After ownership transfer, the migration had dropped its temporary owner
capability before finishing ACL/comment operations. Those operations now run
with the temporary capability, then SET/INHERIT are disabled. postgres retains
only explicit SELECT on the public view for dump/introspection. Final capability
roles remain NOLOGIN/NOBYPASSRLS with no private IDs granted to the view owner.
