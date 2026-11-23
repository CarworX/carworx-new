-- Port group 1: organisations.setup_done and mark_setup_task. Owners and
-- managers mark tasks; staff, outsiders and anon cannot; nobody writes the
-- column directly. Rolled back. SYNTHETIC.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('b9000000-0000-4000-8000-000000000001', 'oli.owner@example.test', now()),
  ('b9000000-0000-4000-8000-000000000002', 'meg.manager@example.test', now()),
  ('b9000000-0000-4000-8000-000000000003', 'sid.staff@example.test', now()),
  ('b9000000-0000-4000-8000-000000000004', 'out.sider@example.test', now());
insert into public.organisations(id, name) values ('b9100000-0000-4000-8000-000000000001', 'Setup fixture (synthetic)');
insert into public.memberships(organisation_id, user_id, role, status) values
  ('b9100000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('b9100000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000002', 'manager', 'active'),
  ('b9100000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000003', 'staff', 'active');

select plan(12);

select is((select setup_done from public.organisations where id = 'b9100000-0000-4000-8000-000000000001'), '{}'::text[], 'a business starts with no setup tasks done');
select ok(not has_function_privilege('anon', 'public.mark_setup_task(uuid,text)', 'execute'), 'anon cannot mark a task');
select ok(not has_column_privilege('authenticated', 'public.organisations', 'setup_done', 'update'), 'nobody updates the column directly');

create function pg_temp.as_user(p_uid text, q text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  execute q;
  reset role;
end $$;

select lives_ok($$select pg_temp.as_user('b9000000-0000-4000-8000-000000000001', $q$select public.mark_setup_task('b9100000-0000-4000-8000-000000000001', 'assign')$q$)$$, 'the owner marks a task');
select lives_ok($$select pg_temp.as_user('b9000000-0000-4000-8000-000000000002', $q$select public.mark_setup_task('b9100000-0000-4000-8000-000000000001', 'team')$q$)$$, 'a manager marks a task');
select lives_ok($$select pg_temp.as_user('b9000000-0000-4000-8000-000000000001', $q$select public.mark_setup_task('b9100000-0000-4000-8000-000000000001', 'assign')$q$)$$, 'marking twice is harmless');
select is((select setup_done from public.organisations where id = 'b9100000-0000-4000-8000-000000000001'), array['assign','team'], 'each task is recorded once, in order');
select throws_ok($$select pg_temp.as_user('b9000000-0000-4000-8000-000000000003', $q$select public.mark_setup_task('b9100000-0000-4000-8000-000000000001', 'contact')$q$)$$, '42501', null, 'staff cannot mark a task');
select throws_ok($$select pg_temp.as_user('b9000000-0000-4000-8000-000000000004', $q$select public.mark_setup_task('b9100000-0000-4000-8000-000000000001', 'contact')$q$)$$, '42501', null, 'an outsider cannot mark a task');
select throws_ok($$select pg_temp.as_user('b9000000-0000-4000-8000-000000000001', $q$select public.mark_setup_task('b9100000-0000-4000-8000-000000000001', 'prices')$q$)$$, '22023', null, 'an unknown task is refused');
select throws_ok($$select pg_temp.as_user('b9000000-0000-4000-8000-000000000001', $q$update public.organisations set setup_done = array['cover'] where id = 'b9100000-0000-4000-8000-000000000001'$q$)$$, '42501', null, 'the owner cannot write the column directly');
select is((select count(*)::int from public.organisations where id = 'b9100000-0000-4000-8000-000000000001' and setup_done = array['assign','team']), 1, 'nothing else changed');

select * from finish();
rollback;
