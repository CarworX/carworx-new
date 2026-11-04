-- Security boundaries beyond the A4 matrix (A3 database half, A4):
--   1. admin with aal1 (or no aal claim) is denied; the same admin with aal2 is allowed
--   2. forged user_metadata / app_metadata / role claims grant nothing
--   3. a revoked or deleted membership is denied on the next query, same session
--   4. memberships cannot be moved to another org or person (update or upsert)
--   5. the server-controlled admin list is unreadable and unwritable by clients
--   6. audit_log is append-only for every role, including service_role and postgres
-- JWT claims are simulated with SET LOCAL ROLE plus request.jwt.claims.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
create function tests.affected(stmt text) returns integer
language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function tests.affected(text) to anon, authenticated, service_role;

-- Fixtures (as postgres) ------------------------------------------------------
-- Sam's auth row itself carries forged metadata, as a sign-up form could set.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('a2000000-0000-4000-8000-000000000001', 'olive.owner@example.test', '{}', '{}'),
  ('a2000000-0000-4000-8000-000000000002', 'mia.member@example.test', '{}', '{}'),
  ('a2000000-0000-4000-8000-000000000004', 'ada.admin@example.test', '{}', '{}'),
  ('a2000000-0000-4000-8000-000000000005', 'sam.forger@example.test',
   '{"is_admin":true,"role":"admin","organisation_id":"b2000000-0000-4000-8000-00000000000a","org_role":"owner"}',
   '{"is_admin":true,"role":"admin"}'),
  ('a2000000-0000-4000-8000-000000000007', 'rita.revoked@example.test', '{}', '{}');

insert into public.profiles (id, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'Olive Owner (synthetic)'),
  ('a2000000-0000-4000-8000-000000000002', 'Mia Member (synthetic)');

insert into public.organisations (id, name) values
  ('b2000000-0000-4000-8000-00000000000a', 'Org A Motors (synthetic)'),
  ('b2000000-0000-4000-8000-00000000000b', 'Org B Wash (synthetic)'),
  ('b2000000-0000-4000-8000-00000000000c', 'Org C Spare (synthetic)');

insert into public.memberships (id, organisation_id, user_id, role) values
  ('c2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000001', 'owner'),
  ('c2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000002', 'staff'),
  ('c2000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000007', 'staff');

insert into private.platform_admins (user_id) values ('a2000000-0000-4000-8000-000000000004');

select plan(46);

set local role authenticated;

-- =========================================================================
-- 1. aal: same admin user, aal1 vs aal2
-- =========================================================================
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","amr":[{"method":"password","timestamp":1}]}';

select is((select count(*)::int from public.profiles), 0, 'admin aal1: profiles select -> 0 rows');
select is((select count(*)::int from public.organisations), 0, 'admin aal1: organisations select -> 0 rows');
select is((select count(*)::int from public.memberships), 0, 'admin aal1: memberships select -> 0 rows');
select is((select count(*)::int from public.audit_log), 0, 'admin aal1: audit_log select -> 0 rows');
select throws_ok($$insert into public.organisations (name) values ('aal1 Org (synthetic)')$$, '42501', null, 'admin aal1: organisations insert -> denied (42501)');
select is(tests.affected($$update public.organisations set name = 'x' where id = 'b2000000-0000-4000-8000-00000000000a'$$), 0, 'admin aal1: organisations update -> 0 rows');
select is(tests.affected($$delete from public.organisations where id = 'b2000000-0000-4000-8000-00000000000c'$$), 0, 'admin aal1: organisations delete -> 0 rows');
select is(tests.affected($$update public.profiles set display_name = 'x' where id = 'a2000000-0000-4000-8000-000000000001'$$), 0, 'admin aal1: profiles update -> 0 rows');
select throws_ok($$insert into public.memberships (organisation_id, user_id) values ('b2000000-0000-4000-8000-00000000000b', 'a2000000-0000-4000-8000-000000000004')$$, '42501', null, 'admin aal1: memberships insert -> denied (42501)');
select is(tests.affected($$delete from public.memberships where id = 'c2000000-0000-4000-8000-000000000002'$$), 0, 'admin aal1: memberships delete -> 0 rows');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.organisations), 0, 'admin with no aal claim: organisations select -> 0 rows');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated","aal":"AAL2"}';
select is((select count(*)::int from public.organisations), 0, 'admin with malformed aal "AAL2": organisations select -> 0 rows');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2","amr":[{"method":"totp","timestamp":1}]}';
select is((select count(*)::int from public.organisations where id = 'b2000000-0000-4000-8000-00000000000a'), 1, 'admin aal2: organisations select -> allowed');
select is((select count(*)::int from public.memberships where organisation_id = 'b2000000-0000-4000-8000-00000000000a'), 3, 'admin aal2: memberships select -> allowed');
select is(tests.affected($$update public.profiles set display_name = 'Olive O (synthetic)' where id = 'a2000000-0000-4000-8000-000000000001'$$), 1, 'admin aal2: profiles update -> allowed');
select lives_ok($$insert into public.organisations (name) values ('aal2 Org (synthetic)')$$, 'admin aal2: organisations insert -> allowed');

-- aal2 alone is not admin: Mia with aal2 still only sees her own org.
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is((select count(*)::int from public.organisations where id = 'b2000000-0000-4000-8000-00000000000b'), 0, 'non-admin aal2: other org still 0 rows');

-- =========================================================================
-- 2. forged metadata: Sam claims admin/owner in user_metadata, app_metadata
--    and the JWT role claim. None of it is read; he has no membership.
-- =========================================================================
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2","user_metadata":{"is_admin":true,"role":"admin","organisation_id":"b2000000-0000-4000-8000-00000000000a","org_role":"owner"},"app_metadata":{"is_admin":true,"role":"admin","organisation_id":"b2000000-0000-4000-8000-00000000000a"}}';

select is((select count(*)::int from public.organisations), 0, 'forged metadata: organisations select -> 0 rows');
select is((select count(*)::int from public.memberships), 0, 'forged metadata: memberships select -> 0 rows');
select is((select count(*)::int from public.profiles), 0, 'forged metadata: other profiles select -> 0 rows');
select is((select count(*)::int from public.audit_log), 0, 'forged metadata: audit_log select -> 0 rows');
select throws_ok($$insert into public.organisations (name) values ('Forged Org (synthetic)')$$, '42501', null, 'forged metadata: organisations insert -> denied (42501)');
select throws_ok($$insert into public.memberships (organisation_id, user_id, role) values ('b2000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000005', 'owner')$$, '42501', null, 'forged metadata: self-join org A as owner -> denied (42501)');
select is(tests.affected($$update public.organisations set name = 'forged' where id = 'b2000000-0000-4000-8000-00000000000a'$$), 0, 'forged metadata: organisations update -> 0 rows');
select is((select private.is_platform_admin()), false, 'forged metadata: is_platform_admin() is false');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000005","role":"service_role","aal":"aal2"}';
select is((select count(*)::int from public.organisations), 0, 'forged role claim "service_role" on authenticated: organisations -> 0 rows');

-- =========================================================================
-- 3. revocation takes effect on the next query (same transaction, no cache)
-- =========================================================================
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.organisations where id = 'b2000000-0000-4000-8000-00000000000a'), 1, 'revocation: Rita (active) sees org A');
select is((select count(*)::int from public.memberships where user_id <> 'a2000000-0000-4000-8000-000000000007'), 2, 'revocation: Rita (active) sees co-member rows');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(tests.affected($$update public.memberships set status = 'revoked' where id = 'c2000000-0000-4000-8000-000000000007'$$), 1, 'revocation: owner Olive revokes Rita');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.organisations), 0, 'revocation: Rita (revoked) next query -> org A 0 rows');
select is((select count(*)::int from public.memberships where user_id <> 'a2000000-0000-4000-8000-000000000007'), 0, 'revocation: Rita (revoked) -> co-member rows 0');
select is(tests.affected($$update public.memberships set status = 'active' where id = 'c2000000-0000-4000-8000-000000000007'$$), 0, 'revocation: Rita cannot reactivate herself');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(tests.affected($$delete from public.memberships where id = 'c2000000-0000-4000-8000-000000000002'$$), 1, 'removal: owner Olive deletes Mia''s membership');

set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.organisations), 0, 'removal: Mia (removed) next query -> org A 0 rows');

-- =========================================================================
-- 4. memberships cannot be moved (column privileges), including via upsert
-- =========================================================================
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok($$update public.memberships set organisation_id = 'b2000000-0000-4000-8000-00000000000b' where id = 'c2000000-0000-4000-8000-000000000001'$$, '42501', null, 'owner cannot move a membership to another org (update)');
select throws_ok($$insert into public.memberships (organisation_id, user_id, role) values ('b2000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000001', 'owner') on conflict (organisation_id, user_id) do update set organisation_id = 'b2000000-0000-4000-8000-00000000000b'$$, '42501', null, 'owner cannot move a membership to another org (upsert)');
select throws_ok($$update public.memberships set user_id = 'a2000000-0000-4000-8000-000000000005' where id = 'c2000000-0000-4000-8000-000000000001'$$, '42501', null, 'owner cannot hand a membership to another person');
select throws_ok($$update public.profiles set id = 'a2000000-0000-4000-8000-000000000005' where id = 'a2000000-0000-4000-8000-000000000001'$$, '42501', null, 'profile id cannot be changed');

-- =========================================================================
-- 5. the admin list is server-controlled
-- =========================================================================
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
select throws_ok($$insert into private.platform_admins (user_id) values ('a2000000-0000-4000-8000-000000000005')$$, '42501', null, 'client cannot add itself to platform_admins');
select throws_ok($$select 1 from private.platform_admins$$, '42501', null, 'client cannot read platform_admins');

-- =========================================================================
-- 6. audit_log append-only for every role
-- =========================================================================
reset role;
select ok(exists (
  select 1 from public.audit_log
  where actor_id = 'a2000000-0000-4000-8000-000000000001'
    and target_table = 'memberships' and action = 'update'
    and target_id = 'c2000000-0000-4000-8000-000000000007'
    and details ->> 'status' = 'revoked'
), 'audit: revocation was recorded by the trigger with the actor');

set local role service_role;
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', 'audit_log is append-only', 'audit: service_role update -> rejected by trigger');
select throws_ok($$delete from public.audit_log$$, '42501', 'audit_log is append-only', 'audit: service_role delete -> rejected by trigger');
reset role;

select throws_ok($$update public.audit_log set details = '{}'$$, '42501', 'audit_log is append-only', 'audit: postgres update -> rejected by trigger');
select throws_ok($$delete from public.audit_log$$, '42501', 'audit_log is append-only', 'audit: postgres delete -> rejected by trigger');
select throws_ok($$truncate public.audit_log$$, '42501', 'audit_log is append-only', 'audit: postgres truncate -> rejected by trigger');

select * from finish();
rollback;
