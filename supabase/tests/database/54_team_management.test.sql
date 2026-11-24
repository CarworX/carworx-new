-- Finish-build PR 1 (D-098): team management. Cancel an invite, change a
-- role, leave a team, the member-only name list and the last-owner guard.
-- Runs in one transaction and is rolled back. SYNTHETIC.
--
-- Actors: Olu owner and Ona second owner of the Team org; Max manager; Sia
-- staff; Ivo invitee; Xen owner of another business; Ada admin.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('d5400000-0000-4000-8000-000000000001', 'olu.owner@example.test', now()),
  ('d5400000-0000-4000-8000-000000000002', 'ona.owner@example.test', now()),
  ('d5400000-0000-4000-8000-000000000003', 'max.manager@example.test', now()),
  ('d5400000-0000-4000-8000-000000000004', 'sia.staff@example.test', now()),
  ('d5400000-0000-4000-8000-000000000005', 'ivo.invitee@example.test', now()),
  ('d5400000-0000-4000-8000-000000000006', 'xen.other@example.test', now()),
  ('d5400000-0000-4000-8000-000000000007', 'ada.admin@example.test', now());
insert into private.platform_admins (user_id) values ('d5400000-0000-4000-8000-000000000007');
insert into public.profiles (id, display_name) values
  ('d5400000-0000-4000-8000-000000000001', 'Olu Owner (synthetic)'),
  ('d5400000-0000-4000-8000-000000000003', 'Max Manager (synthetic)'),
  ('d5400000-0000-4000-8000-000000000006', 'Xen Other (synthetic)');
insert into public.organisations (id, name) values
  ('d5410000-0000-4000-8000-000000000001', 'Team fixture (synthetic)'),
  ('d5410000-0000-4000-8000-000000000002', 'Other fixture (synthetic)');
insert into public.memberships (id, organisation_id, user_id, role) values
  ('d5420000-0000-4000-8000-000000000001', 'd5410000-0000-4000-8000-000000000001', 'd5400000-0000-4000-8000-000000000001', 'owner'),
  ('d5420000-0000-4000-8000-000000000003', 'd5410000-0000-4000-8000-000000000001', 'd5400000-0000-4000-8000-000000000003', 'manager'),
  ('d5420000-0000-4000-8000-000000000004', 'd5410000-0000-4000-8000-000000000001', 'd5400000-0000-4000-8000-000000000004', 'staff'),
  ('d5420000-0000-4000-8000-000000000006', 'd5410000-0000-4000-8000-000000000002', 'd5400000-0000-4000-8000-000000000006', 'owner');

select plan(47);

-- ===== Grants ===============================================================
select ok(not has_function_privilege('anon', 'public.team_members(uuid)', 'execute'), 'anon cannot list a team');
select ok(not has_function_privilege('anon', 'public.revoke_invite(uuid)', 'execute'), 'anon cannot cancel an invite');
select ok(not has_function_privilege('anon', 'public.set_member_role(uuid, text)', 'execute'), 'anon cannot change a role');
select ok(not has_function_privilege('anon', 'public.leave_team(uuid)', 'execute'), 'anon cannot leave a team');
select ok(not has_function_privilege('authenticated', 'private.memberships_last_owner_guard()', 'execute'),
  'the guard is not callable');

-- ===== Names: members only ==================================================
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::integer from public.team_members('d5410000-0000-4000-8000-000000000001')), 3, 'staff see every active member');
select is((select display_name from public.team_members('d5410000-0000-4000-8000-000000000001')
  where user_id = 'd5400000-0000-4000-8000-000000000001'), 'Olu Owner (synthetic)', 'the list carries real display names');
select is((select display_name from public.team_members('d5410000-0000-4000-8000-000000000001')
  where user_id = 'd5400000-0000-4000-8000-000000000004'), null, 'a member without a profile has no name');
select is((select count(*)::integer from public.profiles), 0, 'profiles themselves stay private');
select throws_ok($$select * from public.team_members('d5410000-0000-4000-8000-000000000002')$$, '42501', 'not_allowed',
  'another business''s team is hidden');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select * from public.team_members('d5410000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'an outsider cannot read names');
select throws_ok($$select * from public.team_members(null)$$, '42501', 'not_allowed', 'a null business is refused');
reset role;

-- ===== Cancel an invite =====================================================
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.mgr_token', public.create_invite('d5410000-0000-4000-8000-000000000001', 'manager', null), true) is not null,
  'Olu makes a manager invite');
select ok(set_config('tests.staff_token', public.create_invite('d5410000-0000-4000-8000-000000000001', 'staff', null), true) is not null,
  'Olu makes a staff invite');
select ok(set_config('tests.used_token', public.create_invite('d5410000-0000-4000-8000-000000000001', 'staff', null), true) is not null,
  'Olu makes a third invite');
reset role;
create temporary table t54 as select
  (select id from public.invites where token_hash = private.invite_token_hash(current_setting('tests.mgr_token'))) as mgr_invite,
  (select id from public.invites where token_hash = private.invite_token_hash(current_setting('tests.staff_token'))) as staff_invite,
  (select id from public.invites where token_hash = private.invite_token_hash(current_setting('tests.used_token'))) as used_invite;
grant select on t54 to authenticated;

set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(public.accept_invite(current_setting('tests.used_token')) is not null, 'Ivo accepts the third invite');
reset role;

set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.revoke_invite((select staff_invite from t54))$$, '42501', 'not_allowed', 'staff cannot cancel invites');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.revoke_invite((select staff_invite from t54))$$, '42501', 'not_allowed',
  'an owner of another business cannot cancel it');
select throws_ok($$select public.revoke_invite('d5400000-0000-4000-8000-0000000000ff')$$, '42501', 'not_allowed',
  'an unknown invite fails the same way');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.revoke_invite((select mgr_invite from t54))$$, '42501', 'not_allowed',
  'a manager cannot cancel a manager invite');
select lives_ok($$select public.revoke_invite((select staff_invite from t54))$$, 'a manager cancels a staff invite');
select is((select count(*)::integer from public.invites where id = (select staff_invite from t54)), 0, 'the invite is gone');
select throws_ok($$select public.revoke_invite((select used_invite from t54))$$, 'P0001', 'invite_invalid',
  'a used invite cannot be cancelled');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.revoke_invite((select mgr_invite from t54))$$, 'the owner cancels a manager invite');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_invite(current_setting('tests.mgr_token'))$$, 'P0001', 'invite_invalid',
  'a cancelled token stops working at once');
reset role;
select is((select count(*)::integer from public.audit_log where target_table = 'invites' and action = 'delete'
  and organisation_id = 'd5410000-0000-4000-8000-000000000001'), 2, 'both cancellations are in the team history');

-- ===== Change a role ========================================================
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_member_role('d5420000-0000-4000-8000-000000000004', 'manager')$$, '42501', 'not_allowed',
  'a manager cannot change roles');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_member_role('d5420000-0000-4000-8000-000000000004', 'manager')$$, '42501', 'not_allowed',
  'an owner of another business cannot change roles here');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_member_role('d5420000-0000-4000-8000-000000000004', 'owner')$$, '22023', null,
  'nobody is made an owner by a role change');
select throws_ok($$select public.set_member_role('d5420000-0000-4000-8000-000000000001', 'manager')$$, 'P0001', 'last_owner',
  'the last owner cannot be demoted');
select lives_ok($$select public.set_member_role('d5420000-0000-4000-8000-000000000004', 'manager')$$, 'the owner promotes staff to manager');
select is((select role from public.memberships where id = 'd5420000-0000-4000-8000-000000000004'), 'manager', 'the role changed');
select lives_ok($$select public.set_member_role('d5420000-0000-4000-8000-000000000004', 'staff')$$, 'and back to staff');
reset role;
select is((select count(*)::integer from public.audit_log where target_table = 'memberships' and action = 'update'
  and target_id = 'd5420000-0000-4000-8000-000000000004' and details->>'old_role' is not null), 2,
  'each role change is in the team history');

-- ===== Leave a team =========================================================
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.leave_team('d5410000-0000-4000-8000-000000000001')$$, 'staff leave the team');
select throws_ok($$select * from public.team_members('d5410000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'leaving applies at once');
select throws_ok($$select public.leave_team('d5410000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'a former member cannot leave again');
reset role;
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.leave_team('d5410000-0000-4000-8000-000000000001')$$, 'P0001', 'last_owner',
  'the last owner cannot leave');

-- ===== Last-owner guard on direct client writes =============================
select throws_ok($$update public.memberships set status = 'revoked' where id = 'd5420000-0000-4000-8000-000000000001'$$,
  'P0001', 'last_owner', 'the last owner cannot revoke themself directly');
select throws_ok($$update public.memberships set role = 'manager' where id = 'd5420000-0000-4000-8000-000000000001'$$,
  'P0001', 'last_owner', 'nor demote themself directly');
select throws_ok($$delete from public.memberships where id = 'd5420000-0000-4000-8000-000000000001'$$,
  'P0001', 'last_owner', 'nor delete their own membership');
reset role;

-- A second owner arrives (as an admin or a transfer would add one).
insert into public.memberships (id, organisation_id, user_id, role) values
  ('d5420000-0000-4000-8000-000000000002', 'd5410000-0000-4000-8000-000000000001', 'd5400000-0000-4000-8000-000000000002', 'owner');
create temporary table g54 as select control_generation as gen from public.organisations where id = 'd5410000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.set_member_role('d5420000-0000-4000-8000-000000000002', 'manager')$$,
  'an owner can demote another owner while one remains');
reset role;
select ok((select control_generation from public.organisations where id = 'd5410000-0000-4000-8000-000000000001') > (select gen from g54),
  'an owner change starts a new control generation');
update public.memberships set role = 'owner' where id = 'd5420000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.leave_team('d5410000-0000-4000-8000-000000000001')$$, 'an owner leaves while another owner remains');
select is((select count(*)::integer from public.memberships where organisation_id = 'd5410000-0000-4000-8000-000000000001'
  and role = 'owner' and status = 'active'), 0, 'the former owner no longer sees the business''s owners');
reset role;
select is((select count(*)::integer from public.memberships where organisation_id = 'd5410000-0000-4000-8000-000000000001'
  and role = 'owner' and status = 'active'), 1, 'exactly one owner remains');

-- An aal2 admin keeps their audited power to remove the last owner.
set local request.jwt.claims = '{"sub":"d5400000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$update public.memberships set status = 'revoked' where id = 'd5420000-0000-4000-8000-000000000006'$$,
  'an aal2 admin is not blocked by the guard');
reset role;

select * from finish();
rollback;
