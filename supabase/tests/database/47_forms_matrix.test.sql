-- P2-5 A4 extension (Claude 22): consents, enquiries, demand_requests and
-- support_cases x six actors x four operations (96), plus aal1-admin reads (4).
-- Clients have SELECT only, so every write is denied (42501 -> -1) for every
-- actor, including the aal2 admin. A13: demand capture is read by the aal2
-- admin only. Actors: anon; self = Sam, who sent every row with his own email
-- (no user link, so he reads nothing); owner = Olga, owner of org X (reads
-- org X enquiries); staff = Sid, staff of org X; other = Oren, owner of org Y;
-- admin = Ada at aal2. Own fixtures (K4). Rolled back. SYNTHETIC.
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
  ('b7000000-0000-4000-8000-000000000001','sam.self@example.test',now()), ('b7000000-0000-4000-8000-000000000002','olga.owner@example.test',now()),
  ('b7000000-0000-4000-8000-000000000003','sid.staff@example.test',now()), ('b7000000-0000-4000-8000-000000000004','oren.other@example.test',now()),
  ('b7000000-0000-4000-8000-000000000005','ada.admin@example.test',now());
insert into public.categories(slug,name) values ('p25m-cat','P2-5 matrix category (synthetic)');
insert into public.services(slug,category_slug,name) values ('p25m-svc','p25m-cat','P2-5 matrix service (synthetic)');
insert into private.platform_admins(user_id) values ('b7000000-0000-4000-8000-000000000005');
insert into public.organisations(id,name) values ('b7100000-0000-4000-8000-00000000000a','Org X Matrix (synthetic)'), ('b7100000-0000-4000-8000-00000000000b','Org Y Matrix (synthetic)');
insert into public.memberships(organisation_id,user_id,role,status) values
  ('b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000002','owner','active'), ('b7100000-0000-4000-8000-00000000000a','b7000000-0000-4000-8000-000000000003','staff','active'), ('b7100000-0000-4000-8000-00000000000b','b7000000-0000-4000-8000-000000000004','owner','active');
insert into public.listings(public_id,organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
  values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','p25m-svc','Synthetic matrix listing','Synthetic matrix description','Gauteng','mobile','live','provider_application','synthetic-matrix');
insert into public.consents(id,purpose,notice_version,subject_email) values
  ('b7300000-0000-4000-8000-000000000001','enquiry_share_with_provider','privacy-2026-11-11','sam.self@example.test'),
  ('b7300000-0000-4000-8000-000000000002','demand_notify','privacy-2026-11-11','sam.self@example.test');
insert into public.enquiries(id,listing_public_id,organisation_id,sender_name,sender_email,message,consent_id)
  values ('b7400000-0000-4000-8000-000000000001','b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Sam Self','sam.self@example.test','Synthetic matrix enquiry','b7300000-0000-4000-8000-000000000001');
insert into public.demand_requests(id,email,category_slug,province,consent_id,last_activity_at,expires_at)
  values ('b7500000-0000-4000-8000-000000000001','sam.self@example.test','p25m-cat','gauteng','b7300000-0000-4000-8000-000000000002',now(),now()+interval '12 months');
insert into public.support_cases(id,email,topic,message) values ('b7600000-0000-4000-8000-000000000001','sam.self@example.test','other','Synthetic matrix support case');

select plan(100);


reset role;
set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is(tests.effect($sql$select * from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | anonymous | select');
select is(tests.effect($sql$insert into public.consents(purpose,notice_version,subject_email) values ('demand_notify','privacy-2026-11-11','x@example.test')$sql$),-1,'consents | anonymous | insert denied');
select is(tests.effect($sql$update public.consents set withdrawn_at=now() where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | anonymous | update denied');
select is(tests.effect($sql$delete from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | anonymous | delete denied');
select is(tests.effect($sql$select * from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | anonymous | select');
select is(tests.effect($sql$insert into public.enquiries(listing_public_id,organisation_id,sender_name,sender_email,message,consent_id) values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Xx','x@example.test','Synthetic matrix insert','b7300000-0000-4000-8000-000000000001')$sql$),-1,'enquiries | anonymous | insert denied');
select is(tests.effect($sql$update public.enquiries set message='Synthetic changed message' where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | anonymous | update denied');
select is(tests.effect($sql$delete from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | anonymous | delete denied');
select is(tests.effect($sql$select * from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | anonymous | select');
select is(tests.effect($sql$insert into public.demand_requests(email,category_slug,province,consent_id,last_activity_at,expires_at) values ('x@example.test','p25m-cat','limpopo','b7300000-0000-4000-8000-000000000001',now(),now()+interval '12 months')$sql$),-1,'demand_requests | anonymous | insert denied');
select is(tests.effect($sql$update public.demand_requests set province='limpopo' where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | anonymous | update denied');
select is(tests.effect($sql$delete from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | anonymous | delete denied');
select is(tests.effect($sql$select * from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | anonymous | select');
select is(tests.effect($sql$insert into public.support_cases(email,topic,message) values ('x@example.test','other','Synthetic matrix insert')$sql$),-1,'support_cases | anonymous | insert denied');
select is(tests.effect($sql$update public.support_cases set status='closed' where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | anonymous | update denied');
select is(tests.effect($sql$delete from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | anonymous | delete denied');

reset role;
set local request.jwt.claims = '{"sub":"b7000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),0,'consents | self | select');
select is(tests.effect($sql$insert into public.consents(purpose,notice_version,subject_email) values ('demand_notify','privacy-2026-11-11','x@example.test')$sql$),-1,'consents | self | insert denied');
select is(tests.effect($sql$update public.consents set withdrawn_at=now() where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | self | update denied');
select is(tests.effect($sql$delete from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | self | delete denied');
select is(tests.effect($sql$select * from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),0,'enquiries | self | select');
select is(tests.effect($sql$insert into public.enquiries(listing_public_id,organisation_id,sender_name,sender_email,message,consent_id) values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Xx','x@example.test','Synthetic matrix insert','b7300000-0000-4000-8000-000000000001')$sql$),-1,'enquiries | self | insert denied');
select is(tests.effect($sql$update public.enquiries set message='Synthetic changed message' where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | self | update denied');
select is(tests.effect($sql$delete from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | self | delete denied');
select is(tests.effect($sql$select * from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),0,'demand_requests | self | select');
select is(tests.effect($sql$insert into public.demand_requests(email,category_slug,province,consent_id,last_activity_at,expires_at) values ('x@example.test','p25m-cat','limpopo','b7300000-0000-4000-8000-000000000001',now(),now()+interval '12 months')$sql$),-1,'demand_requests | self | insert denied');
select is(tests.effect($sql$update public.demand_requests set province='limpopo' where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | self | update denied');
select is(tests.effect($sql$delete from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | self | delete denied');
select is(tests.effect($sql$select * from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),0,'support_cases | self | select');
select is(tests.effect($sql$insert into public.support_cases(email,topic,message) values ('x@example.test','other','Synthetic matrix insert')$sql$),-1,'support_cases | self | insert denied');
select is(tests.effect($sql$update public.support_cases set status='closed' where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | self | update denied');
select is(tests.effect($sql$delete from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | self | delete denied');

reset role;
set local request.jwt.claims = '{"sub":"b7000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),0,'consents | owner | select');
select is(tests.effect($sql$insert into public.consents(purpose,notice_version,subject_email) values ('demand_notify','privacy-2026-11-11','x@example.test')$sql$),-1,'consents | owner | insert denied');
select is(tests.effect($sql$update public.consents set withdrawn_at=now() where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | owner | update denied');
select is(tests.effect($sql$delete from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | owner | delete denied');
select is(tests.effect($sql$select * from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),1,'enquiries | owner | select');
select is(tests.effect($sql$insert into public.enquiries(listing_public_id,organisation_id,sender_name,sender_email,message,consent_id) values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Xx','x@example.test','Synthetic matrix insert','b7300000-0000-4000-8000-000000000001')$sql$),-1,'enquiries | owner | insert denied');
select is(tests.effect($sql$update public.enquiries set message='Synthetic changed message' where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | owner | update denied');
select is(tests.effect($sql$delete from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | owner | delete denied');
select is(tests.effect($sql$select * from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),0,'demand_requests | owner | select');
select is(tests.effect($sql$insert into public.demand_requests(email,category_slug,province,consent_id,last_activity_at,expires_at) values ('x@example.test','p25m-cat','limpopo','b7300000-0000-4000-8000-000000000001',now(),now()+interval '12 months')$sql$),-1,'demand_requests | owner | insert denied');
select is(tests.effect($sql$update public.demand_requests set province='limpopo' where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | owner | update denied');
select is(tests.effect($sql$delete from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | owner | delete denied');
select is(tests.effect($sql$select * from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),0,'support_cases | owner | select');
select is(tests.effect($sql$insert into public.support_cases(email,topic,message) values ('x@example.test','other','Synthetic matrix insert')$sql$),-1,'support_cases | owner | insert denied');
select is(tests.effect($sql$update public.support_cases set status='closed' where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | owner | update denied');
select is(tests.effect($sql$delete from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | owner | delete denied');

reset role;
set local request.jwt.claims = '{"sub":"b7000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),0,'consents | staff | select');
select is(tests.effect($sql$insert into public.consents(purpose,notice_version,subject_email) values ('demand_notify','privacy-2026-11-11','x@example.test')$sql$),-1,'consents | staff | insert denied');
select is(tests.effect($sql$update public.consents set withdrawn_at=now() where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | staff | update denied');
select is(tests.effect($sql$delete from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | staff | delete denied');
select is(tests.effect($sql$select * from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),0,'enquiries | staff | select');
select is(tests.effect($sql$insert into public.enquiries(listing_public_id,organisation_id,sender_name,sender_email,message,consent_id) values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Xx','x@example.test','Synthetic matrix insert','b7300000-0000-4000-8000-000000000001')$sql$),-1,'enquiries | staff | insert denied');
select is(tests.effect($sql$update public.enquiries set message='Synthetic changed message' where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | staff | update denied');
select is(tests.effect($sql$delete from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | staff | delete denied');
select is(tests.effect($sql$select * from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),0,'demand_requests | staff | select');
select is(tests.effect($sql$insert into public.demand_requests(email,category_slug,province,consent_id,last_activity_at,expires_at) values ('x@example.test','p25m-cat','limpopo','b7300000-0000-4000-8000-000000000001',now(),now()+interval '12 months')$sql$),-1,'demand_requests | staff | insert denied');
select is(tests.effect($sql$update public.demand_requests set province='limpopo' where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | staff | update denied');
select is(tests.effect($sql$delete from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | staff | delete denied');
select is(tests.effect($sql$select * from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),0,'support_cases | staff | select');
select is(tests.effect($sql$insert into public.support_cases(email,topic,message) values ('x@example.test','other','Synthetic matrix insert')$sql$),-1,'support_cases | staff | insert denied');
select is(tests.effect($sql$update public.support_cases set status='closed' where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | staff | update denied');
select is(tests.effect($sql$delete from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | staff | delete denied');

reset role;
set local request.jwt.claims = '{"sub":"b7000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),0,'consents | other-org | select');
select is(tests.effect($sql$insert into public.consents(purpose,notice_version,subject_email) values ('demand_notify','privacy-2026-11-11','x@example.test')$sql$),-1,'consents | other-org | insert denied');
select is(tests.effect($sql$update public.consents set withdrawn_at=now() where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | other-org | update denied');
select is(tests.effect($sql$delete from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | other-org | delete denied');
select is(tests.effect($sql$select * from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),0,'enquiries | other-org | select');
select is(tests.effect($sql$insert into public.enquiries(listing_public_id,organisation_id,sender_name,sender_email,message,consent_id) values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Xx','x@example.test','Synthetic matrix insert','b7300000-0000-4000-8000-000000000001')$sql$),-1,'enquiries | other-org | insert denied');
select is(tests.effect($sql$update public.enquiries set message='Synthetic changed message' where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | other-org | update denied');
select is(tests.effect($sql$delete from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | other-org | delete denied');
select is(tests.effect($sql$select * from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),0,'demand_requests | other-org | select');
select is(tests.effect($sql$insert into public.demand_requests(email,category_slug,province,consent_id,last_activity_at,expires_at) values ('x@example.test','p25m-cat','limpopo','b7300000-0000-4000-8000-000000000001',now(),now()+interval '12 months')$sql$),-1,'demand_requests | other-org | insert denied');
select is(tests.effect($sql$update public.demand_requests set province='limpopo' where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | other-org | update denied');
select is(tests.effect($sql$delete from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | other-org | delete denied');
select is(tests.effect($sql$select * from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),0,'support_cases | other-org | select');
select is(tests.effect($sql$insert into public.support_cases(email,topic,message) values ('x@example.test','other','Synthetic matrix insert')$sql$),-1,'support_cases | other-org | insert denied');
select is(tests.effect($sql$update public.support_cases set status='closed' where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | other-org | update denied');
select is(tests.effect($sql$delete from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | other-org | delete denied');

reset role;
set local request.jwt.claims = '{"sub":"b7000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),1,'consents | admin aal2 | select');
select is(tests.effect($sql$insert into public.consents(purpose,notice_version,subject_email) values ('demand_notify','privacy-2026-11-11','x@example.test')$sql$),-1,'consents | admin aal2 | insert denied');
select is(tests.effect($sql$update public.consents set withdrawn_at=now() where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | admin aal2 | update denied');
select is(tests.effect($sql$delete from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),-1,'consents | admin aal2 | delete denied');
select is(tests.effect($sql$select * from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),1,'enquiries | admin aal2 | select');
select is(tests.effect($sql$insert into public.enquiries(listing_public_id,organisation_id,sender_name,sender_email,message,consent_id) values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-00000000000a','Xx','x@example.test','Synthetic matrix insert','b7300000-0000-4000-8000-000000000001')$sql$),-1,'enquiries | admin aal2 | insert denied');
select is(tests.effect($sql$update public.enquiries set message='Synthetic changed message' where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | admin aal2 | update denied');
select is(tests.effect($sql$delete from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),-1,'enquiries | admin aal2 | delete denied');
select is(tests.effect($sql$select * from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),1,'demand_requests | admin aal2 | select');
select is(tests.effect($sql$insert into public.demand_requests(email,category_slug,province,consent_id,last_activity_at,expires_at) values ('x@example.test','p25m-cat','limpopo','b7300000-0000-4000-8000-000000000001',now(),now()+interval '12 months')$sql$),-1,'demand_requests | admin aal2 | insert denied');
select is(tests.effect($sql$update public.demand_requests set province='limpopo' where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | admin aal2 | update denied');
select is(tests.effect($sql$delete from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),-1,'demand_requests | admin aal2 | delete denied');
select is(tests.effect($sql$select * from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),1,'support_cases | admin aal2 | select');
select is(tests.effect($sql$insert into public.support_cases(email,topic,message) values ('x@example.test','other','Synthetic matrix insert')$sql$),-1,'support_cases | admin aal2 | insert denied');
select is(tests.effect($sql$update public.support_cases set status='closed' where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | admin aal2 | update denied');
select is(tests.effect($sql$delete from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),-1,'support_cases | admin aal2 | delete denied');

reset role;
set local request.jwt.claims = '{"sub":"b7000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.consents where id='b7300000-0000-4000-8000-000000000001'$sql$),0,'consents | admin aal1 | select returns nothing');
select is(tests.effect($sql$select * from public.enquiries where id='b7400000-0000-4000-8000-000000000001'$sql$),0,'enquiries | admin aal1 | select returns nothing');
select is(tests.effect($sql$select * from public.demand_requests where id='b7500000-0000-4000-8000-000000000001'$sql$),0,'demand_requests | admin aal1 | select returns nothing');
select is(tests.effect($sql$select * from public.support_cases where id='b7600000-0000-4000-8000-000000000001'$sql$),0,'support_cases | admin aal1 | select returns nothing');

select * from finish();
rollback;
