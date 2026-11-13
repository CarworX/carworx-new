-- O3/O6: retired submission cannot bypass consent; team audit is narrowly scoped.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(13);
select ok(not has_function_privilege('authenticated','public.provider_apply(text,text,text,text,text,text,double precision,double precision,integer)','execute'),'old public submission is retired');
select ok(not has_function_privilege('authenticated','private.provider_apply(text,text,text,text,text,text,double precision,double precision,integer)','execute'),'old private submission cannot bypass consent');
select ok(not has_function_privilege('anon','public.provider_apply(text,text,text,text,text,text,double precision,double precision,integer)','execute'),'anon cannot submit');
select ok(not has_function_privilege('anon','public.team_changes(uuid)','execute'),'anon cannot read team history');
select ok(not has_function_privilege('service_role','public.provider_apply(text,text,text,text,text,text,double precision,double precision,integer)','execute'),'no legacy service-role grant');
insert into auth.users(id,email,email_confirmed_at) values
('d5100000-0000-4000-8000-000000000001','owner-o6@example.test',now()),
('d5100000-0000-4000-8000-000000000002','staff-o6@example.test',now());
insert into public.organisations(id,name) values
('d5100000-0000-4000-8000-000000000010','Synthetic team history'),
('d5100000-0000-4000-8000-000000000020','Synthetic other team');
insert into public.memberships(organisation_id,user_id,role,status) values
('d5100000-0000-4000-8000-000000000010','d5100000-0000-4000-8000-000000000001','owner','active'),
('d5100000-0000-4000-8000-000000000010','d5100000-0000-4000-8000-000000000002','staff','active');
set local request.jwt.claims = '{"sub":"d5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select count(*) > 0 from public.team_changes('d5100000-0000-4000-8000-000000000010')),'owner sees recent team events');
select is((select count(*) from public.team_changes('d5100000-0000-4000-8000-000000000010') c where to_jsonb(c) ?| array['details','actor_id','target_id']),0::bigint,'team projection contains no private audit payload');
select throws_ok($q$select * from public.team_changes('d5100000-0000-4000-8000-000000000020')$q$,'42501','not_allowed','other organisation history denied');
set local request.jwt.claims = '{"sub":"d5100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select throws_ok($q$select * from public.team_changes('d5100000-0000-4000-8000-000000000010')$q$,'42501','not_allowed','staff cannot read team history');
reset role;
update public.memberships set status='revoked' where user_id='d5100000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"d5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($q$select * from public.team_changes('d5100000-0000-4000-8000-000000000010')$q$,'42501','not_allowed','revocation applies immediately');
reset role;
set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select throws_ok($q$select public.provider_apply('Synthetic legacy','none','mobile','Gauteng','Synthetic only',null,-26.1,28.0,10)$q$,'42501',null,'legacy anon submission is refused');
reset role;
set local request.jwt.claims = '{"sub":"d5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($q$select public.provider_apply('Synthetic legacy','none','mobile','Gauteng','Synthetic only',null,-26.1,28.0,10)$q$,'42501',null,'legacy signed-in submission is refused');
reset role;
update public.memberships set status='active',role='manager' where user_id='d5100000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($q$select * from public.team_changes('d5100000-0000-4000-8000-000000000010')$q$,'manager can read own team events');
reset role;
select * from finish();
rollback;
