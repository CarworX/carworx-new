-- K2: minimal Didit outcomes. No images, payloads or full document numbers.
create table private.identity_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'didit' check (provider = 'didit'),
  provider_session_id text unique not null check (provider_session_id ~ '^[0-9a-fA-F-]{36}$'),
  status text not null check (status in ('not_started','in_progress','approved','declined','in_review','expired','abandoned')),
  decline_reason text check (decline_reason in ('document_expired','face_mismatch','liveness_failed','document_unreadable','verification_declined')),
  id_last4 char(4) check (id_last4 ~ '^[0-9]{4}$'),
  attempt smallint not null check (attempt between 1 and 3),
  decided_by text check (decided_by in ('didit','admin')),
  admin_id uuid,
  admin_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table private.identity_checks enable row level security;
revoke all on private.identity_checks from public, anon, authenticated, service_role, forms_server;
create index identity_checks_user_created_idx on private.identity_checks(user_id, created_at desc);

create function private.identity_next_attempt(p_user uuid) returns smallint
language plpgsql security definer set search_path = '' as $$
declare v_used integer;
begin
  perform pg_advisory_xact_lock(172911, hashtext(p_user::text));
  if not exists (select from auth.users where id = p_user)
    or exists (select from private.account_closures where user_id = p_user)
    or exists (select from private.identity_checks where user_id = p_user and status in ('approved','in_review'))
    or exists (select from private.identity_checks where user_id = p_user
      and status in ('not_started','in_progress') and created_at > now() - interval '24 hours')
  then raise exception 'identity_not_available' using errcode = 'P0001'; end if;
  select count(*) into v_used from private.identity_checks
    where user_id = p_user and created_at > now() - interval '30 days';
  if v_used >= 3 then raise exception 'identity_attempt_limit' using errcode = 'P0001'; end if;
  return (v_used + 1)::smallint;
end $$;

create function private.identity_start(p_user uuid, p_session text, p_attempt smallint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_attempt is distinct from private.identity_next_attempt(p_user) then
    raise exception 'identity_attempt_changed' using errcode = 'P0001';
  end if;
  insert into private.identity_checks (user_id, provider_session_id, status, attempt)
  values (p_user, p_session, 'not_started', p_attempt);
end $$;

create function private.identity_apply_webhook(p_session text, p_status text, p_reason text, p_last4 text) returns void
language sql security definer set search_path = '' as $$
  update private.identity_checks
  set status = p_status,
    decline_reason = case when p_status = 'declined' then p_reason end,
    id_last4 = coalesce(p_last4, id_last4),
    updated_at = now(),
    decided_at = case when p_status in ('approved','declined') then now() end,
    decided_by = case when p_status in ('approved','declined') then 'didit' end
  where provider_session_id = p_session and status <> p_status and (
    (status = 'not_started' and p_status in ('in_progress','in_review','approved','declined','expired','abandoned'))
    or (status = 'in_progress' and p_status in ('in_review','approved','declined','expired','abandoned'))
    or (status = 'in_review' and p_status in ('approved','declined'))
  )
$$;

create function private.my_identity_status()
returns table(state text, reason text, attempt smallint, tries_left integer, decided_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select case
    when c.status = 'approved' then 'approved'
    when c.status = 'in_review' then 'in_review'
    when c.status in ('not_started','in_progress') and c.created_at > now() - interval '24 hours' then 'checking'
    when u.used >= 3 then 'locked'
    when c.status = 'declined' then 'declined'
    else 'none' end,
    c.decline_reason, coalesce(c.attempt, 0::smallint), greatest(0, 3 - u.used), c.decided_at
  from (select count(*)::integer as used from private.identity_checks
        where user_id = auth.uid() and created_at > now() - interval '30 days') u
  left join lateral (
    select i.* from private.identity_checks i where i.user_id = auth.uid()
    order by (i.status = 'approved') desc, i.created_at desc, i.attempt desc, i.id desc limit 1
  ) c on true
$$;
create function public.my_identity_status()
returns table(state text, reason text, attempt smallint, tries_left integer, decided_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.my_identity_status()
$$;

create function private.require_identity_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (auth.jwt()->>'aal') is distinct from 'aal2' or not private.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end $$;

create function private.admin_identity_queue()
returns table(id uuid, user_id uuid, status text, id_last4 char(4), attempt smallint, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_identity_admin();
  return query select i.id, i.user_id, i.status, i.id_last4, i.attempt, i.created_at
    from private.identity_checks i where i.status = 'in_review' order by i.created_at, i.id;
end $$;
create function public.admin_identity_queue()
returns table(id uuid, user_id uuid, status text, id_last4 char(4), attempt smallint, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.admin_identity_queue()
$$;

create function private.admin_decide_identity(p_id uuid, p_decision text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_identity_admin();
  if p_decision is null or p_decision not in ('approved','declined')
    or p_reason is null or length(btrim(p_reason)) not between 3 and 240
  then raise exception 'invalid_identity_decision' using errcode = '22023'; end if;
  update private.identity_checks
    set status = p_decision, admin_id = auth.uid(), admin_reason = btrim(p_reason),
        decline_reason = case when p_decision = 'declined' then 'verification_declined' end,
        updated_at = now(), decided_at = now(), decided_by = 'admin'
    where id = p_id and status = 'in_review';
  if not found then raise exception 'identity_not_in_review' using errcode = 'P0001'; end if;
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'update', 'identity_checks', p_id::text, jsonb_build_object('status', p_decision));
end $$;
create function public.admin_decide_identity(p_id uuid, p_decision text, p_reason text) returns void
language sql security invoker set search_path = '' as $$
  select private.admin_decide_identity(p_id, p_decision, p_reason)
$$;

revoke all on function private.identity_next_attempt(uuid), private.identity_start(uuid,text,smallint),
  private.identity_apply_webhook(text,text,text,text), private.require_identity_admin(),
  private.my_identity_status(), public.my_identity_status(), private.admin_identity_queue(),
  public.admin_identity_queue(), private.admin_decide_identity(uuid,text,text),
  public.admin_decide_identity(uuid,text,text) from public, anon, authenticated, service_role, forms_server;
grant execute on function private.identity_next_attempt(uuid), private.identity_start(uuid,text,smallint),
  private.identity_apply_webhook(text,text,text,text) to forms_server;
grant execute on function private.my_identity_status(), public.my_identity_status(), private.admin_identity_queue(),
  public.admin_identity_queue(), private.admin_decide_identity(uuid,text,text),
  public.admin_decide_identity(uuid,text,text) to authenticated;
