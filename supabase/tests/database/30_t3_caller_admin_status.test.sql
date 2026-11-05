-- T3: public.caller_is_listed_admin() (migration 20261104200000).
--   1. shape: SECURITY INVOKER in public, definer helper in private, search_path set
--   2. privileges: anon cannot call either; authenticated can call the RPC
--   3. answers only for the caller: listed admin true at aal1 and aal2,
--      others false, forged metadata false, no subject false
--   4. being listed grants nothing at aal1 (RLS still needs aal2)
-- JWT claims are simulated with SET LOCAL ROLE plus request.jwt.claims.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('a3000000-0000-4000-8000-000000000001', 'ari.admin@example.test', '{}', '{}'),
  ('a3000000-0000-4000-8000-000000000002', 'nia.nobody@example.test', '{}', '{}'),
  ('a3000000-0000-4000-8000-000000000003', 'fay.forger@example.test',
   '{"is_admin":true,"role":"admin"}', '{"is_admin":true,"role":"admin"}');
insert into public.organisations (id, name) values
  ('b3000000-0000-4000-8000-00000000000a', 'Org T3 Motors (synthetic)');
insert into private.platform_admins (user_id) values ('a3000000-0000-4000-8000-000000000001');

select plan(14);

-- 1. shape -------------------------------------------------------------------
select has_function('public', 'caller_is_listed_admin', array[]::text[], 'public RPC exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.caller_is_listed_admin()'::regprocedure),
  false, 'public RPC is SECURITY INVOKER');
select is(
  (select prosecdef from pg_proc where oid = 'private.caller_is_listed_admin()'::regprocedure),
  true, 'private helper is SECURITY DEFINER');
select ok(
  exists (select 1 from pg_proc p, unnest(coalesce(p.proconfig, '{}')) c
    where p.oid = 'private.caller_is_listed_admin()'::regprocedure and c like 'search_path=%'),
  'private helper sets search_path');

-- 2. privileges ----------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.caller_is_listed_admin()', 'execute'),
  'anon cannot call the RPC');
select ok(not has_function_privilege('anon', 'private.caller_is_listed_admin()', 'execute'),
  'anon cannot call the private helper');
select ok(has_function_privilege('authenticated', 'public.caller_is_listed_admin()', 'execute'),
  'authenticated can call the RPC');

set local role authenticated;

-- 3. answers only for the caller ----------------------------------------------
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.caller_is_listed_admin(), true, 'listed admin at aal1: true');

-- 4. ...but grants nothing at aal1
select is((select count(*)::int from public.organisations), 0,
  'listed admin at aal1 still sees no organisations');

set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(public.caller_is_listed_admin(), true, 'listed admin at aal2: true');
select is((select count(*)::int from public.organisations where id = 'b3000000-0000-4000-8000-00000000000a'), 1,
  'listed admin at aal2 sees organisations (T2 policy)');

set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is(public.caller_is_listed_admin(), false, 'unlisted user at aal2: false');

set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","user_metadata":{"is_admin":true},"app_metadata":{"role":"admin"}}';
select is(public.caller_is_listed_admin(), false, 'forged metadata claims: false');

set local request.jwt.claims = '{"role":"authenticated","aal":"aal2"}';
select is(public.caller_is_listed_admin(), false, 'no subject: false');

select * from finish();
rollback;
