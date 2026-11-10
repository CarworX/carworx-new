-- P2 A4 extension: seven tables x five actors x four operations = 140 assertions.
-- Seed fixtures are checked or constructed inside the rolled-back transaction. No mutation survives its helper subtransaction.
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
insert into public.categories(slug,name,parent_slug) values
 ('wash-and-detailing','Wash & Detailing',null), ('repairs-and-maintenance','Repairs & Maintenance',null),
 ('glass-repair-and-replacement','Glass Repair & Replacement',null), ('tyres-and-wheel-alignment','Tyres & Wheel Alignment',null),
 ('mechanical-service','Mechanical service','repairs-and-maintenance'), ('panel-and-paint','Panel and paint','repairs-and-maintenance'),
 ('auto-electrical','Auto electrical','repairs-and-maintenance'), ('mobile-mechanic','Mobile mechanic','repairs-and-maintenance');
insert into public.services(slug,category_slug,name) values
 ('wash','wash-and-detailing','Synthetic wash'), ('service','mechanical-service','Synthetic service'),
 ('tyres','tyres-and-wheel-alignment','Synthetic tyres'), ('paint','panel-and-paint','Synthetic paint'),
 ('electrical','auto-electrical','Synthetic electrical'), ('mobile-repair','mobile-mechanic','Synthetic mobile repair'),
 ('glass','glass-repair-and-replacement','Synthetic glass repair');
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
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.catalogue_effect(stmt text) returns integer language plpgsql as $$
declare n integer; detail text;
begin
  begin
    execute stmt;
    get diagnostics n = row_count;
    raise exception using errcode = 'ZX001', detail = n::text;
  exception when sqlstate 'ZX001' then
    get stacked diagnostics detail = pg_exception_detail;
    return detail::integer;
  end;
exception when insufficient_privilege then return -1;
  when foreign_key_violation then return -2;
end $$;
grant execute on function tests.catalogue_effect(text) to anon, authenticated;
select plan(140);
insert into public.memberships(organisation_id,user_id,role,status) values ('5eed0000-0000-4000-8000-0000000000b2','5eed0000-0000-4000-8000-000000000003','staff','active');

reset role;
set local role anon;
set local request.jwt.claims = '{"sub":"","role":"anon","aal":null}';
select is(tests.catalogue_effect($sql$select * from public.categories where slug='wash-and-detailing'$sql$),-1,'anonymous categories select');
select is(tests.catalogue_effect($sql$insert into public.categories(slug,name) values ('matrix-new','Synthetic matrix')$sql$),-1,'anonymous categories insert');
select is(tests.catalogue_effect($sql$update public.categories set name='Synthetic changed' where slug='wash-and-detailing'$sql$),-1,'anonymous categories update');
select is(tests.catalogue_effect($sql$delete from public.categories where slug='wash-and-detailing'$sql$),-1,'anonymous categories delete');
select is(tests.catalogue_effect($sql$select * from public.services where slug='service'$sql$),-1,'anonymous services select');
select is(tests.catalogue_effect($sql$insert into public.services(slug,category_slug,name) values ('matrix-new','wash-and-detailing','Synthetic matrix')$sql$),-1,'anonymous services insert');
select is(tests.catalogue_effect($sql$update public.services set name='Synthetic changed' where slug='service'$sql$),-1,'anonymous services update');
select is(tests.catalogue_effect($sql$delete from public.services where slug='service'$sql$),-1,'anonymous services delete');
select is(tests.catalogue_effect($sql$select * from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous coordinate_sources select');
select is(tests.catalogue_effect($sql$insert into public.coordinate_sources(organisation_id,source_kind,licence_note) values ('5eed0000-0000-4000-8000-0000000000a1','provider_supplied','Synthetic matrix')$sql$),-1,'anonymous coordinate_sources insert');
select is(tests.catalogue_effect($sql$update public.coordinate_sources set licence_note='Synthetic changed' where id='ca7a0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous coordinate_sources update');
select is(tests.catalogue_effect($sql$delete from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous coordinate_sources delete');
select is(tests.catalogue_effect($sql$select * from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),-1,'anonymous branches select');
select is(tests.catalogue_effect($sql$insert into public.branches(organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values ('5eed0000-0000-4000-8000-0000000000a1','Synthetic matrix','Synthetic street',-26,28,'ca7a0000-0000-4000-8000-000000000001')$sql$),-1,'anonymous branches insert');
select is(tests.catalogue_effect($sql$update public.branches set name='Synthetic changed' where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),-1,'anonymous branches update');
select is(tests.catalogue_effect($sql$delete from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),-1,'anonymous branches delete');
select is(tests.catalogue_effect($sql$select * from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),-1,'anonymous listings select');
select is(tests.catalogue_effect($sql$insert into public.listings(organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,provenance_kind,provenance_reference) values ('5eed0000-0000-4000-8000-0000000000a1','service','ca7b1000-0000-4000-8000-000000000001','Synthetic matrix','Synthetic description','Gauteng','fixed','admin_import','Synthetic source')$sql$),-1,'anonymous listings insert');
select is(tests.catalogue_effect($sql$update public.listings set display_name='Synthetic changed' where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),-1,'anonymous listings update');
select is(tests.catalogue_effect($sql$delete from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),-1,'anonymous listings delete');
select is(tests.catalogue_effect($sql$select * from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous service_areas select');
select is(tests.catalogue_effect($sql$insert into public.service_areas(listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values ('ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2',-26,28,10,'ca7a0000-0000-4000-8000-000000000002')$sql$),-1,'anonymous service_areas insert');
select is(tests.catalogue_effect($sql$update public.service_areas set radius_km=20 where id='ca7d0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous service_areas update');
select is(tests.catalogue_effect($sql$delete from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous service_areas delete');
select is(tests.catalogue_effect($sql$select * from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous verifications select');
select is(tests.catalogue_effect($sql$insert into public.verifications(organisation_id,listing_public_id,method,verified_by,evidence_reference) values ('5eed0000-0000-4000-8000-0000000000a1','ca7c1000-0000-4000-8000-000000000002','business_details_checked','5eed0000-0000-4000-8000-000000000004','Synthetic evidence')$sql$),-1,'anonymous verifications insert');
select is(tests.catalogue_effect($sql$update public.verifications set evidence_reference='Synthetic changed' where id='ca7e0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous verifications update');
select is(tests.catalogue_effect($sql$delete from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),-1,'anonymous verifications delete');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"5eed9999-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(tests.catalogue_effect($sql$select * from public.categories where slug='wash-and-detailing'$sql$),0,'self categories select');
select is(tests.catalogue_effect($sql$insert into public.categories(slug,name) values ('matrix-new','Synthetic matrix')$sql$),-1,'self categories insert');
select is(tests.catalogue_effect($sql$update public.categories set name='Synthetic changed' where slug='wash-and-detailing'$sql$),0,'self categories update');
select is(tests.catalogue_effect($sql$delete from public.categories where slug='wash-and-detailing'$sql$),0,'self categories delete');
select is(tests.catalogue_effect($sql$select * from public.services where slug='service'$sql$),0,'self services select');
select is(tests.catalogue_effect($sql$insert into public.services(slug,category_slug,name) values ('matrix-new','wash-and-detailing','Synthetic matrix')$sql$),-1,'self services insert');
select is(tests.catalogue_effect($sql$update public.services set name='Synthetic changed' where slug='service'$sql$),0,'self services update');
select is(tests.catalogue_effect($sql$delete from public.services where slug='service'$sql$),0,'self services delete');
select is(tests.catalogue_effect($sql$select * from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'self coordinate_sources select');
select is(tests.catalogue_effect($sql$insert into public.coordinate_sources(organisation_id,source_kind,licence_note) values ('5eed0000-0000-4000-8000-0000000000a1','provider_supplied','Synthetic matrix')$sql$),-1,'self coordinate_sources insert');
select is(tests.catalogue_effect($sql$update public.coordinate_sources set licence_note='Synthetic changed' where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'self coordinate_sources update');
select is(tests.catalogue_effect($sql$delete from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'self coordinate_sources delete');
select is(tests.catalogue_effect($sql$select * from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'self branches select');
select is(tests.catalogue_effect($sql$insert into public.branches(organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values ('5eed0000-0000-4000-8000-0000000000a1','Synthetic matrix','Synthetic street',-26,28,'ca7a0000-0000-4000-8000-000000000001')$sql$),-1,'self branches insert');
select is(tests.catalogue_effect($sql$update public.branches set name='Synthetic changed' where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'self branches update');
select is(tests.catalogue_effect($sql$delete from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'self branches delete');
select is(tests.catalogue_effect($sql$select * from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'self listings select');
select is(tests.catalogue_effect($sql$insert into public.listings(organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,provenance_kind,provenance_reference) values ('5eed0000-0000-4000-8000-0000000000a1','service','ca7b1000-0000-4000-8000-000000000001','Synthetic matrix','Synthetic description','Gauteng','fixed','admin_import','Synthetic source')$sql$),-1,'self listings insert');
select is(tests.catalogue_effect($sql$update public.listings set display_name='Synthetic changed' where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'self listings update');
select is(tests.catalogue_effect($sql$delete from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'self listings delete');
select is(tests.catalogue_effect($sql$select * from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'self service_areas select');
select is(tests.catalogue_effect($sql$insert into public.service_areas(listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values ('ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2',-26,28,10,'ca7a0000-0000-4000-8000-000000000002')$sql$),-1,'self service_areas insert');
select is(tests.catalogue_effect($sql$update public.service_areas set radius_km=20 where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'self service_areas update');
select is(tests.catalogue_effect($sql$delete from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'self service_areas delete');
select is(tests.catalogue_effect($sql$select * from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'self verifications select');
select is(tests.catalogue_effect($sql$insert into public.verifications(organisation_id,listing_public_id,method,verified_by,evidence_reference) values ('5eed0000-0000-4000-8000-0000000000a1','ca7c1000-0000-4000-8000-000000000002','business_details_checked','5eed0000-0000-4000-8000-000000000004','Synthetic evidence')$sql$),-1,'self verifications insert');
select is(tests.catalogue_effect($sql$update public.verifications set evidence_reference='Synthetic changed' where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'self verifications update');
select is(tests.catalogue_effect($sql$delete from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'self verifications delete');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"5eed0000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(tests.catalogue_effect($sql$select * from public.categories where slug='wash-and-detailing'$sql$),0,'member categories select');
select is(tests.catalogue_effect($sql$insert into public.categories(slug,name) values ('matrix-new','Synthetic matrix')$sql$),-1,'member categories insert');
select is(tests.catalogue_effect($sql$update public.categories set name='Synthetic changed' where slug='wash-and-detailing'$sql$),0,'member categories update');
select is(tests.catalogue_effect($sql$delete from public.categories where slug='wash-and-detailing'$sql$),0,'member categories delete');
select is(tests.catalogue_effect($sql$select * from public.services where slug='service'$sql$),0,'member services select');
select is(tests.catalogue_effect($sql$insert into public.services(slug,category_slug,name) values ('matrix-new','wash-and-detailing','Synthetic matrix')$sql$),-1,'member services insert');
select is(tests.catalogue_effect($sql$update public.services set name='Synthetic changed' where slug='service'$sql$),0,'member services update');
select is(tests.catalogue_effect($sql$delete from public.services where slug='service'$sql$),0,'member services delete');
select is(tests.catalogue_effect($sql$select * from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),1,'member coordinate_sources select');
select is(tests.catalogue_effect($sql$insert into public.coordinate_sources(organisation_id,source_kind,licence_note) values ('5eed0000-0000-4000-8000-0000000000a1','provider_supplied','Synthetic matrix')$sql$),-1,'member coordinate_sources insert');
select is(tests.catalogue_effect($sql$update public.coordinate_sources set licence_note='Synthetic changed' where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'member coordinate_sources update');
select is(tests.catalogue_effect($sql$delete from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'member coordinate_sources delete');
select is(tests.catalogue_effect($sql$select * from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),1,'member branches select');
select is(tests.catalogue_effect($sql$insert into public.branches(organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values ('5eed0000-0000-4000-8000-0000000000a1','Synthetic matrix','Synthetic street',-26,28,'ca7a0000-0000-4000-8000-000000000001')$sql$),-1,'member branches insert');
select is(tests.catalogue_effect($sql$update public.branches set name='Synthetic changed' where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'member branches update');
select is(tests.catalogue_effect($sql$delete from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'member branches delete');
select is(tests.catalogue_effect($sql$select * from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),1,'member listings select');
select is(tests.catalogue_effect($sql$insert into public.listings(organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,provenance_kind,provenance_reference) values ('5eed0000-0000-4000-8000-0000000000a1','service','ca7b1000-0000-4000-8000-000000000001','Synthetic matrix','Synthetic description','Gauteng','fixed','admin_import','Synthetic source')$sql$),-1,'member listings insert');
select is(tests.catalogue_effect($sql$update public.listings set display_name='Synthetic changed' where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'member listings update');
select is(tests.catalogue_effect($sql$delete from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'member listings delete');
select is(tests.catalogue_effect($sql$select * from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),1,'member service_areas select');
select is(tests.catalogue_effect($sql$insert into public.service_areas(listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values ('ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2',-26,28,10,'ca7a0000-0000-4000-8000-000000000002')$sql$),-1,'member service_areas insert');
select is(tests.catalogue_effect($sql$update public.service_areas set radius_km=20 where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'member service_areas update');
select is(tests.catalogue_effect($sql$delete from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'member service_areas delete');
select is(tests.catalogue_effect($sql$select * from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'member verifications select');
select is(tests.catalogue_effect($sql$insert into public.verifications(organisation_id,listing_public_id,method,verified_by,evidence_reference) values ('5eed0000-0000-4000-8000-0000000000a1','ca7c1000-0000-4000-8000-000000000002','business_details_checked','5eed0000-0000-4000-8000-000000000004','Synthetic evidence')$sql$),-1,'member verifications insert');
select is(tests.catalogue_effect($sql$update public.verifications set evidence_reference='Synthetic changed' where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'member verifications update');
select is(tests.catalogue_effect($sql$delete from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'member verifications delete');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"5eed0000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select is(tests.catalogue_effect($sql$select * from public.categories where slug='wash-and-detailing'$sql$),0,'other categories select');
select is(tests.catalogue_effect($sql$insert into public.categories(slug,name) values ('matrix-new','Synthetic matrix')$sql$),-1,'other categories insert');
select is(tests.catalogue_effect($sql$update public.categories set name='Synthetic changed' where slug='wash-and-detailing'$sql$),0,'other categories update');
select is(tests.catalogue_effect($sql$delete from public.categories where slug='wash-and-detailing'$sql$),0,'other categories delete');
select is(tests.catalogue_effect($sql$select * from public.services where slug='service'$sql$),0,'other services select');
select is(tests.catalogue_effect($sql$insert into public.services(slug,category_slug,name) values ('matrix-new','wash-and-detailing','Synthetic matrix')$sql$),-1,'other services insert');
select is(tests.catalogue_effect($sql$update public.services set name='Synthetic changed' where slug='service'$sql$),0,'other services update');
select is(tests.catalogue_effect($sql$delete from public.services where slug='service'$sql$),0,'other services delete');
select is(tests.catalogue_effect($sql$select * from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'other coordinate_sources select');
select is(tests.catalogue_effect($sql$insert into public.coordinate_sources(organisation_id,source_kind,licence_note) values ('5eed0000-0000-4000-8000-0000000000a1','provider_supplied','Synthetic matrix')$sql$),-1,'other coordinate_sources insert');
select is(tests.catalogue_effect($sql$update public.coordinate_sources set licence_note='Synthetic changed' where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'other coordinate_sources update');
select is(tests.catalogue_effect($sql$delete from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),0,'other coordinate_sources delete');
select is(tests.catalogue_effect($sql$select * from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'other branches select');
select is(tests.catalogue_effect($sql$insert into public.branches(organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values ('5eed0000-0000-4000-8000-0000000000a1','Synthetic matrix','Synthetic street',-26,28,'ca7a0000-0000-4000-8000-000000000001')$sql$),-1,'other branches insert');
select is(tests.catalogue_effect($sql$update public.branches set name='Synthetic changed' where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'other branches update');
select is(tests.catalogue_effect($sql$delete from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),0,'other branches delete');
select is(tests.catalogue_effect($sql$select * from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'other listings select');
select is(tests.catalogue_effect($sql$insert into public.listings(organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,provenance_kind,provenance_reference) values ('5eed0000-0000-4000-8000-0000000000a1','service','ca7b1000-0000-4000-8000-000000000001','Synthetic matrix','Synthetic description','Gauteng','fixed','admin_import','Synthetic source')$sql$),-1,'other listings insert');
select is(tests.catalogue_effect($sql$update public.listings set display_name='Synthetic changed' where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'other listings update');
select is(tests.catalogue_effect($sql$delete from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),0,'other listings delete');
select is(tests.catalogue_effect($sql$select * from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'other service_areas select');
select is(tests.catalogue_effect($sql$insert into public.service_areas(listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values ('ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2',-26,28,10,'ca7a0000-0000-4000-8000-000000000002')$sql$),-1,'other service_areas insert');
select is(tests.catalogue_effect($sql$update public.service_areas set radius_km=20 where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'other service_areas update');
select is(tests.catalogue_effect($sql$delete from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),0,'other service_areas delete');
select is(tests.catalogue_effect($sql$select * from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'other verifications select');
select is(tests.catalogue_effect($sql$insert into public.verifications(organisation_id,listing_public_id,method,verified_by,evidence_reference) values ('5eed0000-0000-4000-8000-0000000000a1','ca7c1000-0000-4000-8000-000000000002','business_details_checked','5eed0000-0000-4000-8000-000000000004','Synthetic evidence')$sql$),-1,'other verifications insert');
select is(tests.catalogue_effect($sql$update public.verifications set evidence_reference='Synthetic changed' where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'other verifications update');
select is(tests.catalogue_effect($sql$delete from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),0,'other verifications delete');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"5eed0000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select is(tests.catalogue_effect($sql$select * from public.categories where slug='wash-and-detailing'$sql$),1,'admin categories select');
select is(tests.catalogue_effect($sql$insert into public.categories(slug,name) values ('matrix-new','Synthetic matrix')$sql$),1,'admin categories insert');
select is(tests.catalogue_effect($sql$update public.categories set name='Synthetic changed' where slug='wash-and-detailing'$sql$),1,'admin categories update');
select is(tests.catalogue_effect($sql$delete from public.categories where slug='wash-and-detailing'$sql$),-2,'admin categories delete');
select is(tests.catalogue_effect($sql$select * from public.services where slug='service'$sql$),1,'admin services select');
select is(tests.catalogue_effect($sql$insert into public.services(slug,category_slug,name) values ('matrix-new','wash-and-detailing','Synthetic matrix')$sql$),1,'admin services insert');
select is(tests.catalogue_effect($sql$update public.services set name='Synthetic changed' where slug='service'$sql$),1,'admin services update');
select is(tests.catalogue_effect($sql$delete from public.services where slug='service'$sql$),-2,'admin services delete');
select is(tests.catalogue_effect($sql$select * from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),1,'admin coordinate_sources select');
select is(tests.catalogue_effect($sql$insert into public.coordinate_sources(organisation_id,source_kind,licence_note) values ('5eed0000-0000-4000-8000-0000000000a1','provider_supplied','Synthetic matrix')$sql$),1,'admin coordinate_sources insert');
select is(tests.catalogue_effect($sql$update public.coordinate_sources set licence_note='Synthetic changed' where id='ca7a0000-0000-4000-8000-000000000001'$sql$),1,'admin coordinate_sources update');
select is(tests.catalogue_effect($sql$delete from public.coordinate_sources where id='ca7a0000-0000-4000-8000-000000000001'$sql$),-2,'admin coordinate_sources delete');
select is(tests.catalogue_effect($sql$select * from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),1,'admin branches select');
select is(tests.catalogue_effect($sql$insert into public.branches(organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values ('5eed0000-0000-4000-8000-0000000000a1','Synthetic matrix','Synthetic street',-26,28,'ca7a0000-0000-4000-8000-000000000001')$sql$),1,'admin branches insert');
select is(tests.catalogue_effect($sql$update public.branches set name='Synthetic changed' where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),1,'admin branches update');
select is(tests.catalogue_effect($sql$delete from public.branches where public_id='ca7b1000-0000-4000-8000-000000000001'$sql$),-2,'admin branches delete');
select is(tests.catalogue_effect($sql$select * from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),1,'admin listings select');
select is(tests.catalogue_effect($sql$insert into public.listings(organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,provenance_kind,provenance_reference) values ('5eed0000-0000-4000-8000-0000000000a1','service','ca7b1000-0000-4000-8000-000000000001','Synthetic matrix','Synthetic description','Gauteng','fixed','admin_import','Synthetic source')$sql$),1,'admin listings insert');
select is(tests.catalogue_effect($sql$update public.listings set display_name='Synthetic changed' where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),1,'admin listings update');
select is(tests.catalogue_effect($sql$delete from public.listings where public_id='ca7c1000-0000-4000-8000-000000000001'$sql$),1,'admin listings delete');
select is(tests.catalogue_effect($sql$select * from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),1,'admin service_areas select');
select is(tests.catalogue_effect($sql$insert into public.service_areas(listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values ('ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2',-26,28,10,'ca7a0000-0000-4000-8000-000000000002')$sql$),1,'admin service_areas insert');
select is(tests.catalogue_effect($sql$update public.service_areas set radius_km=20 where id='ca7d0000-0000-4000-8000-000000000001'$sql$),1,'admin service_areas update');
select is(tests.catalogue_effect($sql$delete from public.service_areas where id='ca7d0000-0000-4000-8000-000000000001'$sql$),1,'admin service_areas delete');
select is(tests.catalogue_effect($sql$select * from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),1,'admin verifications select');
select is(tests.catalogue_effect($sql$insert into public.verifications(organisation_id,listing_public_id,method,verified_by,evidence_reference) values ('5eed0000-0000-4000-8000-0000000000a1','ca7c1000-0000-4000-8000-000000000002','business_details_checked','5eed0000-0000-4000-8000-000000000004','Synthetic evidence')$sql$),1,'admin verifications insert');
select is(tests.catalogue_effect($sql$update public.verifications set evidence_reference='Synthetic changed' where id='ca7e0000-0000-4000-8000-000000000001'$sql$),1,'admin verifications update');
select is(tests.catalogue_effect($sql$delete from public.verifications where id='ca7e0000-0000-4000-8000-000000000001'$sql$),1,'admin verifications delete');

reset role;
select * from finish();
rollback;
