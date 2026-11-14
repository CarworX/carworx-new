-- Opening hours per day (Claude 26). No table changes: listing_hours already
-- stores one row per day (1 = Monday) and clean_hours already validates a
-- per-day list. This adds:
--   1. the edit path after listing: private.set_listing_hours (owner or
--      manager only), with a public invoker wrapper;
--   2. the public read: api.listing_hours, owned by listing_projection, live
--      listings only, executable by catalogue_server only (the
--      api.search_listings pattern). anon still cannot read listing_hours.
-- One period per day in v1 and no midnight crossing (Claude 26 §2).

-- ---------------------------------------------------------------------------
-- 1. Edit hours after listing
-- ---------------------------------------------------------------------------
-- Writes only the difference, so the catalogue_audit trigger records one
-- audit row per changed day (with the actor) and nothing for unchanged days.
-- Hours apply immediately: they are structured values with no free text, so
-- they don't go back through admin review (Claude 26 §4b).
create function private.set_listing_hours(p_listing uuid, p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_org uuid; v jsonb;
begin
  if auth.uid() is null or p_listing is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select l.organisation_id into v_org from public.listings l where l.public_id = p_listing for update;
  -- An unknown listing and someone else's listing fail the same way.
  if not found or not private.has_org_role(v_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v := private.clean_hours(p);
  delete from public.listing_hours h
    where h.listing_public_id = p_listing
      and not exists (select from jsonb_array_elements(v) e where (e->>'day')::smallint = h.day);
  insert into public.listing_hours(listing_public_id, organisation_id, day, opens, closes)
    select p_listing, v_org, (e->>'day')::smallint, (e->>'opens')::time, (e->>'closes')::time
    from jsonb_array_elements(v) e
  on conflict (listing_public_id, day) do update
    set opens = excluded.opens, closes = excluded.closes
    where (public.listing_hours.opens, public.listing_hours.closes)
      is distinct from (excluded.opens, excluded.closes);
end $$;

create function public.set_listing_hours(p_listing uuid, p jsonb) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_listing_hours(p_listing, p) $$;

revoke all on function private.set_listing_hours(uuid, jsonb), public.set_listing_hours(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.set_listing_hours(uuid, jsonb), public.set_listing_hours(uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Public read for live listings
-- ---------------------------------------------------------------------------
-- The projection owner may read the day and times only (no row or
-- organisation IDs), and only for live listings.
grant select (listing_public_id, day, opens, closes) on public.listing_hours to listing_projection;
create policy catalogue_projection on public.listing_hours for select to listing_projection
  using (exists (select from public.listings l where l.public_id = listing_hours.listing_public_id and l.status = 'live'));

create function api.listing_hours(p_listing uuid)
returns table (day smallint, opens text, closes text)
language sql stable security definer set search_path = '' as $$
  select h.day, pg_catalog.to_char(h.opens, 'HH24:MI'), pg_catalog.to_char(h.closes, 'HH24:MI')
  from public.listing_hours h
  join public.listings l on l.public_id = h.listing_public_id and l.status = 'live'
  where h.listing_public_id = p_listing
  order by h.day
  limit 7
$$;
comment on function api.listing_hours(uuid) is
  'Claude 26. Only catalogue_server may execute. Day (1 = Monday) and HH:MM times of a live listing; nothing for any other status.';

revoke all on function api.listing_hours(uuid) from public, anon, authenticated, service_role;
-- Granted before the ownership transfer; ACLs carry over.
grant execute on function api.listing_hours(uuid) to catalogue_server;

grant create on schema api to listing_projection;
grant listing_projection to postgres with set true, inherit false;
alter function api.listing_hours(uuid) owner to listing_projection;
grant listing_projection to postgres with set false, inherit false;
revoke create on schema api from listing_projection;
