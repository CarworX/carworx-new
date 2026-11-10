-- P2-2 search (A8 A9 A10 A11 A17). Isolated synthetic Cape Town fixture with its
-- own category/services; independent of the seed. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(48);

-- Fixture ----------------------------------------------------------------------
insert into public.organisations(id, name) values ('5ea0c000-0000-4000-8000-0000000000a1', 'Search fixture (synthetic)');
insert into public.coordinate_sources(id, organisation_id, source_kind, licence_note)
  values ('5ea0c000-0000-4000-8000-0000000000c1', '5ea0c000-0000-4000-8000-0000000000a1', 'provider_supplied', 'Synthetic search fixture');
insert into public.categories(slug, name) values ('srch-cat', 'Search test category');
insert into public.services(slug, category_slug, name) values
  ('srch-fixed', 'srch-cat', 'Search fixed'), ('srch-mobile', 'srch-cat', 'Search mobile'), ('srch-other', 'srch-cat', 'Search other');

-- 45 fixed premises within 2 km (several share a 0.1 km bucket), one at 24.90 km,
-- one at 25.11 km. Query point (-33.9, 18.4); 1 deg latitude = 111.195 km.
insert into public.branches(public_id, organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id)
select ('5ea0b000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, '5ea0c000-0000-4000-8000-0000000000a1',
  'Synthetic branch ' || i, i || ' Synthetic Road', -33.9 + (i % 9) * 0.002, 18.4, '5ea0c000-0000-4000-8000-0000000000c1'
from generate_series(1, 45) i;
insert into public.branches(public_id, organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id) values
  ('5ea0b000-0000-4000-8000-000000000901', '5ea0c000-0000-4000-8000-0000000000a1', 'Edge in', 'Edge in', -33.9 + 0.22394, 18.4, '5ea0c000-0000-4000-8000-0000000000c1'),
  ('5ea0b000-0000-4000-8000-000000000902', '5ea0c000-0000-4000-8000-0000000000a1', 'Edge out', 'Edge out', -33.9 + 0.22582, 18.4, '5ea0c000-0000-4000-8000-0000000000c1');
insert into public.listings(public_id, organisation_id, service_slug, branch_public_id, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
select ('5ea01000-0000-4000-8000-' || substr(b.public_id::text, 25))::uuid, b.organisation_id, 'srch-fixed', b.public_id,
  'Fixed ' || b.name, 'Synthetic fixed', 'Synthetic Cape', 'fixed', 'live', 'admin_import', 'synthetic-search'
from public.branches b where b.organisation_id = '5ea0c000-0000-4000-8000-0000000000a1';

-- 25 mobile providers covering the rounded point; one outside; one only covered
-- by the unrounded point; one other-service listing with the largest public ID.
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
select ('5ea02000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, '5ea0c000-0000-4000-8000-0000000000a1', 'srch-mobile',
  'Mobile ' || i, 'Synthetic mobile', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-search'
from generate_series(1, 25) i;
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference) values
  ('5ea02000-0000-4000-8000-000000000901', '5ea0c000-0000-4000-8000-0000000000a1', 'srch-mobile', 'Mobile far', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-search'),
  ('5ea02000-0000-4000-8000-000000000902', '5ea0c000-0000-4000-8000-0000000000a1', 'srch-mobile', 'Mobile rounding', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-search'),
  ('ffffffff-0000-4000-8000-000000000903', '5ea0c000-0000-4000-8000-0000000000a1', 'srch-other', 'Mobile other', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-search');
insert into public.service_areas(listing_public_id, organisation_id, centre_latitude, centre_longitude, radius_km, coordinate_source_id)
select l.public_id, l.organisation_id,
  case l.public_id
    when '5ea02000-0000-4000-8000-000000000901' then -34.10
    when '5ea02000-0000-4000-8000-000000000902' then -33.99
    else -33.95 end,
  18.4, 10, '5ea0c000-0000-4000-8000-0000000000c1'
from public.listings l where l.organisation_id = '5ea0c000-0000-4000-8000-0000000000a1' and l.mode = 'mobile';

-- Structure and grants ------------------------------------------------------------
select is(pg_get_userbyid((select proowner from pg_proc where oid = 'private.mobile_eligible_ids(double precision,double precision,text,uuid,integer)'::regprocedure))::text,
  'listing_eligibility', 'eligibility helper owned by listing_eligibility');
select is(pg_get_userbyid((select proowner from pg_proc where oid = 'api.search_listings(double precision,double precision,text,integer,text,integer,uuid,integer)'::regprocedure))::text,
  'listing_projection', 'wrapper owned by listing_projection');
select is_empty($$select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('api','private') and p.proname in ('search_listings','mobile_eligible_ids')
  and not (p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""'])$$,
  'both functions are STABLE SECURITY DEFINER with an empty search_path (A17: no writes)');
select ok(not has_function_privilege('anon', 'api.search_listings(double precision,double precision,text,integer,text,integer,uuid,integer)', 'execute'), 'anon cannot execute wrapper');
select ok(not has_function_privilege('authenticated', 'api.search_listings(double precision,double precision,text,integer,text,integer,uuid,integer)', 'execute'), 'authenticated cannot execute wrapper');
select ok(not has_function_privilege('service_role', 'api.search_listings(double precision,double precision,text,integer,text,integer,uuid,integer)', 'execute'), 'service_role cannot execute wrapper');
select ok(has_function_privilege('catalogue_server', 'api.search_listings(double precision,double precision,text,integer,text,integer,uuid,integer)', 'execute'), 'catalogue_server can execute wrapper');
select ok(not has_function_privilege('catalogue_server', 'private.mobile_eligible_ids(double precision,double precision,text,uuid,integer)', 'execute')
  and not has_function_privilege('anon', 'private.mobile_eligible_ids(double precision,double precision,text,uuid,integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.mobile_eligible_ids(double precision,double precision,text,uuid,integer)', 'execute'),
  'only the projection owner can execute the eligibility helper');
select ok(not has_schema_privilege('anon', 'api', 'usage') and not has_schema_privilege('authenticated', 'api', 'usage')
  and not has_schema_privilege('catalogue_server', 'private', 'usage'), 'no client usage on api; server has no usage on private');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','private') and c.relkind in ('r','v','m','p')
  and (has_table_privilege('catalogue_server', c.oid, 'select,insert,update,delete')
       or has_any_column_privilege('catalogue_server', c.oid, 'select'))$$,
  'catalogue_server has no table, view or column privileges');
select is_empty($$select rolname from pg_roles where rolname = 'catalogue_server'
  and (not rolcanlogin or rolconnlimit <> 10 or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolinherit or rolreplication)$$,
  'catalogue_server is a limited, non-inheriting login');
select is_empty($$select b.rolname from pg_auth_members m join pg_roles r on r.oid = m.member join pg_roles b on b.oid = m.roleid
  where r.rolname = 'catalogue_server'$$, 'catalogue_server is a member of no role');
select ok(not has_column_privilege('listing_projection', 'public.service_areas', 'centre_latitude', 'select'),
  'projection owner still cannot read private centres');

-- Run as the real scoped server role ------------------------------------------------
grant catalogue_server to postgres with set true, inherit false;

-- Helper for the remaining assertions: call as catalogue_server.
create function pg_temp.s(p_group text, p_service text, p_radius integer, p_bucket integer, p_after uuid, p_limit integer,
  p_lat double precision default -33.9, p_lng double precision default 18.4)
returns setof jsonb language plpgsql as $$
begin
  set local role catalogue_server;
  return query select to_jsonb(r) from api.search_listings(p_lat, p_lng, p_service, p_radius, p_group, p_bucket, p_after, p_limit) r;
  reset role;
end $$;

-- A8 fixed boundary and ordering
select is((select count(*)::integer from pg_temp.s('fixed', 'srch-fixed', 25, null, null, 21)), 21, 'fixed page is bounded');
select ok(exists(select from pg_temp.s('fixed', 'srch-fixed', 25, 230, '00000000-0000-0000-0000-000000000000', 21) j
  where j->>'public_id' = '5ea01000-0000-4000-8000-000000000901' and (j->>'distance_bucket')::int = 249), '24.90 km premises inside 25 km (bucket 249)');
select ok(not exists(select from pg_temp.s('fixed', 'srch-fixed', 25, 240, '00000000-0000-0000-0000-000000000000', 21) j
  where j->>'public_id' = '5ea01000-0000-4000-8000-000000000902'), '25.11 km premises excluded at 25 km');
select ok(exists(select from pg_temp.s('fixed', 'srch-fixed', 50, 250, '00000000-0000-0000-0000-000000000000', 21) j
  where j->>'public_id' = '5ea01000-0000-4000-8000-000000000902' and (j->>'distance_bucket')::int = 251), '25.11 km premises inside 50 km (bucket 251)');
select ok(not exists(select from pg_temp.s('fixed', 'srch-fixed', 5, 0, '00000000-0000-0000-0000-000000000000', 21) j
  where j->>'public_id' = '5ea01000-0000-4000-8000-000000000901'), 'chosen 5 km radius excludes 24.90 km');

-- Keyset paging: three pages of 20 cover all 46 fixed results with no gaps or duplicates.
create temporary table pg_temp.fixed_pages(n int, o bigint, j jsonb);
do $$ declare b int; a uuid; page int := 0; got int; last jsonb; begin
  loop
    page := page + 1;
    insert into pg_temp.fixed_pages select page, t.o, t.x from pg_temp.s('fixed', 'srch-fixed', 25, b, a, 20) with ordinality t(x, o);
    get diagnostics got = row_count;
    exit when got < 20 or page > 5;
    select j into last from pg_temp.fixed_pages where n = page order by o desc limit 1;
    b := (last->>'distance_bucket')::int; a := (last->>'public_id')::uuid;
  end loop;
end $$;
select is((select count(*)::integer from pg_temp.fixed_pages), 46, 'paging returns every fixed result');
select is((select count(distinct j->>'public_id')::integer from pg_temp.fixed_pages), 46, 'paging has no duplicates');
select is((select max(n) from pg_temp.fixed_pages), 3, 'three fixed pages');
select ok((select bool_and(ok) from (select ((j->>'distance_bucket')::int, j->>'public_id') > (lag((j->>'distance_bucket')::int, 1, -1) over w, lag(j->>'public_id', 1, '') over w) as ok
  from pg_temp.fixed_pages window w as (order by n, o)) t), 'returned fixed order is strictly (bucket, public ID) across pages');
select ok((select bool_and(j ? 'public_latitude' and j->>'public_latitude' is not null and (j->>'distance_bucket') is not null) from pg_temp.fixed_pages),
  'fixed rows carry public pin and straight-line bucket');

-- A9 mobile coverage, rounding and ordering
select is((select count(*)::integer from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21)), 21, 'mobile page is bounded');
create temporary table pg_temp.mobile_pages(n int, o bigint, j jsonb);
do $$ declare a uuid; page int := 0; got int; begin
  loop
    page := page + 1;
    insert into pg_temp.mobile_pages select page, t.o, t.x from pg_temp.s('mobile', 'srch-mobile', 25, null, a, 20) with ordinality t(x, o);
    get diagnostics got = row_count;
    exit when got < 20 or page > 5;
    select (j->>'public_id')::uuid into a from pg_temp.mobile_pages where n = page order by o desc limit 1;
  end loop;
end $$;
select is((select count(*)::integer from pg_temp.mobile_pages), 25, 'mobile paging returns every covering provider');
select is((select count(distinct j->>'public_id')::integer from pg_temp.mobile_pages), 25, 'mobile paging has no duplicates');
select ok((select bool_and(ok) from (select j->>'public_id' > lag(j->>'public_id', 1, '') over (order by n, o) as ok from pg_temp.mobile_pages) t),
  'returned mobile order is strictly public ID across pages');
select ok(not exists(select from pg_temp.mobile_pages where j->>'public_id' = '5ea02000-0000-4000-8000-000000000901'), 'provider 22 km away (10 km radius) excluded');
select ok(not exists(select from pg_temp.s('mobile', 'srch-mobile', 25, null, '5ea02000-0000-4000-8000-000000000025', 21, -33.904, 18.4) j
  where j->>'public_id' = '5ea02000-0000-4000-8000-000000000902'),
  'rounding false negative: point covered only before rounding to 0.01 deg is not matched');
select is((select string_agg(j::text, ',' order by j->>'public_id') from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21, -33.8951, 18.4049) j),
  (select string_agg(j::text, ',' order by j->>'public_id') from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21) j),
  'points in one 0.01 deg cell give identical mobile results');
select ok((select bool_and(j->>'public_address' is null and j->>'public_latitude' is null and j->>'public_longitude' is null and j->>'distance_bucket' is null) from pg_temp.mobile_pages),
  'mobile rows carry no address, coordinates or distance');
select ok(exists(select from pg_temp.s('mobile', 'srch-other', 25, null, null, 1) j where j->>'public_id' = 'ffffffff-0000-4000-8000-000000000903'),
  'service filter applies before the helper limit (largest ID still found on page 1)');
select is((select count(*)::integer from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21) j where j->>'public_id' like 'ffffffff%'), 0,
  'service filter excludes other services');

-- A10 moving the private base within coverage leaves output byte-identical
do $$ begin perform set_config('tests.mobile_before', (select string_agg(j::text, ',' order by j->>'public_id') from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21) j), true); end $$;
update public.service_areas set centre_latitude = -33.97, centre_longitude = 18.41
  where listing_public_id = '5ea02000-0000-4000-8000-000000000001';
select is((select string_agg(j::text, ',' order by j->>'public_id') from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21) j),
  current_setting('tests.mobile_before'), 'moving a base within coverage leaves mobile output byte-identical');
select ok((select string_agg(j::text, '') from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21) j) !~ '(centre|radius|organisation|provenance|33\.95|33\.97|5ea0c000|5ea0b000)',
  'mobile output exposes no private centre, radius, organisation or branch IDs');

-- Suspended or submitted listings disappear immediately
update public.listings set status = 'suspended' where public_id = '5ea02000-0000-4000-8000-000000000002';
select ok(not exists(select from pg_temp.s('mobile', 'srch-mobile', 25, null, null, 21) j where j->>'public_id' = '5ea02000-0000-4000-8000-000000000002'),
  'suspended mobile listing excluded');
update public.listings set status = 'submitted' where public_id = '5ea01000-0000-4000-8000-000000000001';
select ok(not exists(select from pg_temp.s('fixed', 'srch-fixed', 25, null, null, 21) j
  where j->>'public_id' = '5ea01000-0000-4000-8000-000000000001'), 'submitted fixed listing excluded');

-- A11 bounded inputs (22023) as the server role
select throws_ok($$select * from pg_temp.s('fixed', null, 7, null, null, 20)$$, '22023', null, 'radius outside {5,10,25,50} rejected');
select throws_ok($$select * from pg_temp.s('fixed', null, 25, null, null, 22)$$, '22023', null, 'page size above 21 rejected');
select throws_ok($$select * from pg_temp.s('fixed', null, 25, null, null, 0)$$, '22023', null, 'page size zero rejected');
select throws_ok($$select * from pg_temp.s('fixed', null, 25, null, null, 20, 51.5, -0.1)$$, '22023', null, 'point outside South Africa rejected');
select throws_ok($$select * from pg_temp.s('fixed', null, 25, null, null, 20, 'NaN'::float8, 18.4)$$, '22023', null, 'non-finite point rejected');
select throws_ok($$select * from pg_temp.s('fixed', 'Bad Slug', 25, null, null, 20)$$, '22023', null, 'malformed service rejected');
select throws_ok($$select * from pg_temp.s('mobile', null, 25, 3, null, 20)$$, '22023', null, 'mobile cursor cannot carry a distance bucket');
select throws_ok($$select * from pg_temp.s('fixed', null, 25, 3, null, 20)$$, '22023', null, 'fixed cursor needs both bucket and ID');
select throws_ok($$select * from pg_temp.s('both', null, 25, null, null, 20)$$, '22023', null, 'unknown group rejected');

-- Direct access as the server role is denied
create function pg_temp.as_server(q text) returns void language plpgsql as $$
begin
  set local role catalogue_server;
  execute q;
end $$;
select throws_ok($$select pg_temp.as_server('select * from public.listing_public')$$, '42501', null, 'server role cannot read the projection directly');
select throws_ok($$select pg_temp.as_server('select centre_latitude from public.service_areas')$$, '42501', null, 'server role cannot read private geometry');

select * from finish();
rollback;
