-- P2-4 A4 extension: listing_decisions, listing_claims, claim_disputes x five
-- actors x four operations (60), plus aal1-admin reads (3). Clients have
-- SELECT only, so every write is denied (42501 -> -1) for every actor,
-- including the aal2 admin: writes go through the private.* functions.
-- Actors: anon; self = Cleo, the claimant; member = Sid, staff of org X;
-- other = Oren, owner of org Y; admin = Ada at aal2. Rolled back. SYNTHETIC.
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
  ('b5000000-0000-4000-8000-000000000001','olga.owner@example.test',now()), ('b5000000-0000-4000-8000-000000000002','sid.staff@example.test',now()),
  ('b5000000-0000-4000-8000-000000000003','oren.other@example.test',now()), ('b5000000-0000-4000-8000-000000000004','cleo.claimant@example.test',now()),
  ('b5000000-0000-4000-8000-000000000005','ada.admin@example.test',now());
insert into private.platform_admins(user_id) values ('b5000000-0000-4000-8000-000000000005');
insert into public.organisations(id,name) values ('b5100000-0000-4000-8000-00000000000a','Org X Motors (synthetic)'), ('b5100000-0000-4000-8000-00000000000b','Org Y Wash (synthetic)');
insert into public.memberships(organisation_id,user_id,role,status) values
  ('b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000001','owner','active'), ('b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000002','staff','active'), ('b5100000-0000-4000-8000-00000000000b','b5000000-0000-4000-8000-000000000003','owner','active');
insert into public.listings(public_id,organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
  values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','mobile-repair','Synthetic matrix listing','Synthetic matrix description','Gauteng','mobile','live','provider_application','synthetic-matrix');
insert into public.listing_decisions(id,listing_public_id,organisation_id,decision,review_method,decided_by)
  values ('b5300000-0000-4000-8000-000000000001','b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','approved','phone_call','b5000000-0000-4000-8000-000000000005');
insert into public.listing_claims(id,listing_public_id,organisation_id,claimant_id,evidence_kind,document_reference,status)
  values ('b5400000-0000-4000-8000-000000000001','b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000004','document','Synthetic matrix reference','disputed');
insert into public.claim_disputes(id,claim_id,organisation_id,raised_by,reason)
  values ('b5500000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000001','Synthetic matrix dispute reason');

select plan(63);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(tests.effect($sql$select * from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | anonymous | select');
select is(tests.effect($sql$insert into public.listing_decisions(listing_public_id,organisation_id,decision,reason,decided_by) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','suspended','Synthetic matrix','b5000000-0000-4000-8000-000000000005')$sql$),-1,'listing_decisions | anonymous | insert denied');
select is(tests.effect($sql$update public.listing_decisions set reason='Synthetic changed' where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | anonymous | update denied');
select is(tests.effect($sql$delete from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | anonymous | delete denied');
select is(tests.effect($sql$select * from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | anonymous | select');
select is(tests.effect($sql$insert into public.listing_claims(listing_public_id,organisation_id,claimant_id,evidence_kind,document_reference) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','document','Synthetic matrix')$sql$),-1,'listing_claims | anonymous | insert denied');
select is(tests.effect($sql$update public.listing_claims set status='approved' where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | anonymous | update denied');
select is(tests.effect($sql$delete from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | anonymous | delete denied');
select is(tests.effect($sql$select * from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | anonymous | select');
select is(tests.effect($sql$insert into public.claim_disputes(claim_id,organisation_id,raised_by,reason) values ('b5400000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','Synthetic matrix dispute')$sql$),-1,'claim_disputes | anonymous | insert denied');
select is(tests.effect($sql$update public.claim_disputes set status='upheld' where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | anonymous | update denied');
select is(tests.effect($sql$delete from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | anonymous | delete denied');
reset role;
set local request.jwt.claims = '{"sub":"b5000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),0,'listing_decisions | self | select');
select is(tests.effect($sql$insert into public.listing_decisions(listing_public_id,organisation_id,decision,reason,decided_by) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','suspended','Synthetic matrix','b5000000-0000-4000-8000-000000000005')$sql$),-1,'listing_decisions | self | insert denied');
select is(tests.effect($sql$update public.listing_decisions set reason='Synthetic changed' where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | self | update denied');
select is(tests.effect($sql$delete from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | self | delete denied');
select is(tests.effect($sql$select * from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),1,'listing_claims | self | select');
select is(tests.effect($sql$insert into public.listing_claims(listing_public_id,organisation_id,claimant_id,evidence_kind,document_reference) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','document','Synthetic matrix')$sql$),-1,'listing_claims | self | insert denied');
select is(tests.effect($sql$update public.listing_claims set status='approved' where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | self | update denied');
select is(tests.effect($sql$delete from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | self | delete denied');
select is(tests.effect($sql$select * from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),1,'claim_disputes | self | select');
select is(tests.effect($sql$insert into public.claim_disputes(claim_id,organisation_id,raised_by,reason) values ('b5400000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','Synthetic matrix dispute')$sql$),-1,'claim_disputes | self | insert denied');
select is(tests.effect($sql$update public.claim_disputes set status='upheld' where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | self | update denied');
select is(tests.effect($sql$delete from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | self | delete denied');
reset role;
set local request.jwt.claims = '{"sub":"b5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),1,'listing_decisions | member | select');
select is(tests.effect($sql$insert into public.listing_decisions(listing_public_id,organisation_id,decision,reason,decided_by) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','suspended','Synthetic matrix','b5000000-0000-4000-8000-000000000005')$sql$),-1,'listing_decisions | member | insert denied');
select is(tests.effect($sql$update public.listing_decisions set reason='Synthetic changed' where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | member | update denied');
select is(tests.effect($sql$delete from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | member | delete denied');
select is(tests.effect($sql$select * from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),0,'listing_claims | member | select');
select is(tests.effect($sql$insert into public.listing_claims(listing_public_id,organisation_id,claimant_id,evidence_kind,document_reference) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','document','Synthetic matrix')$sql$),-1,'listing_claims | member | insert denied');
select is(tests.effect($sql$update public.listing_claims set status='approved' where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | member | update denied');
select is(tests.effect($sql$delete from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | member | delete denied');
select is(tests.effect($sql$select * from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),0,'claim_disputes | member | select');
select is(tests.effect($sql$insert into public.claim_disputes(claim_id,organisation_id,raised_by,reason) values ('b5400000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','Synthetic matrix dispute')$sql$),-1,'claim_disputes | member | insert denied');
select is(tests.effect($sql$update public.claim_disputes set status='upheld' where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | member | update denied');
select is(tests.effect($sql$delete from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | member | delete denied');
reset role;
set local request.jwt.claims = '{"sub":"b5000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),0,'listing_decisions | other | select');
select is(tests.effect($sql$insert into public.listing_decisions(listing_public_id,organisation_id,decision,reason,decided_by) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','suspended','Synthetic matrix','b5000000-0000-4000-8000-000000000005')$sql$),-1,'listing_decisions | other | insert denied');
select is(tests.effect($sql$update public.listing_decisions set reason='Synthetic changed' where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | other | update denied');
select is(tests.effect($sql$delete from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | other | delete denied');
select is(tests.effect($sql$select * from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),0,'listing_claims | other | select');
select is(tests.effect($sql$insert into public.listing_claims(listing_public_id,organisation_id,claimant_id,evidence_kind,document_reference) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','document','Synthetic matrix')$sql$),-1,'listing_claims | other | insert denied');
select is(tests.effect($sql$update public.listing_claims set status='approved' where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | other | update denied');
select is(tests.effect($sql$delete from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | other | delete denied');
select is(tests.effect($sql$select * from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),0,'claim_disputes | other | select');
select is(tests.effect($sql$insert into public.claim_disputes(claim_id,organisation_id,raised_by,reason) values ('b5400000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','Synthetic matrix dispute')$sql$),-1,'claim_disputes | other | insert denied');
select is(tests.effect($sql$update public.claim_disputes set status='upheld' where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | other | update denied');
select is(tests.effect($sql$delete from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | other | delete denied');
reset role;
set local request.jwt.claims = '{"sub":"b5000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),1,'listing_decisions | admin | select');
select is(tests.effect($sql$insert into public.listing_decisions(listing_public_id,organisation_id,decision,reason,decided_by) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','suspended','Synthetic matrix','b5000000-0000-4000-8000-000000000005')$sql$),-1,'listing_decisions | admin | insert denied');
select is(tests.effect($sql$update public.listing_decisions set reason='Synthetic changed' where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | admin | update denied');
select is(tests.effect($sql$delete from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),-1,'listing_decisions | admin | delete denied');
select is(tests.effect($sql$select * from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),1,'listing_claims | admin | select');
select is(tests.effect($sql$insert into public.listing_claims(listing_public_id,organisation_id,claimant_id,evidence_kind,document_reference) values ('b5200000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','document','Synthetic matrix')$sql$),-1,'listing_claims | admin | insert denied');
select is(tests.effect($sql$update public.listing_claims set status='approved' where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | admin | update denied');
select is(tests.effect($sql$delete from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),-1,'listing_claims | admin | delete denied');
select is(tests.effect($sql$select * from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),1,'claim_disputes | admin | select');
select is(tests.effect($sql$insert into public.claim_disputes(claim_id,organisation_id,raised_by,reason) values ('b5400000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-000000000003','Synthetic matrix dispute')$sql$),-1,'claim_disputes | admin | insert denied');
select is(tests.effect($sql$update public.claim_disputes set status='upheld' where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | admin | update denied');
select is(tests.effect($sql$delete from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),-1,'claim_disputes | admin | delete denied');
reset role;
set local request.jwt.claims = '{"sub":"b5000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(tests.effect($sql$select * from public.listing_decisions where id='b5300000-0000-4000-8000-000000000001'$sql$),0,'listing_decisions | listed admin at aal1 | select sees nothing');
select is(tests.effect($sql$select * from public.listing_claims where id='b5400000-0000-4000-8000-000000000001'$sql$),0,'listing_claims | listed admin at aal1 | select sees nothing');
select is(tests.effect($sql$select * from public.claim_disputes where id='b5500000-0000-4000-8000-000000000001'$sql$),0,'claim_disputes | listed admin at aal1 | select sees nothing');

select * from finish();
rollback;
