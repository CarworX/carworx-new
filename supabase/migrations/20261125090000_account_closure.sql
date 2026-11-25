-- Finish-build PR 4b (D-098, owner 2026-11-24): close my account.
--
-- * Self-service, after re-confirming (password or a two-step check, in the
--   Worker). The account is disabled at once: every membership ends, the
--   Worker signs it out everywhere, and every signed-in page sends it to
--   /account/closing until it is reinstated or deleted.
-- * Data is kept for 14 days and the person is told the exact date. Signing
--   back in within the 14 days asks them to confirm "Reinstate my account";
--   nothing is restored silently. Ended memberships are not restored.
-- * After the 14 days the daily retention run deletes the account: it
--   copies the address into the mail outbox for a final "your account has
--   been deleted" email (encrypted in the Worker), then deletes or
--   de-identifies the personal data. The outbox drops the encrypted address
--   once the email is sent (private.finish_mail).
-- * Business owners must first hand over or close their business, and
--   platform admins are removed by another admin (the audit log keeps who
--   did what), so neither can close their own account here.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table private.account_closures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  delete_after timestamptz not null default now() + interval '14 days',
  claimed_at timestamptz,
  check (delete_after = requested_at + interval '14 days')
);
comment on table private.account_closures is
  'Accounts closing (D-098): disabled at once, reinstatable for 14 days, then deleted by the daily retention run.';
alter table private.account_closures enable row level security;
revoke all on private.account_closures from public, anon, authenticated, service_role,
  listing_projection, listing_eligibility, catalogue_server, forms_server, retention_server;

-- The final email shares the encrypted outbox (D-014, Codex #93/#94).
alter table private.mail_outbox drop constraint mail_outbox_template_check;
alter table private.mail_outbox add constraint mail_outbox_template_check
  check (template in ('invite','security_code','auth_signup','auth_recovery','security_alert','account_deleted'));
create or replace function private.enqueue_mail(p_key text, p_template text, p_recipient_hash text,
  p_encrypted_payload text, p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  if p_key is null or p_key !~ '^[a-z0-9_/-]{1,160}$'
    or p_template is null or p_template not in ('invite','security_code','auth_signup','auth_recovery','security_alert','account_deleted')
    or p_recipient_hash is null or p_recipient_hash !~ '^[a-f0-9]{64}$'
    or p_encrypted_payload is null or length(p_encrypted_payload) not between 50 and 8192
    or p_encrypted_payload !~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'
    or p_expires_at is null or p_expires_at <= now()
    or p_expires_at > now() + (case when p_template in ('security_code','auth_signup','auth_recovery') then interval '10 minutes' when p_template = 'security_alert' then interval '1 day' else interval '7 days' end)
  then raise exception 'invalid_input' using errcode = '22023'; end if;
  if exists (select from private.mail_outbox where recipient_hash = p_recipient_hash and state in ('bounced','complained'))
  then raise exception 'mail_suppressed' using errcode = 'P0001'; end if;
  insert into private.mail_outbox(logical_key,template,recipient_hash,encrypted_payload,expires_at)
    values (p_key,p_template,p_recipient_hash,p_encrypted_payload,p_expires_at)
    on conflict (logical_key) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from private.mail_outbox where logical_key = p_key
      and template = p_template and recipient_hash = p_recipient_hash;
    if v_id is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Close, status, reinstate (the person themself)
-- ---------------------------------------------------------------------------
create function private.close_account() returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_after timestamptz;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Re-confirmed at this boundary, not only in the Worker: the caller's
  -- token must carry a password or authenticator check from the last 10
  -- minutes (the Worker signs in again, or verifies a code, just before).
  -- A stolen older session cannot close the account through the API.
  if not exists (select from jsonb_array_elements(
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
  if exists (select from public.memberships m
             where m.user_id = v_uid and m.status = 'active' and m.role = 'owner'
               and not exists (select from public.memberships o
                               where o.organisation_id = m.organisation_id and o.id <> m.id
                                 and o.role = 'owner' and o.status = 'active')) then
    raise exception 'owner_must_transfer' using errcode = 'P0001';
  end if;
  if exists (select from private.account_closures c where c.user_id = v_uid) then
    raise exception 'already_closing' using errcode = 'P0001';
  end if;
  -- Disabled at once: every membership ends (audited, and owner changes
  -- start a new control generation through the existing triggers).
  update public.memberships set status = 'revoked' where user_id = v_uid and status = 'active';
  insert into private.account_closures(user_id) values (v_uid) returning delete_after into v_after;
  return v_after;
end $$;

-- When this account will be deleted, or null when it is not closing. An
-- overdue closure still counts until the daily run deletes the account:
-- only reinstating is limited to the 14 days.
create function private.account_closure_status() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select c.delete_after from private.account_closures c
  where c.user_id = auth.uid()
$$;

-- Signing back in within the 14 days, and confirming, keeps the account.
create function private.reinstate_account() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from private.account_closures c
    where c.user_id = auth.uid() and c.delete_after > now() and c.claimed_at is null;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Deletion after 14 days (retention_server, daily)
-- ---------------------------------------------------------------------------
-- Due accounts with the address for the final email. A claim older than a
-- day is offered again, so a run that died half-way is retried. The address
-- leaves the database only to be encrypted into the outbox by the Worker.
create function private.claim_account_deletions(p_limit integer)
returns table(user_id uuid, email text, delete_after timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit not between 1 and 200 then perform private.bad_input(); end if;
  return query
    with due as (
      select c.user_id from private.account_closures c
      where c.delete_after <= now()
        and (c.claimed_at is null or c.claimed_at < now() - interval '1 day')
      order by c.delete_after limit p_limit for update skip locked
    ), marked as (
      update private.account_closures c set claimed_at = now()
      from due where c.user_id = due.user_id returning c.user_id
    )
    select m.user_id, u.email::text, c.delete_after from marked m
      join auth.users u on u.id = m.user_id
      join private.account_closures c on c.user_id = m.user_id;
end $$;

-- Delete or de-identify one claimed account. Kept, with the person removed:
-- enquiries the businesses received (name and email replaced; the message
-- stays with the business until the enquiry rule deletes it), the audit log
-- (IDs only, its own 3-year rule) and consent records (their 3-year rule).
-- Everything else tied to the account goes with auth.users (cascades).
create function private.finalize_account_deletion(p_user uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_user is null then perform private.bad_input(); end if;
  perform from private.account_closures c
    where c.user_id = p_user and c.delete_after <= now() and c.claimed_at is not null for update;
  if not found then return false; end if;
  update public.enquiries set sender_name = 'Deleted account',
    sender_email = 'deleted-account@carworx.invalid', sender_user_id = null
    where sender_user_id = p_user;
  -- Their export files go to the R2 deletion queue before the rows cascade.
  insert into private.media_deletions(object_key, reason)
    select d.object_key, 'export_expired' from private.data_exports d where d.user_id = p_user
    on conflict (object_key) do nothing;
  -- Invites they made or used would block the delete (no-action foreign keys).
  delete from public.invites where created_by = p_user or used_by = p_user;
  delete from auth.users where id = p_user;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Grants and public wrappers
-- ---------------------------------------------------------------------------
revoke all on function
  private.close_account(), private.account_closure_status(), private.reinstate_account(),
  private.claim_account_deletions(integer), private.finalize_account_deletion(uuid)
  from public, anon, authenticated, service_role, forms_server, catalogue_server, retention_server;
grant execute on function
  private.close_account(), private.account_closure_status(), private.reinstate_account()
  to authenticated;
grant execute on function
  private.claim_account_deletions(integer), private.finalize_account_deletion(uuid)
  to retention_server;

create function public.close_account() returns timestamptz
language sql volatile security invoker set search_path = '' as $$ select private.close_account() $$;
create function public.account_closure_status() returns timestamptz
language sql stable security invoker set search_path = '' as $$ select private.account_closure_status() $$;
create function public.reinstate_account() returns boolean
language sql volatile security invoker set search_path = '' as $$ select private.reinstate_account() $$;
create function public.claim_account_deletions(p_limit integer) returns table(user_id uuid, email text, delete_after timestamptz)
language sql volatile security invoker set search_path = '' as $$ select * from private.claim_account_deletions(p_limit) $$;
create function public.finalize_account_deletion(p_user uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$ select private.finalize_account_deletion(p_user) $$;

revoke all on function
  public.close_account(), public.account_closure_status(), public.reinstate_account(),
  public.claim_account_deletions(integer), public.finalize_account_deletion(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.close_account(), public.account_closure_status(), public.reinstate_account()
  to authenticated;
grant execute on function public.claim_account_deletions(integer), public.finalize_account_deletion(uuid)
  to retention_server;
