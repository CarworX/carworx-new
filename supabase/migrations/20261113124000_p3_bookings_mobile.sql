-- Phase 3, Claude lane, slices C5 + C6: mobile jobs, address privacy, staff
-- assignment and membership revocation (PLAN §6.5; A30, A31, A34).
-- Travel: straight-line distance bands from the listing's service-area
-- centre, labelled as straight-line. The provider confirms the travel buffer
-- before accepting; it is part of the reserved interval. There is no routing
-- service, so every mobile request is accepted manually (PLAN §6.5).
-- Address: the provider sees only the suburb until the booking is
-- confirmed; then the full address is readable only by staff assigned to
-- the job, through one audited function; hidden 7 days after completion.
-- Access is checked on every read, so a revoked membership loses it at once.

alter table public.bookings
  add column mobile boolean not null default false,
  add column travel_minutes integer not null default 0 check (travel_minutes between 0 and 240),
  add column travel_charge_minor bigint not null default 0 check (travel_charge_minor >= 0),
  add column distance_km numeric(6,1) check (distance_km is null or distance_km >= 0),
  -- Coarse, shown to the provider before confirmation.
  add column suburb text check (suburb is null or length(suburb) between 2 and 80);

create table public.travel_bands (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  listing_public_id uuid not null,
  up_to_km numeric(6,1) not null check (up_to_km > 0 and up_to_km <= 250),
  travel_minutes integer not null check (travel_minutes between 0 and 240 and travel_minutes % 5 = 0),
  charge_minor bigint not null default 0 check (charge_minor between 0 and 10000000),
  unique (listing_public_id, up_to_km),
  foreign key (listing_public_id, organisation_id) references public.listings(public_id, organisation_id) on delete cascade
);

-- Full address for a mobile job. No client grants at all: read only through
-- private.job_address(). Deleted under the retention schedule (90 days
-- after completion, PLAN §9.3, row "Customer addresses").
create table private.booking_addresses (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  address text not null check (length(address) between 5 and 300),
  access_notes text check (access_notes is null or length(access_notes) <= 300),
  -- No coordinates: they come from Mapbox temporary geocoding, which may not
  -- be stored (A17, D-082). They are used once for the distance, then dropped.
  created_at timestamptz not null default now()
);
revoke all on private.booking_addresses from public, anon, authenticated, service_role;

-- Which staff do a job. Only active memberships of the booking's
-- organisation; checked again on every address read (A34).
create table public.booking_assignments (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  organisation_id uuid not null,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (booking_id, membership_id)
);

-- Straight-line (haversine) distance in km.
create function private.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 2 * 6371.0088 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- ---------------------------------------------------------------------------
-- Customer: request a mobile booking. Distance picks the band; the band's
-- travel time is added to the interval and its charge to the price.
-- ---------------------------------------------------------------------------
create function private.request_mobile_booking(
  p_offer uuid, p_starts_at timestamptz, p_suburb text, p_address text, p_latitude double precision,
  p_longitude double precision, p_access_notes text default null, p_note text default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare o record; a record; band record; v_km double precision; v_accept_by timestamptz; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select so.* into o from public.service_offers so
    join public.listings l on l.public_id = so.listing_public_id and l.status = 'live' and l.mode in ('mobile','both')
  where so.id = p_offer and so.active and so.pricing = 'fixed';
  if not found then raise exception 'offer_unavailable' using errcode = 'P0001'; end if;
  select * into a from public.service_areas where listing_public_id = o.listing_public_id;
  if not found then raise exception 'offer_unavailable' using errcode = 'P0001'; end if;
  if p_latitude not between -35 and -22 or p_longitude not between 16 and 33 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_km := private.km_between(a.centre_latitude, a.centre_longitude, p_latitude, p_longitude);
  if v_km > a.radius_km then raise exception 'outside_area' using errcode = 'P0001'; end if;
  select * into band from public.travel_bands
  where listing_public_id = o.listing_public_id and up_to_km >= v_km order by up_to_km limit 1;
  v_accept_by := private.add_business_minutes(now(), 120);
  if p_starts_at is null or p_starts_at < v_accept_by + interval '15 minutes' then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  insert into public.bookings(organisation_id, customer_id, offer_id, during, accept_by, amount_minor, customer_note,
                              mobile, travel_minutes, travel_charge_minor, distance_km, suburb)
  values (o.organisation_id, auth.uid(), o.id,
          tstzrange(p_starts_at, p_starts_at + make_interval(mins => o.duration_minutes + o.buffer_minutes + coalesce(band.travel_minutes, 0)), '[)'),
          v_accept_by, o.price_minor + coalesce(band.charge_minor, 0), nullif(btrim(p_note), ''),
          true, coalesce(band.travel_minutes, 0), coalesce(band.charge_minor, 0), round(v_km::numeric, 1), btrim(p_suburb))
  returning id into v_id;
  insert into private.booking_addresses(booking_id, address, access_notes)
  values (v_id, btrim(p_address), nullif(btrim(p_access_notes), ''));
  perform private.booking_log(v_id, 'requested', jsonb_build_object('mobile', true));
  return v_id;
end $$;

-- Provider confirms (or corrects) the travel buffer before accepting. The
-- start stays; the end moves. Any change of charge is shown to the customer
-- in the accepted booking before they pay (no hidden second charge).
create function private.set_travel_buffer(p_booking uuid, p_travel_minutes integer, p_charge_minor bigint default null)
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
    updated_at = now()
  where id = b.id;
  perform private.booking_log(b.id, 'travel_confirmed', jsonb_build_object('travel_minutes', p_travel_minutes));
end $$;

-- ---------------------------------------------------------------------------
-- Assignments (owner or manager assigns active staff of the organisation).
-- ---------------------------------------------------------------------------
create function private.assign_staff(p_booking uuid, p_membership uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b record;
begin
  select * into b from public.bookings where id = p_booking;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(b.organisation_id);
  if not exists (select 1 from public.memberships m where m.id = p_membership and m.organisation_id = b.organisation_id and m.status = 'active') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.booking_assignments(booking_id, membership_id, organisation_id, assigned_by)
  values (b.id, p_membership, b.organisation_id, auth.uid())
  on conflict do nothing;
  perform private.booking_log(b.id, 'staff_assigned');
end $$;

create function private.unassign_staff(p_booking uuid, p_membership uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b record;
begin
  select * into b from public.bookings where id = p_booking;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.require_org_manager(b.organisation_id);
  delete from public.booking_assignments where booking_id = b.id and membership_id = p_membership;
end $$;

-- ---------------------------------------------------------------------------
-- The only way to read a full address (A31, A34).
-- Assigned + active membership + booking confirmed (or completed less than
-- 7 days ago). aal2 admins may read it too; each admin read is logged.
-- ---------------------------------------------------------------------------
create function private.job_address(p_booking uuid)
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
  if v_admin and not v_allowed then
    -- audit_log only records writes; admin address reads go to the booking
    -- event feed with the admin's id, kept with the booking's history.
    perform private.booking_log(b.id, 'admin_address_read', jsonb_build_object('admin_id', auth.uid()));
  end if;
  return query select ad.address, ad.access_notes
    from private.booking_addresses ad where ad.booking_id = b.id;
end $$;

-- Staff "my jobs": bookings assigned to the caller through an active
-- membership. Revoking the membership empties this at once (A34).
create function private.my_jobs()
returns table(booking_id uuid, starts_at timestamptz, ends_at timestamptz, state text, suburb text, mobile boolean)
language sql stable security definer set search_path = '' as $$
  select b.id, lower(b.during), upper(b.during), b.state, b.suburb, b.mobile
  from public.bookings b
  join public.booking_assignments ba on ba.booking_id = b.id
  join public.memberships m on m.id = ba.membership_id
  where m.user_id = auth.uid() and m.status = 'active' and m.organisation_id = b.organisation_id
    and b.state in ('confirmed','completed')
  order by lower(b.during)
$$;

-- Bands are managed with the offers (owner or manager).
create function private.save_travel_band(p_org uuid, p_listing uuid, p_up_to_km numeric, p_minutes integer, p_charge_minor bigint)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_org_manager(p_org);
  insert into public.travel_bands(organisation_id, listing_public_id, up_to_km, travel_minutes, charge_minor)
  values (p_org, p_listing, p_up_to_km, p_minutes, coalesce(p_charge_minor, 0))
  on conflict (listing_public_id, up_to_km) do update set travel_minutes = excluded.travel_minutes, charge_minor = excluded.charge_minor
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Wrappers, grants, RLS
-- ---------------------------------------------------------------------------
create function public.request_mobile_booking(p_offer uuid, p_starts_at timestamptz, p_suburb text, p_address text,
  p_latitude double precision, p_longitude double precision, p_access_notes text default null, p_note text default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.request_mobile_booking(p_offer, p_starts_at, p_suburb, p_address, p_latitude, p_longitude, p_access_notes, p_note) $$;
create function public.set_travel_buffer(p_booking uuid, p_travel_minutes integer, p_charge_minor bigint default null)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.set_travel_buffer(p_booking, p_travel_minutes, p_charge_minor) $$;
create function public.assign_staff(p_booking uuid, p_membership uuid)
returns void language sql volatile security invoker set search_path = '' as $$ select private.assign_staff(p_booking, p_membership) $$;
create function public.unassign_staff(p_booking uuid, p_membership uuid)
returns void language sql volatile security invoker set search_path = '' as $$ select private.unassign_staff(p_booking, p_membership) $$;
create function public.job_address(p_booking uuid)
returns table(address text, access_notes text)
language sql volatile security invoker set search_path = '' as $$ select * from private.job_address(p_booking) $$;
create function public.my_jobs()
returns table(booking_id uuid, starts_at timestamptz, ends_at timestamptz, state text, suburb text, mobile boolean)
language sql stable security invoker set search_path = '' as $$ select * from private.my_jobs() $$;
create function public.save_travel_band(p_org uuid, p_listing uuid, p_up_to_km numeric, p_minutes integer, p_charge_minor bigint)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.save_travel_band(p_org, p_listing, p_up_to_km, p_minutes, p_charge_minor) $$;

do $$ declare t text; begin
  foreach t in array array['travel_bands','booking_assignments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
create policy travel_bands_member_select on public.travel_bands for select to authenticated
  using ((select private.is_org_member(organisation_id)));
create policy booking_assignments_member_select on public.booking_assignments for select to authenticated
  using ((select private.is_org_member(organisation_id)));

revoke all on function
  private.km_between(double precision, double precision, double precision, double precision),
  private.request_mobile_booking(uuid, timestamptz, text, text, double precision, double precision, text, text),
  private.set_travel_buffer(uuid, integer, bigint), private.assign_staff(uuid, uuid), private.unassign_staff(uuid, uuid),
  private.job_address(uuid), private.my_jobs(), private.save_travel_band(uuid, uuid, numeric, integer, bigint),
  public.request_mobile_booking(uuid, timestamptz, text, text, double precision, double precision, text, text),
  public.set_travel_buffer(uuid, integer, bigint), public.assign_staff(uuid, uuid), public.unassign_staff(uuid, uuid),
  public.job_address(uuid), public.my_jobs(), public.save_travel_band(uuid, uuid, numeric, integer, bigint)
  from public, anon, authenticated, service_role;
grant execute on function
  private.request_mobile_booking(uuid, timestamptz, text, text, double precision, double precision, text, text),
  private.set_travel_buffer(uuid, integer, bigint), private.assign_staff(uuid, uuid), private.unassign_staff(uuid, uuid),
  private.job_address(uuid), private.my_jobs(), private.save_travel_band(uuid, uuid, numeric, integer, bigint),
  public.request_mobile_booking(uuid, timestamptz, text, text, double precision, double precision, text, text),
  public.set_travel_buffer(uuid, integer, bigint), public.assign_staff(uuid, uuid), public.unassign_staff(uuid, uuid),
  public.job_address(uuid), public.my_jobs(), public.save_travel_band(uuid, uuid, numeric, integer, bigint)
  to authenticated;
