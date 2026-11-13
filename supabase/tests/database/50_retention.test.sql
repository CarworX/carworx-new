-- R-2 (retention schedule section 3): the scheduled retention entry point.
-- Only the scoped retention_server login can run it, through an invoker
-- wrapper; it returns counts only; it deletes exactly the rows past their
-- schedule period and keeps everything else. Rolled back. SYNTHETIC.
--
-- Actors: Olga owner of org R, Ada admin, Cleo claimant.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (id, email, email_confirmed_at) values
  ('b7000000-0000-4000-8000-000000000001', 'olga.owner@example.test', now()),
  ('b7000000-0000-4000-8000-000000000005', 'ada.admin@example.test', now()),
  ('b7000000-0000-4000-8000-000000000007', 'cleo.claimant@example.test', now());
-- Own catalogue fixtures: recovery CI (K4) runs without the seed.
insert into public.categories(slug,name) values ('r2-cat','R-2 test category (synthetic)');
insert into public.services(slug,category_slug,name) values ('r2-svc','r2-cat','R-2 test service (synthetic)');
insert into private.platform_admins(user_id) values ('b7000000-0000-4000-8000-000000000005');
insert into public.organisations(id,name) values ('b7100000-0000-4000-8000-00000000000a','Org R Retention (synthetic)');
insert into public.memberships(organisation_id,user_id,role,status) values
  ('b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000001','owner','active');
insert into public.listings(public_id,organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference) values
  ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','r2-svc','Synthetic listing one','Synthetic description','Gauteng','mobile','live','provider_application','synthetic-r2'),
  ('b7200000-0000-4000-8000-000000000002','b7100000-0000-4000-8000-00000000000a','r2-svc','Synthetic listing two','Synthetic description','Gauteng','mobile','live','provider_application','synthetic-r2');

select plan(26);

-- ===== Who may call what ====================================================
select ok(has_function_privilege('retention_server','public.run_retention()','execute'),
  'retention_server can execute the public wrapper');
select is_empty($$
  select r.rolname, f.sig from (values ('anon'),('authenticated'),('service_role'),('forms_server'),('catalogue_server')) r(rolname),
    (values ('public.run_retention()'),('private.run_retention()'),('private.purge_expired_provider_records()'),('private.purge_expired_forms()')) f(sig)
  where has_function_privilege(r.rolname, f.sig, 'execute')$$,
  'no API, forms or catalogue role can run any retention function');
select ok(not has_function_privilege('retention_server','private.purge_expired_forms()','execute')
  and not has_function_privilege('retention_server','private.purge_expired_provider_records()','execute'),
  'retention_server cannot call the purges directly, only the entry point');
select is_empty($$select p.oid from pg_proc p where p.oid in (
    'public.run_retention()'::regprocedure, 'private.run_retention()'::regprocedure, 'private.purge_expired_provider_records()'::regprocedure)
  and exists (select from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')$$,
  'PUBLIC has no EXECUTE on any retention function');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','private','auth','storage') and c.relkind in ('r','v','m','p')
  and (has_table_privilege('retention_server', c.oid, 'select,insert,update,delete')
       or has_any_column_privilege('retention_server', c.oid, 'select'))$$,
  'retention_server has no table, view or column privileges');
select is_empty($$select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private','api')
  and has_function_privilege('retention_server', p.oid, 'execute')
  and p.oid not in ('public.run_retention()'::regprocedure, 'private.run_retention()'::regprocedure)$$,
  'retention_server can execute nothing else in public, private or api');
select is_empty($$select rolname from pg_roles where rolname = 'retention_server'
  and not (rolcanlogin and rolconnlimit = 5 and not rolsuper and not rolbypassrls and not rolinherit and not rolcreaterole and not rolcreatedb)$$,
  'retention_server is a limited, non-inheriting login');
select is_empty($$select 1 from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = 'retention_server'$$,
  'retention_server is a member of no role');
select is_empty($$select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles g on g.oid = m.member
  where r.rolname = 'retention_server' and g.rolname = 'authenticator'$$,
  'PostgREST (authenticator) cannot switch to retention_server');
select ok((select not prosecdef and 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.run_retention()'::regprocedure),
  'the public wrapper is SECURITY INVOKER with an empty search_path');
select is_empty($$select p.proname from pg_proc p where p.oid in ('private.run_retention()'::regprocedure, 'private.purge_expired_provider_records()'::regprocedure)
  and (not p.prosecdef or not ('search_path=""' = any(p.proconfig)))$$,
  'private retention functions are SECURITY DEFINER with an empty search_path');
select is((select string_agg(a.name || ':' || format_type(a.typ, null) || ':' || a.mode::text, ',' order by a.n)
  from pg_proc p, unnest(p.proallargtypes, p.proargnames, p.proargmodes) with ordinality as a(typ, name, mode, n)
  where p.oid = 'public.run_retention()'::regprocedure),
  'job:text:t,deleted:integer:t', 'the entry point takes no input and returns a job name and a count, nothing else');

-- Clear anything the seed left past its period, so counts below are exact.
do $$ begin perform private.run_retention(); end $$;

-- ===== Fixtures: one row each side of every boundary =========================
-- Forms (P2-5).
insert into public.consents(id, purpose, notice_version, subject_email, granted_at) values
  ('b7300000-0000-4000-8000-000000000001','demand_notify','privacy-2025-10-01','old.demand@example.test', now() - interval '13 months'),
  ('b7300000-0000-4000-8000-000000000002','demand_notify','privacy-2026-10-01','fresh.demand@example.test', now() - interval '1 month'),
  ('b7300000-0000-4000-8000-000000000003','enquiry_share_with_provider','privacy-2025-10-01','old.enquiry@example.test', now() - interval '13 months'),
  ('b7300000-0000-4000-8000-000000000004','enquiry_share_with_provider','privacy-2026-10-01','fresh.enquiry@example.test', now() - interval '11 months'),
  ('b7300000-0000-4000-8000-000000000005','demand_notify','privacy-2022-10-01','ancient@example.test', now() - interval '4 years');
update public.consents set processing_ended_at = now() - interval '37 months', retain_until = now() - interval '1 day'
  where id = 'b7300000-0000-4000-8000-000000000005';
insert into public.demand_requests(email, category_slug, province, consent_id, created_at, last_activity_at, expires_at) values
  ('old.demand@example.test','r2-cat','limpopo','b7300000-0000-4000-8000-000000000001', now() - interval '13 months', now() - interval '13 months', now() - interval '1 month'),
  ('fresh.demand@example.test','r2-cat','limpopo','b7300000-0000-4000-8000-000000000002', now() - interval '1 month', now() - interval '1 month', now() + interval '11 months');
insert into public.enquiries(listing_public_id, organisation_id, sender_name, sender_email, message, consent_id, created_at) values
  ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Old Sender','old.enquiry@example.test','Synthetic old enquiry','b7300000-0000-4000-8000-000000000003', now() - interval '12 months 1 day'),
  ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Fresh Sender','fresh.enquiry@example.test','Synthetic fresh enquiry','b7300000-0000-4000-8000-000000000004', now() - interval '11 months');
insert into public.support_cases(email, topic, message, status, closed_at, close_note, created_at) values
  ('old.closed@example.test','other','Synthetic old closed case','closed', now() - interval '37 months','Synthetic note', now() - interval '38 months'),
  ('recent.closed@example.test','other','Synthetic recent closed case','closed', now() - interval '35 months','Synthetic note', now() - interval '38 months'),
  ('old.open@example.test','other','Synthetic old open case','open', null, null, now() - interval '38 months');

-- Claims (P2-4): decided 37 months ago (purged); decided 35 months ago (kept);
-- old but with a recently resolved dispute (kept); old with an open dispute
-- (kept); old and still awaiting review (kept).
insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, email_domain, status, review_method, review_note, decided_by, decided_at, created_at) values
  ('b7400000-0000-4000-8000-000000000001','b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000007','business_email','example.test','rejected','phone_call','Synthetic review','b7000000-0000-4000-8000-000000000005', now() - interval '37 months', now() - interval '38 months'),
  ('b7400000-0000-4000-8000-000000000002','b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000007','business_email','example.test','rejected','phone_call','Synthetic review','b7000000-0000-4000-8000-000000000005', now() - interval '35 months', now() - interval '38 months'),
  ('b7400000-0000-4000-8000-000000000003','b7200000-0000-4000-8000-000000000002','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000007','business_email','example.test','reversed','phone_call','Synthetic review','b7000000-0000-4000-8000-000000000005', now() - interval '40 months', now() - interval '41 months'),
  ('b7400000-0000-4000-8000-000000000004','b7200000-0000-4000-8000-000000000002','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000007','business_email','example.test','approved','phone_call','Synthetic review','b7000000-0000-4000-8000-000000000005', now() - interval '40 months', now() - interval '41 months');
insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, email_domain, status, created_at) values
  ('b7400000-0000-4000-8000-000000000005','b7200000-0000-4000-8000-000000000002','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000001','business_email','example.test','submitted', now() - interval '40 months');
insert into public.claim_disputes(claim_id, organisation_id, raised_by, reason, status, resolved_by, resolved_at, resolution_note, created_at) values
  ('b7400000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000001','Synthetic old dispute reason','dismissed','b7000000-0000-4000-8000-000000000005', now() - interval '37 months','Synthetic note', now() - interval '37 months 2 days'),
  ('b7400000-0000-4000-8000-000000000003','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000001','Synthetic later dispute reason','upheld','b7000000-0000-4000-8000-000000000005', now() - interval '2 months','Synthetic note', now() - interval '3 months');
insert into public.claim_disputes(claim_id, organisation_id, raised_by, reason, status, created_at) values
  ('b7400000-0000-4000-8000-000000000004','b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000001','Synthetic open dispute reason','open', now() - interval '39 months');

-- Verifications (P2-1): revoked 37 months ago (purged), revoked 35 months ago
-- (kept), live (kept).
insert into public.verifications(id, organisation_id, listing_public_id, method, verified_at, verified_by, evidence_reference, revoked_at) values
  ('b7500000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','b7200000-0000-4000-8000-000000000001','identity_checked', now() - interval '5 years','b7000000-0000-4000-8000-000000000005','synthetic-ref-1', now() - interval '37 months'),
  ('b7500000-0000-4000-8000-000000000002','b7100000-0000-4000-8000-00000000000a','b7200000-0000-4000-8000-000000000001','premises_visited', now() - interval '5 years','b7000000-0000-4000-8000-000000000005','synthetic-ref-2', now() - interval '35 months'),
  ('b7500000-0000-4000-8000-000000000003','b7100000-0000-4000-8000-00000000000a','b7200000-0000-4000-8000-000000000002','identity_checked', now() - interval '5 years','b7000000-0000-4000-8000-000000000005','synthetic-ref-3', null);

-- ===== Run as the scoped login, exactly as the Worker cron does =============
-- Rolled back with the test: lets this session assume the logins.
grant retention_server to postgres with set true, inherit false;
grant forms_server to postgres with set true, inherit false;
do $$ begin
  set local role retention_server;
  perform set_config('r2.result', (select jsonb_object_agg(job, deleted)::text from public.run_retention()), true);
  reset role;
end $$;

select is(current_setting('r2.result')::jsonb,
  '{"demand_requests":1,"enquiries":1,"support_cases":1,"consents":1,"listing_claims":1,"verifications":1}'::jsonb,
  'one run deletes exactly one expired row per job');
select is((select array_agg(email) from public.demand_requests where email like '%.demand@example.test'),
  array['fresh.demand@example.test'], 'demand inside 12 months is kept');
select is((select array_agg(sender_email) from public.enquiries where organisation_id = 'b7100000-0000-4000-8000-00000000000a'),
  array['fresh.enquiry@example.test'], 'an enquiry inside 12 months is kept');
select is((select array_agg(email order by email) from public.support_cases where email like '%@example.test' and message like 'Synthetic%'),
  array['old.open@example.test','recent.closed@example.test'], 'open cases and cases closed under 3 years ago are kept');
select ok(not exists (select from public.consents where id = 'b7300000-0000-4000-8000-000000000005'),
  'a consent past its 3-year proof period is deleted');
select ok((select processing_ended_at is not null and retain_until > now() + interval '35 months'
  from public.consents where id = 'b7300000-0000-4000-8000-000000000001'),
  'purged demand and enquiry consents start their 3-year proof clock');
select is((select array_agg(id::text order by id) from public.listing_claims where organisation_id = 'b7100000-0000-4000-8000-00000000000a'),
  array['b7400000-0000-4000-8000-000000000002','b7400000-0000-4000-8000-000000000003','b7400000-0000-4000-8000-000000000004','b7400000-0000-4000-8000-000000000005'],
  'only the claim decided over 3 years ago with no recent dispute is deleted');
select is((select count(*)::int from public.claim_disputes where claim_id = 'b7400000-0000-4000-8000-000000000001'), 0,
  'a purged claim takes its resolved dispute with it');
select is((select count(*)::int from public.claim_disputes where organisation_id = 'b7100000-0000-4000-8000-00000000000a'), 2,
  'disputes on kept claims are kept');
select is((select array_agg(id::text order by id) from public.verifications where organisation_id = 'b7100000-0000-4000-8000-00000000000a'),
  array['b7500000-0000-4000-8000-000000000002','b7500000-0000-4000-8000-000000000003'],
  'only the verification revoked over 3 years ago is deleted; live ones stay');
select ok(not exists (select from public.audit_log where details::text ~ '(example\.test|Synthetic|synthetic-ref)'),
  'audit entries for the deletions carry no email, text or evidence reference');

-- A second run is a no-op.
do $$ begin
  set local role retention_server;
  perform set_config('r2.again', (select sum(deleted)::text from public.run_retention()), true);
  reset role;
end $$;
select is(current_setting('r2.again'), '0', 'running again deletes nothing');

-- The other server logins cannot reach it at all.
create function pg_temp.refused(r text) returns text language plpgsql as $$
begin
  execute format('set local role %I', r);
  perform * from public.run_retention();
  reset role;
  return 'allowed';
exception when insufficient_privilege then
  reset role;
  return 'refused';
end $$;
select is(pg_temp.refused('forms_server'), 'refused', 'forms_server is refused');
select is(pg_temp.refused('anon'), 'refused', 'anon is refused');

select * from finish();
rollback;
