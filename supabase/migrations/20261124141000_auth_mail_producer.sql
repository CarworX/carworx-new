-- Signed Auth hook producer: enqueue capability only, no delivery/API credentials.
alter table private.mail_outbox drop constraint mail_outbox_template_check;
alter table private.mail_outbox add constraint mail_outbox_template_check
  check (template in ('invite','security_code','auth_signup','auth_recovery'));

create or replace function private.enqueue_mail(p_key text, p_template text, p_recipient_hash text,
  p_encrypted_payload text, p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  if p_key is null or p_key !~ '^[a-z0-9_/-]{1,160}$'
    or p_template is null or p_template not in ('invite','security_code','auth_signup','auth_recovery')
    or p_recipient_hash is null or p_recipient_hash !~ '^[a-f0-9]{64}$'
    or p_encrypted_payload is null or length(p_encrypted_payload) not between 50 and 8192
    or p_encrypted_payload !~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'
    or p_expires_at is null or p_expires_at <= now()
    or p_expires_at > now() + (case when p_template in ('security_code','auth_signup','auth_recovery') then interval '10 minutes' else interval '7 days' end)
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

create or replace function private.claim_mail(p_daily_limit integer default 100)
returns table(id uuid, logical_key text, template text, encrypted_payload text,
  expires_at timestamptz, lease_token uuid, attempts integer)
language plpgsql security definer set search_path = '' as $$
declare v_job private.mail_outbox%rowtype; v_used integer;
begin
  if p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'invalid_input' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  update private.mail_outbox q set state = 'failed', encrypted_payload = null,
    lease_token = null, lease_until = null, updated_at = now()
    where q.state in ('queued','leased') and q.expires_at <= now();
  update private.mail_outbox q set state = 'reconcile', lease_token = null,
    lease_until = null, encrypted_payload = null, updated_at = now()
    where q.state in ('queued','leased') and q.first_attempt_at <= now() - interval '23 hours 50 minutes'
      and (q.state <> 'leased' or q.lease_until <= now());
  perform private.retire_suppressed_mail();
  select count(*) into v_used from private.mail_outbox q
    where q.first_attempt_at > now() - interval '24 hours';
  select q.* into v_job from private.mail_outbox q
    where ((q.state = 'queued' and q.available_at <= now()) or (q.state = 'leased' and q.lease_until <= now()))
      and q.expires_at > now() and q.encrypted_payload is not null
      and not exists (select from private.mail_outbox s
        where s.recipient_hash = q.recipient_hash and s.state in ('bounced','complained'))
      and (q.first_attempt_at is not null or v_used < p_daily_limit)
    order by case when q.template in ('security_code','auth_signup','auth_recovery') then 0 else 1 end,
      q.available_at, q.created_at, q.id for update skip locked limit 1;
  if not found then return; end if;
  if v_job.attempts >= 12 then
    update private.mail_outbox q set state = 'reconcile', encrypted_payload = null,
      lease_token = null, lease_until = null, updated_at = now() where q.id = v_job.id;
    return;
  end if;
  return query update private.mail_outbox q set state = 'leased',
    first_attempt_at = coalesce(q.first_attempt_at, now()), attempts = q.attempts + 1,
    lease_token = gen_random_uuid(), lease_until = now() + interval '2 minutes', updated_at = now()
    where q.id = v_job.id returning q.id,q.logical_key,q.template,q.encrypted_payload,q.expires_at,q.lease_token,q.attempts;
end $$;

do $$ begin
  if not exists (select from pg_roles where rolname = 'mail_producer') then
    create role mail_producer nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;
revoke all on private.mail_outbox, private.mail_delivery_events from mail_producer;
revoke all on function private.claim_mail(integer), private.finish_mail(uuid,uuid,text,text),
  private.mail_delivery(text,text), private.purge_expired_mail(), private.retire_suppressed_mail()
  from mail_producer;
grant usage on schema private to mail_producer;
grant execute on function private.enqueue_mail(text,text,text,text,timestamptz) to mail_producer;
-- Owner provisions a separate expiring credential in Hyperdrive, never in Git.
alter role mail_producer login connection limit 3;
