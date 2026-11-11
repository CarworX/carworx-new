-- P2-5 (Claude 22): visitor forms. The submit functions are reachable only as
-- the scoped forms_server login (never anon/authenticated, so PostgREST can't
-- skip Turnstile and the limiter); consent must be explicit; demand repeats
-- refresh one row; admin functions need a listed admin at aal2; retention
-- purge; audit details carry no email, name or message. Rolled back. SYNTHETIC.
--
-- Actors: Olga owner of org X, Ada admin, Max unrelated signed-in person.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated, forms_server;

insert into auth.users (id, email, email_confirmed_at) values
  ('b6000000-0000-4000-8000-000000000001', 'olga.owner@example.test', now()),
  ('b6000000-0000-4000-8000-000000000005', 'ada.admin@example.test', now()),
  ('b6000000-0000-4000-8000-000000000006', 'max.unrelated@example.test', now());
-- Own catalogue fixtures: recovery CI (K4) runs without the seed.
insert into public.categories(slug,name) values ('p25-cat','P2-5 test category (synthetic)');
insert into public.services(slug,category_slug,name) values ('p25-svc','p25-cat','P2-5 test service (synthetic)');
insert into private.platform_admins(user_id) values ('b6000000-0000-4000-8000-000000000005');
insert into public.organisations(id,name) values ('b6100000-0000-4000-8000-00000000000a','Org X Forms (synthetic)');
insert into public.memberships(organisation_id,user_id,role,status) values
  ('b6100000-0000-4000-8000-00000000000a','b6000000-0000-4000-8000-000000000001','owner','active');
insert into public.listings(public_id,organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference) values
  ('b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-00000000000a','p25-svc','Live synthetic listing','Synthetic description','Gauteng','mobile','live','provider_application','synthetic-forms'),
  ('b6200000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-00000000000a','p25-svc','Pending synthetic listing','Synthetic description','Gauteng','mobile','submitted','provider_application','synthetic-forms');

select plan(74);

-- ===== Who may call what ====================================================
select ok(has_function_privilege('forms_server','public.submit_enquiry(uuid,text,text,text,boolean,text)','execute')
  and has_function_privilege('forms_server','public.capture_demand(text,text,text,boolean,text)','execute')
  and has_function_privilege('forms_server','public.open_support_case(text,text,text)','execute'),
  'forms_server can execute the three submit wrappers');
select ok(not has_function_privilege('forms_server','public.admin_close_support_case(uuid,text)','execute')
  and not has_function_privilege('forms_server','public.admin_withdraw_demand(uuid)','execute')
  and not has_function_privilege('forms_server','private.purge_expired_forms()','execute'),
  'forms_server cannot execute admin functions or the purge');
select is_empty($$
  select r.rolname, f.sig from (values ('anon'),('authenticated'),('service_role'),('public')) r(rolname),
    (values ('public.submit_enquiry(uuid,text,text,text,boolean,text)'),('private.submit_enquiry(uuid,text,text,text,boolean,text)'),
            ('public.capture_demand(text,text,text,boolean,text)'),('private.capture_demand(text,text,text,boolean,text)'),
            ('public.open_support_case(text,text,text)'),('private.open_support_case(text,text,text)')) f(sig)
  where r.rolname <> 'public' and has_function_privilege(r.rolname, f.sig, 'execute')$$,
  'anon, authenticated and service_role cannot execute any submit function');
select is_empty($$select p.oid from pg_proc p where p.oid in (
    'public.submit_enquiry(uuid,text,text,text,boolean,text)'::regprocedure, 'public.capture_demand(text,text,text,boolean,text)'::regprocedure,
    'public.open_support_case(text,text,text)'::regprocedure)
  and exists (select from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')$$,
  'PUBLIC has no EXECUTE on the submit wrappers');
select ok(not has_function_privilege('anon','public.admin_close_support_case(uuid,text)','execute')
  and not has_function_privilege('anon','public.admin_withdraw_demand(uuid)','execute')
  and has_function_privilege('authenticated','public.admin_close_support_case(uuid,text)','execute'),
  'admin wrappers: authenticated only (checked inside), never anon');
select is_empty($$select r.rolname from (values ('anon'),('authenticated'),('service_role'),('forms_server')) r(rolname)
  where has_function_privilege(r.rolname, 'private.purge_expired_forms()', 'execute')$$,
  'nobody but the owner can run the purge');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','private','auth') and c.relkind in ('r','v','m','p')
  and (has_table_privilege('forms_server', c.oid, 'select,insert,update,delete')
       or has_any_column_privilege('forms_server', c.oid, 'select'))$$,
  'forms_server has no table, view or column privileges');
select is_empty($$select rolname from pg_roles where rolname = 'forms_server'
  and not (rolcanlogin and rolconnlimit = 5 and not rolsuper and not rolbypassrls and not rolinherit and not rolcreaterole and not rolcreatedb)$$,
  'forms_server is a limited, non-inheriting login');
select is_empty($$select 1 from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = 'forms_server'$$,
  'forms_server is a member of no role');
select is_empty($$select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles g on g.oid = m.member
  where r.rolname = 'forms_server' and g.rolname = 'authenticator'$$,
  'PostgREST (authenticator) cannot switch to forms_server');
select is_empty($$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('submit_enquiry','capture_demand','open_support_case','admin_close_support_case','admin_withdraw_demand')
  and (p.prosecdef or not ('search_path=""' = any(p.proconfig)))$$,
  'public wrappers are SECURITY INVOKER with an empty search_path');
select is_empty($$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname in ('submit_enquiry','capture_demand','open_support_case','admin_close_support_case','admin_withdraw_demand','purge_expired_forms')
  and (not p.prosecdef or not ('search_path=""' = any(p.proconfig)))$$,
  'private functions are SECURITY DEFINER with an empty search_path');
select is_empty($$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('submit_enquiry','capture_demand','open_support_case')
  and p.prorettype <> 'void'::regtype$$,
  'submit wrappers return void: nothing about existing rows leaks');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('consents','enquiries','demand_requests','support_cases') and not c.relrowsecurity$$,
  'RLS is on for all four tables');

-- ===== Submissions, as forms_server ========================================
grant forms_server to postgres with set true, inherit false;
-- Test-only (rolled back): pgTAP lives in extensions.
grant usage on schema extensions to forms_server;
set local role forms_server;
select lives_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','Sam.Sender@Example.test','Synthetic enquiry: do you do weekend washes?',true,'privacy-2026-11-11')$$,
  'enquiry to a live listing is accepted');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','sam@example.test','Synthetic enquiry message',false,'privacy-2026-11-11')$$,
  'P0001','consent_required','unticked consent is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','sam@example.test','Synthetic enquiry message',null,'privacy-2026-11-11')$$,
  'P0001','consent_required','missing consent is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000002','Sam Sender','sam@example.test','Synthetic enquiry message',true,'privacy-2026-11-11')$$,
  'P0001','listing_not_available','a listing that is not live is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-0000000000ff','Sam Sender','sam@example.test','Synthetic enquiry message',true,'privacy-2026-11-11')$$,
  'P0001','listing_not_available','an unknown listing gets the same refusal');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','not-an-email','Synthetic enquiry message',true,'privacy-2026-11-11')$$,
  '22023',null,'a malformed email is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','sam@example..test','Synthetic enquiry message',true,'privacy-2026-11-11')$$,
  '22023',null,'a double dot in the domain is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','sam@example.test','short',true,'privacy-2026-11-11')$$,
  '22023',null,'a too-short message is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','sam@example.test',repeat('x',1001),true,'privacy-2026-11-11')$$,
  '22023',null,'a too-long message is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001',E'Sam\u0007','sam@example.test','Synthetic enquiry message',true,'privacy-2026-11-11')$$,
  '22023',null,'a control character in the name is refused');
select throws_ok($$select public.submit_enquiry('b6200000-0000-4000-8000-000000000001','Sam Sender','sam@example.test','Synthetic enquiry message',true,'Bad Notice!')$$,
  '22023',null,'a malformed notice version is refused');

select lives_ok($$select public.capture_demand('Dana.Demand@example.test','p25-cat','gauteng',true,'privacy-2026-11-11')$$,
  'demand request is accepted');
select lives_ok($$select public.capture_demand('dana.demand@example.test','p25-cat','gauteng',true,'privacy-2026-11-11')$$,
  'a repeat looks the same to the caller');
select throws_ok($$select public.capture_demand('dana@example.test','p25-cat','gauteng',false,'privacy-2026-11-11')$$,
  'P0001','consent_required','demand without consent is refused');
select throws_ok($$select public.capture_demand('dana@example.test','p25-cat','atlantis',true,'privacy-2026-11-11')$$,
  '22023',null,'an unknown province is refused');
select throws_ok($$select public.capture_demand('dana@example.test','no-such-cat','gauteng',true,'privacy-2026-11-11')$$,
  '22023',null,'an unknown category is refused');

select lives_ok($$select public.open_support_case('sue.support@example.test','privacy_request','Synthetic: please withdraw my demand request.')$$,
  'support case is accepted');
select throws_ok($$select public.open_support_case('sue@example.test','billing','Synthetic support message')$$,
  '22023',null,'an unknown topic is refused');
select throws_ok($$insert into public.enquiries(listing_public_id,organisation_id,sender_name,sender_email,message,consent_id)
  values ('b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-00000000000a','X','x@example.test','Synthetic direct insert',gen_random_uuid())$$,
  '42501',null,'forms_server cannot write a table directly');
select throws_ok($$select * from public.support_cases$$, '42501', null, 'forms_server cannot read a table');
reset role;

-- ===== What was stored ======================================================
select is((select count(*)::int from public.enquiries where listing_public_id = 'b6200000-0000-4000-8000-000000000001'), 1, 'one enquiry stored');
select is((select sender_email from public.enquiries where listing_public_id = 'b6200000-0000-4000-8000-000000000001'), 'sam.sender@example.test', 'email is lower-cased');
select is((select organisation_id from public.enquiries where listing_public_id = 'b6200000-0000-4000-8000-000000000001'), 'b6100000-0000-4000-8000-00000000000a'::uuid, 'enquiry records the listing organisation');
select ok((select c.purpose = 'enquiry_share_with_provider' and c.method = 'checkbox_unticked_default' and c.notice_version = 'privacy-2026-11-11' and c.retain_until is null
  from public.enquiries e join public.consents c on c.id = e.consent_id), 'enquiry consent recorded with purpose, method and notice');
select is((select count(*)::int from public.demand_requests where email = 'dana.demand@example.test'), 1, 'a repeat demand keeps one row');
select ok((select expires_at = last_activity_at + interval '12 months' and last_activity_at >= now() from public.demand_requests where email = 'dana.demand@example.test'),
  'demand expires 12 months after last activity');
select is((select count(*)::int from public.consents where purpose = 'demand_notify' and subject_email = 'dana.demand@example.test'), 2, 'each demand submission records its own consent');
select is((select count(*)::int from public.consents c where c.purpose = 'demand_notify' and c.subject_email = 'dana.demand@example.test'
  and c.processing_ended_at is not null and c.retain_until > now() + interval '35 months'
  and not exists (select from public.demand_requests d where d.consent_id = c.id)), 1, 'the superseded consent is ended and kept 3 years');
select is((select status from public.support_cases where email = 'sue.support@example.test'), 'open', 'support case starts open');

-- ===== Admin functions =====================================================
set local request.jwt.claims = '{"sub":"b6000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok(format('select public.admin_close_support_case(%L, %L)', (select id from public.support_cases where email = 'sue.support@example.test'), 'Synthetic close note'),
  '42501', null, 'non-admin cannot close a case');
reset role;
do $$ begin
  perform set_config('t.case', (select id::text from public.support_cases where email = 'sue.support@example.test'), true);
  perform set_config('t.demand', (select id::text from public.demand_requests where email = 'dana.demand@example.test'), true);
end $$;
set local request.jwt.claims = '{"sub":"b6000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.admin_close_support_case(current_setting('t.case')::uuid, 'Synthetic close note')$$,
  '42501', null, 'aal1 admin cannot close a case');
select throws_ok($$select public.admin_withdraw_demand(current_setting('t.demand')::uuid)$$,
  '42501', null, 'aal1 admin cannot withdraw demand');
select is((select count(*)::int from public.demand_requests), 0, 'aal1 admin reads no demand');
reset role;
set local request.jwt.claims = '{"sub":"b6000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is((select count(*)::int from public.demand_requests where email = 'dana.demand@example.test'), 1, 'aal2 admin reads demand');
select throws_ok($$select public.admin_close_support_case(current_setting('t.case')::uuid, 'no')$$,
  '22023', null, 'a too-short close note is refused');
select lives_ok($$select public.admin_close_support_case(current_setting('t.case')::uuid, 'Synthetic: demand withdrawn as asked.')$$,
  'aal2 admin closes a case');
select throws_ok($$select public.admin_close_support_case(current_setting('t.case')::uuid, 'Synthetic close note')$$,
  'P0001', 'case_not_open', 'a closed case cannot be closed again');
select lives_ok($$select public.admin_withdraw_demand(current_setting('t.demand')::uuid)$$, 'aal2 admin withdraws a demand request');
select throws_ok($$select public.admin_withdraw_demand(current_setting('t.demand')::uuid)$$, '22023', null, 'withdrawing twice is bad input');
select throws_ok($$update public.support_cases set status = 'open'$$, '42501', null, 'even an aal2 admin cannot write a table directly');
reset role;
select is((select status from public.support_cases where id = current_setting('t.case')::uuid), 'closed', 'case is closed');
select is((select closed_by from public.support_cases where id = current_setting('t.case')::uuid), 'b6000000-0000-4000-8000-000000000005'::uuid, 'closing admin recorded');
select is((select count(*)::int from public.demand_requests where email = 'dana.demand@example.test'), 0, 'withdrawn demand is deleted at once');
select is((select count(*)::int from public.consents where subject_email = 'dana.demand@example.test' and withdrawn_at is not null and retain_until > now() + interval '35 months'), 1,
  'the withdrawn consent is kept as proof for 3 years');

-- ===== Expiry and purge =====================================================
insert into public.consents(id, purpose, notice_version, subject_email, granted_at) values
  ('b6300000-0000-4000-8000-000000000001','demand_notify','privacy-2025-10-01','old.demand@example.test', now() - interval '13 months'),
  ('b6300000-0000-4000-8000-000000000002','demand_notify','privacy-2026-10-01','fresh.demand@example.test', now() - interval '1 month'),
  ('b6300000-0000-4000-8000-000000000003','enquiry_share_with_provider','privacy-2025-10-01','old.enquiry@example.test', now() - interval '13 months'),
  ('b6300000-0000-4000-8000-000000000004','demand_notify','privacy-2022-10-01','ancient@example.test', now() - interval '4 years');
update public.consents set processing_ended_at = now() - interval '37 months', retain_until = now() - interval '1 month' where id = 'b6300000-0000-4000-8000-000000000004';
insert into public.demand_requests(email, category_slug, province, consent_id, created_at, last_activity_at, expires_at) values
  ('old.demand@example.test','p25-cat','limpopo','b6300000-0000-4000-8000-000000000001', now() - interval '13 months', now() - interval '13 months', now() - interval '1 month'),
  ('fresh.demand@example.test','p25-cat','limpopo','b6300000-0000-4000-8000-000000000002', now() - interval '1 month', now() - interval '1 month', now() + interval '11 months');
insert into public.enquiries(listing_public_id, organisation_id, sender_name, sender_email, message, consent_id, created_at) values
  ('b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-00000000000a','Old Sender','old.enquiry@example.test','Synthetic old enquiry','b6300000-0000-4000-8000-000000000003', now() - interval '13 months');
insert into public.support_cases(email, topic, message, status, closed_at, close_note, created_at) values
  ('old.closed@example.test','other','Synthetic old closed case','closed', now() - interval '37 months','Synthetic note', now() - interval '38 months'),
  ('old.open@example.test','other','Synthetic old open case','open', null, null, now() - interval '38 months');

set local request.jwt.claims = '{"sub":"b6000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is((select array_agg(email order by email) from public.demand_requests where email like '%.demand@example.test'), array['fresh.demand@example.test'],
  'expired demand is hidden from the admin before any purge');
reset role;
select is((select row(demand_deleted, enquiries_deleted, support_deleted, consents_deleted)::text from private.purge_expired_forms()), '(1,1,1,1)',
  'purge removes exactly the expired demand, old enquiry, old closed case and expired consent');
select is((select count(*)::int from public.demand_requests where email = 'fresh.demand@example.test'), 1, 'unexpired demand is kept');
select is((select count(*)::int from public.support_cases where email = 'old.open@example.test'), 1, 'an open case is never purged');
select is((select count(*)::int from public.enquiries where listing_public_id = 'b6200000-0000-4000-8000-000000000001'), 1, 'the recent enquiry is kept');
select ok((select processing_ended_at is not null and retain_until > now() + interval '35 months' from public.consents where id = 'b6300000-0000-4000-8000-000000000001'),
  'a purged demand''s consent is ended and kept 3 years');
select ok((select processing_ended_at is not null and retain_until > now() + interval '35 months' from public.consents where id = 'b6300000-0000-4000-8000-000000000003'),
  'a purged enquiry''s consent is ended and kept 3 years');
select is((select count(*)::int from public.consents where id = 'b6300000-0000-4000-8000-000000000004'), 0, 'a consent past its 3 years is deleted');
select is((select row(demand_deleted, enquiries_deleted, support_deleted, consents_deleted)::text from private.purge_expired_forms()), '(0,0,0,0)',
  'a second purge finds nothing');

-- ===== Audit redaction ======================================================
select ok((select count(*) > 0 from public.audit_log where target_table in ('consents','enquiries','demand_requests','support_cases')),
  'form tables are audited');
select is_empty($$select id from public.audit_log where target_table in ('consents','enquiries','demand_requests','support_cases')
  and (details::text ~ '@' or details::text ~* '(sender|message|note|email|synthetic)')$$,
  'audit details hold no email, name, message or note');

-- A listing cascade must start the same retention clock as expiry purge.
savepoint cascade_consent;
insert into public.listings(public_id,organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
values ('b6200000-0000-4000-8000-000000000003','b6100000-0000-4000-8000-00000000000a','p25-svc','Cascade listing','Synthetic cascade fixture','Gauteng','mobile','live','admin_import','synthetic-cascade');
set local role forms_server;
select public.submit_enquiry('b6200000-0000-4000-8000-000000000003','Synthetic Sender','cascade@example.test','Synthetic cascade enquiry',true,'privacy-2026-11-11');
reset role;
select lives_ok($$delete from public.listings where public_id='b6200000-0000-4000-8000-000000000003'$$, 'listing cascade succeeds');
select is((select count(*) from public.enquiries where sender_email='cascade@example.test'),0::bigint,'cascade removes enquiry');
select ok((select processing_ended_at = now() and retain_until = now() + interval '3 years' from public.consents where subject_email='cascade@example.test'),'cascade starts consent proof retention');
select ok(not has_function_privilege('forms_server','private.end_enquiry_consent()','execute'),'submit login cannot invoke retention trigger directly');
update public.consents set retain_until = now() - interval '1 day' where subject_email='cascade@example.test';
do $$ begin perform private.purge_expired_forms(); end $$;
select is((select count(*) from public.consents where subject_email='cascade@example.test'),0::bigint,'ended cascade consent is eventually purged');
rollback to savepoint cascade_consent;
select * from finish();
rollback;
