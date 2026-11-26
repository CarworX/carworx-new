begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to forms_server;
grant execute on all functions in schema extensions to forms_server;
grant forms_server to postgres with set true, inherit false;
select plan(10);

insert into auth.users(id,email) values
 ('d6000000-0000-4000-8000-000000000001','fines-subject@example.test'),
 ('d6000000-0000-4000-8000-000000000002','fines-admin@example.test');
insert into private.platform_admins(user_id) values ('d6000000-0000-4000-8000-000000000002');

select ok(not has_table_privilege('authenticated','public.fines_payments','update'), 'client cannot settle');
select ok(not has_function_privilege('authenticated','private.apply_fines_callback(uuid,text)','execute'), 'client cannot run callback');

set local role forms_server;
select throws_ok($$select private.start_fines_payment('d6000000-0000-4000-8000-000000000001',array['DEMO-101'],45000)$$,
 '42501','identity_required','checkout requires approved identity');
reset role;
insert into private.identity_checks(user_id,provider_session_id,status,attempt)
 values ('d6000000-0000-4000-8000-000000000001','d6010000-0000-4000-8000-000000000001','approved',1);

set local role forms_server;
select private.start_fines_payment('d6000000-0000-4000-8000-000000000001',array['DEMO-101'],45000) as payment \gset
select is(private.start_fines_payment('d6000000-0000-4000-8000-000000000001',array['DEMO-101','DEMO-101'],45000)::text,
 :'payment', 'repeated checkout reuses the same payment');
select throws_ok($$select private.start_fines_payment('d6000000-0000-4000-8000-000000000001',array['DEMO-102','DEMO-101'],46000)$$,
 'P0001','fines_checkout_exists','overlapping checkout cannot double-pay a notice');
select private.apply_fines_callback(:'payment','pending_issuer');
select private.apply_fines_callback(:'payment','paid');
select private.apply_fines_callback(:'payment','paid');
select private.apply_fines_callback(:'payment','failed');
reset role;
select is((select status from public.fines_payments where id=:'payment'), 'paid', 'duplicate and late callbacks leave settled payment alone');
select ok((select settled_at is not null and receipt_number='DEMO-'||id::text from public.fines_payments where id=:'payment'), 'paid record has one receipt and a settlement time');

set local request.jwt.claims = '{"sub":"d6000000-0000-4000-8000-000000000001","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::int from public.fines_payments where id=:'payment'), 1, 'customer reads own payment');
reset role;
set local request.jwt.claims = '{"sub":"d6000000-0000-4000-8000-000000000002","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::int from public.fines_payments where id=:'payment'), 0, 'AAL1 admin cannot read another customer payment');
reset role;
set local request.jwt.claims = '{"sub":"d6000000-0000-4000-8000-000000000002","aal":"aal2"}';
set local role authenticated;
select is((select count(*)::int from public.fines_payments where id=:'payment'), 1, 'AAL2 admin can read another customer payment');
reset role;
select * from finish();
rollback;
