-- Finish-build PR 1 (D-098, planning/claude/finish-build-plan.md): team
-- management. Cancel an invite, change a member's role, leave a team, and a
-- member-only list of real display names.
--
-- Rules:
-- * Only owners change roles, and only between manager and staff. Making
--   someone an owner is the ownership transfer (PR 5), which the new owner
--   must accept, so it is not a role change here.
-- * Nobody removes, demotes or revokes the last active owner. The functions
--   below check it, and a trigger enforces it for direct client writes too
--   (the "Remove access" path uses the owner's own RLS update).
-- * Every change lands in the existing team history: memberships_audit and
--   the invites catalogue_audit trigger write public.audit_log, which
--   team_changes projects. memberships_control_generation (the trigger that
--   runs private.bump_control_generation) fires on any owner change, which
--   voids invites made under the old control. Access is re-read from
--   memberships on every request, so a change applies at once.
-- * The team two-step sign-in policy is not here: it stays with Codex's #95.
--
-- Lock order as P2-4: the organisation row first, then the invite or the
-- memberships.

-- ---------------------------------------------------------------------------
-- 1. Last-owner guard for direct client writes
-- ---------------------------------------------------------------------------
-- Runs after memberships_client_write_guard (trigger names fire in
-- alphabetical order), which has already locked the organisation row, so the
-- owner count below cannot race another client write. Platform admins keep
-- their audited powers; the private.* functions run as their owner and make
-- the same check themselves.
-- SECURITY INVOKER, like memberships_client_write_guard: inside a definer
-- current_user is the function owner, so the client check would never match.
-- The caller is an active owner here (the earlier guard and RLS made sure),
-- and memberships_select_co_member lets an owner read every co-member row.
create function private.memberships_last_owner_guard() returns trigger
language plpgsql volatile security invoker set search_path = '' as $$
begin
  -- Two steps on purpose: SQL does not promise to short-circuit OR, and
  -- service_role (server-side writes) cannot execute is_platform_admin().
  if current_user <> 'authenticated' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if private.is_platform_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.status <> 'active' or new.role <> 'owner')
     and not exists (select from public.memberships m
                     where m.organisation_id = old.organisation_id and m.id <> old.id
                       and m.role = 'owner' and m.status = 'active') then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.memberships_last_owner_guard() from public, anon, authenticated, service_role;
create trigger memberships_last_owner_guard before update or delete on public.memberships
  for each row execute function private.memberships_last_owner_guard();

-- ---------------------------------------------------------------------------
-- 2. Team list with real names (members of that business only)
-- ---------------------------------------------------------------------------
-- profiles stays self/admin-only under RLS. This returns just the display
-- name of each active member to another active member of the same business.
create function private.team_members(p_org uuid)
returns table(id uuid, user_id uuid, role text, display_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_org is null or not private.is_org_member(p_org) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, m.role, p.display_name, m.created_at
    from public.memberships m
    left join public.profiles p on p.id = m.user_id
    where m.organisation_id = p_org and m.status = 'active'
    order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at, m.id
    limit 100;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cancel an invite
-- ---------------------------------------------------------------------------
-- The same authority that could make it: owners cancel any invite, managers
-- only staff invites. An unknown invite and one at another business fail
-- alike (not_allowed), so this cannot probe for invite IDs. The row is
-- deleted; the audit row stays and the token stops working at once.
create function private.revoke_invite(p_invite uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_i public.invites;
begin
  if v_uid is null or p_invite is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select i.organisation_id into v_org from public.invites i where i.id = p_invite;
  if not found or not private.has_org_role(v_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.organisations where id = v_org for update;
  select * into v_i from public.invites where id = p_invite for update;
  if not found or not (private.has_org_role(v_org, array['owner'])
                       or (v_i.role = 'staff' and private.has_org_role(v_org, array['manager']))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_i.used_at is not null then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  delete from public.invites where id = v_i.id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Change a member's role (owners only; manager <-> staff, or an owner
--    stepping down while another owner remains)
-- ---------------------------------------------------------------------------
create function private.set_member_role(p_membership uuid, p_role text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_m public.memberships;
begin
  if v_uid is null or p_membership is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('manager','staff') then perform private.bad_input(); end if;
  select m.organisation_id into v_org from public.memberships m where m.id = p_membership;
  if not found or not private.has_org_role(v_org, array['owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.organisations where id = v_org for update;
  select * into v_m from public.memberships where id = p_membership and status = 'active' for update;
  -- Re-read after the lock: the caller may have lost ownership meanwhile.
  if not found or not private.has_org_role(v_org, array['owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_m.role = p_role then return; end if;
  if v_m.role = 'owner' and not exists (select from public.memberships m
      where m.organisation_id = v_org and m.id <> v_m.id and m.role = 'owner' and m.status = 'active') then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  update public.memberships set role = p_role where id = v_m.id;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Leave a team (any active member, except the last owner)
-- ---------------------------------------------------------------------------
create function private.leave_team(p_org uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_m public.memberships;
begin
  if v_uid is null or p_org is null or not private.is_org_member(p_org) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.organisations where id = p_org for update;
  select * into v_m from public.memberships
    where organisation_id = p_org and user_id = v_uid and status = 'active' for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_m.role = 'owner' and not exists (select from public.memberships m
      where m.organisation_id = p_org and m.id <> v_m.id and m.role = 'owner' and m.status = 'active') then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  update public.memberships set status = 'revoked' where id = v_m.id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Grants and public wrappers (SECURITY INVOKER; authenticated only)
-- ---------------------------------------------------------------------------
revoke all on function
  private.team_members(uuid),
  private.revoke_invite(uuid),
  private.set_member_role(uuid, text),
  private.leave_team(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  private.team_members(uuid),
  private.revoke_invite(uuid),
  private.set_member_role(uuid, text),
  private.leave_team(uuid)
  to authenticated;

create function public.team_members(p_org uuid)
returns table(id uuid, user_id uuid, role text, display_name text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.team_members(p_org) $$;
create function public.revoke_invite(p_invite uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.revoke_invite(p_invite) $$;
create function public.set_member_role(p_membership uuid, p_role text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_member_role(p_membership, p_role) $$;
create function public.leave_team(p_org uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.leave_team(p_org) $$;

revoke all on function
  public.team_members(uuid),
  public.revoke_invite(uuid),
  public.set_member_role(uuid, text),
  public.leave_team(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.team_members(uuid),
  public.revoke_invite(uuid),
  public.set_member_role(uuid, text),
  public.leave_team(uuid)
  to authenticated;
