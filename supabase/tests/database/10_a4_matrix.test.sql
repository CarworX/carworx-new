-- A4 matrix (PLAN §11): 4 tables x {anon, self, member, other org, admin}
-- x {select, insert, update, delete}, each with an explicit expected result.
--
-- Actors (all synthetic, example.test):
--   anon   : role anon, no JWT
--   self   : the signed-in person acting on rows about themselves
--              profiles      -> Sam on Sam's own profile
--              organisations -> Sam (no membership) on org A
--              memberships   -> Mia on her own membership row in org A
--              audit_log     -> Olive on audit rows she caused
--   member : Mia, active staff of org A, acting on other rows of org A
--            (plus owner extras: Olive, active owner of org A)
--   other  : Oscar, owner of org B, acting on org A's rows
--   admin  : Ada, listed in private.platform_admins, aal2 session
--
-- "denied (42501)" = the statement errors with insufficient_privilege (no
-- grant, or a WITH CHECK failure). "0 rows" = RLS filters it silently.
-- JWT claims are simulated the standard way: SET LOCAL ROLE plus
-- request.jwt.claims. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- This project's default privileges stop new functions being executable by
-- PUBLIC, so let the test roles call pgTAP (rolled back with the test).
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
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'olive.owner@example.test'),
  ('a1000000-0000-4000-8000-000000000002', 'mia.member@example.test'),
  ('a1000000-0000-4000-8000-000000000003', 'oscar.other@example.test'),
  ('a1000000-0000-4000-8000-000000000004', 'ada.admin@example.test'),
  ('a1000000-0000-4000-8000-000000000005', 'sam.self@example.test'),
  ('a1000000-0000-4000-8000-000000000006', 'nina.new@example.test');

insert into public.profiles (id, display_name) values
  ('a1000000-0000-4000-8000-000000000001', 'Olive Owner (synthetic)'),
  ('a1000000-0000-4000-8000-000000000002', 'Mia Member (synthetic)'),
  ('a1000000-0000-4000-8000-000000000003', 'Oscar Other (synthetic)'),
  ('a1000000-0000-4000-8000-000000000004', 'Ada Admin (synthetic)');

insert into public.organisations (id, name) values
  ('b1000000-0000-4000-8000-00000000000a', 'Org A Motors (synthetic)'),
  ('b1000000-0000-4000-8000-00000000000b', 'Org B Wash (synthetic)'),
  ('b1000000-0000-4000-8000-00000000000c', 'Org C Spare (synthetic)');

insert into public.memberships (id, organisation_id, user_id, role) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000001', 'owner'),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000002', 'staff'),
  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000003', 'owner');

insert into private.platform_admins (user_id) values ('a1000000-0000-4000-8000-000000000004');

select plan(85);

-- =========================================================================
-- anon: no grants on any table -> every operation denied (42501)
-- =========================================================================
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$select 1 from public.profiles$$, '42501', null, 'profiles  | anon   | select | denied (42501)');
select throws_ok($$insert into public.profiles (id, display_name) values ('a1000000-0000-4000-8000-000000000006', 'x')$$, '42501', null, 'profiles  | anon   | insert | denied (42501)');
select throws_ok($$update public.profiles set display_name = 'x'$$, '42501', null, 'profiles  | anon   | update | denied (42501)');
select throws_ok($$delete from public.profiles$$, '42501', null, 'profiles  | anon   | delete | denied (42501)');

select throws_ok($$select 1 from public.organisations$$, '42501', null, 'orgs      | anon   | select | denied (42501)');
select throws_ok($$insert into public.organisations (name) values ('x')$$, '42501', null, 'orgs      | anon   | insert | denied (42501)');
select throws_ok($$update public.organisations set name = 'x'$$, '42501', null, 'orgs      | anon   | update | denied (42501)');
select throws_ok($$delete from public.organisations$$, '42501', null, 'orgs      | anon   | delete | denied (42501)');

select throws_ok($$select 1 from public.memberships$$, '42501', null, 'members   | anon   | select | denied (42501)');
select throws_ok($$insert into public.memberships (organisation_id, user_id) values ('b1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000006')$$, '42501', null, 'members   | anon   | insert | denied (42501)');
select throws_ok($$update public.memberships set role = 'owner'$$, '42501', null, 'members   | anon   | update | denied (42501)');
select throws_ok($$delete from public.memberships$$, '42501', null, 'members   | anon   | delete | denied (42501)');

select throws_ok($$select 1 from public.audit_log$$, '42501', null, 'audit_log | anon   | select | denied (42501)');
select throws_ok($$insert into public.audit_log (action, target_table, target_id) values ('insert', 'x', 'x')$$, '42501', null, 'audit_log | anon   | insert | denied (42501)');
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', null, 'audit_log | anon   | update | denied (42501)');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'audit_log | anon   | delete | denied (42501)');

reset role;

-- =========================================================================
-- self
-- =========================================================================
-- Sam: signed in, no memberships, no profile yet.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';

select lives_ok($$insert into public.profiles (id, display_name) values ('a1000000-0000-4000-8000-000000000005', 'Sam Self (synthetic)')$$,
  'profiles  | self   | insert | allowed (own row)');
select is((select array_agg(id::text) from public.profiles), array['a1000000-0000-4000-8000-000000000005'],
  'profiles  | self   | select | allowed: sees exactly own row');
select is(tests.affected($$update public.profiles set display_name = 'Sam S (synthetic)' where id = 'a1000000-0000-4000-8000-000000000005'$$), 1,
  'profiles  | self   | update | allowed: 1 row (own)');
select throws_ok($$delete from public.profiles where id = 'a1000000-0000-4000-8000-000000000005'$$, '42501', null,
  'profiles  | self   | delete | denied (42501, no client deletes)');

select is((select count(*)::int from public.organisations where id = 'b1000000-0000-4000-8000-00000000000a'), 0,
  'orgs      | self   | select | denied: 0 rows without membership');
select throws_ok($$insert into public.organisations (name) values ('Sam Org (synthetic)')$$, '42501', null,
  'orgs      | self   | insert | denied (42501)');
select is(tests.affected($$update public.organisations set name = 'hijack' where id = 'b1000000-0000-4000-8000-00000000000a'$$), 0,
  'orgs      | self   | update | denied: 0 rows');
select is(tests.affected($$delete from public.organisations where id = 'b1000000-0000-4000-8000-00000000000a'$$), 0,
  'orgs      | self   | delete | denied: 0 rows');

-- Mia acting on her own membership row.
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::int from public.memberships where id = 'c1000000-0000-4000-8000-000000000002'), 1,
  'members   | self   | select | allowed: own membership visible');
select throws_ok($$insert into public.memberships (organisation_id, user_id, role) values ('b1000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000002', 'owner')$$, '42501', null,
  'members   | self   | insert | denied (42501): cannot add self to another org');
select is(tests.affected($$update public.memberships set role = 'owner' where id = 'c1000000-0000-4000-8000-000000000002'$$), 0,
  'members   | self   | update | denied: 0 rows (staff cannot promote self)');
select is(tests.affected($$delete from public.memberships where id = 'c1000000-0000-4000-8000-000000000002'$$), 0,
  'members   | self   | delete | denied: 0 rows');

reset role;

-- =========================================================================
-- member: Mia (active staff of org A) on other rows of org A
-- =========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::int from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'), 0,
  'profiles  | member | select | denied: 0 rows (co-member profile not readable)');
select throws_ok($$insert into public.profiles (id, display_name) values ('a1000000-0000-4000-8000-000000000006', 'x')$$, '42501', null,
  'profiles  | member | insert | denied (42501): not own id');
select is(tests.affected($$update public.profiles set display_name = 'x' where id = 'a1000000-0000-4000-8000-000000000001'$$), 0,
  'profiles  | member | update | denied: 0 rows');
select throws_ok($$delete from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'$$, '42501', null,
  'profiles  | member | delete | denied (42501)');

select is((select count(*)::int from public.organisations where id = 'b1000000-0000-4000-8000-00000000000a'), 1,
  'orgs      | member | select | allowed: own org visible');
select throws_ok($$insert into public.organisations (name) values ('Mia Org (synthetic)')$$, '42501', null,
  'orgs      | member | insert | denied (42501)');
select is(tests.affected($$update public.organisations set name = 'staff edit' where id = 'b1000000-0000-4000-8000-00000000000a'$$), 0,
  'orgs      | member | update | denied: 0 rows (staff)');
select is(tests.affected($$delete from public.organisations where id = 'b1000000-0000-4000-8000-00000000000a'$$), 0,
  'orgs      | member | delete | denied: 0 rows');

select is((select count(*)::int from public.memberships where id = 'c1000000-0000-4000-8000-000000000001'), 1,
  'members   | member | select | allowed: co-member row visible');
select throws_ok($$insert into public.memberships (organisation_id, user_id) values ('b1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000006')$$, '42501', null,
  'members   | member | insert | denied (42501): staff cannot add members');
select is(tests.affected($$update public.memberships set status = 'revoked' where id = 'c1000000-0000-4000-8000-000000000001'$$), 0,
  'members   | member | update | denied: 0 rows (staff)');
select is(tests.affected($$delete from public.memberships where id = 'c1000000-0000-4000-8000-000000000001'$$), 0,
  'members   | member | delete | denied: 0 rows (staff)');

-- Owner extras: Olive, active owner of org A.
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(tests.affected($$update public.organisations set name = 'Org A Motors (renamed, synthetic)' where id = 'b1000000-0000-4000-8000-00000000000a'$$), 1,
  'orgs      | owner  | update | allowed: 1 row (own org)');
select lives_ok($$insert into public.memberships (organisation_id, user_id, role) values ('b1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000006', 'staff')$$,
  'members   | owner  | insert | allowed (own org)');
select is(tests.affected($$update public.memberships set role = 'manager' where organisation_id = 'b1000000-0000-4000-8000-00000000000a' and user_id = 'a1000000-0000-4000-8000-000000000006'$$), 1,
  'members   | owner  | update | allowed: 1 row (own org)');
select is(tests.affected($$delete from public.memberships where organisation_id = 'b1000000-0000-4000-8000-00000000000a' and user_id = 'a1000000-0000-4000-8000-000000000006'$$), 1,
  'members   | owner  | delete | allowed: 1 row (own org)');

reset role;

-- =========================================================================
-- other org: Oscar (owner of org B) on org A's rows
-- =========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

select is((select count(*)::int from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'), 0,
  'profiles  | other  | select | denied: 0 rows');
select throws_ok($$insert into public.profiles (id, display_name) values ('a1000000-0000-4000-8000-000000000006', 'x')$$, '42501', null,
  'profiles  | other  | insert | denied (42501)');
select is(tests.affected($$update public.profiles set display_name = 'x' where id = 'a1000000-0000-4000-8000-000000000001'$$), 0,
  'profiles  | other  | update | denied: 0 rows');
select throws_ok($$delete from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'$$, '42501', null,
  'profiles  | other  | delete | denied (42501)');

select is((select count(*)::int from public.organisations where id = 'b1000000-0000-4000-8000-00000000000a'), 0,
  'orgs      | other  | select | denied: 0 rows of org A');
select is((select count(*)::int from public.organisations), 1,
  'orgs      | other  | select | (control) sees only own org B');
select throws_ok($$insert into public.organisations (name) values ('Oscar Org 2 (synthetic)')$$, '42501', null,
  'orgs      | other  | insert | denied (42501)');
select is(tests.affected($$update public.organisations set name = 'hijack' where id = 'b1000000-0000-4000-8000-00000000000a'$$), 0,
  'orgs      | other  | update | denied: 0 rows');
select is(tests.affected($$delete from public.organisations where id = 'b1000000-0000-4000-8000-00000000000a'$$), 0,
  'orgs      | other  | delete | denied: 0 rows');

select is((select count(*)::int from public.memberships where organisation_id = 'b1000000-0000-4000-8000-00000000000a'), 0,
  'members   | other  | select | denied: 0 rows of org A');
select throws_ok($$insert into public.memberships (organisation_id, user_id, role) values ('b1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000003', 'owner')$$, '42501', null,
  'members   | other  | insert | denied (42501): cannot join org A');
select is(tests.affected($$update public.memberships set status = 'revoked' where id = 'c1000000-0000-4000-8000-000000000002'$$), 0,
  'members   | other  | update | denied: 0 rows');
select is(tests.affected($$delete from public.memberships where id = 'c1000000-0000-4000-8000-000000000002'$$), 0,
  'members   | other  | delete | denied: 0 rows');

reset role;

-- =========================================================================
-- admin: Ada, platform admin, aal2
-- =========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

select is((select count(*)::int from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'), 1,
  'profiles  | admin  | select | allowed (aal2)');
select throws_ok($$insert into public.profiles (id, display_name) values ('a1000000-0000-4000-8000-000000000006', 'x')$$, '42501', null,
  'profiles  | admin  | insert | denied (42501): profiles are self-created only');
select is(tests.affected($$update public.profiles set display_name = 'Olive O (synthetic)' where id = 'a1000000-0000-4000-8000-000000000001'$$), 1,
  'profiles  | admin  | update | allowed: 1 row (aal2)');
select throws_ok($$delete from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'$$, '42501', null,
  'profiles  | admin  | delete | denied (42501, no client deletes)');

select is((select count(*)::int from public.organisations where id = 'b1000000-0000-4000-8000-00000000000a'), 1,
  'orgs      | admin  | select | allowed (aal2)');
select lives_ok($$insert into public.organisations (name) values ('Org D New (synthetic)')$$,
  'orgs      | admin  | insert | allowed (aal2)');
select is(tests.affected($$update public.organisations set name = 'Org A Motors (admin, synthetic)' where id = 'b1000000-0000-4000-8000-00000000000a'$$), 1,
  'orgs      | admin  | update | allowed: 1 row (aal2)');
select is(tests.affected($$delete from public.organisations where id = 'b1000000-0000-4000-8000-00000000000c'$$), 1,
  'orgs      | admin  | delete | allowed: 1 row (aal2)');

select is((select count(*)::int from public.memberships where organisation_id = 'b1000000-0000-4000-8000-00000000000a'), 2,
  'members   | admin  | select | allowed: all org A rows (aal2)');
select lives_ok($$insert into public.memberships (organisation_id, user_id) values ('b1000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000005')$$,
  'members   | admin  | insert | allowed (aal2)');
select is(tests.affected($$update public.memberships set role = 'manager' where organisation_id = 'b1000000-0000-4000-8000-00000000000b' and user_id = 'a1000000-0000-4000-8000-000000000005'$$), 1,
  'members   | admin  | update | allowed: 1 row (aal2)');
select is(tests.affected($$delete from public.memberships where organisation_id = 'b1000000-0000-4000-8000-00000000000b' and user_id = 'a1000000-0000-4000-8000-000000000005'$$), 1,
  'members   | admin  | delete | allowed: 1 row (aal2)');

reset role;

-- =========================================================================
-- audit_log (runs last, so earlier writes have produced audit rows)
-- =========================================================================
set local role authenticated;

-- self: Olive on rows she caused
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.audit_log), 0,
  'audit_log | self   | select | denied: 0 rows (own actions not readable)');
select throws_ok($$insert into public.audit_log (action, target_table, target_id) values ('insert', 'x', 'x')$$, '42501', null,
  'audit_log | self   | insert | denied (42501)');
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', null,
  'audit_log | self   | update | denied (42501)');
select throws_ok($$delete from public.audit_log$$, '42501', null,
  'audit_log | self   | delete | denied (42501)');

-- member: Mia on org A's rows
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.audit_log where organisation_id = 'b1000000-0000-4000-8000-00000000000a'), 0,
  'audit_log | member | select | denied: 0 rows');
select throws_ok($$insert into public.audit_log (action, target_table, target_id) values ('insert', 'x', 'x')$$, '42501', null,
  'audit_log | member | insert | denied (42501)');
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', null,
  'audit_log | member | update | denied (42501)');
select throws_ok($$delete from public.audit_log$$, '42501', null,
  'audit_log | member | delete | denied (42501)');

-- other org: Oscar on org A's rows
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.audit_log where organisation_id = 'b1000000-0000-4000-8000-00000000000a'), 0,
  'audit_log | other  | select | denied: 0 rows');
select throws_ok($$insert into public.audit_log (action, target_table, target_id) values ('insert', 'x', 'x')$$, '42501', null,
  'audit_log | other  | insert | denied (42501)');
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', null,
  'audit_log | other  | update | denied (42501)');
select throws_ok($$delete from public.audit_log$$, '42501', null,
  'audit_log | other  | delete | denied (42501)');

-- admin: Ada, aal2 -> read only
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select ok((select count(*) from public.audit_log where organisation_id = 'b1000000-0000-4000-8000-00000000000a') > 0,
  'audit_log | admin  | select | allowed: org A rows visible (aal2)');
select throws_ok($$insert into public.audit_log (action, target_table, target_id) values ('insert', 'x', 'x')$$, '42501', null,
  'audit_log | admin  | insert | denied (42501): triggers are the only writer');
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', null,
  'audit_log | admin  | update | denied (42501): append-only');
select throws_ok($$delete from public.audit_log$$, '42501', null,
  'audit_log | admin  | delete | denied (42501): append-only');

reset role;

select * from finish();
rollback;
