-- Phase 3, Claude lane, slice C3: quote-then-pay (PLAN §6.4, A27).
-- Customer asks for a quote on a quote-priced offer -> provider issues an
-- immutable version with a visible expiry (default 7 days) -> customer
-- approves that exact version and picks a slot -> hold -> payment.
-- Revising before payment supersedes earlier versions. Work added after
-- payment needs a separate change quote with its own approval and payment.
-- A paid version is never relabelled.

alter table public.bookings add column parent_booking_id uuid references public.bookings(id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  customer_id uuid not null references auth.users(id),
  offer_id uuid not null references public.service_offers(id),
  -- Set for a change quote: extra work on an already-paid booking.
  parent_booking_id uuid references public.bookings(id),
  -- Optional priced diagnostic booking that came first (PLAN §6.4).
  diagnostic_booking_id uuid references public.bookings(id),
  state text not null default 'requested' check (state in ('requested','quoted','approved','paid','withdrawn','declined')),
  customer_note text check (customer_note is null or length(customer_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_customer_idx on public.quotes(customer_id, created_at desc);
create index quotes_org_idx on public.quotes(organisation_id, state, created_at desc);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  organisation_id uuid not null,
  version integer not null check (version >= 1),
  -- [{ "label": "Front brake pads", "amount_minor": 120000 }, ...]
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 30),
  total_minor bigint not null check (total_minor between 100 and 100000000),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  duration_minutes integer not null check (duration_minutes between 15 and 1440 and duration_minutes % 15 = 0),
  valid_until timestamptz not null,
  note text check (note is null or length(note) <= 1000),
  state text not null default 'issued' check (state in ('issued','superseded','approved','paid','expired')),
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (quote_id, version),
  check (valid_until > issued_at)
);
create index quote_versions_quote_idx on public.quote_versions(quote_id, version desc);

alter table public.bookings add constraint bookings_quote_version_fk
  foreign key (quote_version_id) references public.quote_versions(id);

-- Immutability: content columns never change after issue; only the state
-- (and approved_at) move, and only forward. A paid version is final.
create function private.quote_version_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'immutable' using errcode = 'P0001'; end if;
  if (new.lines, new.total_minor, new.currency, new.duration_minutes, new.valid_until, new.note, new.version, new.quote_id, new.issued_by, new.issued_at)
     is distinct from (old.lines, old.total_minor, old.currency, old.duration_minutes, old.valid_until, old.note, old.version, old.quote_id, old.issued_by, old.issued_at) then
    raise exception 'immutable' using errcode = 'P0001';
  end if;
  if old.state = 'paid' and new.state <> 'paid' then raise exception 'immutable' using errcode = 'P0001'; end if;
  if old.state in ('superseded','expired') and new.state <> old.state then raise exception 'immutable' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger quote_version_guard before update or delete on public.quote_versions
  for each row execute function private.quote_version_guard();

-- ---------------------------------------------------------------------------
-- Customer: ask for a quote (optionally linked to a diagnostic booking).
-- ---------------------------------------------------------------------------
create function private.request_quote(p_offer uuid, p_note text default null, p_diagnostic_booking uuid default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare o record; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select so.* into o from public.service_offers so
    join public.listings l on l.public_id = so.listing_public_id and l.status = 'live'
  where so.id = p_offer and so.active and so.pricing = 'quote';
  if not found then raise exception 'offer_unavailable' using errcode = 'P0001'; end if;
  if p_diagnostic_booking is not null and not exists (
    select 1 from public.bookings where id = p_diagnostic_booking and customer_id = auth.uid() and organisation_id = o.organisation_id
  ) then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.quotes(organisation_id, customer_id, offer_id, diagnostic_booking_id, customer_note)
  values (o.organisation_id, auth.uid(), o.id, p_diagnostic_booking, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Provider: issue a version (supersedes earlier unpaid versions).
-- ---------------------------------------------------------------------------
create function private.issue_quote_version(
  p_quote uuid, p_lines jsonb, p_duration integer, p_valid_days integer default 7, p_note text default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare q record; v_total bigint; v_id uuid; v_next integer;
begin
  select * into q from public.quotes where id = p_quote for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(q.organisation_id);
  if q.state not in ('requested','quoted') then raise exception 'wrong_state' using errcode = 'P0001'; end if;
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
  -- An approved-but-unpaid version loses its hold too (payment eligibility ends).
  perform private.release_reservation(b.hold_id, 'released')
  from public.bookings b join public.quote_versions v on v.id = b.quote_version_id
  where v.quote_id = q.id and b.state = 'awaiting_payment';
  update public.bookings b set state = 'cancelled', updated_at = now()
  from public.quote_versions v where v.id = b.quote_version_id and v.quote_id = q.id and b.state in ('awaiting_payment','requested');
  select coalesce(max(version), 0) + 1 into v_next from public.quote_versions where quote_id = q.id;
  insert into public.quote_versions(quote_id, organisation_id, version, lines, total_minor, duration_minutes, valid_until, note, issued_by)
  values (q.id, q.organisation_id, v_next, p_lines, v_total, p_duration, now() + make_interval(days => p_valid_days),
          nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  update public.quotes set state = 'quoted', updated_at = now() where id = q.id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Customer: approve an exact version and pick a start time -> booking + hold.
-- The provider already offered the price, so no second acceptance step.
-- For a change quote, no new slot: the extra work belongs to the parent job.
-- ---------------------------------------------------------------------------
create function private.approve_quote_version(p_version uuid, p_starts_at timestamptz default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v record; q record; o record; v_booking uuid; v_during tstzrange; v_hold uuid;
begin
  select * into v from public.quote_versions where id = p_version for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into q from public.quotes where id = v.quote_id for update;
  if q.customer_id is distinct from auth.uid() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v.state <> 'issued' then raise exception 'version_not_current' using errcode = 'P0001'; end if;
  if v.valid_until <= now() then
    update public.quote_versions set state = 'expired' where id = v.id;
    raise exception 'quote_expired' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.quote_versions where quote_id = q.id and version > v.version) then
    raise exception 'version_not_current' using errcode = 'P0001';
  end if;
  select * into o from public.service_offers where id = q.offer_id;
  if q.parent_booking_id is null then
    if p_starts_at is null or p_starts_at < now() + interval '15 minutes' then
      raise exception 'too_soon' using errcode = 'P0001';
    end if;
    v_during := tstzrange(p_starts_at, p_starts_at + make_interval(mins => v.duration_minutes + o.buffer_minutes), '[)');
  else
    -- Change quote: a short placeholder interval on the parent's resource is
    -- not taken; the payable is tied to the parent job's existing slot.
    select during into v_during from public.bookings where id = q.parent_booking_id;
  end if;
  insert into public.bookings(organisation_id, customer_id, offer_id, during, state, accept_by, amount_minor,
                              quote_version_id, parent_booking_id, decided_at)
  values (q.organisation_id, q.customer_id, q.offer_id, v_during, 'requested', now(), v.total_minor,
          v.id, q.parent_booking_id, now())
  returning id into v_booking;
  update public.quote_versions set state = 'approved', approved_at = now() where id = v.id;
  update public.quotes set state = 'approved', updated_at = now() where id = q.id;
  perform private.booking_log(v_booking, 'quote_approved', jsonb_build_object('quote_version_id', v.id));
  if q.parent_booking_id is null then
    v_hold := private.place_hold(v_booking, 15);
  else
    v_hold := private.place_change_hold(v_booking, 15);
  end if;
  return v_booking;
end $$;

-- A change quote's payable: a hold that occupies no capacity (zero-capacity
-- marker on the parent's resource is not needed; the parent booking already
-- holds the slot). It still expires after 15 minutes unpaid.
create function private.place_change_hold(p_booking uuid, p_hold_minutes integer default 15)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare b record; p record; v_hold uuid;
begin
  select * into b from public.bookings where id = p_booking for update;
  select * into p from public.bookings where id = b.parent_booking_id;
  if p.state <> 'confirmed' then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  -- Inserted directly: change payables never compete for capacity, and the
  -- capacity check counts only kind 'booking' rows of non-change bookings
  -- once converted (see confirm_paid below).
  insert into public.reservations(resource_id, organisation_id, during, kind, state, expires_at, booking_id)
  values (p.resource_id, p.organisation_id, p.during, 'hold', 'active', now() + make_interval(mins => p_hold_minutes), b.id)
  returning id into v_hold;
  update public.bookings set state = 'awaiting_payment', resource_id = p.resource_id, hold_id = v_hold, updated_at = now()
  where id = b.id;
  perform private.booking_log(b.id, 'hold_placed', jsonb_build_object('hold_id', v_hold, 'change_of', p.id));
  return v_hold;
end $$;

-- Change-quote holds must not consume capacity: exclude them from the peak.
create or replace function private.peak_concurrency(p_resource uuid, p_during tstzrange)
returns integer
language sql stable set search_path = '' as $$
  with live as (
    select r.during from public.reservations r
    left join public.bookings b on b.id = r.booking_id
    where r.resource_id = p_resource and r.state = 'active' and r.during && p_during
      and (r.kind = 'booking' or r.expires_at > now())
      and b.parent_booking_id is null
  ), points as (
    select lower(p_during) as p
    union
    select lower(l.during) from live l where lower(l.during) <@ p_during
  )
  select coalesce(max((select count(*) from live l where l.during @> pt.p)), 0)::int from points pt
$$;

-- Provider: issue a change quote for extra work on a confirmed booking.
create function private.start_change_quote(p_booking uuid, p_note text default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare b record; v_id uuid;
begin
  select * into b from public.bookings where id = p_booking;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(b.organisation_id);
  if b.state <> 'confirmed' or b.parent_booking_id is not null then raise exception 'wrong_state' using errcode = 'P0001'; end if;
  insert into public.quotes(organisation_id, customer_id, offer_id, parent_booking_id, customer_note)
  values (b.organisation_id, b.customer_id, b.offer_id, b.id, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end $$;

create function private.decline_quote(p_quote uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare q record;
begin
  select * into q from public.quotes where id = p_quote for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if q.customer_id is distinct from auth.uid() then
    perform private.require_org_manager(q.organisation_id);
    update public.quotes set state = 'withdrawn', updated_at = now() where id = q.id and state in ('requested','quoted');
  else
    update public.quotes set state = 'declined', updated_at = now() where id = q.id and state in ('requested','quoted');
  end if;
  update public.quote_versions set state = 'superseded' where quote_id = q.id and state = 'issued';
end $$;

-- confirm_paid also marks the quote version and quote paid (never relabelled).
create or replace function private.confirm_paid(p_hold uuid, p_payment_attempt uuid)
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
    return 'hold_expired';
  end if;
  select * into r from public.reservations where id = p_hold for update;
  if b.state = 'awaiting_payment' and r.state = 'active' and r.kind = 'hold' and r.expires_at > now() then
    if b.parent_booking_id is null then
      update public.reservations set kind = 'booking', expires_at = null where id = r.id;
    else
      -- A change payment adds no capacity; the parent's slot stays.
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
-- Wrappers, grants, RLS
-- ---------------------------------------------------------------------------
create function public.request_quote(p_offer uuid, p_note text default null, p_diagnostic_booking uuid default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.request_quote(p_offer, p_note, p_diagnostic_booking) $$;
create function public.issue_quote_version(p_quote uuid, p_lines jsonb, p_duration integer, p_valid_days integer default 7, p_note text default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.issue_quote_version(p_quote, p_lines, p_duration, p_valid_days, p_note) $$;
create function public.approve_quote_version(p_version uuid, p_starts_at timestamptz default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.approve_quote_version(p_version, p_starts_at) $$;
create function public.start_change_quote(p_booking uuid, p_note text default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.start_change_quote(p_booking, p_note) $$;
create function public.decline_quote(p_quote uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.decline_quote(p_quote) $$;

do $$ declare t text; begin
  foreach t in array array['quotes','quote_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
create policy quotes_customer_select on public.quotes for select to authenticated using (customer_id = (select auth.uid()));
create policy quotes_org_select on public.quotes for select to authenticated using ((select private.is_org_member(organisation_id)));
create policy quotes_admin_select on public.quotes for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy quote_versions_customer_select on public.quote_versions for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and q.customer_id = (select auth.uid())));
create policy quote_versions_org_select on public.quote_versions for select to authenticated using ((select private.is_org_member(organisation_id)));
create policy quote_versions_admin_select on public.quote_versions for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));

revoke all on function
  private.quote_version_guard(), private.request_quote(uuid, text, uuid),
  private.issue_quote_version(uuid, jsonb, integer, integer, text), private.approve_quote_version(uuid, timestamptz),
  private.place_change_hold(uuid, integer), private.start_change_quote(uuid, text), private.decline_quote(uuid),
  public.request_quote(uuid, text, uuid), public.issue_quote_version(uuid, jsonb, integer, integer, text),
  public.approve_quote_version(uuid, timestamptz), public.start_change_quote(uuid, text), public.decline_quote(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  private.request_quote(uuid, text, uuid), private.issue_quote_version(uuid, jsonb, integer, integer, text),
  private.approve_quote_version(uuid, timestamptz), private.start_change_quote(uuid, text), private.decline_quote(uuid),
  public.request_quote(uuid, text, uuid), public.issue_quote_version(uuid, jsonb, integer, integer, text),
  public.approve_quote_version(uuid, timestamptz), public.start_change_quote(uuid, text), public.decline_quote(uuid)
  to authenticated;
