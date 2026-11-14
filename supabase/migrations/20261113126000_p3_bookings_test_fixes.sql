-- Phase 3 bookings lane: fixes found by the test round (P3-O2).
-- Claude's lane only. SYNTHETIC data only until G-PROD / G-PAY.

-- ---------------------------------------------------------------------------
-- T-1 (A23/A24/A29). confirm_paid must be idempotent for a payment it has
-- already applied, whatever happened to the booking since. Before this fix:
--   * paid -> confirmed -> cancelled, then the same charge replayed: the
--     booking was moved to 'paid_after_expiry' with confirmed_at still set,
--     which violates bookings_check1 (23514), so the money lane's effect
--     applier could never finish that event;
--   * paid late -> cancelled (refund requested), then replayed: the booking
--     was reopened as 'paid_after_expiry', so the customer could rebook a
--     slot they had already been refunded for;
--   * paid -> completed, then replayed: 'hold_expired', which opens a false
--     late-payment case for finished work.
-- Rule now: once a payment attempt is recorded on the booking, the booking
-- never changes again through confirm_paid. The same attempt gets
-- 'already_confirmed' (if it confirmed the booking) or 'hold_expired' (if it
-- was late); a different attempt gets 'hold_expired' so the money lane
-- refunds the duplicate.
-- ---------------------------------------------------------------------------
create or replace function private.confirm_paid(p_hold uuid, p_payment_attempt uuid)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare b record; r record; v_parent_ok boolean := true;
begin
  if p_hold is null or p_payment_attempt is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into b from public.bookings where hold_id = p_hold for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if b.paid_attempt_id is not null then
    if b.paid_attempt_id = p_payment_attempt and b.confirmed_at is not null then
      return 'already_confirmed';
    end if;
    return 'hold_expired';
  end if;
  if b.parent_booking_id is not null then
    select state = 'confirmed' into v_parent_ok from public.bookings where id = b.parent_booking_id for update;
  end if;
  select * into r from public.reservations where id = p_hold for update;
  if v_parent_ok and b.state = 'awaiting_payment' and r.state = 'active' and r.kind = 'hold' and r.expires_at > now() then
    if b.parent_booking_id is null then
      update public.reservations set kind = 'booking', expires_at = null where id = r.id;
    else
      update public.reservations set state = 'converted', released_at = now() where id = r.id;
    end if;
    update public.bookings set state = 'confirmed', paid_attempt_id = p_payment_attempt,
      confirmed_at = now(), updated_at = now() where id = b.id;
    if b.quote_version_id is not null then
      update public.quote_versions set state = 'paid' where id = b.quote_version_id;
      update public.quotes set state = 'paid', updated_at = now()
      where id = (select quote_id from public.quote_versions where id = b.quote_version_id);
    end if;
    perform private.booking_log(b.id, 'confirmed');
    return 'confirmed';
  end if;
  if b.state in ('awaiting_payment','payment_expired','cancelled') then
    if r.state = 'active' then
      update public.reservations set state = 'expired', released_at = now() where id = r.id;
    end if;
    update public.bookings set state = 'paid_after_expiry', paid_attempt_id = p_payment_attempt, updated_at = now()
    where id = b.id;
    perform private.booking_log(b.id, 'paid_after_expiry');
  end if;
  return 'hold_expired';
end $$;

-- ---------------------------------------------------------------------------
-- T-2 (A30, PLAN §6.5). There is no routing service, so a mobile job's timing
-- is confirmed by the provider before acceptance. Before this fix the
-- provider could accept a mobile request without confirming the travel
-- buffer, reserving the band's guess unseen.
-- ---------------------------------------------------------------------------
alter table public.bookings add column travel_confirmed_at timestamptz;

create or replace function private.set_travel_buffer(p_booking uuid, p_travel_minutes integer, p_charge_minor bigint default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b record; o record;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(b.organisation_id);
  if not b.mobile or b.state <> 'requested' then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if p_travel_minutes not between 0 and 240 or p_travel_minutes % 5 <> 0 or coalesce(p_charge_minor, 0) < 0 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into o from public.service_offers where id = b.offer_id;
  update public.bookings set
    travel_minutes = p_travel_minutes,
    travel_charge_minor = coalesce(p_charge_minor, travel_charge_minor),
    amount_minor = o.price_minor + coalesce(p_charge_minor, travel_charge_minor),
    during = tstzrange(lower(during), lower(during) + make_interval(mins => o.duration_minutes + o.buffer_minutes + p_travel_minutes), '[)'),
    travel_confirmed_at = now(),
    updated_at = now()
  where id = b.id;
  perform private.booking_log(b.id, 'travel_confirmed', jsonb_build_object('travel_minutes', p_travel_minutes));
end $$;

create or replace function private.accept_booking(p_booking uuid, p_hold_minutes integer default 15)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare b record;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(b.organisation_id);
  if b.state <> 'requested' then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if b.accept_by < now() then
    update public.bookings set state = 'lapsed', decided_at = now(), updated_at = now() where id = b.id;
    perform private.booking_log(b.id, 'lapsed');
    raise exception 'request_lapsed' using errcode = 'P0001';
  end if;
  if b.mobile and b.travel_confirmed_at is null then
    raise exception 'travel_unconfirmed' using errcode = 'P0001';
  end if;
  perform private.booking_log(b.id, 'accepted');
  return private.place_hold(b.id, p_hold_minutes);
end $$;
