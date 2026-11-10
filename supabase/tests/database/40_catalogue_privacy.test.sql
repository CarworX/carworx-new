begin;
-- Supply the same isolated synthetic fixture when recovery CI disables seeding.
-- This entire file rolls back; existing seed state is tested unchanged when present.
do $fixtures$ begin
  if not exists (select from public.organisations where id='5eed0000-0000-4000-8000-0000000000a1') then
-- CarworX local seed. SYNTHETIC DATA ONLY.
-- Every name is obviously fake and every email uses the reserved
-- example.test domain (RFC 2606). No passwords are set: these users cannot
-- sign in until T3 adds its own local fixtures. pgTAP tests do not rely on
-- this seed; they create their own rows inside a rolled-back transaction.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'synthetic.owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'synthetic.staff@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'synthetic.customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'synthetic.admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('5eed0000-0000-4000-8000-000000000001', 'Test Owner (synthetic)'),
  ('5eed0000-0000-4000-8000-000000000002', 'Test Staff (synthetic)'),
  ('5eed0000-0000-4000-8000-000000000003', 'Test Customer (synthetic)'),
  ('5eed0000-0000-4000-8000-000000000004', 'Test Admin (synthetic)');

insert into public.organisations (id, name) values
  ('5eed0000-0000-4000-8000-0000000000a1', 'Example Motors (synthetic)'),
  ('5eed0000-0000-4000-8000-0000000000b2', 'Sample Car Wash (synthetic)');

insert into public.memberships (organisation_id, user_id, role, status) values
  ('5eed0000-0000-4000-8000-0000000000a1', '5eed0000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('5eed0000-0000-4000-8000-0000000000a1', '5eed0000-0000-4000-8000-000000000002', 'staff', 'active');

insert into private.platform_admins (user_id) values
  ('5eed0000-0000-4000-8000-000000000004');

-- P2-1 defaults from Claude 17 section 3. Gauteng is a reversible synthetic
-- fixture metro, not an owner-confirmed launch region or provider supply.
insert into public.categories(slug,name) values
 ('wash-and-valet','Wash and valet'), ('mechanical-service','Mechanical service'),
 ('tyres','Tyres'), ('panel-and-paint','Panel and paint'),
 ('auto-electrical','Auto electrical'), ('mobile-mechanic','Mobile mechanic');
insert into public.services(slug,category_slug,name) values
 ('wash','wash-and-valet','Synthetic wash'), ('service','mechanical-service','Synthetic service'),
 ('tyres','tyres','Synthetic tyres'), ('paint','panel-and-paint','Synthetic paint'),
 ('electrical','auto-electrical','Synthetic electrical'), ('mobile-repair','mobile-mechanic','Synthetic mobile repair');
insert into public.coordinate_sources(id,organisation_id,source_kind,licence_note) values
 ('ca7a0000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','provider_supplied','Synthetic permanent fixture; no geocoding service'),
 ('ca7a0000-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-0000000000b2','manual_verified','Synthetic permanent fixture; no geocoding service');
insert into public.branches(id,public_id,organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values
 ('ca7b0000-0000-4000-8000-000000000001','ca7b1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','Synthetic workshop','1 Synthetic Street, Exampleville',-26.2,28.04,'ca7a0000-0000-4000-8000-000000000001');
insert into public.listings(id,public_id,organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,status,provenance_kind,provenance_reference) values
 ('ca7c0000-0000-4000-8000-000000000001','ca7c1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','service','ca7b1000-0000-4000-8000-000000000001','Synthetic fixed provider','Synthetic catalogue fixture; not a real provider','Gauteng','fixed','live','admin_import','synthetic-seed-fixed'),
 ('ca7c0000-0000-4000-8000-000000000002','ca7c1000-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-0000000000a1','mobile-repair',null,'Synthetic mobile provider','Synthetic catalogue fixture; not a real provider','Gauteng','mobile','live','provider_application','synthetic-seed-mobile'),
 ('ca7c0000-0000-4000-8000-000000000003','ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2','mobile-repair',null,'Synthetic pending provider','Synthetic unapproved fixture','Gauteng','mobile','submitted','provider_application','synthetic-seed-pending');
insert into public.service_areas(id,listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values
 ('ca7d0000-0000-4000-8000-000000000001','ca7c1000-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-0000000000a1',-26.112233,28.112233,25,'ca7a0000-0000-4000-8000-000000000001');
insert into public.verifications(id,organisation_id,listing_public_id,method,verified_by,evidence_reference) values
 ('ca7e0000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','ca7c1000-0000-4000-8000-000000000002','identity_checked','5eed0000-0000-4000-8000-000000000004','synthetic-evidence-owner-held');

  end if;
end $fixtures$;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(41);

select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='listing_public'),
  array['public_id','display_name','description','metro','mode','service_slug','service_name','category_slug','category_name','public_address','public_latitude','public_longitude','verification_labels']::text[], 'exact public column set');
select is((select pg_get_userbyid(relowner)::text from pg_class where oid='public.listing_public'::regclass),'listing_projection','view has dedicated owner');
select ok((select reloptions @> array['security_invoker=false','security_barrier=true'] from pg_class where oid='public.listing_public'::regclass),'view uses owner security with barrier');
select is_empty($$select rolname from pg_roles where rolname in ('listing_projection','listing_eligibility','catalogue_server') and (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole or rolcreatedb or rolinherit)$$,'capability roles are unprivileged NOLOGIN roles');
select ok(not has_schema_privilege('listing_projection','public','create'),'projection owner cannot create arbitrary objects');
select is_empty($$select attname from pg_attribute where attrelid='public.service_areas'::regclass and attnum>0 and not attisdropped and has_column_privilege('listing_projection',attrelid,attnum,'select')$$,'projection cannot read any service-area column');
select is_empty($$select c.relname||'.'||a.attname from pg_class c join pg_attribute a on a.attrelid=c.oid where c.relnamespace='public'::regnamespace and c.relname in ('categories','services','branches','listings','verifications','coordinate_sources') and a.attname in ('id','organisation_id','coordinate_source_id','evidence_reference','provenance_reference','verified_by') and has_column_privilege('listing_projection',c.oid,a.attnum,'select')$$,'projection cannot read private IDs or provenance');
select ok(not has_table_privilege('listing_eligibility','public.branches','select') and not has_any_column_privilege('listing_eligibility','public.branches','select') and not has_any_column_privilege('listing_eligibility','public.verifications','select'),'eligibility role cannot read unrelated projection/evidence data');
select ok(has_column_privilege('listing_eligibility','public.service_areas','centre_latitude','select') and has_column_privilege('listing_eligibility','public.service_areas','radius_km','select'),'separate eligibility role can read private geometry');
select is_empty($$select tablename from pg_tables where schemaname='public' and tablename in ('categories','services','branches','listings','service_areas','verifications','coordinate_sources') and has_any_column_privilege('catalogue_server',format('public.%I',tablename),'select')$$,'server role has no base-data grants');
select ok(not pg_has_role('catalogue_server','listing_projection','member') and not pg_has_role('catalogue_server','listing_eligibility','member') and not pg_has_role('authenticator','catalogue_server','member'),'no capability role switching or server activation');
select is((select count(*)::integer from public.categories),6,'six Claude 17 default categories seeded');
select is((select count(*)::integer from public.listings where metro='Gauteng'),3,'one synthetic metro only (not owner launch confirmation)');

do $$ begin
  perform set_config('tests.mobile_json',(select row_to_json(p)::text from public.listing_public p where mode='mobile'),true);
end $$;
set local role anon;
select is((select count(*)::integer from public.listing_public),2,'anonymous sees only two live synthetic listings');
select is((select verification_labels from public.listing_public where mode='mobile'),array['Identity checked']::text[],'method-based verification label only');
select ok((select public_address is null and public_latitude is null and public_longitude is null from public.listing_public where mode='mobile'),'mobile has no public pin or address');
select ok((select public_address is not null and public_latitude is not null from public.listing_public where mode='fixed'),'fixed premises has approved public pin');
select is_empty($$select public_id from public.listing_public where public_id='ca7c1000-0000-4000-8000-000000000003'$$,'submitted listing is hidden');
select ok((select string_agg(row_to_json(p)::text,'') !~ '(centre|radius|organisation_id|provenance|evidence|26\.112233|28\.112233|ca7c0000)' from public.listing_public p),'public JSON excludes private fields/values/row IDs');
select throws_ok($$select centre_latitude from public.service_areas$$,'42501',null,'anonymous raw geometry denied');
select throws_ok($$insert into public.categories(slug,name) values ('forged','forged')$$,'42501',null,'anonymous catalogue mutation denied');

reset role;
update public.service_areas set centre_latitude=-26.334455, radius_km=30 where id='ca7d0000-0000-4000-8000-000000000001';
set local role anon;
select is((select row_to_json(p)::text from public.listing_public p where mode='mobile'),current_setting('tests.mobile_json'),'private base/radius change leaves public JSON byte-identical');
reset role;
update public.verifications set revoked_at=now() where id='ca7e0000-0000-4000-8000-000000000001';
set local role anon;
select is((select cardinality(verification_labels) from public.listing_public where mode='mobile'),0,'revoked method label disappears');
reset role;
select is_empty($$select details from public.audit_log where target_table in ('categories','services','branches','listings','service_areas','verifications','coordinate_sources') and details <> '{}'::jsonb$$,'audit details never copy coordinates/evidence/provenance');
select ok((select count(*)>0 from public.audit_log where target_table='service_areas' and action='update'),'catalogue edits append audit entries');
select throws_ok($$insert into public.coordinate_sources(organisation_id,source_kind,licence_note) values ('5eed0000-0000-4000-8000-0000000000a1','temporary_geocode','not licensed')$$,'23514',null,'temporary geocoding provenance rejected');
select throws_ok($$update public.service_areas set radius_km=0$$,'23514',null,'zero radius rejected');
select throws_ok($$update public.service_areas set centre_latitude='NaN'::float8$$,'23514',null,'non-finite coordinate rejected');
select throws_ok($$insert into public.listings(organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,provenance_kind,provenance_reference) values ('5eed0000-0000-4000-8000-0000000000b2','service','ca7b1000-0000-4000-8000-000000000001','Synthetic','Synthetic','Gauteng','fixed','admin_import','Synthetic')$$,'23503',null,'branch cannot cross organisation boundary');
select throws_ok($$update public.listings set mode='mobile' where mode='fixed'$$,'23514',null,'mobile cannot inherit a fixed-premises pin');
select throws_ok($$update public.listings set public_id=id$$,'23514',null,'public listing ID cannot equal the private row ID');
select throws_ok($$update public.branches set public_id=id$$,'23514',null,'public branch ID cannot equal the private row ID');
select throws_ok($$insert into public.service_areas(listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values ('ca7c1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1',-26,28,10,'ca7a0000-0000-4000-8000-000000000001')$$,'23503',null,'service area cannot attach to a fixed listing');

set local role authenticated;
set local request.jwt.claims='{"sub":"5eed0000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.service_areas),0,'listed admin at aal1 cannot read geometry');
select is((select count(*)::integer from public.verifications),0,'listed admin at aal1 cannot read evidence');
select is((select count(*)::integer from public.listings),0,'listed admin at aal1 cannot read unpublished base rows');
set local request.jwt.claims='{"sub":"5eed0000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","user_metadata":{"is_admin":true},"app_metadata":{"role":"admin"}}';
select is((select count(*)::integer from public.service_areas),0,'forged metadata grants no tenant/admin access');
set local request.jwt.claims='{"sub":"5eed0000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select throws_ok($$update public.listings set organisation_id='5eed0000-0000-4000-8000-0000000000b2'$$,'42501',null,'organisation assignment is immutable even for client admin');
select throws_ok($$update public.listings set public_id=gen_random_uuid()$$,'42501',null,'public identities are immutable for client admin');
set local request.jwt.claims='{"sub":"5eed0000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.service_areas),1,'active own-tenant staff can read private service data');
reset role;
update public.memberships set status='revoked' where user_id='5eed0000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims='{"sub":"5eed0000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.service_areas),0,'revocation takes effect without refreshing JWT');
reset role;
select * from finish();
rollback;
