begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to authenticated, forms_server;
grant usage on schema extensions to forms_server;
select plan(10);

insert into auth.users(id, email) values
  ('d5900000-0000-4000-8000-000000000001','identity-subject@example.test'),
  ('d5900000-0000-4000-8000-000000000002','identity-admin@example.test');
insert into private.platform_admins(user_id) values ('d5900000-0000-4000-8000-000000000002');

select ok(not has_table_privilege('authenticated','private.identity_checks','select'), 'no direct client reads');
select ok(not has_function_privilege('authenticated','private.identity_start(uuid,text,smallint)','execute'), 'no caller-supplied user ID over client API');

set local role forms_server;
select lives_ok($$select private.identity_start('d5900000-0000-4000-8000-000000000001','d5910000-0000-4000-8000-000000000001',1::smallint)$$, 'start first check');
select private.identity_apply_webhook('d5910000-0000-4000-8000-000000000001','declined','face_mismatch',null);
select private.identity_start('d5900000-0000-4000-8000-000000000001','d5910000-0000-4000-8000-000000000002',2::smallint);
select private.identity_apply_webhook('d5910000-0000-4000-8000-000000000002','abandoned',null,null);
select private.identity_start('d5900000-0000-4000-8000-000000000001','d5910000-0000-4000-8000-000000000003',3::smallint);
select private.identity_apply_webhook('d5910000-0000-4000-8000-000000000003','in_review',null,'1234');
reset role;

set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000001","aal":"aal1"}';
set local role authenticated;
select is((select state from public.my_identity_status()), 'in_review', 'review is the current state');
select is((select tries_left from public.my_identity_status()), 0, 'all three attempts are counted');
reset role;

set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000002","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select * from public.admin_identity_queue()$$, '42501', 'not_allowed', 'an AAL1 admin cannot access queue');
reset role;
set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000002","aal":"aal2"}';
set local role authenticated;
select is((select count(*)::int from public.admin_identity_queue()), 1, 'an AAL2 admin can view pending checks');
select lives_ok($$select public.admin_decide_identity((select id from public.admin_identity_queue()),'declined','Test decision')$$, 'an AAL2 admin can decide');
reset role;

set local role forms_server;
select throws_ok($$select private.identity_start('d5900000-0000-4000-8000-000000000001','d5910000-0000-4000-8000-000000000004',3::smallint)$$, 'P0001', 'identity_attempt_limit', 'a fourth check is forbidden');
select private.identity_apply_webhook('d5910000-0000-4000-8000-000000000003','approved',null,'9999');
reset role;
select is((select status from private.identity_checks where provider_session_id='d5910000-0000-4000-8000-000000000003'), 'declined', 'a late webhook cannot overwrite an admin decision');

select * from finish();
rollback;
