-- Claude 26: opening hours per day. set_listing_hours (owner/manager only,
-- audited, writes only changes) and api.listing_hours (catalogue_server only,
-- live listings only). Synthetic fixture; everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(36);

-- Fixture ----------------------------------------------------------------------
insert into auth.users(id, email, email_confirmed_at) values
  ('d5200000-0000-4000-8000-000000000001', 'hours-owner@example.test', now()),
  ('d5200000-0000-4000-8000-000000000002', 'hours-manager@example.test', now()),
  ('d5200000-0000-4000-8000-000000000003', 'hours-staff@example.test', now()),
  ('d5200000-0000-4000-8000-000000000004', 'hours-other@example.test', now());
insert into public.organisations(id, name) values
  ('d5200000-0000-4000-8000-000000000010', 'Synthetic hours business'),
  ('d5200000-0000-4000-8000-000000000020', 'Synthetic other business');
insert into public.memberships(organisation_id, user_id, role, status) values
  ('d5200000-0000-4000-8000-000000000010', 'd5200000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('d5200000-0000-4000-8000-000000000010', 'd5200000-0000-4000-8000-000000000002', 'manager', 'active'),
  ('d5200000-0000-4000-8000-000000000010', 'd5200000-0000-4000-8000-000000000003', 'staff', 'active'),
  ('d5200000-0000-4000-8000-000000000020', 'd5200000-0000-4000-8000-000000000004', 'owner', 'active');
insert into public.categories(slug, name) values ('hours-cat', 'Hours test category (synthetic)');
insert into public.services(slug, category_slug, name) values ('hours-svc', 'hours-cat', 'Hours test service');
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference) values
  ('d5201000-0000-4000-8000-000000000001', 'd5200000-0000-4000-8000-000000000010', 'hours-svc', 'Hours live', 'Synthetic live', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-hours'),
  ('d5201000-0000-4000-8000-000000000002', 'd5200000-0000-4000-8000-000000000010', 'hours-svc', 'Hours submitted', 'Synthetic submitted', 'Gauteng', 'mobile', 'submitted', 'admin_import', 'synthetic-hours'),
  ('d5201000-0000-4000-8000-000000000003', 'd5200000-0000-4000-8000-000000000010', 'hours-svc', 'Hours suspended', 'Synthetic suspended', 'Gauteng', 'mobile', 'suspended', 'admin_import', 'synthetic-hours');
insert into public.listing_hours(listing_public_id, organisation_id, day, opens, closes)
select l.public_id, l.organisation_id, d, '08:00', '17:00'
from public.listings l, generate_series(1, 5) d
where l.organisation_id = 'd5200000-0000-4000-8000-000000000010';

-- Structure and grants ------------------------------------------------------------
select is(pg_get_userbyid((select proowner from pg_proc where oid = 'api.listing_hours(uuid)'::regprocedure))::text,
  'listing_projection', 'public read owned by listing_projection');
select ok((select prosecdef and provolatile = 's' and proconfig @> array['search_path=""'] from pg_proc where oid = 'api.listing_hours(uuid)'::regprocedure),
  'public read is STABLE SECURITY DEFINER with an empty search_path');
select ok(has_function_privilege('catalogue_server', 'api.listing_hours(uuid)', 'execute'), 'catalogue_server can read hours');
select ok(not has_function_privilege('anon', 'api.listing_hours(uuid)', 'execute'), 'anon cannot execute the public read');
select ok(not has_function_privilege('authenticated', 'api.listing_hours(uuid)', 'execute'), 'authenticated cannot execute the public read');
select ok(not has_function_privilege('service_role', 'api.listing_hours(uuid)', 'execute'), 'service_role cannot execute the public read');
select ok(not has_table_privilege('anon', 'public.listing_hours', 'select'), 'anon still cannot read listing_hours');
select ok(not has_any_column_privilege('catalogue_server', 'public.listing_hours', 'select'), 'catalogue_server cannot read listing_hours directly');
select is_empty($$select attname from pg_attribute where attrelid = 'public.listing_hours'::regclass and attnum > 0 and not attisdropped
  and attname in ('id','organisation_id') and has_column_privilege('listing_projection', attrelid, attnum, 'select')$$,
  'projection owner cannot read row or organisation IDs');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'private.set_listing_hours(uuid,jsonb)'::regprocedure),
  'edit is SECURITY DEFINER with an empty search_path');
select ok((select not prosecdef from pg_proc where oid = 'public.set_listing_hours(uuid,jsonb)'::regprocedure), 'edit wrapper is SECURITY INVOKER');
select ok(has_function_privilege('authenticated', 'public.set_listing_hours(uuid,jsonb)', 'execute'), 'signed-in users can call the edit wrapper');
select ok(not has_function_privilege('anon', 'public.set_listing_hours(uuid,jsonb)', 'execute')
  and not has_function_privilege('anon', 'private.set_listing_hours(uuid,jsonb)', 'execute'), 'anon cannot edit hours');
select ok(not has_function_privilege('service_role', 'public.set_listing_hours(uuid,jsonb)', 'execute'), 'no service_role grant on the edit');

-- Public read as the real scoped server role -----------------------------------------
grant catalogue_server to postgres with set true, inherit false;
create function pg_temp.h(p uuid) returns setof jsonb language plpgsql as $$
begin
  set local role catalogue_server;
  return query select to_jsonb(r) from api.listing_hours(p) r;
  reset role;
end $$;
select is((select count(*)::integer from pg_temp.h('d5201000-0000-4000-8000-000000000001')), 5, 'live listing: five open days');
select is((select j from pg_temp.h('d5201000-0000-4000-8000-000000000001') j limit 1),
  '{"day": 1, "opens": "08:00", "closes": "17:00"}'::jsonb, 'rows are day plus HH:MM text only, Monday first');
select is((select count(*)::integer from pg_temp.h('d5201000-0000-4000-8000-000000000002')), 0, 'submitted listing: no hours');
select is((select count(*)::integer from pg_temp.h('d5201000-0000-4000-8000-000000000003')), 0, 'suspended listing: no hours');
select is((select count(*)::integer from pg_temp.h('00000000-0000-4000-8000-000000000000')), 0, 'unknown listing: no hours');
create function pg_temp.direct_read() returns text language plpgsql as $$
begin
  set local role catalogue_server;
  perform from public.listing_hours;
  reset role;
  return 'read';
exception when insufficient_privilege then
  reset role;
  return 'refused';
end $$;
select is(pg_temp.direct_read(), 'refused', 'catalogue_server table read is refused');

-- Edit -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d5200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001',
  '[{"day":1,"opens":"08:00","closes":"17:00"},{"day":2,"opens":"08:00","closes":"17:00"},{"day":3,"opens":"08:00","closes":"17:00"},
    {"day":4,"opens":"08:00","closes":"17:00"},{"day":5,"opens":"07:30","closes":"16:00"},{"day":6,"opens":"08:00","closes":"13:00"}]')$q$,
  'owner sets per-day hours');
reset role;
select is((select array_agg(day::text || ' ' || to_char(opens, 'HH24:MI') || '-' || to_char(closes, 'HH24:MI') order by day)
  from public.listing_hours where listing_public_id = 'd5201000-0000-4000-8000-000000000001'),
  array['1 08:00-17:00','2 08:00-17:00','3 08:00-17:00','4 08:00-17:00','5 07:30-16:00','6 08:00-13:00'], 'each day keeps its own times');
select is((select count(*)::integer from public.audit_log where target_table = 'listing_hours'
  and actor_id = 'd5200000-0000-4000-8000-000000000001'), 2, 'only the two changed days are audited, with the actor');
set local role authenticated;
select lives_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[{"day":6,"opens":"08:00","closes":"13:00"}]')$q$,
  'closing days removes their rows');
reset role;
select is((select count(*)::integer from public.listing_hours where listing_public_id = 'd5201000-0000-4000-8000-000000000001'), 1, 'closed days are gone');
set local role authenticated;
select lives_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[]')$q$, 'closed all week is allowed');
select throws_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[{"day":1,"opens":"17:00","closes":"08:00"}]')$q$,
  '22023', 'invalid_input', 'closing before opening is refused');
select throws_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[{"day":1,"opens":"08:00","closes":"17:00"},{"day":1,"opens":"09:00","closes":"12:00"}]')$q$,
  '22023', 'invalid_input', 'a repeated day is refused (one period per day)');
select throws_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[{"day":8,"opens":"08:00","closes":"17:00"}]')$q$,
  '22023', 'invalid_input', 'day 8 is refused');
select throws_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[{"day":1,"opens":"8am","closes":"17:00"}]')$q$,
  '22023', 'invalid_input', 'a malformed time is refused');
reset role;

set local request.jwt.claims = '{"sub":"d5200000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[{"day":1,"opens":"09:00","closes":"18:00"}]')$q$,
  'a manager can set hours');
reset role;

set local request.jwt.claims = '{"sub":"d5200000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[]')$q$, '42501', 'not_allowed', 'staff cannot set hours');
select is((select count(*)::integer from public.listing_hours where listing_public_id = 'd5201000-0000-4000-8000-000000000001'), 1,
  'staff can still read their own listing''s hours');
reset role;

set local request.jwt.claims = '{"sub":"d5200000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[]')$q$, '42501', 'not_allowed', 'another organisation''s owner is refused');
select throws_ok($q$select public.set_listing_hours('00000000-0000-4000-8000-000000000000', '[]')$q$, '42501', 'not_allowed', 'an unknown listing fails the same way');
reset role;

set local request.jwt.claims = '{"role":"authenticated"}';
set local role authenticated;
select throws_ok($q$select public.set_listing_hours('d5201000-0000-4000-8000-000000000001', '[]')$q$, '42501', 'not_allowed', 'no signed-in user is refused');
reset role;

select * from finish();
rollback;
