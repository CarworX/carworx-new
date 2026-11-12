-- R-2 (retention schedule section 3): scheduled deletion for every Phase 2
-- schedule row that has a table. One entry point, private.run_retention(),
-- reached only by the scoped login retention_server through an invoker
-- wrapper (the forms_server pattern). A Worker cron calls it daily through
-- the Hyperdrive binding RETENTION_DB. It returns counts only: no row data,
-- email or text ever leaves the database. SYNTHETIC tests only.
--
-- Rows covered (planning/legal/retention-schedule.md section 2):
--   Enquiries, demand requests            -> private.purge_expired_forms() (P2-5)
--   Consent records                       -> private.purge_expired_forms() (P2-5)
--   Support cases                         -> private.purge_expired_forms() (P2-5)
--   Claims and transfer-of-control        -> decision (or last dispute
--                                            resolution) + 3 years
--   Verification method records           -> label removed (revoked) + 3 years
-- Rows not covered here, and why, are listed in the schedule's R-2 entry.

do $$ begin
  if not exists (select from pg_roles where rolname = 'retention_server') then
    create role retention_server nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;

-- Claims: a decided claim (approved, rejected or reversed) is kept 3 years
-- after its last decision. A claim with an open dispute, or still awaiting
-- review, is never purged. Disputes go with their claim (on delete cascade).
-- Verification method records: kept 3 years after the label was revoked.
create function private.purge_expired_provider_records(
  out claims_deleted integer, out verifications_deleted integer
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  with gone as (
    delete from public.listing_claims c
    where c.status in ('approved','rejected','reversed')
      and c.decided_at is not null
      and c.decided_at <= now() - interval '3 years'
      and not exists (
        select from public.claim_disputes d
        where d.claim_id = c.id
          and (d.status = 'open' or d.resolved_at > now() - interval '3 years'))
    returning c.id
  ) select count(*) into claims_deleted from gone;
  with gone as (
    delete from public.verifications v
    where v.revoked_at is not null and v.revoked_at <= now() - interval '3 years'
    returning v.id
  ) select count(*) into verifications_deleted from gone;
end $$;

-- The single scheduled entry point. Counts only, one row per job.
create function private.run_retention()
returns table(job text, deleted integer)
language plpgsql volatile security definer set search_path = '' as $$
declare f record; p record;
begin
  select * into f from private.purge_expired_forms();
  select * into p from private.purge_expired_provider_records();
  return query values
    ('demand_requests', f.demand_deleted),
    ('enquiries', f.enquiries_deleted),
    ('support_cases', f.support_deleted),
    ('consents', f.consents_deleted),
    ('listing_claims', p.claims_deleted),
    ('verifications', p.verifications_deleted);
end $$;

create function public.run_retention()
returns table(job text, deleted integer)
language sql volatile security invoker set search_path = '' as $$
  select * from private.run_retention()
$$;

revoke all on function private.purge_expired_provider_records(), private.run_retention(), public.run_retention()
  from public, anon, authenticated, service_role, forms_server, catalogue_server;
grant usage on schema private to retention_server;
grant execute on function private.run_retention(), public.run_retention() to retention_server;

-- The scoped server credential. No password ships here: private test tooling
-- sets a synthetic one locally; the owner sets the hosted one with VALID UNTIL.
alter role retention_server login connection limit 2;
