begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to authenticated;
select plan(13);

insert into auth.users (id, email) values
  ('d9700000-0000-4000-8000-000000000001', 'optional-one@example.test'),
  ('d9700000-0000-4000-8000-000000000002', 'optional-two@example.test');

select ok(not has_table_privilege('mail_server','public.notification_preferences','select'),
  'mail role cannot read the preferences table');
select ok(has_function_privilege('mail_server','private.enqueue_optional_mail(uuid,text,text,text,text,timestamptz)','execute'),
  'mail role can invoke the optional queue gate');
select ok(not has_function_privilege('authenticated','private.enqueue_optional_mail(uuid,text,text,text,text,timestamptz)','execute'),
  'account users cannot use the optional mail queue');
select ok(not has_function_privilege('mail_producer','private.enqueue_optional_mail(uuid,text,text,text,text,timestamptz)','execute'),
  'Auth hook producer cannot use the optional mail queue');

set local role authenticated;
set local request.jwt.claim.sub = 'd9700000-0000-4000-8000-000000000001';
select lives_ok($q$select public.save_notification_preferences(true)$q$, 'caller can save their own preference');
select is((select optional_email from public.notification_preferences), true, 'saved preference is readable');
select throws_ok(
  $q$insert into public.notification_preferences(user_id, optional_email)
      values ('d9700000-0000-4000-8000-000000000002',true)$q$,
  '42501', null, 'cross-account inserts are rejected'
);
set local request.jwt.claim.sub = 'd9700000-0000-4000-8000-000000000002';
select is_empty($q$select * from public.notification_preferences$q$, 'cross-account reads yield no rows');
update public.notification_preferences set optional_email = false;
reset role;
select is(
  (select optional_email from public.notification_preferences where user_id = 'd9700000-0000-4000-8000-000000000001'),
  true, 'cross-account updates affect no rows'
);
select ok(private.enqueue_optional_mail(
    'd9700000-0000-4000-8000-000000000001', 'invite/optional-on', 'invite',
    repeat('d',64), 'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60), now()+interval '1 day'
  ), 'mail is queued for an opted-in account');
select ok(not private.enqueue_optional_mail(
    'd9700000-0000-4000-8000-000000000002', 'invite/optional-missing', 'invite',
    repeat('e',64), 'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60), now()+interval '1 day'
  ), 'missing preferences suppress optional mail');

set local role authenticated;
set local request.jwt.claim.sub = 'd9700000-0000-4000-8000-000000000001';
do $$begin perform public.save_notification_preferences(false); end$$;
reset role;
select ok(not private.enqueue_optional_mail(
    'd9700000-0000-4000-8000-000000000001', 'invite/optional-off', 'invite',
    repeat('d',64), 'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60), now()+interval '1 day'
  ), 'opt-out suppresses subsequent optional mail');

reset role;
select is(
  (select count(*) from private.mail_outbox where logical_key in
    ('invite/optional-on','invite/optional-missing','invite/optional-off')),
  1::bigint, 'only the opted-in message entered the outbox'
);
select * from finish();
rollback;
