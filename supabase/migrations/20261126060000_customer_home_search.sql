-- K6: rating summaries and comes-to-you in the bounded search projection.
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
  p_q text,
  p_comes_to_you boolean
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
  browse_rank integer,
  rating_avg numeric,
  rating_count integer
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
  if p_comes_to_you is null or p_limit is null or not (p_limit between 1 and 21)
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
        and (not p_comes_to_you or p.mode in ('mobile','both'))
        and (v_pattern is null or p.display_name ilike v_pattern escape '\'
             or p.service_name ilike v_pattern escape '\')
    )
    select r.public_id, r.display_name, r.description, r.metro, r.mode,
      r.service_slug, r.service_name, r.category_slug, r.category_name,
      r.public_address, r.public_latitude, r.public_longitude,
      r.verification_labels, null::integer, r.rank, r.rating_avg, r.rating_count
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
      where p.mode in ('fixed','both') and not p_comes_to_you
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
      r.verification_labels, r.bucket, null::integer, r.rating_avg, r.rating_count
    from ranked r
    where p_after_bucket is null or (r.bucket, r.public_id) > (p_after_bucket, p_after_id)
    order by r.bucket, r.public_id
    limit p_limit;
  else
    -- Same expression and point as the fixed group above.
    select coalesce(array_agg(p.public_id), '{}') into v_exclude
    from public.listing_public p
    where p.mode = 'both' and not p_comes_to_you
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
      p.verification_labels, null::integer, null::integer, p.rating_avg, p.rating_count
    from private.mobile_eligible_ids(v_lat, v_lng, v_services, v_exclude, v_only, p_after_id, p_limit) e(id)
    join public.listing_public p on p.public_id = e.id
    where p.mode in ('mobile','both')
    order by p.public_id
    limit p_limit;
  end if;
end $$;

revoke all on function api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text,boolean)
  from public, anon, authenticated, service_role;
grant execute on function api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text,boolean)
  to catalogue_server;
grant create on schema api to listing_projection;
grant listing_projection to postgres with set true, inherit true;
alter function api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text,boolean) owner to listing_projection;

create or replace function api.search_listings(
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
language sql stable security definer set search_path = '' as $$
  select s.public_id,s.display_name,s.description,s.metro,s.mode,s.service_slug,s.service_name,
    s.category_slug,s.category_name,s.public_address,s.public_latitude,s.public_longitude,
    s.verification_labels,s.distance_bucket,s.browse_rank
  from api.search_listings(p_lat,p_lng,p_service,p_category,p_radius,p_group,p_after_bucket,p_after_id,p_limit,p_q,false) s
$$;
grant listing_projection to postgres with set false, inherit false;
revoke create on schema api from listing_projection;
