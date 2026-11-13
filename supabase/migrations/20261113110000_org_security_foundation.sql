-- O7/O8 inactive foundation. No policy writes are enabled by this migration.
-- All proof/receipt writes remain private server capabilities; no client DML.
create table private.mfa_stepups (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  primary key (user_id, session_id),
  check (expires_at > issued_at and expires_at <= issued_at + interval '12 hours'),
  check (revoked_at is null or revoked_at >= issued_at)
);
create table private.primary_auth_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  method text not null check (method in ('password','oauth')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  primary key (user_id, session_id),
  check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'),
  check (used_at is null or used_at >= issued_at)
);
alter table private.mfa_stepups enable row level security;
alter table private.primary_auth_receipts enable row level security;
revoke all on private.mfa_stepups, private.primary_auth_receipts
  from public, anon, authenticated, service_role;
create index mfa_stepups_expiry on private.mfa_stepups(expires_at) where revoked_at is null;
create index primary_auth_receipts_expiry on private.primary_auth_receipts(expires_at) where used_at is null;

-- Canonical decision for the caller's current membership and policy. Role
-- authorization is separate: callers must still check private.has_org_role.
create function private.org_mfa_satisfied(p_org uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_role text; v_policy text; v_session text;
begin
  if v_uid is null or p_org is null then return false; end if;
  select m.role, o.team_mfa_policy into v_role, v_policy
    from public.memberships m join public.organisations o on o.id = m.organisation_id
    where m.organisation_id = p_org and m.user_id = v_uid and m.status = 'active';
  if not found then return false; end if;
  if v_role = 'owner' or v_policy = 'optional'
    or (v_policy = 'managers' and v_role = 'staff') then return true; end if;
  if auth.jwt()->>'aal' = 'aal2' then return true; end if;
  -- An administrator never gets access from a custom email proof.
  if exists (select from private.platform_admins where user_id = v_uid) then return false; end if;
  v_session := auth.jwt()->>'session_id';
  if v_session is null or v_session !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
    then return false; end if;
  return exists (
    select from private.mfa_stepups p
      join auth.sessions s on s.id = p.session_id and s.user_id = p.user_id
      join auth.users u on u.id = p.user_id
    where p.user_id = v_uid and p.session_id = v_session::uuid
      and p.issued_at <= now() and p.expires_at > now() and p.revoked_at is null
      and coalesce(u.encrypted_password, '') <> ''
      and (s.not_after is null or s.not_after > now())
      -- Conservative invalidation also catches direct Auth API password/profile
      -- changes and factor enrolment, before Worker revocation is connected.
      and u.updated_at <= p.issued_at
      and not exists (select from auth.mfa_factors f where f.user_id = p.user_id and f.created_at > p.issued_at)
  );
end $$;
revoke all on function private.org_mfa_satisfied(uuid) from public, anon, authenticated, service_role;
grant execute on function private.org_mfa_satisfied(uuid) to authenticated;
create function public.org_mfa_satisfied(p_org uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.org_mfa_satisfied(p_org);
$$;
revoke all on function public.org_mfa_satisfied(uuid) from public, anon, authenticated, service_role;
grant execute on function public.org_mfa_satisfied(uuid) to authenticated;

do $$ begin
  if not exists (select from pg_roles where rolname = 'auth_security_server') then
    create role auth_security_server nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;
revoke all on private.mfa_stepups, private.primary_auth_receipts from auth_security_server;

-- Call ONLY immediately after the Worker itself completes a new password
-- sign-in or recovery-initiated Google code exchange. Parameters must come from
-- that verified result, never a browser's times/metadata or refreshed JWT iat.
-- The restricted server login is the attesting authority; no public RPC exists.
create function private.record_primary_auth_receipt(p_user uuid, p_session uuid, p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_end timestamptz;
begin
  if p_user is null or p_session is null or p_method is null or p_method not in ('password','oauth')
    then raise exception 'invalid_auth_receipt' using errcode = 'P0001'; end if;
  select s.not_after into v_end from auth.sessions s
    where s.id = p_session and s.user_id = p_user
      and (s.not_after is null or s.not_after > now());
  if not found then raise exception 'invalid_auth_receipt' using errcode = 'P0001'; end if;
  if p_method = 'password' and not exists (
    select from auth.users where id = p_user and coalesce(encrypted_password, '') <> ''
  ) then raise exception 'invalid_auth_receipt' using errcode = 'P0001'; end if;
  if p_method = 'oauth' and not exists (
    select from auth.identities where user_id = p_user and provider = 'google'
  ) then raise exception 'invalid_auth_receipt' using errcode = 'P0001'; end if;
  insert into private.primary_auth_receipts(user_id,session_id,method,issued_at,expires_at,used_at)
    values(p_user,p_session,p_method,now(),least(now() + interval '5 minutes',v_end),null)
    on conflict(user_id,session_id) do update set method = excluded.method,
      issued_at = excluded.issued_at, expires_at = excluded.expires_at, used_at = null;
end $$;

-- Revocation never promotes a JWT or changes native factors.
create function private.revoke_mfa_stepups(p_user uuid, p_session uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_user is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  update private.mfa_stepups set revoked_at = now()
    where user_id = p_user and (p_session is null or session_id = p_session) and revoked_at is null;
  get diagnostics v_count = row_count;
  delete from private.primary_auth_receipts
    where user_id = p_user and (p_session is null or session_id = p_session);
  return v_count;
end $$;
revoke all on function private.record_primary_auth_receipt(uuid,uuid,text),
  private.revoke_mfa_stepups(uuid,uuid) from public, anon, authenticated, service_role;
grant usage on schema private to auth_security_server;
grant execute on function private.record_primary_auth_receipt(uuid,uuid,text),
  private.revoke_mfa_stepups(uuid,uuid) to auth_security_server;
alter role auth_security_server login connection limit 3;

-- Intentionally NO step-up minting, recovery redemption, factor reset or policy
-- activation yet. set_team_settings keeps its existing not_yet_available guard.
