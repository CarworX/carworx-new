-- D-097 PR A: keyword search and browsing without a location.
--
-- api.search_listings gains two optional trailing arguments:
--   p_q      business or service name words (2-60 characters), matched with a
--            case-insensitive substring on live listings only;
--   (group)  'all': no location at all. Every live listing, newest verified
--            first (whole days), then public ID. No distance is returned.
-- The 9-argument call keeps working (p_q defaults to null), so the Worker
-- that is live today is unaffected until it is redeployed.
--
-- Same owners, grants and bounds as before: only catalogue_server may execute
-- the wrapper; it runs as listing_projection and reads only the projection
-- (listing_public) and the eligibility helper. The helper still sees no names:
-- the wrapper resolves name matches to public IDs first (p_only), the same way
-- it already passes p_exclude.

drop function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer);
drop function private.mobile_eligible_ids(double precision, double precision, text[], uuid[], uuid, integer);

create function private.mobile_eligible_ids(
  p_lat double precision,
  p_lng double precision,
  p_services text[],
  p_exclude uuid[],
  p_only uuid[],
  p_after uuid,
  p_limit integer
) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.public_id
  from public.service_areas a
  join public.listings l on l.public_id = a.listing_public_id
  where l.status = 'live' and l.mode in ('mobile','both')
    and p_lat between -90 and 90 and p_lng between -180 and 180
    and (p_services is null or l.service_slug = any(p_services))
    and not (l.public_id = any(coalesce(p_exclude, '{}'::uuid[])))
    and (p_only is null or l.public_id = any(p_only))
    and (p_after is null or l.public_id > p_after)
    and 2 * 6371.0088 * asin(least(1.0, sqrt(
          power(sin(radians(a.centre_latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(a.centre_latitude))
            * power(sin(radians(a.centre_longitude - p_lng) / 2), 2)
        ))) <= a.radius_km
  order by l.public_id
  limit least(greatest(coalesce(p_limit, 0), 0), 21)
$$;

create function api.search_listings(
  p_lat double precision,
  p_lng double precision,
  p_service text,
  p_category text,
  p_radius integer,
  p_group text,
  p_after_bucket integer,
  p_after_id uuid,
  p_limit integer,
  p_q text default null
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
  distance_bucket integer,
  browse_rank integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_services text[];
  v_exclude uuid[];
  v_only uuid[];
  v_pattern text;
begin
  if p_limit is null or not (p_limit between 1 and 21)
     or p_group is null or p_group not in ('fixed', 'mobile', 'all')
     or (p_service is not null and p_service !~ '^[a-z][a-z0-9-]{0,79}$')
     or (p_category is not null and p_category !~ '^[a-z][a-z0-9-]{0,79}$')
     or (p_service is not null and p_category is not null)
     -- The server allows letters, digits and a few marks; here: bounded,
     -- trimmed and free of control characters.
     or (p_q is not null and (char_length(p_q) not between 2 and 60
         or p_q ~ '[[:cntrl:]]' or p_q <> btrim(p_q)))
     -- Located groups: a South African point and a known radius.
     or (p_group <> 'all' and (p_lat is null or p_lng is null
         or not (p_lat between -35 and -22) or not (p_lng between 16 and 33)
         or p_radius is null or p_radius not in (5, 10, 25, 50)))
     or (p_group = 'mobile' and p_after_bucket is not null)
     or (p_group = 'fixed' and (p_after_bucket is null) <> (p_after_id is null))
     or (p_group = 'fixed' and p_after_bucket is not null and not (p_after_bucket between 0 and 500))
     -- Browsing: no location at all; the cursor is (verified day, public ID).
     or (p_group = 'all' and (p_lat is not null or p_lng is not null or p_radius is not null))
     or (p_group = 'all' and (p_after_bucket is null) <> (p_after_id is null))
     or (p_group = 'all' and p_after_bucket is not null and not (p_after_bucket between 0 and 1000000))
  then
    raise exception 'invalid search input' using errcode = '22023';
  end if;

  -- A category covers its own services and those of its subcategories.
  if p_service is not null then
    v_services := array[p_service];
  elsif p_category is not null then
    select coalesce(array_agg(s.slug), '{}') into v_services
    from public.services s join public.categories c on c.slug = s.category_slug
    where c.slug = p_category or c.parent_slug = p_category;
  end if;

  -- Name words match as plain text: LIKE wildcards are escaped.
  if p_q is not null then
    v_pattern := '%' || replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  if p_group = 'all' then
    return query
    with ranked as (
      select p.*, coalesce((
          select floor(extract(epoch from max(v.verified_at)) / 86400)::integer
          from public.verifications v
          where v.listing_public_id = p.public_id and v.revoked_at is null and v.verified_at <= now()
        ), 0) as rank
      from public.listing_public p
      where (v_services is null or p.service_slug = any(v_services))
        and (v_pattern is null or p.display_name ilike v_pattern escape '\'
             or p.service_name ilike v_pattern escape '\')
    )
    select r.public_id, r.display_name, r.description, r.metro, r.mode,
      r.service_slug, r.service_name, r.category_slug, r.category_name,
      r.public_address, r.public_latitude, r.public_longitude,
      r.verification_labels, null::integer, r.rank
    from ranked r
    where p_after_bucket is null or r.rank < p_after_bucket
       or (r.rank = p_after_bucket and r.public_id > p_after_id)
    order by r.rank desc, r.public_id
    limit p_limit;
    return;
  end if;

  -- The fixed group's point (3 decimals) decides fixed membership in both
  -- groups, so a both-listing is never in both.
  v_lat := round(p_lat::numeric, 3)::double precision;
  v_lng := round(p_lng::numeric, 3)::double precision;

  if p_group = 'fixed' then
    return query
    with candidates as (
      select p.*, 2 * 6371.0088 * asin(least(1.0, sqrt(
          power(sin(radians(p.public_latitude - v_lat) / 2), 2)
          + cos(radians(v_lat)) * cos(radians(p.public_latitude))
            * power(sin(radians(p.public_longitude - v_lng) / 2), 2)
        ))) as km
      from public.listing_public p
      where p.mode in ('fixed','both')
        and (v_services is null or p.service_slug = any(v_services))
        and (v_pattern is null or p.display_name ilike v_pattern escape '\'
             or p.service_name ilike v_pattern escape '\')
    ), ranked as (
      select c.*, floor(c.km * 10)::integer as bucket
      from candidates c
      where c.km <= p_radius
    )
    select r.public_id, r.display_name, r.description, r.metro, r.mode,
      r.service_slug, r.service_name, r.category_slug, r.category_name,
      r.public_address, r.public_latitude, r.public_longitude,
      r.verification_labels, r.bucket, null::integer
    from ranked r
    where p_after_bucket is null or (r.bucket, r.public_id) > (p_after_bucket, p_after_id)
    order by r.bucket, r.public_id
    limit p_limit;
  else
    -- Same expression and point as the fixed group above.
    select coalesce(array_agg(p.public_id), '{}') into v_exclude
    from public.listing_public p
    where p.mode = 'both'
      and (v_services is null or p.service_slug = any(v_services))
      and 2 * 6371.0088 * asin(least(1.0, sqrt(
          power(sin(radians(p.public_latitude - v_lat) / 2), 2)
          + cos(radians(v_lat)) * cos(radians(p.public_latitude))
            * power(sin(radians(p.public_longitude - v_lng) / 2), 2)
        ))) <= p_radius;
    -- Name matches are resolved here, so the helper never reads names.
    if v_pattern is not null then
      select coalesce(array_agg(p.public_id), '{}') into v_only
      from public.listing_public p
      where p.mode in ('mobile','both')
        and (p.display_name ilike v_pattern escape '\' or p.service_name ilike v_pattern escape '\');
    end if;
    v_lat := round(p_lat::numeric, 2)::double precision;
    v_lng := round(p_lng::numeric, 2)::double precision;
    return query
    select p.public_id, p.display_name, p.description, p.metro, p.mode,
      p.service_slug, p.service_name, p.category_slug, p.category_name,
      null::text, null::double precision, null::double precision,
      p.verification_labels, null::integer, null::integer
    from private.mobile_eligible_ids(v_lat, v_lng, v_services, v_exclude, v_only, p_after_id, p_limit) e(id)
    join public.listing_public p on p.public_id = e.id
    where p.mode in ('mobile','both')
    order by p.public_id
    limit p_limit;
  end if;
end $$;

comment on function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer, text) is
  'D-097 wrapper. Only catalogue_server may execute. Projection columns only; optional name words (p_q); group all browses without a location (no distance); mobile-group rows have no location or distance; a both-listing is in exactly one located group.';

revoke all on function private.mobile_eligible_ids(double precision, double precision, text[], uuid[], uuid[], uuid, integer) from public, anon, authenticated, service_role;
revoke all on function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer, text) from public, anon, authenticated, service_role;
grant execute on function private.mobile_eligible_ids(double precision, double precision, text[], uuid[], uuid[], uuid, integer) to listing_projection;
grant execute on function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer, text) to catalogue_server;

grant create on schema private to listing_eligibility;
grant create on schema api to listing_projection;
grant listing_eligibility to postgres with set true, inherit false;
grant listing_projection to postgres with set true, inherit false;
alter function private.mobile_eligible_ids(double precision, double precision, text[], uuid[], uuid[], uuid, integer) owner to listing_eligibility;
alter function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer, text) owner to listing_projection;
grant listing_eligibility to postgres with set false, inherit false;
grant listing_projection to postgres with set false, inherit false;
revoke create on schema private from listing_eligibility;
revoke create on schema api from listing_projection;
