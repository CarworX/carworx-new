-- Catalog checks: RLS on every table, policy shape, SECURITY DEFINER hygiene,
-- minimal grants for anon/authenticated, and default privileges that do not
-- widen future objects. Runs as postgres in a rolled-back transaction.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

-- RLS -----------------------------------------------------------------------
select is_empty($$
  select n.nspname || '.' || c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity
$$, 'RLS is enabled on every table in public and private');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS on public.profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.organisations'::regclass), 'RLS on public.organisations');
select ok((select relrowsecurity from pg_class where oid = 'public.memberships'::regclass), 'RLS on public.memberships');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass), 'RLS on public.audit_log');
select ok((select relrowsecurity from pg_class where oid = 'private.platform_admins'::regclass), 'RLS on private.platform_admins');

-- Policies --------------------------------------------------------------------
select is_empty($$
  select policyname from pg_policies
  where schemaname in ('public', 'private') and roles <> '{authenticated}'::name[]
$$, 'every policy is scoped to authenticated only (none to public or anon)');

select is_empty($$
  select policyname from pg_policies
  where schemaname in ('public', 'private')
    and (trim(coalesce(qual, '')) = 'true' or trim(coalesce(with_check, '')) = 'true')
$$, 'no policy uses a bare true');

select is_empty($$
  select policyname from pg_policies
  where schemaname in ('public', 'private')
    and policyname like '%admin%'
    and coalesce(qual, '') || coalesce(with_check, '') not like '%aal2%'
$$, 'every admin policy checks aal2 in its own expression');

select is_empty($$
  select policyname from pg_policies
  where schemaname in ('public', 'private')
    and (coalesce(qual, '') || coalesce(with_check, '')) ~* '(user_metadata|app_metadata|raw_user_meta_data|raw_app_meta_data)'
$$, 'no policy reads user or app metadata');

-- SECURITY DEFINER hygiene -----------------------------------------------------
select is_empty($$
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
$$, 'no SECURITY DEFINER function in the API-exposed public schema');

select is_empty($$
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
$$, 'every SECURITY DEFINER function sets search_path');

select is_empty($$
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('public', p.oid, 'execute'))
$$, 'no private function is executable by anon or PUBLIC');

select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon has no usage on schema private');

-- Grants ------------------------------------------------------------------------
select is_empty($$
  select table_schema || '.' || table_name || ':' || privilege_type
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema in ('public', 'private')
$$, 'anon has no table privileges in public or private');

select is_empty($$
  select table_name || ':' || privilege_type
  from information_schema.role_table_grants
  where grantee in ('anon', 'authenticated') and table_schema = 'public'
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
$$, 'no TRUNCATE, REFERENCES or TRIGGER for client roles');

select is_empty($$
  select privilege_type
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public' and table_name = 'audit_log'
    and privilege_type <> 'SELECT'
$$, 'authenticated can only SELECT audit_log');

-- Identity columns are not updatable, so even an owner of two orgs cannot
-- move a membership between them or hand it to someone else.
select ok(not has_column_privilege('authenticated', 'public.memberships', 'organisation_id', 'update'),
  'memberships.organisation_id is not updatable by authenticated');
select ok(not has_column_privilege('authenticated', 'public.memberships', 'user_id', 'update'),
  'memberships.user_id is not updatable by authenticated');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'id', 'update'),
  'profiles.id is not updatable by authenticated');

-- Default privileges: objects created later do not widen client access ----------
create table public.t2_default_privilege_probe (id int);
create function public.t2_default_privilege_probe_fn() returns int language sql as 'select 1';

select ok(
  not has_table_privilege('anon', 'public.t2_default_privilege_probe', 'select,insert,update,delete'),
  'a new public table grants nothing to anon by default');
select ok(
  not has_table_privilege('authenticated', 'public.t2_default_privilege_probe', 'select,insert,update,delete'),
  'a new public table grants nothing to authenticated by default');
select ok(
  not has_function_privilege('anon', 'public.t2_default_privilege_probe_fn()', 'execute'),
  'a new public function is not executable by anon by default');

select * from finish();
rollback;
