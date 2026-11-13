
-- X3-X5: bounded recovery, separate refund/dispute effects and operator cases.
alter table private.payment_attempts add column checked_at timestamptz not null default '-infinity';
alter table private.payment_refunds add column checked_at timestamptz not null default '-infinity';
create function private.payment_recovery_batch() returns setof private.payment_attempts
language plpgsql security definer set search_path='' as $$
begin
 update private.payment_attempts set state='reconcile',lease_until=null
 where state='initialising' and lease_until<clock_timestamp();
 return query with batch as (
  select id from private.payment_attempts where state in('ready','reconcile','paid')
  and checked_at<clock_timestamp()-interval '15 minutes'
  order by checked_at,id for update skip locked limit 5
 ) update private.payment_attempts a set checked_at=clock_timestamp() from batch
 where a.id=batch.id returning a.*;
end $$;
create function private.flag_payment(p_attempt uuid,p_kind text) returns void
language sql security definer set search_path='' as $$
 insert into private.payment_cases(attempt_id,kind) values(p_attempt,p_kind)
 on conflict(attempt_id,kind) do update set status='open',resolved_at=null
$$;
create function private.claim_refunds() returns table(id uuid,reference text,amount_minor bigint)
language plpgsql security definer set search_path='' as $$
begin
 -- Unknown submissions are never blindly retried.
 update private.payment_refunds r set state='reconcile'
 where state='submitting' and updated_at<clock_timestamp()-interval '2 minutes';
 insert into private.payment_cases(attempt_id,kind)
 select distinct attempt_id,'refund_unknown' from private.payment_refunds where state='reconcile'
 on conflict do nothing;
 return query with batch as (
  select r.id from private.payment_refunds r
  where r.state='requested' order by r.created_at,r.id for update skip locked limit 2
 ), claimed as (
  update private.payment_refunds r set state='submitting',updated_at=clock_timestamp()
  from batch where r.id=batch.id returning r.*
 ) select r.id,a.reference,r.amount_minor from claimed r join private.payment_attempts a on a.id=r.attempt_id;
end $$;
create function private.refund_recovery_batch() returns table(id uuid,reference text,provider_id text,amount_minor bigint)
language plpgsql security definer set search_path='' as $$
begin
 return query with batch as (
  select r.id from private.payment_refunds r where r.state in('pending','reconcile')
  and r.checked_at<clock_timestamp()-interval '15 minutes'
  order by r.checked_at,r.id for update skip locked limit 5
 ), checked as (
  update private.payment_refunds r set checked_at=clock_timestamp() from batch where r.id=batch.id returning r.*
 ) select r.id,a.reference,r.provider_id,r.amount_minor from checked r join private.payment_attempts a on a.id=r.attempt_id;
end $$;
create function private.record_refund(p_id uuid,p_provider text,p_amount bigint,p_state text)
returns void language plpgsql security definer set search_path='' as $$
declare r private.payment_refunds; b uuid; next_state text;
begin
 select * into r from private.payment_refunds where id=p_id for update;
 if not found or r.amount_minor<>p_amount or p_provider !~ '^[1-9][0-9]{0,29}$'
 or (r.provider_id is not null and r.provider_id<>p_provider)
 or p_state is null or p_state not in('pending','processing','processed','failed','needs-attention')
 then raise exception 'refund_verification_invalid' using errcode='P0001'; end if;
 if r.state='processed' then return; end if;
 next_state:=case when p_state='processed' then 'processed' when p_state='failed' then 'failed'
 when p_state='needs-attention' then 'reconcile' else 'pending' end;
 -- Never revive a failed reservation automatically; an operator must investigate.
 if r.state='failed' and next_state<>'failed' then
  perform private.flag_payment(r.attempt_id,'refund_unknown'); return;
 end if;
 update private.payment_refunds set provider_id=p_provider,state=next_state,updated_at=clock_timestamp() where id=r.id;
 select booking_id into b from private.payment_attempts where id=r.attempt_id;
 if next_state<>r.state then insert into private.payment_event(booking_id,kind)
 values(b,case next_state when 'processed' then 'refunded' when 'failed' then 'refund_failed' else 'refund_pending' end); end if;
end $$;
create function private.apply_verified_adjustment(p_key text,p_reference text,p_provider text,p_amount bigint,p_state text,p_refund uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts; e private.payment_inbox;
begin
 select * into a from private.payment_attempts where reference=p_reference for update;
 select * into e from private.payment_inbox where event_key=p_key for update;
 if a.id is null or e.event_key is null or e.reference<>p_reference or e.provider_id<>p_provider
 or e.amount_minor<>p_amount then raise exception 'payment_verification_invalid' using errcode='P0001'; end if;
 if e.state='applied' then return; end if;
 if e.kind like 'refund.%' then
  if not exists(select from private.payment_refunds where id=p_refund and attempt_id=a.id) then
   raise exception 'refund_not_found' using errcode='P0001'; end if;
  perform private.record_refund(p_refund,p_provider,p_amount,p_state);
 elsif e.kind like 'charge.dispute.%' then
  if p_state not in('open','resolved') or p_state is null then raise exception 'invalid_input'; end if;
  insert into private.payment_disputes(provider_id,attempt_id,amount_minor,state)
  values(p_provider,a.id,p_amount,p_state) on conflict(provider_id) do update
  set state=case when payment_disputes.state='resolved' then 'resolved' else excluded.state end,
  updated_at=clock_timestamp() where payment_disputes.attempt_id=a.id and payment_disputes.amount_minor=p_amount;
  if not found then raise exception 'payment_verification_invalid'; end if;
  insert into private.payment_event(booking_id,kind) values(a.booking_id,
   case p_state when 'resolved' then 'dispute_resolved' else 'disputed' end);
 else raise exception 'payment_verification_invalid'; end if;
 update private.payment_inbox set state='applied',applied_at=clock_timestamp() where event_key=p_key;
end $$;
create function public.request_payment_refund(p_booking uuid,p_amount bigint,p_reason text,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 return private.request_refund(p_booking,p_amount,p_reason,'admin:'||p_key::text);
end $$;
create function public.refund_late_payment(p_booking uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts;
begin
 select * into a from private.payment_attempts where booking_id=p_booking and customer_id=auth.uid() and state='paid'
 order by created_at limit 1 for update;
 if not found or not exists(select from private.payment_cases where attempt_id=a.id and kind='late_payment' and status='open')
 or not exists(select from public.bookings where id=p_booking and state='paid_after_expiry')
 then raise exception 'not_allowed' using errcode='42501'; end if;
 return private.request_refund(p_booking,a.amount_minor,'Late payment refund','late:'||p_booking::text);
end $$;
create function public.money_operations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 return jsonb_build_object(
 'cases',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
 select c.id,c.kind,c.status,c.created_at,a.booking_id,a.reference,a.amount_minor
 from private.payment_cases c join private.payment_attempts a on a.id=c.attempt_id
 where c.status='open' order by c.created_at limit 100)t),
 'refunds',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
 select r.id,a.booking_id,r.amount_minor,r.state from private.payment_refunds r join private.payment_attempts a on a.id=r.attempt_id
 order by r.created_at desc limit 100)t),
 'disputes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
 select d.provider_id,a.booking_id,d.amount_minor,d.state from private.payment_disputes d join private.payment_attempts a on a.id=d.attempt_id
 order by d.updated_at desc limit 100)t));
end $$;
revoke all on function private.payment_recovery_batch(),private.flag_payment(uuid,text),private.claim_refunds(),
 private.refund_recovery_batch(),private.record_refund(uuid,text,bigint,text),
 private.apply_verified_adjustment(text,text,text,bigint,text,uuid),
 public.request_payment_refund(uuid,bigint,text,uuid),public.refund_late_payment(uuid),public.money_operations()
 from public,anon,authenticated,service_role;
grant execute on function private.payment_recovery_batch(),private.flag_payment(uuid,text),private.claim_refunds(),
 private.refund_recovery_batch(),private.record_refund(uuid,text,bigint,text),
 private.apply_verified_adjustment(text,text,text,bigint,text,uuid) to money_server;
grant execute on function public.request_payment_refund(uuid,bigint,text,uuid),public.refund_late_payment(uuid),public.money_operations() to authenticated;

create function private.refund_identity(p_provider text) returns uuid
language sql stable security definer set search_path='' as $$
 select id from private.payment_refunds where provider_id=p_provider
$$;
revoke all on function private.refund_identity(text) from public,anon,authenticated,service_role;
grant execute on function private.refund_identity(text) to money_server;
