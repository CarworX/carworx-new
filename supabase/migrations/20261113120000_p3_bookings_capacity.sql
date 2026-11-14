-- Phase 3, Claude lane, slice C1: capacity core (planning/claude/24-phase-3-plan.md §5).
-- Resources (bay, team or calendar) with a provider-set capacity (D-057),
-- opening hours, closures, South African public holidays, priced service
-- offers, and the single atomic reservation primitive every hold and
-- booking goes through. Intervals are half-open UTC tstzrange [start, end).
-- SYNTHETIC data only until G-PROD / G-PAY.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Scoped logins and the contract group role (forms_server pattern).
-- booking_server: the Worker's booking jobs (availability, hold expiry).
-- booking_contract: NOLOGIN group holding EXECUTE on the functions the money
-- lane calls (plan §4). Codex grants it to its own login WITH INHERIT TRUE.
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select from pg_roles where rolname = 'booking_server') then
    create role booking_server nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'booking_contract') then
    create role booking_contract nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;
grant usage on schema private to booking_server, booking_contract;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  branch_public_id uuid,
  kind text not null check (kind in ('bay','team','calendar')),
  name text not null check (length(name) between 1 and 80),
  -- D-057: how many customers this resource serves at the same time.
  capacity smallint not null default 1 check (capacity between 1 and 50),
  -- Mobile teams travel; their intervals include a travel buffer (C5).
  mobile boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, organisation_id),
  foreign key (branch_public_id, organisation_id) references public.branches(public_id, organisation_id)
);
comment on table public.resources is 'Bays, teams or calendars with a provider-set simultaneous capacity (D-057). Written only through provider RPCs.';
create index resources_org_idx on public.resources(organisation_id) where active;

-- Weekly opening hours in Africa/Johannesburg local time. Several rows per
-- weekday allow a lunch break.
create table public.resource_hours (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  organisation_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  opens time not null,
  closes time not null,
  check (closes > opens),
  foreign key (resource_id, organisation_id) references public.resources(id, organisation_id) on delete cascade
);
create index resource_hours_idx on public.resource_hours(resource_id, weekday);

create table public.resource_closures (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  organisation_id uuid not null,
  during tstzrange not null check (not isempty(during) and lower_inc(during) and not upper_inc(during)),
  reason text check (reason is null or length(reason) <= 120),
  created_at timestamptz not null default now(),
  foreign key (resource_id, organisation_id) references public.resources(id, organisation_id) on delete cascade
);
create index resource_closures_gist on public.resource_closures using gist (resource_id, during);

-- Ad hoc public holidays proclaimed under the Public Holidays Act 36 of 1994,
-- s2A (for example an election day). The fixed and Easter-based ones are
-- computed by private.sa_public_holidays().
create table public.public_holiday_extras (
  day date primary key,
  name text not null check (length(name) between 3 and 80)
);

-- What a customer can book: a priced (or quote-first) service on a listing,
-- with how long it takes and the turnaround buffer after it.
create table public.service_offers (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  organisation_id uuid not null,
  listing_public_id uuid not null,
  name text not null check (length(name) between 2 and 80),
  -- D-051: price-list services are booked and paid at once; others start
  -- with an enquiry and a quote (C3).
  pricing text not null check (pricing in ('fixed','quote')),
  price_minor bigint check (price_minor is null or price_minor between 100 and 100000000),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  duration_minutes integer not null check (duration_minutes between 15 and 1440 and duration_minutes % 15 = 0),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240 and buffer_minutes % 5 = 0),
  resource_kind text not null default 'bay' check (resource_kind in ('bay','team','calendar')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((pricing = 'fixed') = (price_minor is not null)),
  foreign key (listing_public_id, organisation_id) references public.listings(public_id, organisation_id) on delete cascade
);
create index service_offers_listing_idx on public.service_offers(listing_public_id) where active;

-- Every hold and booking occupies a reservation. Only private.reserve()
-- inserts rows; it enforces capacity under a row lock on the resource.
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  organisation_id uuid not null,
  during tstzrange not null check (not isempty(during) and lower_inc(during) and not upper_inc(during)),
  kind text not null check (kind in ('hold','booking')),
  state text not null default 'active' check (state in ('active','released','expired','converted')),
  -- Holds only: when capacity returns if unpaid (default 15 minutes, plan §2).
  expires_at timestamptz,
  booking_id uuid,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  check ((kind = 'hold') = (expires_at is not null)),
  check ((state = 'active') = (released_at is null)),
  foreign key (resource_id, organisation_id) references public.resources(id, organisation_id) on delete cascade
);
comment on table public.reservations is 'Capacity occupied by holds and bookings. Inserted only by private.reserve(); never written by clients.';
create index reservations_active_gist on public.reservations using gist (resource_id, during) where state = 'active';
create index reservations_hold_expiry_idx on public.reservations(expires_at) where state = 'active' and kind = 'hold';

-- ---------------------------------------------------------------------------
-- South African public holidays (Public Holidays Act 36 of 1994, Schedule 1
-- and s2(1): a holiday falling on a Sunday is observed on the Monday).
-- Easter Sunday by the anonymous Gregorian algorithm.
-- ---------------------------------------------------------------------------
create function private.easter_sunday(p_year integer) returns date
language plpgsql immutable set search_path = '' as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mon int; dy int;
begin
  a := p_year % 19; b := p_year / 100; c := p_year % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  mon := (h + l - 7 * m + 114) / 31; dy := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, mon, dy);
end $$;

create function private.sa_public_holidays(p_year integer)
returns table(day date, name text)
language sql stable set search_path = '' as $$
  with fixed(d, n) as (values
    (make_date(p_year, 1, 1), 'New Year''s Day'),
    (make_date(p_year, 3, 21), 'Human Rights Day'),
    (private.easter_sunday(p_year) - 2, 'Good Friday'),
    (private.easter_sunday(p_year) + 1, 'Family Day'),
    (make_date(p_year, 4, 27), 'Freedom Day'),
    (make_date(p_year, 5, 1), 'Workers'' Day'),
    (make_date(p_year, 6, 16), 'Youth Day'),
    (make_date(p_year, 8, 9), 'National Women''s Day'),
    (make_date(p_year, 9, 24), 'Heritage Day'),
    (make_date(p_year, 12, 16), 'Day of Reconciliation'),
    (make_date(p_year, 12, 25), 'Christmas Day'),
    (make_date(p_year, 12, 26), 'Day of Goodwill')
  ), observed as (
    select d, n from fixed
    union all
    -- s2(1): Sunday holidays move to Monday.
    select d + 1, n || ' (observed)' from fixed where extract(isodow from d) = 7
    union all
    select e.day, e.name from public.public_holiday_extras e where extract(year from e.day) = p_year
  )
  select distinct on (d) d, n from observed order by d, n
$$;

create function private.is_public_holiday(p_day date) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from private.sa_public_holidays(extract(year from p_day)::int) h where h.day = p_day)
$$;

-- ---------------------------------------------------------------------------
-- Capacity. The true peak concurrency inside an interval occurs at its start
-- or at the start of some overlapping reservation, so checking those points
-- is exact (not the over-strict "count every overlap").
-- ---------------------------------------------------------------------------
create function private.peak_concurrency(p_resource uuid, p_during tstzrange)
returns integer
language sql stable set search_path = '' as $$
  with live as (
    select r.during from public.reservations r
    where r.resource_id = p_resource and r.state = 'active' and r.during && p_during
      and (r.kind = 'booking' or r.expires_at > now())
  ), points as (
    select lower(p_during) as p
    union
    select lower(l.during) from live l where lower(l.during) <@ p_during
  )
  select coalesce(max((select count(*) from live l where l.during @> pt.p)), 0)::int from points pt
$$;

-- Is the whole interval inside opening hours (local time), outside closures
-- and not on a public holiday? Intervals may not cross local midnight.
create function private.within_opening(p_resource uuid, p_during tstzrange)
returns boolean
language sql stable set search_path = '' as $$
  with local as (
    select (lower(p_during) at time zone 'Africa/Johannesburg') as s,
           (upper(p_during) at time zone 'Africa/Johannesburg') as e
  )
  select l.s::date = (l.e - interval '1 microsecond')::date
    and not private.is_public_holiday(l.s::date)
    and exists (
      select 1 from public.resource_hours h
      where h.resource_id = p_resource
        and h.weekday = extract(isodow from l.s)
        and h.opens <= l.s::time
        -- Compare as intervals so an end at local midnight can't wrap to 00:00.
        and l.s::time::interval + (l.e - l.s) <= h.closes::interval
    )
    and not exists (
      select 1 from public.resource_closures c where c.resource_id = p_resource and c.during && p_during
    )
  from local l
$$;

-- The one way capacity is taken. Locks the resource row so concurrent
-- reservations on it serialise; then checks opening hours and peak
-- concurrency against the provider-set capacity. Raises:
--   22023 invalid_input · P0001 resource_unavailable / outside_hours / capacity_full
create function private.reserve(
  p_resource uuid, p_during tstzrange, p_kind text, p_hold_minutes integer default 15, p_booking uuid default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_cap smallint; v_org uuid; v_id uuid;
begin
  if p_during is null or isempty(p_during) or not lower_inc(p_during) or upper_inc(p_during)
     or lower(p_during) < now() or upper(p_during) - lower(p_during) > interval '24 hours'
     or p_kind not in ('hold','booking') or p_hold_minutes not between 1 and 60 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select r.capacity, r.organisation_id into v_cap, v_org
  from public.resources r where r.id = p_resource and r.active
  for update;
  if not found then raise exception 'resource_unavailable' using errcode = 'P0001'; end if;
  if not private.within_opening(p_resource, p_during) then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;
  if private.peak_concurrency(p_resource, p_during) >= v_cap then
    raise exception 'capacity_full' using errcode = 'P0001';
  end if;
  insert into public.reservations(resource_id, organisation_id, during, kind, expires_at, booking_id)
  values (p_resource, v_org, p_during, p_kind,
          case when p_kind = 'hold' then now() + make_interval(mins => p_hold_minutes) end, p_booking)
  returning id into v_id;
  return v_id;
end $$;

-- Releases capacity (cancel, reschedule-old-slot, rejected request).
create function private.release_reservation(p_reservation uuid, p_state text default 'released')
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_state not in ('released','expired','converted') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.reservations set state = p_state, released_at = now()
  where id = p_reservation and state = 'active';
end $$;

-- Marks holds past their expiry as expired. Run every minute by the Worker
-- cron as booking_server; holds also stop counting the moment they expire
-- (peak_concurrency ignores them), so this is tidy-up, not correctness.
create function private.expire_holds() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  with gone as (
    update public.reservations set state = 'expired', released_at = now()
    where state = 'active' and kind = 'hold' and expires_at <= now()
    returning id
  ) select count(*) into n from gone;
  return n;
end $$;

-- Candidate start times for an offer on one local date, in 15-minute steps,
-- on any active resource of the offer's kind with room left. Server-only
-- (booking_server): the Worker shapes it for the slot picker.
create function private.available_slots(p_offer uuid, p_day date, p_minutes integer default null)
returns table(resource_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with o as (
    select so.* from public.service_offers so
    join public.listings l on l.public_id = so.listing_public_id and l.status = 'live'
    where so.id = p_offer and so.active
  ), res as (
    select r.id from public.resources r join o on o.organisation_id = r.organisation_id
    where r.active and r.kind = o.resource_kind
  ), starts as (
    select gs as local_start
    from generate_series(p_day::timestamp, p_day::timestamp + interval '23 hours 45 minutes', interval '15 minutes') gs
  ), cand as (
    select res.id as resource_id,
           (s.local_start at time zone 'Africa/Johannesburg') as starts_at,
           ((s.local_start + make_interval(mins => coalesce(p_minutes, o.duration_minutes) + o.buffer_minutes)) at time zone 'Africa/Johannesburg') as ends_at
    from res cross join starts s cross join o
  )
  select c.resource_id, c.starts_at, c.ends_at from cand c, public.resources r
  where r.id = c.resource_id
    and c.starts_at > now()
    and private.within_opening(c.resource_id, tstzrange(c.starts_at, c.ends_at, '[)'))
    and private.peak_concurrency(c.resource_id, tstzrange(c.starts_at, c.ends_at, '[)')) < r.capacity
  order by c.starts_at, c.resource_id
$$;

-- ---------------------------------------------------------------------------
-- Provider RPCs (authenticated; owner or manager of the organisation).
-- ---------------------------------------------------------------------------
create function private.require_org_manager(p_org uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_org_role(p_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create function private.save_resource(
  p_org uuid, p_resource uuid, p_kind text, p_name text, p_capacity smallint, p_mobile boolean, p_active boolean, p_branch uuid default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_org_manager(p_org);
  if p_resource is null then
    insert into public.resources(organisation_id, branch_public_id, kind, name, capacity, mobile, active)
    values (p_org, p_branch, p_kind, btrim(p_name), coalesce(p_capacity, 1), coalesce(p_mobile, false), coalesce(p_active, true))
    returning id into v_id;
  else
    -- Lowering capacity never cancels existing bookings; it only limits new ones.
    update public.resources set kind = p_kind, name = btrim(p_name), capacity = coalesce(p_capacity, capacity),
      mobile = coalesce(p_mobile, mobile), active = coalesce(p_active, active), branch_public_id = p_branch
    where id = p_resource and organisation_id = p_org
    returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  end if;
  return v_id;
end $$;

-- Replaces a resource's weekly hours with the given set (jsonb array of
-- {"weekday":1,"opens":"08:00","closes":"17:00"}).
create function private.set_resource_hours(p_org uuid, p_resource uuid, p_hours jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_org_manager(p_org);
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 21 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.resources where id = p_resource and organisation_id = p_org) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  delete from public.resource_hours where resource_id = p_resource;
  insert into public.resource_hours(resource_id, organisation_id, weekday, opens, closes)
  select p_resource, p_org, (h->>'weekday')::smallint, (h->>'opens')::time, (h->>'closes')::time
  from jsonb_array_elements(p_hours) h;
end $$;

create function private.add_resource_closure(p_org uuid, p_resource uuid, p_from timestamptz, p_to timestamptz, p_reason text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_org_manager(p_org);
  insert into public.resource_closures(resource_id, organisation_id, during, reason)
  select p_resource, p_org, tstzrange(p_from, p_to, '[)'), nullif(btrim(p_reason), '')
  where exists (select 1 from public.resources where id = p_resource and organisation_id = p_org)
  returning id into v_id;
  if v_id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  return v_id;
end $$;

create function private.save_service_offer(
  p_org uuid, p_offer uuid, p_listing uuid, p_name text, p_pricing text, p_price_minor bigint,
  p_duration integer, p_buffer integer, p_resource_kind text, p_active boolean
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_org_manager(p_org);
  if p_offer is null then
    insert into public.service_offers(organisation_id, listing_public_id, name, pricing, price_minor,
      duration_minutes, buffer_minutes, resource_kind, active)
    values (p_org, p_listing, btrim(p_name), p_pricing, p_price_minor, p_duration, coalesce(p_buffer, 0),
      coalesce(p_resource_kind, 'bay'), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.service_offers set name = btrim(p_name), pricing = p_pricing, price_minor = p_price_minor,
      duration_minutes = p_duration, buffer_minutes = coalesce(p_buffer, 0),
      resource_kind = coalesce(p_resource_kind, resource_kind), active = coalesce(p_active, active)
    where id = p_offer and organisation_id = p_org
    returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  end if;
  return v_id;
end $$;

-- Public SECURITY INVOKER wrappers, as for the P2-4 admin functions.
create function public.save_resource(p_org uuid, p_resource uuid, p_kind text, p_name text, p_capacity smallint, p_mobile boolean, p_active boolean, p_branch uuid default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.save_resource(p_org, p_resource, p_kind, p_name, p_capacity, p_mobile, p_active, p_branch) $$;
create function public.set_resource_hours(p_org uuid, p_resource uuid, p_hours jsonb)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.set_resource_hours(p_org, p_resource, p_hours) $$;
create function public.add_resource_closure(p_org uuid, p_resource uuid, p_from timestamptz, p_to timestamptz, p_reason text)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.add_resource_closure(p_org, p_resource, p_from, p_to, p_reason) $$;
create function public.save_service_offer(p_org uuid, p_offer uuid, p_listing uuid, p_name text, p_pricing text, p_price_minor bigint, p_duration integer, p_buffer integer, p_resource_kind text, p_active boolean)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.save_service_offer(p_org, p_offer, p_listing, p_name, p_pricing, p_price_minor, p_duration, p_buffer, p_resource_kind, p_active) $$;

-- ---------------------------------------------------------------------------
-- Grants and RLS. Reads by the organisation's members and aal2 admins;
-- offers on live listings are public through the server only.
-- ---------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['resources','resource_hours','resource_closures','service_offers','reservations','public_holiday_extras'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
  end loop;
  foreach t in array array['resources','resource_hours','resource_closures','service_offers','reservations'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_org_member(organisation_id)) or ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin())))', t || '_member_select', t);
  end loop;
end $$;
grant select on public.public_holiday_extras to authenticated;
create policy public_holiday_extras_read on public.public_holiday_extras for select to authenticated using (true);

revoke all on function
  private.easter_sunday(integer), private.sa_public_holidays(integer), private.is_public_holiday(date),
  private.peak_concurrency(uuid, tstzrange), private.within_opening(uuid, tstzrange),
  private.reserve(uuid, tstzrange, text, integer, uuid), private.release_reservation(uuid, text),
  private.expire_holds(), private.available_slots(uuid, date, integer), private.require_org_manager(uuid),
  private.save_resource(uuid, uuid, text, text, smallint, boolean, boolean, uuid),
  private.set_resource_hours(uuid, uuid, jsonb), private.add_resource_closure(uuid, uuid, timestamptz, timestamptz, text),
  private.save_service_offer(uuid, uuid, uuid, text, text, bigint, integer, integer, text, boolean),
  public.save_resource(uuid, uuid, text, text, smallint, boolean, boolean, uuid),
  public.set_resource_hours(uuid, uuid, jsonb), public.add_resource_closure(uuid, uuid, timestamptz, timestamptz, text),
  public.save_service_offer(uuid, uuid, uuid, text, text, bigint, integer, integer, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function
  private.save_resource(uuid, uuid, text, text, smallint, boolean, boolean, uuid),
  private.set_resource_hours(uuid, uuid, jsonb), private.add_resource_closure(uuid, uuid, timestamptz, timestamptz, text),
  private.save_service_offer(uuid, uuid, uuid, text, text, bigint, integer, integer, text, boolean),
  public.save_resource(uuid, uuid, text, text, smallint, boolean, boolean, uuid),
  public.set_resource_hours(uuid, uuid, jsonb), public.add_resource_closure(uuid, uuid, timestamptz, timestamptz, text),
  public.save_service_offer(uuid, uuid, uuid, text, text, bigint, integer, integer, text, boolean)
  to authenticated;
grant execute on function private.available_slots(uuid, date, integer), private.expire_holds(), private.is_public_holiday(date)
  to booking_server;

-- Signed-in customers see free slots through an invoker wrapper (booking
-- needs an account). Bounded: one offer, one local day, at most 96 starts
-- per resource.
create function public.available_slots(p_offer uuid, p_day date, p_minutes integer default null)
returns table(resource_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.available_slots(p_offer, p_day, p_minutes)
  where p_day between (now() at time zone 'Africa/Johannesburg')::date
                  and (now() at time zone 'Africa/Johannesburg')::date + 60
    and (p_minutes is null or p_minutes between 15 and 1440)
$$;
revoke all on function public.available_slots(uuid, date, integer) from public, anon, authenticated, service_role;
grant execute on function private.available_slots(uuid, date, integer), public.available_slots(uuid, date, integer) to authenticated;

-- What a signed-in customer may book on a live listing: the listing's name
-- and mode plus its active offers. No base, radius or coordinates (A10).
create function private.bookable_offers(p_listing uuid)
returns table(listing_name text, listing_mode text, offer_id uuid, name text, pricing text,
              price_minor bigint, duration_minutes integer)
language sql stable security definer set search_path = '' as $$
  select l.display_name, l.mode, so.id, so.name, so.pricing, so.price_minor, so.duration_minutes
  from public.listings l join public.service_offers so on so.listing_public_id = l.public_id and so.active
  where l.public_id = p_listing and l.status = 'live'
  order by so.pricing, so.price_minor nulls last, so.name
$$;
create function public.bookable_offers(p_listing uuid)
returns table(listing_name text, listing_mode text, offer_id uuid, name text, pricing text,
              price_minor bigint, duration_minutes integer)
language sql stable security invoker set search_path = '' as $$ select * from private.bookable_offers(p_listing) $$;
revoke all on function private.bookable_offers(uuid), public.bookable_offers(uuid) from public, anon, authenticated, service_role;
grant execute on function private.bookable_offers(uuid), public.bookable_offers(uuid) to authenticated;

alter role booking_server login connection limit 5;
