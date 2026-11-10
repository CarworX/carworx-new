-- P2-2: bounded server search (Claude 19, D-081). Two capability-owned
-- SECURITY DEFINER functions and one login role that can only call the wrapper.
-- Neither `api` nor `private` is exposed through PostgREST ([api].schemas).

create schema api;
revoke all on schema api from public;

-- The eligibility helper may also filter on the public service slug, so the
-- bounded LIMIT applies after every filter (no gaps when a service is chosen).
grant select(service_slug) on public.listings to listing_eligibility;

-- Mobile coverage: reads private geometry, returns only public listing IDs.
-- Order and the keyset cursor are applied before LIMIT. The caller passes a
-- point already rounded to the coarse discovery grid.
create function private.mobile_eligible_ids(
  p_lat double precision,
  p_lng double precision,
  p_service text,
  p_after uuid,
  p_limit integer
) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.public_id
  from public.service_areas a
  join public.listings l on l.public_id = a.listing_public_id
  where l.status = 'live' and l.mode = 'mobile'
    and p_lat between -90 and 90 and p_lng between -180 and 180
    and (p_service is null or l.service_slug = p_service)
    and (p_after is null or l.public_id > p_after)
    and 2 * 6371.0088 * asin(least(1.0, sqrt(
          power(sin(radians(a.centre_latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(a.centre_latitude))
            * power(sin(radians(a.centre_longitude - p_lng) / 2), 2)
        ))) <= a.radius_km
  order by l.public_id
  limit least(greatest(coalesce(p_limit, 0), 0), 21)
$$;

-- Public wrapper: validates every input, rounds, pages each group separately.
-- Fixed rows carry a 0.1 km straight-line bucket from the public pin; mobile
-- rows carry no location and no distance.
create function api.search_listings(
  p_lat double precision,
  p_lng double precision,
  p_service text,
  p_radius integer,
  p_group text,
  p_after_bucket integer,
  p_after_id uuid,
  p_limit integer
) returns table (
  public_id uuid,
  display_name text,
  description text,
  metro text,
  mode text,
  service_slug text,
  service_name text,
  category_slug text,
  category_name text,
  public_address text,
  public_latitude double precision,
  public_longitude double precision,
  verification_labels text[],
  distance_bucket integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  if p_lat is null or p_lng is null
     or not (p_lat between -35 and -22) or not (p_lng between 16 and 33)
     or p_radius is null or p_radius not in (5, 10, 25, 50)
     or p_limit is null or not (p_limit between 1 and 21)
     or p_group is null or p_group not in ('fixed', 'mobile')
     or (p_service is not null and p_service !~ '^[a-z][a-z0-9-]{0,79}$')
     or (p_group = 'mobile' and p_after_bucket is not null)
     or (p_group = 'fixed' and (p_after_bucket is null) <> (p_after_id is null))
     or (p_after_bucket is not null and not (p_after_bucket between 0 and 500))
  then
    raise exception 'invalid search input' using errcode = '22023';
  end if;

  if p_group = 'fixed' then
    v_lat := round(p_lat::numeric, 3)::double precision;
    v_lng := round(p_lng::numeric, 3)::double precision;
    return query
    with candidates as (
      select p.*, 2 * 6371.0088 * asin(least(1.0, sqrt(
          power(sin(radians(p.public_latitude - v_lat) / 2), 2)
          + cos(radians(v_lat)) * cos(radians(p.public_latitude))
            * power(sin(radians(p.public_longitude - v_lng) / 2), 2)
        ))) as km
      from public.listing_public p
      where p.mode = 'fixed'
        and (p_service is null or p.service_slug = p_service)
    ), ranked as (
      select c.*, floor(c.km * 10)::integer as bucket
      from candidates c
      where c.km <= p_radius
    )
    select r.public_id, r.display_name, r.description, r.metro, r.mode,
      r.service_slug, r.service_name, r.category_slug, r.category_name,
      r.public_address, r.public_latitude, r.public_longitude,
      r.verification_labels, r.bucket
    from ranked r
    where p_after_bucket is null or (r.bucket, r.public_id) > (p_after_bucket, p_after_id)
    order by r.bucket, r.public_id
    limit p_limit;
  else
    v_lat := round(p_lat::numeric, 2)::double precision;
    v_lng := round(p_lng::numeric, 2)::double precision;
    return query
    select p.public_id, p.display_name, p.description, p.metro, p.mode,
      p.service_slug, p.service_name, p.category_slug, p.category_name,
      null::text, null::double precision, null::double precision,
      p.verification_labels, null::integer
    from private.mobile_eligible_ids(v_lat, v_lng, p_service, p_after_id, p_limit) e(id)
    join public.listing_public p on p.public_id = e.id
    where p.mode = 'mobile'
    order by p.public_id
    limit p_limit;
  end if;
end $$;

comment on function api.search_listings(double precision, double precision, text, integer, text, integer, uuid, integer) is
  'P2-2 wrapper. Only catalogue_server may execute. Returns projection columns only; mobile rows have no location or distance.';

revoke all on function private.mobile_eligible_ids(double precision, double precision, text, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function api.search_listings(double precision, double precision, text, integer, text, integer, uuid, integer)
  from public, anon, authenticated, service_role;

-- Call chain (granted before ownership transfer; ACLs carry over): catalogue_server -> api wrapper (as listing_projection) -> helper
-- (as listing_eligibility). Nothing else is granted to either caller.
grant usage on schema private to listing_projection;
grant execute on function private.mobile_eligible_ids(double precision, double precision, text, uuid, integer)
  to listing_projection;
grant usage on schema api to catalogue_server;
grant execute on function api.search_listings(double precision, double precision, text, integer, text, integer, uuid, integer)
  to catalogue_server;

-- Transfer ownership to the capability roles (same pattern as P2-1).
grant create on schema private to listing_eligibility;
grant create on schema api to listing_projection;
grant listing_eligibility to postgres with set true, inherit false;
grant listing_projection to postgres with set true, inherit false;
alter function private.mobile_eligible_ids(double precision, double precision, text, uuid, integer)
  owner to listing_eligibility;
alter function api.search_listings(double precision, double precision, text, integer, text, integer, uuid, integer)
  owner to listing_projection;
grant listing_eligibility to postgres with set false, inherit false;
grant listing_projection to postgres with set false, inherit false;
revoke create on schema private from listing_eligibility;
revoke create on schema api from listing_projection;

-- The scoped server credential. No password ships here: private test tooling
-- sets a synthetic one locally; the owner sets the hosted one with VALID UNTIL.
alter role catalogue_server login connection limit 10;
