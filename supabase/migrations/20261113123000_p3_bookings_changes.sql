-- Phase 3, Claude lane, slice C4: reschedule, cancel, complete, and the
-- late-payment rebook (PLAN §6.3, §6.6; A23, A28, A29).
-- Reschedule reserves the new interval before releasing the old one, in one
-- transaction, so a failed reschedule keeps the original booking (A28).
-- Cancellation of a paid booking asks the money lane for a refund through
-- the contract (private.request_refund, Codex). Refund amounts follow the
-- PROPOSED default below until the agents' cancellation terms are approved
-- before G-PAY (PLAN §6.6).

alter table public.bookings
  add column cancelled_at timestamptz,
  add column cancelled_by text check (cancelled_by is null or cancelled_by in ('customer','provider','admin')),
  add column completed_at timestamptz,
  add column reschedule_count smallint not null default 0 check (reschedule_count between 0 and 20);

-- The reservation that currently holds a confirmed booking's slot.
create function private.booking_reservation(p_booking uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.id from public.reservations r
  where r.booking_id = p_booking and r.state = 'active' and r.kind = 'booking'
  order by r.created_at desc limit 1
$$;

-- Who may act: the customer, or an owner/manager of the provider.
create function private.booking_actor(p_booking uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare b record;
begin
  select customer_id, organisation_id into b from public.bookings where id = p_booking;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if b.customer_id = auth.uid() then return 'customer'; end if;
  if private.has_org_role(b.organisation_id, array['owner','manager']) then return 'provider'; end if;
  raise exception 'not_allowed' using errcode = '42501';
end $$;

-- ---------------------------------------------------------------------------
-- Reschedule a confirmed booking to a new start (same length). Same resource
-- first, then any resource of the offer's kind with room.
-- ---------------------------------------------------------------------------
create function private.reschedule_booking(p_booking uuid, p_new_starts_at timestamptz)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b record; v_actor text; v_len interval; v_new tstzrange; v_old uuid; v_res uuid; r record;
begin
  v_actor := private.booking_actor(p_booking);
  select * into b from public.bookings where id = p_booking for update;
  if b.state <> 'confirmed' or b.parent_booking_id is not null then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if lower(b.during) <= now() then raise exception 'already_started' using errcode = 'P0001'; end if;
  if p_new_starts_at is null or p_new_starts_at < now() + interval '15 minutes' then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  v_len := upper(b.during) - lower(b.during);
  v_new := tstzrange(p_new_starts_at, p_new_starts_at + v_len, '[)');
  v_old := private.booking_reservation(b.id);
  -- Reserve the new interval first. The old reservation still counts, so on
  -- a full resource a "move by 15 minutes" may fail: that is the safe side.
  begin
    v_res := private.reserve(b.resource_id, v_new, 'booking', 15, b.id);
  exception when sqlstate 'P0001' then
    v_res := null;
  end;
  if v_res is null then
    for r in
      select res.id from public.resources res join public.service_offers so on so.id = b.offer_id
      where res.organisation_id = b.organisation_id and res.active and res.kind = so.resource_kind and res.id <> b.resource_id
      order by res.created_at
    loop
      begin
        v_res := private.reserve(r.id, v_new, 'booking', 15, b.id);
        exit;
      exception when sqlstate 'P0001' then
        v_res := null;
      end;
    end loop;
  end if;
  if v_res is null then raise exception 'capacity_full' using errcode = 'P0001'; end if;
  -- Only now release the old slot (A28: a failure above kept it).
  if v_old is not null then perform private.release_reservation(v_old, 'released'); end if;
  update public.bookings set during = v_new, resource_id = (select resource_id from public.reservations where id = v_res),
    reschedule_count = reschedule_count + 1, updated_at = now()
  where id = b.id;
  perform private.booking_log(b.id, 'rescheduled', jsonb_build_object('by', v_actor));
end $$;

-- ---------------------------------------------------------------------------
-- Cancel. PROPOSED refund default (until the cancellation terms are
-- approved): provider or admin cancels -> full refund; customer cancels at
-- least 24 hours before the start -> full refund; later -> no automatic
-- refund (a provider or admin can still refund through the money lane).
-- ---------------------------------------------------------------------------
create function private.cancel_booking(p_booking uuid, p_reason text default null)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare b record; v_actor text; v_res uuid; v_refund bigint := 0; v_outcome text := 'cancelled';
begin
  if private.is_platform_admin() then v_actor := 'admin'; else v_actor := private.booking_actor(p_booking); end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.state in ('cancelled','completed','declined','lapsed') then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if b.state = 'confirmed' and lower(b.during) <= now() and v_actor = 'customer' then
    raise exception 'already_started' using errcode = 'P0001';
  end if;
  -- Release whatever capacity it holds (hold or booking).
  update public.reservations set state = 'released', released_at = now()
  where booking_id = b.id and state = 'active';
  if b.state in ('confirmed','paid_after_expiry') then
    v_refund := case
      when v_actor in ('provider','admin') then b.amount_minor
      when lower(b.during) - now() >= interval '24 hours' then b.amount_minor
      when b.state = 'paid_after_expiry' then b.amount_minor
      else 0 end;
  end if;
  update public.bookings set state = 'cancelled', cancelled_at = now(), cancelled_by = v_actor, updated_at = now()
  where id = b.id;
  perform private.booking_log(b.id, 'cancelled', jsonb_build_object('by', v_actor, 'refund_minor', v_refund));
  if v_refund > 0 then
    -- Contract call into the money lane. Until that lane's function exists
    -- (separate migrations), record the request for it to pick up.
    if to_regprocedure('private.request_refund(uuid,bigint,text,text)') is not null then
      execute 'select private.request_refund($1, $2, $3, $4)'
      using b.id, v_refund, coalesce(nullif(btrim(p_reason), ''), 'cancelled_by_' || v_actor), 'cancel:' || b.id::text;
      v_outcome := 'cancelled_refund_requested';
    else
      perform private.booking_log(b.id, 'refund_pending', jsonb_build_object('amount_minor', v_refund));
      v_outcome := 'cancelled_refund_pending';
    end if;
  end if;
  return v_outcome;
end $$;

-- Provider marks the job done (starts the 7-day address window, C5, and
-- makes the booking reviewable, Codex X7).
create function private.complete_booking(p_booking uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b record;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(b.organisation_id);
  if b.state <> 'confirmed' then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if lower(b.during) > now() then raise exception 'not_started' using errcode = 'P0001'; end if;
  update public.bookings set state = 'completed', completed_at = now(), updated_at = now() where id = b.id;
  perform private.booking_log(b.id, 'completed');
end $$;

-- ---------------------------------------------------------------------------
-- Late payment (A23). The money lane found a payment after the hold expired
-- (confirm_paid returned 'hold_expired' and set 'paid_after_expiry'). The
-- customer chooses a free slot (rebook) or a refund (money lane).
-- ---------------------------------------------------------------------------
create function private.rebook_options(p_booking uuid, p_days integer default 7)
returns table(resource_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare b record; d date;
begin
  select * into b from public.bookings where id = p_booking;
  if not found or b.state <> 'paid_after_expiry' then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if p_days not between 1 and 14 then raise exception 'invalid_input' using errcode = '22023'; end if;
  for i in 0..(p_days - 1) loop
    d := (greatest(lower(b.during), now()) at time zone 'Africa/Johannesburg')::date + i;
    return query select s.resource_id, s.starts_at, s.ends_at from private.available_slots(b.offer_id, d) s;
  end loop;
end $$;

create function private.rebook_after_late_payment(p_booking uuid, p_resource uuid, p_starts_at timestamptz)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b record; v_res uuid; v_new tstzrange;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.state <> 'paid_after_expiry' then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  -- Called by the customer (app) or by the money lane (booking_contract).
  if auth.uid() is not null and auth.uid() <> b.customer_id then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_new := tstzrange(p_starts_at, p_starts_at + (upper(b.during) - lower(b.during)), '[)');
  if not exists (select 1 from public.resources r join public.service_offers so on so.id = b.offer_id
                 where r.id = p_resource and r.organisation_id = b.organisation_id and r.kind = so.resource_kind) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_res := private.reserve(p_resource, v_new, 'booking', 15, b.id);
  update public.bookings set state = 'confirmed', during = v_new, resource_id = p_resource,
    confirmed_at = now(), updated_at = now()
  where id = b.id;
  perform private.booking_log(b.id, 'rebooked_after_late_payment');
end $$;

-- ---------------------------------------------------------------------------
-- Wrappers and grants
-- ---------------------------------------------------------------------------
create function public.reschedule_booking(p_booking uuid, p_new_starts_at timestamptz)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.reschedule_booking(p_booking, p_new_starts_at) $$;
create function public.cancel_booking(p_booking uuid, p_reason text default null)
returns text language sql volatile security invoker set search_path = '' as $$
  select private.cancel_booking(p_booking, p_reason) $$;
create function public.complete_booking(p_booking uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.complete_booking(p_booking) $$;
create function public.rebook_options(p_booking uuid)
returns table(resource_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.bookings where id = p_booking and customer_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select * from private.rebook_options(p_booking, 7);
end $$;
create function public.rebook_after_late_payment(p_booking uuid, p_resource uuid, p_starts_at timestamptz)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.rebook_after_late_payment(p_booking, p_resource, p_starts_at) $$;

revoke all on function
  private.booking_reservation(uuid), private.booking_actor(uuid), private.reschedule_booking(uuid, timestamptz),
  private.cancel_booking(uuid, text), private.complete_booking(uuid), private.rebook_options(uuid, integer),
  private.rebook_after_late_payment(uuid, uuid, timestamptz),
  public.reschedule_booking(uuid, timestamptz), public.cancel_booking(uuid, text), public.complete_booking(uuid),
  public.rebook_options(uuid), public.rebook_after_late_payment(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function
  private.reschedule_booking(uuid, timestamptz), private.cancel_booking(uuid, text), private.complete_booking(uuid),
  private.rebook_options(uuid, integer), private.rebook_after_late_payment(uuid, uuid, timestamptz),
  public.reschedule_booking(uuid, timestamptz), public.cancel_booking(uuid, text), public.complete_booking(uuid),
  public.rebook_options(uuid), public.rebook_after_late_payment(uuid, uuid, timestamptz)
  to authenticated;
grant execute on function private.rebook_options(uuid, integer), private.rebook_after_late_payment(uuid, uuid, timestamptz)
  to booking_contract;
