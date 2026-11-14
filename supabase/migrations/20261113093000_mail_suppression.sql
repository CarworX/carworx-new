-- A bounce/complaint suppresses already queued deliveries, not only new enqueue.
-- Serialize all queue mutations before row locks to keep claim/finish/event
-- races deterministic. Existing RPC signatures and grants remain unchanged.

-- Retire work that has not started (or whose lease has expired). An active
-- dispatch cannot be recalled; finish_mail still records its provider outcome.
create function private.retire_suppressed_mail() returns void
language sql set search_path = '' as $$
  update private.mail_outbox q set state = 'failed', encrypted_payload = null,
    lease_token = null, lease_until = null, updated_at = now()
    where (q.state = 'queued' or (q.state = 'leased' and q.lease_until <= now()))
      and exists (select from private.mail_outbox s
        where s.recipient_hash = q.recipient_hash and s.state in ('bounced','complained'));
$$;
revoke all on function private.retire_suppressed_mail()
  from public, anon, authenticated, service_role, mail_server;

create or replace function private.enqueue_mail(p_key text, p_template text, p_recipient_hash text,
  p_encrypted_payload text, p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  if p_key is null or p_key !~ '^[a-z0-9_/-]{1,160}$'
    or p_template is null or p_template not in ('invite','security_code')
    or p_recipient_hash is null or p_recipient_hash !~ '^[a-f0-9]{64}$'
    or p_encrypted_payload is null or length(p_encrypted_payload) not between 50 and 8192
    or p_encrypted_payload !~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'
    or p_expires_at is null or p_expires_at <= now()
    or p_expires_at > now() + (case when p_template = 'security_code' then interval '10 minutes' else interval '7 days' end)
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
    order by case when q.template = 'security_code' then 0 else 1 end,
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

create or replace function private.finish_mail(p_id uuid, p_lease uuid, p_result text, p_provider_id text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_job private.mail_outbox%rowtype; v_state text;
begin
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  if p_result is null or p_result not in ('sent','retry','failed','reconcile')
    or (p_result = 'sent' and (p_provider_id is null or p_provider_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
  then raise exception 'invalid_input' using errcode = '22023'; end if;
  select * into v_job from private.mail_outbox where id = p_id and state = 'leased'
    and lease_token = p_lease and lease_until > now() for update;
  if not found then return false; end if;
  v_state := case when p_result <> 'retry' then p_result
    when v_job.expires_at <= now() or exists (select from private.mail_outbox s
      where s.recipient_hash = v_job.recipient_hash and s.state in ('bounced','complained')) then 'failed'
    when v_job.attempts >= 12 or v_job.first_attempt_at <= now() - interval '23 hours 50 minutes' then 'reconcile'
    else 'queued' end;
  if v_state = 'sent' then
    select case when event = 'email.complained' then 'complained' else 'bounced' end into v_state
      from private.mail_delivery_events where provider_id = p_provider_id;
    v_state := coalesce(v_state, 'sent');
  end if;
  update private.mail_outbox set state = v_state,
    available_at = now() + make_interval(secs => least(3600, (30 * power(2, least(v_job.attempts - 1, 7)))::integer)),
    encrypted_payload = case when v_state = 'queued' then encrypted_payload else null end,
    lease_token = null, lease_until = null, provider_id = p_provider_id, updated_at = now() where id = p_id;
  perform private.retire_suppressed_mail();
  return true;
end $$;

create or replace function private.mail_delivery(p_provider_id text, p_event text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  if p_event is null or p_event not in ('email.bounced','email.complained')
    or p_provider_id is null or p_provider_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  then raise exception 'invalid_input' using errcode = '22023'; end if;
  insert into private.mail_delivery_events(provider_id,event) values(p_provider_id,p_event)
    on conflict(provider_id) do update set event = case when private.mail_delivery_events.event = 'email.complained'
      then 'email.complained' else excluded.event end;
  update private.mail_outbox set state = case when p_event = 'email.complained' then 'complained' else 'bounced' end,
    updated_at = now() where provider_id = p_provider_id and state in ('sent','bounced')
      and (state <> 'bounced' or p_event = 'email.complained');
  perform private.retire_suppressed_mail();
  return true;
end $$;

create or replace function private.purge_expired_mail() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(172908, 1);
  update private.mail_outbox set encrypted_payload = null,
    state = case when state in ('queued','leased') then 'failed' else state end,
    lease_token = null, lease_until = null, updated_at = now()
    where encrypted_payload is not null and (expires_at <= now() or state in ('sent','failed','reconcile','bounced','complained'));
  get diagnostics v_count = row_count;
  return v_count;
end $$;
