-- Security-use alerts share the existing encrypted outbox, quota and suppression.
alter table private.mail_outbox drop constraint mail_outbox_template_check;
alter table private.mail_outbox add constraint mail_outbox_template_check
  check (template in ('invite','security_code','auth_signup','auth_recovery','security_alert'));

create or replace function private.enqueue_mail(p_key text, p_template text, p_recipient_hash text,
  p_encrypted_payload text, p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  if p_key is null or p_key !~ '^[a-z0-9_/-]{1,160}$'
    or p_template is null or p_template not in ('invite','security_code','auth_signup','auth_recovery','security_alert')
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

-- O7 email step-up: private, single-use, hashed challenges. No policy activation.
create table private.mfa_email_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  code_hash bytea not null check (octet_length(code_hash) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  used_at timestamptz,
  invalidated_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);
alter table private.mfa_email_challenges enable row level security;
revoke all on private.mfa_email_challenges
  from public, anon, authenticated, service_role, auth_security_server, mail_server, mail_producer;
create index mfa_email_challenges_rate on private.mfa_email_challenges(user_id,created_at);

create function private.audit_email_stepup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.used_at is not null and old.used_at is null then
    insert into public.audit_log(actor_id,action,target_table,target_id,details)
      values(new.user_id,'update','mfa_email_challenges',new.id::text,
        jsonb_build_object('event','email_stepup_used'));
  end if;
  return new;
end $$;
revoke all on function private.audit_email_stepup() from public, anon, authenticated, service_role, auth_security_server;
create trigger email_stepup_audit after update on private.mfa_email_challenges
  for each row execute function private.audit_email_stepup();

-- Stable per-user lock precedes receipt/challenge row locks. Hash collisions
-- only serialize unrelated users; no correctness decision depends on the hash.
create function private.issue_email_stepup(
  p_user uuid, p_session uuid, p_challenge uuid, p_code_hash bytea,
  p_recipient_hash text, p_envelope text, p_expires timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_receipt private.primary_auth_receipts; v_user auth.users; v_existing private.mfa_email_challenges; v_now timestamptz := clock_timestamp();
begin
  if p_user is null or p_session is null or p_challenge is null or p_code_hash is null
    or octet_length(p_code_hash) <> 32 or p_expires is null
    or p_expires <= v_now or p_expires > v_now + interval '10 minutes'
    then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('carworx_auth/' || p_user::text, 0));
  v_now := clock_timestamp();
  if p_expires <= v_now then return false; end if;
  select * into v_user from auth.users where id = p_user;
  if not found or coalesce(v_user.encrypted_password,'') = '' or v_user.email is null or v_user.updated_at is null
    or exists (select from private.platform_admins where user_id = p_user)
    or p_recipient_hash is null
    or p_recipient_hash <> pg_catalog.encode(extensions.digest(convert_to(lower(btrim(v_user.email)), 'UTF8'), 'sha256'), 'hex')
    or not exists (select from auth.sessions where id = p_session and user_id = p_user
      and (not_after is null or not_after > v_now))
    then return false; end if;
  select * into v_existing from private.mfa_email_challenges where id = p_challenge;
  if found then
    return v_existing.user_id = p_user and v_existing.session_id = p_session
      and v_existing.code_hash = p_code_hash and v_existing.expires_at = p_expires
      and v_existing.used_at is null and v_existing.invalidated_at is null
      and v_existing.expires_at > v_now and v_existing.attempts < 5;
  end if;
  select * into v_receipt from private.primary_auth_receipts
    where user_id = p_user and session_id = p_session for update;
  if not found or v_receipt.method <> 'password' or v_receipt.expires_at <= v_now
    or v_receipt.used_at is not null or v_receipt.issued_at > v_now
    or v_user.updated_at > v_receipt.issued_at then return false; end if;
  if exists (select from private.mfa_email_challenges where user_id = p_user
      and created_at > v_now - interval '1 minute')
    or (select count(*) from private.mfa_email_challenges where user_id = p_user
      and created_at > v_now - interval '1 hour') >= 3 then return false; end if;
  update private.mfa_email_challenges set invalidated_at = v_now
    where user_id = p_user and session_id = p_session and used_at is null and invalidated_at is null;
  insert into private.mfa_email_challenges(id,user_id,session_id,code_hash,expires_at)
    values(p_challenge,p_user,p_session,p_code_hash,p_expires);
  update private.primary_auth_receipts set used_at = v_now where user_id = p_user and session_id = p_session;
  perform private.enqueue_mail('mfa/' || p_challenge::text, 'security_code', p_recipient_hash, p_envelope, p_expires);
  return true;
end $$;

create function private.verify_email_stepup(
  p_user uuid, p_session uuid, p_challenge uuid, p_code_hash bytea,
  p_recipient_hash text, p_alert_envelope text, p_alert_expires timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_challenge private.mfa_email_challenges; v_user auth.users; v_end timestamptz; v_now timestamptz := clock_timestamp();
begin
  if p_user is null or p_session is null or p_challenge is null or p_code_hash is null
    or octet_length(p_code_hash) <> 32 then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('carworx_auth/' || p_user::text, 0));
  v_now := clock_timestamp();
  select * into v_challenge from private.mfa_email_challenges
    where id = p_challenge and user_id = p_user and session_id = p_session for update;
  if not found or v_challenge.expires_at <= v_now or v_challenge.created_at > v_now
    or v_challenge.used_at is not null or v_challenge.invalidated_at is not null
    or v_challenge.attempts >= 5 then return false; end if;
  -- Return normally for wrong codes so the attempt increment commits.
  update private.mfa_email_challenges set attempts = attempts + 1 where id = p_challenge;
  if v_challenge.code_hash <> p_code_hash then return false; end if;
  select * into v_user from auth.users where id = p_user;
  if not found or coalesce(v_user.encrypted_password,'') = '' or v_user.email is null or v_user.updated_at is null
    or v_user.updated_at > v_challenge.created_at
    or exists (select from private.platform_admins where user_id = p_user)
    or exists (select from auth.mfa_factors where user_id = p_user and created_at > v_challenge.created_at)
    or p_recipient_hash is null
    or p_recipient_hash <> pg_catalog.encode(extensions.digest(convert_to(lower(btrim(v_user.email)), 'UTF8'), 'sha256'), 'hex')
    then
      update private.mfa_email_challenges set invalidated_at = v_now where id = p_challenge;
      return false;
  end if;
  select not_after into v_end from auth.sessions where id = p_session and user_id = p_user
    and (not_after is null or not_after > v_now);
  if not found then return false; end if;
  if p_alert_expires is null or p_alert_expires <= v_now
    or p_alert_expires > v_now + interval '1 day' then return false; end if;
  -- Enqueue the alert in the same transaction as proof creation and code use.
  -- A mail outage/suppressed recipient cannot produce an unannounced proof.
  perform private.enqueue_mail('mfa-alert/' || p_challenge::text,'security_alert',
    p_recipient_hash,p_alert_envelope,p_alert_expires);
  insert into private.mfa_stepups(user_id,session_id,issued_at,expires_at,revoked_at)
    values(p_user,p_session,v_now,least(v_now + interval '12 hours',v_end),null)
    on conflict(user_id,session_id) do update set issued_at = excluded.issued_at,
      expires_at = excluded.expires_at, revoked_at = null;
  update private.mfa_email_challenges set used_at = v_now where id = p_challenge;
  return true;
end $$;
revoke all on function private.issue_email_stepup(uuid,uuid,uuid,bytea,text,text,timestamptz),
  private.verify_email_stepup(uuid,uuid,uuid,bytea,text,text,timestamptz)
  from public, anon, authenticated, service_role, mail_server, mail_producer;
grant execute on function private.issue_email_stepup(uuid,uuid,uuid,bytea,text,text,timestamptz),
  private.verify_email_stepup(uuid,uuid,uuid,bytea,text,text,timestamptz) to auth_security_server;


create or replace function private.record_primary_auth_receipt(p_user uuid, p_session uuid, p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_end timestamptz;
begin
  if p_user is null or p_session is null or p_method is null or p_method not in ('password','oauth')
    then raise exception 'invalid_auth_receipt' using errcode = 'P0001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('carworx_auth/' || p_user::text, 0));
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

create or replace function private.revoke_mfa_stepups(p_user uuid, p_session uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_user is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('carworx_auth/' || p_user::text, 0));
  update private.mfa_email_challenges set invalidated_at = now()
    where user_id = p_user and (p_session is null or session_id = p_session)
      and used_at is null and invalidated_at is null;
  update private.mfa_stepups set revoked_at = now()
    where user_id = p_user and (p_session is null or session_id = p_session) and revoked_at is null;
  get diagnostics v_count = row_count;
  delete from private.primary_auth_receipts
    where user_id = p_user and (p_session is null or session_id = p_session);
  return v_count;
end $$;
