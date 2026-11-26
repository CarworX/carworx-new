-- K1: record the issued account terms separately from form consent.
alter table public.consents
  drop constraint consents_purpose_check,
  alter column subject_email drop not null,
  add column user_id uuid references auth.users(id) on delete set null,
  add constraint consents_purpose_check check (
    (purpose in ('enquiry_share_with_provider','demand_notify') and subject_email is not null)
    or (purpose = 'account_terms' and subject_email is null)
  );
create index consents_user_idx on public.consents(user_id) where user_id is not null;
create unique index consents_account_terms_user_version_idx
  on public.consents(user_id, notice_version) where purpose = 'account_terms';

create function private.accept_account_terms(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  perform from auth.users where id = v_user for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- A closing account may sign in to reinstate, without writing consent.
  if exists (select from private.account_closures where user_id = v_user) then return; end if;
  if p_version is distinct from 'account-terms-v1' then
    raise exception 'unknown_terms_version' using errcode = '22023';
  end if;
  insert into public.consents (user_id, purpose, notice_version)
    values (v_user, 'account_terms', p_version)
    on conflict (user_id, notice_version) where purpose = 'account_terms' do nothing;
end $$;

create function private.my_terms_status()
returns table(accepted boolean, version text, accepted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.granted_at is not null, c.notice_version, c.granted_at
  from (values (auth.uid())) as caller(id)
  left join lateral (
    select notice_version, granted_at
    from public.consents
    where user_id = caller.id and purpose = 'account_terms'
    order by granted_at desc, notice_version desc
    limit 1
  ) c on true
$$;

alter table private.account_closures add column reason text
  check (reason = 'declined_terms');

create function private.close_account_with_reason(p_reason text) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_after timestamptz;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform from auth.users where id = v_uid for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_reason = 'declined_terms' then
    if not exists (select from auth.users where id = v_uid and created_at > now() - interval '24 hours')
      or (select accepted from private.my_terms_status())
    then raise exception 'terms_decline_not_allowed' using errcode = '42501'; end if;
  end if;
  -- Re-confirmed at this boundary, not only in the Worker: the caller's
  -- token must carry a password or authenticator check from the last 10
  -- minutes (the Worker signs in again, or verifies a code, just before).
  -- A stolen older session cannot close the account through the API.
  if p_reason is null and not exists (select from jsonb_array_elements(
                   case when jsonb_typeof(auth.jwt()->'amr') = 'array' then auth.jwt()->'amr' else '[]'::jsonb end) a
                 where a->>'method' in ('password','totp')
                   and (a->>'timestamp') ~ '^[0-9]{1,12}$'
                   and (a->>'timestamp')::bigint >= extract(epoch from now())::bigint - 600) then
    raise exception 'reconfirm_required' using errcode = 'P0001';
  end if;
  if exists (select from private.platform_admins a where a.user_id = v_uid) then
    raise exception 'admin_account' using errcode = 'P0001';
  end if;
  -- Lock this person's businesses in a fixed order before reading owners.
  perform from public.organisations o
    where o.id in (select m.organisation_id from public.memberships m where m.user_id = v_uid and m.status = 'active')
    order by o.id for update;
  -- A sole owner must first hand the business over (PR 5 transfer) or
  -- close it: no listing of it may still be in search, under review or
  -- suspended. A business whose listings are all closed or drafts can be
  -- left; its history stays with it.
  if exists (select from public.memberships m
             where m.user_id = v_uid and m.status = 'active' and m.role = 'owner'
               and not exists (select from public.memberships o
                               where o.organisation_id = m.organisation_id and o.id <> m.id
                                 and o.role = 'owner' and o.status = 'active')
               and exists (select from public.listings l
                           where l.organisation_id = m.organisation_id
                             and l.status in ('live','submitted','suspended'))) then
    raise exception 'owner_must_transfer' using errcode = 'P0001';
  end if;
  if exists (select from private.account_closures c where c.user_id = v_uid) then
    raise exception 'already_closing' using errcode = 'P0001';
  end if;
  -- Disabled at once: every membership ends (audited, and owner changes
  -- start a new control generation through the existing triggers).
  update public.memberships set status = 'revoked' where user_id = v_uid and status = 'active';
  insert into private.account_closures(user_id, reason) values (v_uid, p_reason) returning delete_after into v_after;
  return v_after;
end $$;

create or replace function private.close_account() returns timestamptz
language sql volatile security definer set search_path = '' as $$
  select private.close_account_with_reason(null)
$$;

create function private.decline_terms_and_close() returns timestamptz
language sql volatile security definer set search_path = '' as $$
  select private.close_account_with_reason('declined_terms')
$$;

create function private.end_account_terms_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.consents
  set processing_ended_at = now(), retain_until = now() + interval '3 years'
  where user_id = old.id and purpose = 'account_terms' and processing_ended_at is null;
  return old;
end $$;
create trigger end_account_terms_consent before delete on auth.users
  for each row execute function private.end_account_terms_consent();

-- Keep API functions invoker-only, matching the repository's RPC boundary.
create function public.accept_account_terms(p_version text) returns void
language sql volatile security invoker set search_path = '' as $$
  select private.accept_account_terms(p_version)
$$;

create function public.my_terms_status()
returns table(accepted boolean, version text, accepted_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.my_terms_status()
$$;

create function public.decline_terms_and_close() returns timestamptz
language sql volatile security invoker set search_path = '' as $$
  select private.decline_terms_and_close()
$$;

revoke all on function public.accept_account_terms(text), public.my_terms_status(),
  public.decline_terms_and_close(), private.accept_account_terms(text),
  private.my_terms_status(), private.decline_terms_and_close(),
  private.close_account_with_reason(text), private.end_account_terms_consent()
  from public, anon, authenticated, service_role;
grant execute on function public.accept_account_terms(text), public.my_terms_status(),
  public.decline_terms_and_close(), private.accept_account_terms(text),
  private.my_terms_status(), private.decline_terms_and_close() to authenticated;
