-- Phase 3, Claude lane, slice C2: request -> accept -> hold, and the
-- bookings side of the lane contract (planning/claude/24-phase-3-plan.md §4).
-- PLAN §6.3: a request doesn't promise capacity; the provider accepts within
-- 2 business hours; acceptance atomically creates a 15-minute payment hold;
-- an expired hold is never confirmed silently.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  customer_id uuid not null references auth.users(id),
  offer_id uuid not null references public.service_offers(id),
  -- Requested interval, including the offer's buffer (and travel, C5).
  during tstzrange not null check (not isempty(during) and lower_inc(during) and not upper_inc(during)),
  state text not null default 'requested' check (state in (
    'requested',          -- waiting for the provider
    'declined', 'lapsed', -- provider said no / didn't answer in time
    'awaiting_payment',   -- accepted; a hold is running
    'payment_expired',    -- hold ran out unpaid
    'confirmed',          -- paid while the hold was active
    'paid_after_expiry',  -- money lane saw a payment after the hold expired (A23)
    'cancelled', 'completed')),
  accept_by timestamptz not null,
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  quote_version_id uuid,            -- set for quoted work (C3)
  resource_id uuid,                 -- chosen at acceptance
  hold_id uuid references public.reservations(id),
  paid_attempt_id uuid,             -- the money lane's payment attempt (contract)
  customer_note text check (customer_note is null or length(customer_note) <= 500),
  decided_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state in ('awaiting_payment','payment_expired','confirmed','paid_after_expiry')) <= (hold_id is not null and amount_minor is not null)),
  check ((state = 'confirmed') = (confirmed_at is not null) or state in ('cancelled','completed'))
);
comment on table public.bookings is 'Customer bookings. Customer sees own; organisation members see theirs; aal2 admins all. Written only by booking functions.';
create index bookings_customer_idx on public.bookings(customer_id, created_at desc);
create index bookings_org_idx on public.bookings(organisation_id, state, created_at desc);
create index bookings_accept_by_idx on public.bookings(accept_by) where state = 'requested';
-- One booking per hold (plan §4 invariant: one active hold per booking).
create unique index bookings_hold_uidx on public.bookings(hold_id) where hold_id is not null;

alter table public.reservations add constraint reservations_booking_fk
  foreign key (booking_id) references public.bookings(id);

-- Insert-only event feed (plan §4). No personal fields: kinds and ids only.
create table private.booking_event (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{3,40}$'),
  occurred_at timestamptz not null default now(),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object')
);
create index booking_event_booking_idx on private.booking_event(booking_id, id);
revoke all on private.booking_event from public, anon, authenticated, service_role;

create function private.booking_log(p_booking uuid, p_kind text, p_data jsonb default '{}')
returns void language sql volatile security definer set search_path = '' as $$
  insert into private.booking_event(booking_id, kind, data) values (p_booking, p_kind, coalesce(p_data, '{}'))
$$;

-- ---------------------------------------------------------------------------
-- Business-hours clock: 08:00-17:00 Mon-Sat, SA public holidays excluded
-- (PLAN §6.3, provisional). Adds p_minutes of business time to p_from.
-- ---------------------------------------------------------------------------
create function private.add_business_minutes(p_from timestamptz, p_minutes integer default 120)
returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  t timestamp := p_from at time zone 'Africa/Johannesburg';
  left_min integer := p_minutes;
  day_start timestamp; day_end timestamp; avail integer;
begin
  for i in 1..400 loop
    day_start := date_trunc('day', t) + time '08:00';
    day_end := date_trunc('day', t) + time '17:00';
    if extract(isodow from t) = 7 or private.is_public_holiday(t::date) or t >= day_end then
      t := date_trunc('day', t) + interval '1 day' + time '08:00';
      continue;
    end if;
    if t < day_start then t := day_start; end if;
    avail := floor(extract(epoch from (day_end - t)) / 60);
    if avail >= left_min then
      return (t + make_interval(mins => left_min)) at time zone 'Africa/Johannesburg';
    end if;
    left_min := left_min - avail;
    t := date_trunc('day', t) + interval '1 day' + time '08:00';
  end loop;
  raise exception 'invalid_input' using errcode = '22023';
end $$;

-- ---------------------------------------------------------------------------
-- Customer: request a booking for a fixed-price offer.
-- Slots that start before acceptance plus payment could finish aren't
-- allowed: start must be after accept_by + the 15-minute hold.
-- ---------------------------------------------------------------------------
create function private.request_booking(p_offer uuid, p_starts_at timestamptz, p_note text default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare o record; v_id uuid; v_accept_by timestamptz; v_during tstzrange;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select so.* into o from public.service_offers so
    join public.listings l on l.public_id = so.listing_public_id and l.status = 'live'
  where so.id = p_offer and so.active and so.pricing = 'fixed';
  if not found then raise exception 'offer_unavailable' using errcode = 'P0001'; end if;
  v_accept_by := private.add_business_minutes(now(), 120);
  if p_starts_at is null or p_starts_at < v_accept_by + interval '15 minutes' then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  v_during := tstzrange(p_starts_at, p_starts_at + make_interval(mins => o.duration_minutes + o.buffer_minutes), '[)');
  insert into public.bookings(organisation_id, customer_id, offer_id, during, accept_by, amount_minor, customer_note)
  values (o.organisation_id, auth.uid(), o.id, v_during, v_accept_by, o.price_minor, nullif(btrim(p_note), ''))
  returning id into v_id;
  perform private.booking_log(v_id, 'requested');
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Provider: accept (creates the hold atomically) or decline.
-- Tries each active resource of the offer's kind until one has room.
-- ---------------------------------------------------------------------------
-- Internal (no auth check): put a hold on the first resource of the offer's
-- kind that has room. Used by provider acceptance and by quote approval (C3).
create function private.place_hold(p_booking uuid, p_hold_minutes integer default 15)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare b record; r record; v_hold uuid;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if b.amount_minor is null then raise exception 'no_price' using errcode = 'P0001'; end if;
  for r in
    select res.id from public.resources res join public.service_offers so on so.id = b.offer_id
    where res.organisation_id = b.organisation_id and res.active and res.kind = so.resource_kind
    order by res.created_at
  loop
    begin
      v_hold := private.reserve(r.id, b.during, 'hold', p_hold_minutes, b.id);
      exit;
    exception when sqlstate 'P0001' then
      v_hold := null; -- capacity_full / outside_hours on this resource; try the next
    end;
  end loop;
  if v_hold is null then raise exception 'capacity_full' using errcode = 'P0001'; end if;
  update public.bookings set state = 'awaiting_payment',
    resource_id = (select resource_id from public.reservations where id = v_hold),
    hold_id = v_hold, decided_at = coalesce(decided_at, now()), updated_at = now()
  where id = b.id;
  perform private.booking_log(b.id, 'hold_placed', jsonb_build_object('hold_id', v_hold));
  return v_hold;
end $$;

create function private.accept_booking(p_booking uuid, p_hold_minutes integer default 15)
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
  perform private.booking_log(b.id, 'accepted');
  return private.place_hold(b.id, p_hold_minutes);
end $$;

create function private.decline_booking(p_booking uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b record;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(b.organisation_id);
  if b.state <> 'requested' then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  update public.bookings set state = 'declined', decided_at = now(), updated_at = now() where id = b.id;
  perform private.booking_log(b.id, 'declined');
end $$;

-- Cron (booking_server, every minute): lapse unanswered requests and mark
-- unpaid expired holds. Replaces C1's expire_holds body.
create or replace function private.expire_holds() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  with gone as (
    update public.reservations set state = 'expired', released_at = now()
    where state = 'active' and kind = 'hold' and expires_at <= now()
    returning id, booking_id
  ), marked as (
    update public.bookings b set state = 'payment_expired', updated_at = now()
    from gone g where b.id = g.booking_id and b.state = 'awaiting_payment'
    returning b.id
  ), logged as (
    insert into private.booking_event(booking_id, kind) select id, 'hold_expired' from marked returning 1
  ) select count(*) into n from gone;
  with lapsed as (
    update public.bookings set state = 'lapsed', decided_at = now(), updated_at = now()
    where state = 'requested' and accept_by < now()
    returning id
  ) insert into private.booking_event(booking_id, kind) select id, 'lapsed' from lapsed;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Lane contract, bookings side (plan §4). Granted to booking_contract.
-- ---------------------------------------------------------------------------
create function private.hold_snapshot(p_hold uuid)
returns table(hold_id uuid, booking_id uuid, quote_version_id uuid, organisation_id uuid,
              amount_minor bigint, currency text, expires_at timestamptz, state text)
language sql stable security definer set search_path = '' as $$
  select r.id, b.id, b.quote_version_id, b.organisation_id, b.amount_minor, b.currency, r.expires_at,
         case when r.state = 'active' and r.kind = 'hold' and r.expires_at > now() then 'active'
              when r.kind = 'booking' then 'converted'
              else 'expired' end
  from public.reservations r join public.bookings b on b.hold_id = r.id
  where r.id = p_hold
$$;

-- Returns 'confirmed', 'already_confirmed' or 'hold_expired'. Idempotent per
-- payment attempt; never confirms an expired hold.
create function private.confirm_paid(p_hold uuid, p_payment_attempt uuid)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare b record; r record;
begin
  if p_hold is null or p_payment_attempt is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into b from public.bookings where hold_id = p_hold for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if b.state = 'confirmed' then
    if b.paid_attempt_id = p_payment_attempt then return 'already_confirmed'; end if;
    -- A second, different payment for a confirmed booking: the money lane
    -- reconciles it (refund the duplicate). Never a second job.
    return 'hold_expired';
  end if;
  select * into r from public.reservations where id = p_hold for update;
  if b.state = 'awaiting_payment' and r.state = 'active' and r.kind = 'hold' and r.expires_at > now() then
    update public.reservations set kind = 'booking', expires_at = null where id = r.id;
    update public.bookings set state = 'confirmed', paid_attempt_id = p_payment_attempt,
      confirmed_at = now(), updated_at = now() where id = b.id;
    perform private.booking_log(b.id, 'confirmed');
    return 'confirmed';
  end if;
  if b.state in ('awaiting_payment','payment_expired') then
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
-- Public invoker wrappers for app routes (authenticated JWT).
-- ---------------------------------------------------------------------------
create function public.request_booking(p_offer uuid, p_starts_at timestamptz, p_note text default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.request_booking(p_offer, p_starts_at, p_note) $$;
create function public.accept_booking(p_booking uuid)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.accept_booking(p_booking, 15) $$;
create function public.decline_booking(p_booking uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.decline_booking(p_booking) $$;

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;
revoke all on public.bookings from public, anon, authenticated, service_role;
grant select on public.bookings to authenticated;
create policy bookings_customer_select on public.bookings for select to authenticated
  using (customer_id = (select auth.uid()));
create policy bookings_org_select on public.bookings for select to authenticated
  using ((select private.is_org_member(organisation_id)));
-- A customer may read the reservations of their own bookings (hold expiry
-- for the countdown). No other customer data is in that table.
create policy reservations_customer_select on public.reservations for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy bookings_admin_select on public.bookings for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));

revoke all on function
  private.booking_log(uuid, text, jsonb), private.add_business_minutes(timestamptz, integer),
  private.request_booking(uuid, timestamptz, text), private.accept_booking(uuid, integer),
  private.place_hold(uuid, integer), private.decline_booking(uuid), private.hold_snapshot(uuid), private.confirm_paid(uuid, uuid),
  public.request_booking(uuid, timestamptz, text), public.accept_booking(uuid), public.decline_booking(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  private.request_booking(uuid, timestamptz, text), private.accept_booking(uuid, integer), private.decline_booking(uuid),
  public.request_booking(uuid, timestamptz, text), public.accept_booking(uuid), public.decline_booking(uuid)
  to authenticated;
grant execute on function private.hold_snapshot(uuid), private.confirm_paid(uuid, uuid) to booking_contract;
grant execute on function private.add_business_minutes(timestamptz, integer) to booking_server;
