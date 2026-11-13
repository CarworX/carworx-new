-- Phase 3 bookings lane: fixes from the first review pass on #99 and the
-- money lane's contract request (plan §4). Build round; tests follow (P3-O2).

-- ---------------------------------------------------------------------------
-- RLS on the two private tables. Reached only through SECURITY DEFINER
-- functions, so they carry no policies: every client role sees nothing.
-- ---------------------------------------------------------------------------
alter table private.booking_event enable row level security;
alter table private.booking_addresses enable row level security;

-- Holiday extras are reference data for any signed-in person, but not via a
-- bare `true`.
drop policy public_holiday_extras_read on public.public_holiday_extras;
create policy public_holiday_extras_read on public.public_holiday_extras for select to authenticated
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- Contract: the customer's own hold snapshot (money lane checkout reads it
-- with the customer's JWT). Someone else's hold returns no row.
-- ---------------------------------------------------------------------------
create function private.my_hold_snapshot(p_hold uuid)
returns table(hold_id uuid, booking_id uuid, quote_version_id uuid, organisation_id uuid,
              amount_minor bigint, currency text, expires_at timestamptz, state text)
language sql stable security definer set search_path = '' as $$
  select s.* from private.hold_snapshot(p_hold) s
  join public.bookings b on b.id = s.booking_id
  where b.customer_id = (select auth.uid())
$$;
create function public.hold_snapshot(p_hold uuid)
returns table(hold_id uuid, booking_id uuid, quote_version_id uuid, organisation_id uuid,
              amount_minor bigint, currency text, expires_at timestamptz, state text)
language sql stable security invoker set search_path = '' as $$
  select * from private.my_hold_snapshot(p_hold)
$$;

-- ---------------------------------------------------------------------------
-- Due expiry, run lazily by the booking screens until a scheduled caller
-- exists. Idempotent: it only moves rows whose time has already passed.
-- ---------------------------------------------------------------------------
create function public.expire_due_bookings()
returns integer
language sql volatile security invoker set search_path = '' as $$
  select private.expire_holds()
$$;

-- ---------------------------------------------------------------------------
-- A paid quote can't be revised; an approved but unpaid one can (its hold is
-- released and its payable cancelled below the guard, as before).
-- ---------------------------------------------------------------------------
create or replace function private.issue_quote_version(
  p_quote uuid, p_lines jsonb, p_duration integer, p_valid_days integer default 7, p_note text default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare q record; v_total bigint; v_id uuid; v_next integer;
begin
  select * into q from public.quotes where id = p_quote for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(q.organisation_id);
  if q.state not in ('requested','quoted','approved') then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if exists (
    select 1 from public.bookings b join public.quote_versions v on v.id = b.quote_version_id
    where v.quote_id = q.id and b.state in ('confirmed','paid_after_expiry','completed')
  ) then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if p_valid_days not between 1 and 30 or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    where jsonb_typeof(l->'label') <> 'string' or length(l->>'label') not between 2 and 120
       or jsonb_typeof(l->'amount_minor') <> 'number' or (l->>'amount_minor')::numeric <> trunc((l->>'amount_minor')::numeric)
       or (l->>'amount_minor')::bigint < 0
  ) then raise exception 'invalid_input' using errcode = '22023'; end if;
  select sum((l->>'amount_minor')::bigint) into v_total from jsonb_array_elements(p_lines) l;
  update public.quote_versions set state = 'superseded' where quote_id = q.id and state in ('issued','approved');
  perform private.release_reservation(b.hold_id, 'released')
  from public.bookings b join public.quote_versions v on v.id = b.quote_version_id
  where v.quote_id = q.id and b.state = 'awaiting_payment';
  update public.bookings b set state = 'cancelled', updated_at = now()
  from public.quote_versions v
  where v.id = b.quote_version_id and v.quote_id = q.id and b.state in ('awaiting_payment','requested','payment_expired');
  select coalesce(max(version), 0) + 1 into v_next from public.quote_versions where quote_id = q.id;
  insert into public.quote_versions(quote_id, organisation_id, version, lines, total_minor, duration_minutes, valid_until, note, issued_by)
  values (q.id, q.organisation_id, v_next, p_lines, v_total, p_duration, now() + make_interval(days => p_valid_days),
          nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  update public.quotes set state = 'quoted', updated_at = now() where id = q.id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Cancelling a job cancels its open extra-work payables first (and refunds
-- paid extra work by the same rule), so nothing stays payable on a cancelled
-- job.
-- ---------------------------------------------------------------------------
create or replace function private.cancel_booking(p_booking uuid, p_reason text default null)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare b record; c record; v_actor text; v_refund bigint := 0; v_outcome text := 'cancelled';
begin
  if private.is_platform_admin() then v_actor := 'admin'; else v_actor := private.booking_actor(p_booking); end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.state in ('cancelled','completed','declined','lapsed') then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  if b.state = 'confirmed' and lower(b.during) <= now() and v_actor = 'customer' then
    raise exception 'already_started' using errcode = 'P0001';
  end if;
  for c in
    select id from public.bookings
    where parent_booking_id = b.id and state not in ('cancelled','completed','declined','lapsed')
    order by id for update
  loop
    perform private.cancel_booking(c.id, p_reason);
  end loop;
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

-- ---------------------------------------------------------------------------
-- confirm_paid never confirms extra work whose parent job is no longer
-- confirmed: that payment is treated as late (refundable), like an expired
-- hold.
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
  if b.state = 'confirmed' then
    if b.paid_attempt_id = p_payment_attempt then return 'already_confirmed'; end if;
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
-- Every successful full-address read is logged (assigned staff and admins
-- alike), with the reader's id.
-- ---------------------------------------------------------------------------
create or replace function private.job_address(p_booking uuid)
returns table(address text, access_notes text)
language plpgsql volatile security definer set search_path = '' as $$
declare b record; v_allowed boolean; v_admin boolean := private.is_platform_admin();
begin
  select * into b from public.bookings where id = p_booking;
  if not found or not b.mobile then raise exception 'not_found' using errcode = 'P0001'; end if;
  v_allowed := (b.state = 'confirmed' or (b.state = 'completed' and b.completed_at > now() - interval '7 days'))
    and exists (
      select 1 from public.booking_assignments ba join public.memberships m on m.id = ba.membership_id
      where ba.booking_id = b.id and m.user_id = auth.uid() and m.status = 'active' and m.organisation_id = b.organisation_id
    );
  if not v_allowed and not v_admin then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform private.booking_log(b.id, case when v_allowed then 'address_read' else 'admin_address_read' end,
    jsonb_build_object('reader_id', auth.uid()));
  return query select ad.address, ad.access_notes
    from private.booking_addresses ad where ad.booking_id = b.id;
end $$;

revoke all on function
  private.my_hold_snapshot(uuid), public.hold_snapshot(uuid), public.expire_due_bookings()
  from public, anon, authenticated, service_role;
grant execute on function
  private.my_hold_snapshot(uuid), public.hold_snapshot(uuid), public.expire_due_bookings()
  to authenticated;
-- The invoker wrapper runs private.expire_holds() as the caller.
grant execute on function private.expire_holds() to authenticated;

-- ---------------------------------------------------------------------------
-- Foreign keys that close a reference loop (bookings <-> reservations;
-- bookings -> quote_versions -> quotes -> bookings; bookings' own parent)
-- are checked at commit, so a data-only backup restores in one transaction
-- whatever order it writes the rows in (BK-1). Integrity is unchanged.
-- ---------------------------------------------------------------------------
alter table public.reservations alter constraint reservations_booking_fk deferrable initially deferred;
alter table public.bookings alter constraint bookings_hold_id_fkey deferrable initially deferred;
alter table public.bookings alter constraint bookings_quote_version_fk deferrable initially deferred;
alter table public.bookings alter constraint bookings_parent_booking_id_fkey deferrable initially deferred;
alter table public.quotes alter constraint quotes_parent_booking_id_fkey deferrable initially deferred;
alter table public.quotes alter constraint quotes_diagnostic_booking_id_fkey deferrable initially deferred;
