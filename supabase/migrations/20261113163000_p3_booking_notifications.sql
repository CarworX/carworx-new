
create table private.notification_cursor(source text not null check(source in('booking','payment')),event_id bigint not null,primary key(source,event_id));
create table private.booking_notifications(
 logical_key text primary key,booking_id uuid not null,recipient_id uuid references auth.users(id) on delete set null,
 expected_state text not null,expires_at timestamptz not null,
 state text not null default 'pending' check(state in('pending','queued','suppressed')),created_at timestamptz not null default now()
);
alter table private.notification_cursor enable row level security;
alter table private.booking_notifications enable row level security;
revoke all on private.notification_cursor,private.booking_notifications from public,anon,authenticated,service_role,money_server,mail_server;
alter table private.mail_outbox drop constraint mail_outbox_template_check;
alter table private.mail_outbox add constraint mail_outbox_template_check check(template in('invite','security_code','booking_update'));
create or replace function private.enqueue_mail(p_key text, p_template text, p_recipient_hash text,
  p_encrypted_payload text, p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_key is null or p_key !~ '^[a-z0-9_/-]{1,160}$'
    or p_template is null or p_template not in ('invite','security_code','booking_update')
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
  if to_regclass('public.bookings') is not null then
  update private.mail_outbox q set state='failed',encrypted_payload=null,lease_token=null,lease_until=null,updated_at=now()
  where q.template='booking_update' and q.state in('queued','leased') and not exists(
   select from private.booking_notifications n join public.bookings b on b.id=n.booking_id
   where n.logical_key=q.logical_key and b.state=n.expected_state and (n.recipient_id=b.customer_id or exists(select from public.memberships m where m.organisation_id=b.organisation_id and m.user_id=n.recipient_id and m.status='active' and m.role in('owner','manager'))) and n.expires_at>now());
  end if;
  select count(*) into v_used from private.mail_outbox q
    where q.first_attempt_at > now() - interval '24 hours';
  select q.* into v_job from private.mail_outbox q
    where ((q.state = 'queued' and q.available_at <= now()) or (q.state = 'leased' and q.lease_until <= now()))
      and q.expires_at > now() and q.encrypted_payload is not null
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
create function private.prepare_booking_notifications() returns void
language plpgsql security definer set search_path='' as $$
declare src text; e record; b record; target record; expiry timestamptz;
begin
 foreach src in array array['booking','payment'] loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('p3/notifications/'||src,0));
  for e in execute case src when 'booking' then
   'select e.id,e.booking_id,e.occurred_at from private.booking_event e where not exists(select from private.notification_cursor c where c.source=$1 and c.event_id=e.id) order by e.id limit 50'
   else 'select e.id,e.booking_id,e.occurred_at from private.payment_event e where not exists(select from private.notification_cursor c where c.source=$1 and c.event_id=e.id) order by e.id limit 50' end using src loop
   select id,customer_id,organisation_id,state into b from public.bookings where id=e.booking_id;
   if found and e.occurred_at>now()-interval '24 hours' then
    expiry:=e.occurred_at+interval '24 hours';
    for target in select b.customer_id as user_id union
     select user_id from public.memberships where organisation_id=b.organisation_id and status='active' and role in('owner','manager') loop
     insert into private.booking_notifications(logical_key,booking_id,recipient_id,expected_state,expires_at)
     values('p3/'||src||'/'||e.id||'/'||target.user_id,b.id,target.user_id,b.state,expiry) on conflict do nothing;
    end loop;
   end if;
   insert into private.notification_cursor(source,event_id) values(src,e.id) on conflict do nothing;
  end loop;
 end loop;
end $$;
create function private.pending_booking_notifications()
returns table(logical_key text,booking_id uuid,email text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 update private.booking_notifications n set state='suppressed' where state='pending' and
 (n.expires_at<=now() or n.recipient_id is null or not exists(select from public.bookings b where b.id=n.booking_id and b.state=n.expected_state and (n.recipient_id=b.customer_id or exists(select from public.memberships m where m.organisation_id=b.organisation_id and m.user_id=n.recipient_id and m.status='active' and m.role in('owner','manager')))));
 return query select n.logical_key,n.booking_id,u.email,n.expires_at
 from private.booking_notifications n join auth.users u on u.id=n.recipient_id
 where n.state='pending' order by n.created_at,n.logical_key limit 10;
end $$;
create function private.finish_booking_notification(p_key text,p_state text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in('queued','suppressed') or p_state is null then raise exception 'invalid_input'; end if;
 update private.booking_notifications set state=p_state where logical_key=p_key and state='pending';
end $$;
create function private.mail_still_current(p_id uuid,p_lease uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return exists(select from private.mail_outbox q where q.id=p_id and q.state='leased' and q.lease_token=p_lease and q.lease_until>now()
 and (q.template<>'booking_update' or exists(select from private.booking_notifications n join public.bookings b on b.id=n.booking_id
 where n.logical_key=q.logical_key and n.expires_at>now() and b.state=n.expected_state and (n.recipient_id=b.customer_id or exists(select from public.memberships m where m.organisation_id=b.organisation_id and m.user_id=n.recipient_id and m.status='active' and m.role in('owner','manager'))))));
end $$;
create function public.mail_operations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare used integer;
begin
 perform private.require_admin();
 select count(*) into used from private.mail_outbox where first_attempt_at>now()-interval '24 hours';
 return jsonb_build_object('used',used,'quota_alert',used>=100,
 'reconcile',(select count(*) from private.mail_outbox where state='reconcile'),
 'suppressed',(select count(*) from private.booking_notifications where state='suppressed'));
end $$;
revoke all on function private.prepare_booking_notifications(),private.pending_booking_notifications(),
 private.finish_booking_notification(text,text),private.mail_still_current(uuid,uuid),public.mail_operations() from public,anon,authenticated,service_role;
grant execute on function private.prepare_booking_notifications(),private.pending_booking_notifications(),private.finish_booking_notification(text,text) to money_server;
grant execute on function private.mail_still_current(uuid,uuid) to mail_server;
grant execute on function public.mail_operations() to authenticated;
