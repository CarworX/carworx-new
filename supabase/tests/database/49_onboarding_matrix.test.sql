-- O2 A4 extension (Claude 23): the five onboarding tables x seven actors x
-- four operations (140). Clients have SELECT only, so every write is denied
-- (42501 -> -1) for every actor, including the aal2 admin: writes go through
-- the private.* functions. Reads: organisation tables by members, invites by
-- owners and managers, applications by their applicant, all by an aal2 admin.
-- Rolled back. SYNTHETIC.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.effect(stmt text) returns integer language plpgsql as $$
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
end $$;
grant execute on function tests.effect(text) to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('b9000000-0000-4000-8000-000000000001','olga.owner@example.test',now()), ('b9000000-0000-4000-8000-000000000002','mia.manager@example.test',now()),
  ('b9000000-0000-4000-8000-000000000003','sid.staff@example.test',now()), ('b9000000-0000-4000-8000-000000000004','tom.stranger@example.test',now()),
  ('b9000000-0000-4000-8000-000000000005','ada.admin@example.test',now());
insert into public.categories(slug,name) values ('o2m-cat','O2 matrix category (synthetic)');
insert into public.services(slug,category_slug,name) values ('o2m-wash','o2m-cat','O2 matrix wash (synthetic)');
insert into private.platform_admins(user_id) values ('b9000000-0000-4000-8000-000000000005');
insert into public.organisations(id,name) values ('b9100000-0000-4000-8000-00000000000a','Org X Wash (synthetic)');
insert into public.memberships(id,organisation_id,user_id,role,status) values
  ('b9200000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-00000000000a','b9000000-0000-4000-8000-000000000001','owner','active'),
  ('b9200000-0000-4000-8000-000000000002','b9100000-0000-4000-8000-00000000000a','b9000000-0000-4000-8000-000000000002','manager','active'),
  ('b9200000-0000-4000-8000-000000000003','b9100000-0000-4000-8000-00000000000a','b9000000-0000-4000-8000-000000000003','staff','active');
insert into public.coordinate_sources(id,organisation_id,source_kind,licence_note) values
  ('b9300000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-00000000000a','provider_supplied','Synthetic');
insert into public.branches(public_id,organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values
  ('b9400000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-00000000000a','Synthetic','1 Synthetic Road',-26.1,28.0,'b9300000-0000-4000-8000-000000000001');
insert into public.listings(public_id,organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,status,provenance_kind,provenance_reference) values
  ('b9500000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-00000000000a','o2m-wash','b9400000-0000-4000-8000-000000000001','Synthetic','Synthetic','Gauteng','fixed','live','admin_import','Synthetic');
insert into public.listing_services(listing_public_id,organisation_id,service_slug,position) values
  ('b9500000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-00000000000a','o2m-wash',0);
insert into public.listing_hours(listing_public_id,organisation_id,day,opens,closes) values
  ('b9500000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-00000000000a',1,'08:00','17:00');
insert into public.staff_profiles(membership_id,organisation_id,first_name) values
  ('b9200000-0000-4000-8000-000000000003','b9100000-0000-4000-8000-00000000000a','Sid');
insert into public.invites(organisation_id,role,token_hash,created_by,control_generation) values
  ('b9100000-0000-4000-8000-00000000000a','staff',extensions.digest('o2m-token','sha256'),'b9000000-0000-4000-8000-000000000001',1);
insert into public.provider_applications(user_id,business_name) values ('b9000000-0000-4000-8000-000000000001','Olga draft (synthetic)');

select plan(140);

-- ===== anon =====
reset role;
set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is(tests.effect($sql$select * from public.listing_services$sql$),-1,'anon listing_services select');
select is(tests.effect($sql$insert into public.listing_services default values$sql$),-1,'anon listing_services insert');
select is(tests.effect($sql$update public.listing_services set id = id$sql$),-1,'anon listing_services update');
select is(tests.effect($sql$delete from public.listing_services$sql$),-1,'anon listing_services delete');
select is(tests.effect($sql$select * from public.listing_hours$sql$),-1,'anon listing_hours select');
select is(tests.effect($sql$insert into public.listing_hours default values$sql$),-1,'anon listing_hours insert');
select is(tests.effect($sql$update public.listing_hours set id = id$sql$),-1,'anon listing_hours update');
select is(tests.effect($sql$delete from public.listing_hours$sql$),-1,'anon listing_hours delete');
select is(tests.effect($sql$select * from public.staff_profiles$sql$),-1,'anon staff_profiles select');
select is(tests.effect($sql$insert into public.staff_profiles default values$sql$),-1,'anon staff_profiles insert');
select is(tests.effect($sql$update public.staff_profiles set id = id$sql$),-1,'anon staff_profiles update');
select is(tests.effect($sql$delete from public.staff_profiles$sql$),-1,'anon staff_profiles delete');
select is(tests.effect($sql$select id from public.invites$sql$),-1,'anon invites select');
select is(tests.effect($sql$insert into public.invites default values$sql$),-1,'anon invites insert');
select is(tests.effect($sql$update public.invites set id = id$sql$),-1,'anon invites update');
select is(tests.effect($sql$delete from public.invites$sql$),-1,'anon invites delete');
select is(tests.effect($sql$select * from public.provider_applications$sql$),-1,'anon provider_applications select');
select is(tests.effect($sql$insert into public.provider_applications default values$sql$),-1,'anon provider_applications insert');
select is(tests.effect($sql$update public.provider_applications set id = id$sql$),-1,'anon provider_applications update');
select is(tests.effect($sql$delete from public.provider_applications$sql$),-1,'anon provider_applications delete');

-- ===== stranger =====
reset role;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_services$sql$),0,'stranger listing_services select');
select is(tests.effect($sql$insert into public.listing_services default values$sql$),-1,'stranger listing_services insert');
select is(tests.effect($sql$update public.listing_services set id = id$sql$),-1,'stranger listing_services update');
select is(tests.effect($sql$delete from public.listing_services$sql$),-1,'stranger listing_services delete');
select is(tests.effect($sql$select * from public.listing_hours$sql$),0,'stranger listing_hours select');
select is(tests.effect($sql$insert into public.listing_hours default values$sql$),-1,'stranger listing_hours insert');
select is(tests.effect($sql$update public.listing_hours set id = id$sql$),-1,'stranger listing_hours update');
select is(tests.effect($sql$delete from public.listing_hours$sql$),-1,'stranger listing_hours delete');
select is(tests.effect($sql$select * from public.staff_profiles$sql$),0,'stranger staff_profiles select');
select is(tests.effect($sql$insert into public.staff_profiles default values$sql$),-1,'stranger staff_profiles insert');
select is(tests.effect($sql$update public.staff_profiles set id = id$sql$),-1,'stranger staff_profiles update');
select is(tests.effect($sql$delete from public.staff_profiles$sql$),-1,'stranger staff_profiles delete');
select is(tests.effect($sql$select id from public.invites$sql$),0,'stranger invites select');
select is(tests.effect($sql$insert into public.invites default values$sql$),-1,'stranger invites insert');
select is(tests.effect($sql$update public.invites set id = id$sql$),-1,'stranger invites update');
select is(tests.effect($sql$delete from public.invites$sql$),-1,'stranger invites delete');
select is(tests.effect($sql$select * from public.provider_applications$sql$),0,'stranger provider_applications select');
select is(tests.effect($sql$insert into public.provider_applications default values$sql$),-1,'stranger provider_applications insert');
select is(tests.effect($sql$update public.provider_applications set id = id$sql$),-1,'stranger provider_applications update');
select is(tests.effect($sql$delete from public.provider_applications$sql$),-1,'stranger provider_applications delete');

-- ===== staff =====
reset role;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_services$sql$),1,'staff listing_services select');
select is(tests.effect($sql$insert into public.listing_services default values$sql$),-1,'staff listing_services insert');
select is(tests.effect($sql$update public.listing_services set id = id$sql$),-1,'staff listing_services update');
select is(tests.effect($sql$delete from public.listing_services$sql$),-1,'staff listing_services delete');
select is(tests.effect($sql$select * from public.listing_hours$sql$),1,'staff listing_hours select');
select is(tests.effect($sql$insert into public.listing_hours default values$sql$),-1,'staff listing_hours insert');
select is(tests.effect($sql$update public.listing_hours set id = id$sql$),-1,'staff listing_hours update');
select is(tests.effect($sql$delete from public.listing_hours$sql$),-1,'staff listing_hours delete');
select is(tests.effect($sql$select * from public.staff_profiles$sql$),1,'staff staff_profiles select');
select is(tests.effect($sql$insert into public.staff_profiles default values$sql$),-1,'staff staff_profiles insert');
select is(tests.effect($sql$update public.staff_profiles set id = id$sql$),-1,'staff staff_profiles update');
select is(tests.effect($sql$delete from public.staff_profiles$sql$),-1,'staff staff_profiles delete');
select is(tests.effect($sql$select id from public.invites$sql$),0,'staff invites select');
select is(tests.effect($sql$insert into public.invites default values$sql$),-1,'staff invites insert');
select is(tests.effect($sql$update public.invites set id = id$sql$),-1,'staff invites update');
select is(tests.effect($sql$delete from public.invites$sql$),-1,'staff invites delete');
select is(tests.effect($sql$select * from public.provider_applications$sql$),0,'staff provider_applications select');
select is(tests.effect($sql$insert into public.provider_applications default values$sql$),-1,'staff provider_applications insert');
select is(tests.effect($sql$update public.provider_applications set id = id$sql$),-1,'staff provider_applications update');
select is(tests.effect($sql$delete from public.provider_applications$sql$),-1,'staff provider_applications delete');

-- ===== manager =====
reset role;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_services$sql$),1,'manager listing_services select');
select is(tests.effect($sql$insert into public.listing_services default values$sql$),-1,'manager listing_services insert');
select is(tests.effect($sql$update public.listing_services set id = id$sql$),-1,'manager listing_services update');
select is(tests.effect($sql$delete from public.listing_services$sql$),-1,'manager listing_services delete');
select is(tests.effect($sql$select * from public.listing_hours$sql$),1,'manager listing_hours select');
select is(tests.effect($sql$insert into public.listing_hours default values$sql$),-1,'manager listing_hours insert');
select is(tests.effect($sql$update public.listing_hours set id = id$sql$),-1,'manager listing_hours update');
select is(tests.effect($sql$delete from public.listing_hours$sql$),-1,'manager listing_hours delete');
select is(tests.effect($sql$select * from public.staff_profiles$sql$),1,'manager staff_profiles select');
select is(tests.effect($sql$insert into public.staff_profiles default values$sql$),-1,'manager staff_profiles insert');
select is(tests.effect($sql$update public.staff_profiles set id = id$sql$),-1,'manager staff_profiles update');
select is(tests.effect($sql$delete from public.staff_profiles$sql$),-1,'manager staff_profiles delete');
select is(tests.effect($sql$select id from public.invites$sql$),1,'manager invites select');
select is(tests.effect($sql$insert into public.invites default values$sql$),-1,'manager invites insert');
select is(tests.effect($sql$update public.invites set id = id$sql$),-1,'manager invites update');
select is(tests.effect($sql$delete from public.invites$sql$),-1,'manager invites delete');
select is(tests.effect($sql$select * from public.provider_applications$sql$),0,'manager provider_applications select');
select is(tests.effect($sql$insert into public.provider_applications default values$sql$),-1,'manager provider_applications insert');
select is(tests.effect($sql$update public.provider_applications set id = id$sql$),-1,'manager provider_applications update');
select is(tests.effect($sql$delete from public.provider_applications$sql$),-1,'manager provider_applications delete');

-- ===== owner =====
reset role;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_services$sql$),1,'owner listing_services select');
select is(tests.effect($sql$insert into public.listing_services default values$sql$),-1,'owner listing_services insert');
select is(tests.effect($sql$update public.listing_services set id = id$sql$),-1,'owner listing_services update');
select is(tests.effect($sql$delete from public.listing_services$sql$),-1,'owner listing_services delete');
select is(tests.effect($sql$select * from public.listing_hours$sql$),1,'owner listing_hours select');
select is(tests.effect($sql$insert into public.listing_hours default values$sql$),-1,'owner listing_hours insert');
select is(tests.effect($sql$update public.listing_hours set id = id$sql$),-1,'owner listing_hours update');
select is(tests.effect($sql$delete from public.listing_hours$sql$),-1,'owner listing_hours delete');
select is(tests.effect($sql$select * from public.staff_profiles$sql$),1,'owner staff_profiles select');
select is(tests.effect($sql$insert into public.staff_profiles default values$sql$),-1,'owner staff_profiles insert');
select is(tests.effect($sql$update public.staff_profiles set id = id$sql$),-1,'owner staff_profiles update');
select is(tests.effect($sql$delete from public.staff_profiles$sql$),-1,'owner staff_profiles delete');
select is(tests.effect($sql$select id from public.invites$sql$),1,'owner invites select');
select is(tests.effect($sql$insert into public.invites default values$sql$),-1,'owner invites insert');
select is(tests.effect($sql$update public.invites set id = id$sql$),-1,'owner invites update');
select is(tests.effect($sql$delete from public.invites$sql$),-1,'owner invites delete');
select is(tests.effect($sql$select * from public.provider_applications$sql$),1,'owner provider_applications select');
select is(tests.effect($sql$insert into public.provider_applications default values$sql$),-1,'owner provider_applications insert');
select is(tests.effect($sql$update public.provider_applications set id = id$sql$),-1,'owner provider_applications update');
select is(tests.effect($sql$delete from public.provider_applications$sql$),-1,'owner provider_applications delete');

-- ===== admin at aal1 =====
reset role;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_services$sql$),0,'admin at aal1 listing_services select');
select is(tests.effect($sql$insert into public.listing_services default values$sql$),-1,'admin at aal1 listing_services insert');
select is(tests.effect($sql$update public.listing_services set id = id$sql$),-1,'admin at aal1 listing_services update');
select is(tests.effect($sql$delete from public.listing_services$sql$),-1,'admin at aal1 listing_services delete');
select is(tests.effect($sql$select * from public.listing_hours$sql$),0,'admin at aal1 listing_hours select');
select is(tests.effect($sql$insert into public.listing_hours default values$sql$),-1,'admin at aal1 listing_hours insert');
select is(tests.effect($sql$update public.listing_hours set id = id$sql$),-1,'admin at aal1 listing_hours update');
select is(tests.effect($sql$delete from public.listing_hours$sql$),-1,'admin at aal1 listing_hours delete');
select is(tests.effect($sql$select * from public.staff_profiles$sql$),0,'admin at aal1 staff_profiles select');
select is(tests.effect($sql$insert into public.staff_profiles default values$sql$),-1,'admin at aal1 staff_profiles insert');
select is(tests.effect($sql$update public.staff_profiles set id = id$sql$),-1,'admin at aal1 staff_profiles update');
select is(tests.effect($sql$delete from public.staff_profiles$sql$),-1,'admin at aal1 staff_profiles delete');
select is(tests.effect($sql$select id from public.invites$sql$),0,'admin at aal1 invites select');
select is(tests.effect($sql$insert into public.invites default values$sql$),-1,'admin at aal1 invites insert');
select is(tests.effect($sql$update public.invites set id = id$sql$),-1,'admin at aal1 invites update');
select is(tests.effect($sql$delete from public.invites$sql$),-1,'admin at aal1 invites delete');
select is(tests.effect($sql$select * from public.provider_applications$sql$),0,'admin at aal1 provider_applications select');
select is(tests.effect($sql$insert into public.provider_applications default values$sql$),-1,'admin at aal1 provider_applications insert');
select is(tests.effect($sql$update public.provider_applications set id = id$sql$),-1,'admin at aal1 provider_applications update');
select is(tests.effect($sql$delete from public.provider_applications$sql$),-1,'admin at aal1 provider_applications delete');

-- ===== admin at aal2 =====
reset role;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_services$sql$),1,'admin at aal2 listing_services select');
select is(tests.effect($sql$insert into public.listing_services default values$sql$),-1,'admin at aal2 listing_services insert');
select is(tests.effect($sql$update public.listing_services set id = id$sql$),-1,'admin at aal2 listing_services update');
select is(tests.effect($sql$delete from public.listing_services$sql$),-1,'admin at aal2 listing_services delete');
select is(tests.effect($sql$select * from public.listing_hours$sql$),1,'admin at aal2 listing_hours select');
select is(tests.effect($sql$insert into public.listing_hours default values$sql$),-1,'admin at aal2 listing_hours insert');
select is(tests.effect($sql$update public.listing_hours set id = id$sql$),-1,'admin at aal2 listing_hours update');
select is(tests.effect($sql$delete from public.listing_hours$sql$),-1,'admin at aal2 listing_hours delete');
select is(tests.effect($sql$select * from public.staff_profiles$sql$),1,'admin at aal2 staff_profiles select');
select is(tests.effect($sql$insert into public.staff_profiles default values$sql$),-1,'admin at aal2 staff_profiles insert');
select is(tests.effect($sql$update public.staff_profiles set id = id$sql$),-1,'admin at aal2 staff_profiles update');
select is(tests.effect($sql$delete from public.staff_profiles$sql$),-1,'admin at aal2 staff_profiles delete');
select is(tests.effect($sql$select id from public.invites$sql$),1,'admin at aal2 invites select');
select is(tests.effect($sql$insert into public.invites default values$sql$),-1,'admin at aal2 invites insert');
select is(tests.effect($sql$update public.invites set id = id$sql$),-1,'admin at aal2 invites update');
select is(tests.effect($sql$delete from public.invites$sql$),-1,'admin at aal2 invites delete');
select is(tests.effect($sql$select * from public.provider_applications$sql$),1,'admin at aal2 provider_applications select');
select is(tests.effect($sql$insert into public.provider_applications default values$sql$),-1,'admin at aal2 provider_applications insert');
select is(tests.effect($sql$update public.provider_applications set id = id$sql$),-1,'admin at aal2 provider_applications update');
select is(tests.effect($sql$delete from public.provider_applications$sql$),-1,'admin at aal2 provider_applications delete');

reset role;
select * from finish();
rollback;
