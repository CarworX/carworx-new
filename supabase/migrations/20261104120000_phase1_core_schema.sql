-- CarworX Phase 1 core schema (T2, issue #6).
--
-- Tables: public.profiles, public.organisations, public.memberships,
-- public.audit_log, plus private.platform_admins (server-controlled admin list).
--
-- Security model (PLAN §5, D-042, Claude 10 §1 T2):
--   * RLS is enabled on every table and denies by default. Every policy names
--     the `authenticated` role; `anon` has no table privileges at all.
--   * Organisation access comes only from an ACTIVE row in public.memberships.
--     A revoked or deleted membership grants nothing on the very next query,
--     because policies re-check the table on every statement (no caching).
--   * Platform admin status comes only from private.platform_admins, which no
--     client role can read or write. JWT user_metadata/app_metadata is never
--     consulted. Admin policies also require (auth.jwt() ->> 'aal') = 'aal2'
--     in the policy expression itself.
--   * public.audit_log is append-only for everyone: clients have SELECT at
--     most (admin, aal2), rows are written only by audit triggers, and a
--     trigger rejects UPDATE, DELETE and TRUNCATE for every role.
--   * SECURITY DEFINER helpers live in the `private` schema, which is not in
--     the API's exposed schemas (config.toml [api].schemas), set
--     search_path = '' and are executable by `authenticated` only.
--
-- Kept general for D-051: organisations/memberships carry no business-type
-- columns, and membership roles are a check constraint that later migrations
-- can widen (branches, staff, providers) without new Phase 3 tables here.

-- ---------------------------------------------------------------------------
-- Default privileges: do not let future objects widen client access.
-- Supabase grants ALL on new tables, sequences and functions in `public` to
-- anon and authenticated by default; remove that for objects created by
-- `postgres` (the migration role). New functions are also no longer
-- executable by PUBLIC by default. Each object below grants exactly what it
-- needs.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Private schema: helpers and server-controlled data. Not exposed by the API.
-- ---------------------------------------------------------------------------
create schema private;
revoke all on schema private from public;
-- Policies on public tables call the helpers below, so the querying role
-- needs USAGE on the schema. anon never reaches a policy (no table grants).
grant usage on schema private to authenticated;

create table private.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table private.platform_admins is
  'Server-controlled list of CarworX platform admins. No client role can read or write it; rows are added by the database owner only.';
alter table private.platform_admins enable row level security;
revoke all on table private.platform_admins from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per signed-in person. Readable by the person and by aal2 admins only.';

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);
comment on table public.organisations is
  'A business or other group. General on purpose (D-051): later phases may use it for providers and branches.';

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);
comment on table public.memberships is
  'The only source of organisation access. Only status = active grants anything.';
create index memberships_user_id_idx on public.memberships (user_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- No foreign keys: audit rows must outlive (and never be rewritten by)
  -- deletes of the rows they describe.
  actor_id uuid,
  organisation_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  target_table text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb
);
comment on table public.audit_log is
  'Append-only. Written by audit triggers only; UPDATE, DELETE and TRUNCATE are rejected for every role.';
create index audit_log_organisation_id_idx on public.audit_log (organisation_id);

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, then grant the minimum each policy needs.
-- service_role keeps Supabase's server-side defaults (it bypasses RLS and is
-- never given to browsers); the audit trigger still blocks its rewrites.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles, public.organisations, public.memberships, public.audit_log
  from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant insert (id, display_name) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select, delete on table public.organisations to authenticated;
grant insert (name) on table public.organisations to authenticated;
grant update (name) on table public.organisations to authenticated;

-- organisation_id and user_id cannot be updated, so a membership can never be
-- moved to another organisation or person (including through upsert).
grant select, delete on table public.memberships to authenticated;
grant insert (organisation_id, user_id, role, status) on table public.memberships to authenticated;
grant update (role, status) on table public.memberships to authenticated;

grant select on table public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can read memberships and the admin
-- list without recursive RLS; owner postgres owns the tables).
-- ---------------------------------------------------------------------------
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
    and exists (
      select 1 from private.platform_admins a where a.user_id = auth.uid()
    );
$$;
comment on function private.is_platform_admin() is
  'True only for a user listed in private.platform_admins whose session is aal2. Never reads user or app metadata.';

create function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organisation_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create function private.has_org_role(org_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organisation_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (roles)
  );
$$;

revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.is_org_member(uuid) from public, anon, authenticated;
revoke all on function private.has_org_role(uuid, text[]) from public, anon, authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies. All are `to authenticated`; none uses `true`.
-- Admin policies repeat the aal2 check inline so it is visible in RLS itself.
-- ---------------------------------------------------------------------------

-- profiles
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
-- No delete policy and no DELETE grant: profiles go when the auth user goes.

-- organisations
create policy organisations_select_member on public.organisations
  for select to authenticated
  using ((select private.is_org_member(id)));
create policy organisations_select_admin on public.organisations
  for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy organisations_insert_admin on public.organisations
  for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy organisations_update_manager on public.organisations
  for update to authenticated
  using ((select private.has_org_role(id, array['owner', 'manager'])))
  with check ((select private.has_org_role(id, array['owner', 'manager'])));
create policy organisations_update_admin on public.organisations
  for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy organisations_delete_admin on public.organisations
  for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));

-- memberships
create policy memberships_select_self on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy memberships_select_co_member on public.memberships
  for select to authenticated
  using ((select private.is_org_member(organisation_id)));
create policy memberships_select_admin on public.memberships
  for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy memberships_insert_owner on public.memberships
  for insert to authenticated
  with check ((select private.has_org_role(organisation_id, array['owner'])));
create policy memberships_insert_admin on public.memberships
  for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy memberships_update_owner on public.memberships
  for update to authenticated
  using ((select private.has_org_role(organisation_id, array['owner'])))
  with check ((select private.has_org_role(organisation_id, array['owner'])));
create policy memberships_update_admin on public.memberships
  for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy memberships_delete_owner on public.memberships
  for delete to authenticated
  using ((select private.has_org_role(organisation_id, array['owner'])));
create policy memberships_delete_admin on public.memberships
  for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));

-- audit_log: admin (aal2) read only. No insert/update/delete policy or grant.
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Audit: triggers are the only write path into audit_log.
-- ---------------------------------------------------------------------------
create function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  org uuid;
  detail jsonb;
begin
  if tg_op = 'DELETE' then
    rec := old;
  else
    rec := new;
  end if;

  if tg_table_name = 'memberships' then
    org := rec.organisation_id;
    detail := jsonb_build_object('user_id', rec.user_id, 'role', rec.role, 'status', rec.status);
    if tg_op = 'UPDATE' then
      detail := detail || jsonb_build_object('old_role', old.role, 'old_status', old.status);
    end if;
  elsif tg_table_name = 'organisations' then
    org := rec.id;
    detail := '{}'::jsonb;
  else
    raise exception 'write_audit: unexpected table %', tg_table_name;
  end if;

  insert into public.audit_log (actor_id, organisation_id, action, target_table, target_id, details)
  values (auth.uid(), org, lower(tg_op), tg_table_name, rec.id::text, detail);

  return null;
end;
$$;

create function private.audit_log_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.write_audit() from public, anon, authenticated;
revoke all on function private.audit_log_append_only() from public, anon, authenticated;

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.write_audit();
create trigger organisations_audit
  after insert or update or delete on public.organisations
  for each row execute function private.write_audit();

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function private.audit_log_append_only();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_append_only();
