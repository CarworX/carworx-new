-- D-097 PR A: keyword search and browsing without a location. Isolated
-- synthetic fixture (names carry the token "Zqx" so seed rows never match);
-- independent of the seed. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(30);

-- Fixture ----------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '5ea0d000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated',
  'synthetic.keyword.admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
insert into public.organisations(id, name) values ('5ea0d000-0000-4000-8000-0000000000a1', 'Keyword fixture (synthetic)');
insert into public.coordinate_sources(id, organisation_id, source_kind, licence_note)
  values ('5ea0d000-0000-4000-8000-0000000000c1', '5ea0d000-0000-4000-8000-0000000000a1', 'provider_supplied', 'Synthetic keyword fixture');
insert into public.categories(slug, name) values ('kw-cat', 'Keyword test category'), ('kw-other-cat', 'Keyword other category');
insert into public.services(slug, category_slug, name) values
  ('kw-wash', 'kw-cat', 'Zqx foam wash'), ('kw-tyres', 'kw-other-cat', 'Keyword tyres');
insert into public.branches(public_id, organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id) values
  ('5ea0d000-0000-4000-8000-0000000000b1', '5ea0d000-0000-4000-8000-0000000000a1', 'Kw branch 1', '1 Synthetic Road', -33.9, 18.4, '5ea0d000-0000-4000-8000-0000000000c1'),
  ('5ea0d000-0000-4000-8000-0000000000b2', '5ea0d000-0000-4000-8000-0000000000a1', 'Kw branch 2', '2 Synthetic Road', -33.91, 18.4, '5ea0d000-0000-4000-8000-0000000000c1');
insert into public.listings(public_id, organisation_id, service_slug, branch_public_id, display_name, description, metro, mode, status, provenance_kind, provenance_reference) values
  -- Fixed, name match, verified today.
  ('5ea0d100-0000-4000-8000-000000000001', '5ea0d000-0000-4000-8000-0000000000a1', 'kw-tyres', '5ea0d000-0000-4000-8000-0000000000b1',
   'Zqx Shine Tyres', 'Synthetic', 'Synthetic Cape', 'fixed', 'live', 'admin_import', 'synthetic-keyword'),
  -- Fixed, service-name match only (service "Zqx foam wash"), verified 10 days ago.
  ('5ea0d100-0000-4000-8000-000000000002', '5ea0d000-0000-4000-8000-0000000000a1', 'kw-wash', '5ea0d000-0000-4000-8000-0000000000b2',
   'Plain Keyword Garage', 'Synthetic', 'Synthetic Cape', 'fixed', 'live', 'admin_import', 'synthetic-keyword'),
  -- Mobile, name match, never verified.
  ('5ea0d100-0000-4000-8000-000000000003', '5ea0d000-0000-4000-8000-0000000000a1', 'kw-tyres', null,
   'Zqx Mobile Shine', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-keyword'),
  -- Mobile, never verified, larger public ID than the one above.
  ('5ea0d100-0000-4000-8000-000000000004', '5ea0d000-0000-4000-8000-0000000000a1', 'kw-tyres', null,
   'Zqx Mobile Two', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-keyword'),
  -- Suspended: never returned.
  ('5ea0d100-0000-4000-8000-000000000005', '5ea0d000-0000-4000-8000-0000000000a1', 'kw-tyres', null,
   'Zqx Suspended Shine', 'Synthetic', 'Synthetic Cape', 'mobile', 'suspended', 'provider_application', 'synthetic-keyword'),
  -- Literal underscore, to prove LIKE wildcards are escaped.
  ('5ea0d100-0000-4000-8000-000000000006', '5ea0d000-0000-4000-8000-0000000000a1', 'kw-tyres', null,
   'Zqx a_c Detail', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-keyword'),
  ('5ea0d100-0000-4000-8000-000000000007', '5ea0d000-0000-4000-8000-0000000000a1', 'kw-tyres', null,
   'Zqx abc Detail', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-keyword');
insert into public.service_areas(listing_public_id, organisation_id, centre_latitude, centre_longitude, radius_km, coordinate_source_id)
select l.public_id, l.organisation_id, -33.95, 18.4, 10, '5ea0d000-0000-4000-8000-0000000000c1'
from public.listings l where l.organisation_id = '5ea0d000-0000-4000-8000-0000000000a1' and l.mode = 'mobile';
insert into public.verifications(organisation_id, listing_public_id, method, verified_at, verified_by, evidence_reference) values
  ('5ea0d000-0000-4000-8000-0000000000a1', '5ea0d100-0000-4000-8000-000000000001', 'identity_checked', now() - interval '1 minute',
   '5ea0d000-0000-4000-8000-0000000000f1', 'synthetic-keyword'),
  ('5ea0d000-0000-4000-8000-0000000000a1', '5ea0d100-0000-4000-8000-000000000002', 'identity_checked', now() - interval '10 days',
   '5ea0d000-0000-4000-8000-0000000000f1', 'synthetic-keyword');

-- Structure and grants ------------------------------------------------------------
select is(pg_get_userbyid((select proowner from pg_proc where oid = 'api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text)'::regprocedure))::text,
  'listing_projection', 'wrapper with name words owned by listing_projection');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api' and p.proname = 'search_listings'), 2, 'compatibility and travel-filter search wrappers; the 9-argument call still uses the default');
select ok(not has_function_privilege('anon', 'api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text)', 'execute')
  and not has_function_privilege('authenticated', 'api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text)', 'execute')
  and not has_function_privilege('service_role', 'api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text)', 'execute'),
  'only catalogue_server executes the wrapper');
select ok(has_function_privilege('catalogue_server', 'api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text)', 'execute'),
  'catalogue_server can execute the wrapper');
select ok(not has_function_privilege('catalogue_server', 'private.mobile_eligible_ids(double precision,double precision,text[],uuid[],uuid[],uuid,integer)', 'execute'),
  'catalogue_server cannot execute the eligibility helper');

grant catalogue_server to postgres with set true, inherit false;
create function pg_temp.s(p_group text, p_q text, p_bucket integer default null, p_after uuid default null, p_limit integer default 21,
  p_lat double precision default null, p_lng double precision default null, p_radius integer default null,
  p_service text default null, p_category text default null)
returns setof jsonb language plpgsql as $$
begin
  set local role catalogue_server;
  return query select to_jsonb(r) from api.search_listings(p_lat, p_lng, p_service, p_category, p_radius, p_group, p_bucket, p_after, p_limit, p_q) r;
  reset role;
end $$;
create function pg_temp.names(p_group text, p_q text, p_lat double precision default null, p_lng double precision default null,
  p_radius integer default null, p_category text default null) returns text[] language sql as $$
  select coalesce(array_agg(j->>'display_name' order by j->>'display_name' collate "C"), '{}')
  from pg_temp.s(p_group, p_q, null, null, 21, p_lat, p_lng, p_radius, null, p_category) j
$$;

-- The 9-argument call still works ---------------------------------------------------
create function pg_temp.old_call() returns integer language plpgsql as $$
declare n integer;
begin
  set local role catalogue_server;
  select count(*) into n from api.search_listings(-33.9, 18.4, null, 'kw-other-cat', 25, 'fixed', null, null, 21);
  reset role;
  return n;
end $$;
select is(pg_temp.old_call(), 1, 'the 9-argument call (no name words) still works');

-- Browsing without a location ("all") ----------------------------------------------
select is(pg_temp.names('all', 'Zqx'),
  array['Plain Keyword Garage','Zqx Mobile Shine','Zqx Mobile Two','Zqx Shine Tyres','Zqx a_c Detail','Zqx abc Detail'],
  'all: name words match business or service names on live listings only');
select ok(not exists(select from pg_temp.s('all', null) j where j->>'display_name' = 'Zqx Suspended Shine'),
  'all without words: a suspended listing is never returned');
select ok(exists(select from pg_temp.s('all', null, null, null, 21, null, null, null, null, 'kw-cat') j where j->>'display_name' = 'Plain Keyword Garage'),
  'all without words: every live listing in a category');
select is(pg_temp.names('all', 'zQX sHINE'), array['Zqx Shine Tyres'], 'name words are case-insensitive');
select is(pg_temp.names('all', 'foam wash'), array['Plain Keyword Garage'], 'a service name matches');
select is(pg_temp.names('all', 'a_c'), array['Zqx a_c Detail'], 'an underscore matches itself, not any character');
select is(pg_temp.names('all', 'Zqx%'), '{}'::text[], 'a percent sign matches itself, not anything');
select is(pg_temp.names('all', 'Zqx', null, null, null, 'kw-cat'), array['Plain Keyword Garage'], 'words and a category narrow together');
select is((select array_agg(j->>'display_name' order by o) from pg_temp.s('all', 'Zqx') with ordinality t(j, o)),
  array['Zqx Shine Tyres','Plain Keyword Garage','Zqx Mobile Shine','Zqx Mobile Two','Zqx a_c Detail','Zqx abc Detail'],
  'all: newest verified first (whole days), then public ID');
select ok((select bool_and(j->>'distance_bucket' is null and (j->>'browse_rank') is not null) from pg_temp.s('all', 'Zqx') j),
  'all rows carry no distance, only the day rank');
select ok((select bool_and(j->>'public_address' is null and j->>'public_latitude' is null) from pg_temp.s('all', 'Zqx') j where j->>'mode' = 'mobile'),
  'all: mobile rows carry no address or coordinates');
select ok((select bool_and(j->>'public_address' is not null) from pg_temp.s('all', 'Zqx') j where j->>'mode' = 'fixed'),
  'all: premises rows carry their public address');

-- Keyset paging in the all group, one row a page: no gaps or duplicates.
create temporary table pg_temp.all_pages(n int, j jsonb);
do $$ declare b int; a uuid; page int := 0; got int; last jsonb; begin
  loop
    page := page + 1;
    insert into pg_temp.all_pages select page, x from pg_temp.s('all', 'Zqx', b, a, 1) x;
    get diagnostics got = row_count;
    exit when got < 1 or page > 10;
    select j into last from pg_temp.all_pages where n = page;
    b := (last->>'browse_rank')::int; a := (last->>'public_id')::uuid;
  end loop;
end $$;
select is((select array_agg(j->>'display_name' order by n) from pg_temp.all_pages),
  (select array_agg(j->>'display_name' order by o) from pg_temp.s('all', 'Zqx') with ordinality t(j, o)),
  'all: pages of one have no gaps or duplicates');

-- Name words with a location ----------------------------------------------------------
select is(pg_temp.names('fixed', 'shine', -33.9, 18.4, 25), array['Zqx Shine Tyres'], 'fixed group: name words narrow the results');
select is(pg_temp.names('mobile', 'Zqx Mobile', -33.9, 18.4, 25), array['Zqx Mobile Shine','Zqx Mobile Two'], 'mobile group: name words narrow the results');
select is((select count(*)::integer from pg_temp.s('mobile', 'Zqx Mobile', null, null, 1, -33.9, 18.4, 25)), 1, 'mobile group: the page limit still applies');
select ok(not exists(select from pg_temp.s('mobile', 'Zqx', null, null, 21, -33.9, 18.4, 25) j where j->>'display_name' = 'Zqx Suspended Shine'),
  'mobile group: a suspended name match is never returned');

-- Bounded inputs (22023) -------------------------------------------------------------
select throws_ok($$select * from pg_temp.s('all', null, null, null, 21, -33.9, 18.4)$$, '22023', null, 'all with a location rejected');
select throws_ok($$select * from pg_temp.s('all', null, null, null, 21, null, null, 25)$$, '22023', null, 'all with a radius rejected');
select throws_ok($$select * from pg_temp.s('fixed', 'shine')$$, '22023', null, 'a located group without a location rejected');
select throws_ok($$select * from pg_temp.s('all', 'a')$$, '22023', null, 'one-character words rejected');
select throws_ok($$select * from pg_temp.s('all', repeat('a', 61))$$, '22023', null, 'words over 60 characters rejected');
select throws_ok($$select * from pg_temp.s('all', ' shine')$$, '22023', null, 'untrimmed words rejected');
select throws_ok($$select * from pg_temp.s('all', 'sh' || chr(10) || 'ine')$$, '22023', null, 'control characters rejected');

select * from finish();
rollback;
