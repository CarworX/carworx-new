-- O2 (Claude 23 §3, §7, §9, §10): onboarding data model. SYNTHETIC DATA ONLY.
--
-- * Mode 'both' (premises AND comes to you). A both-listing has a public
--   premises branch and a private service area.
-- * Search: a both-listing is in the FIXED group when its premises is within
--   the radius, otherwise in the MOBILE group through its private area, and
--   never in both. listing_eligibility still cannot read branches: the
--   projection owner computes the fixed-qualifying set and passes it in.
-- * Server-side application drafts, invites, team settings, staff profiles,
--   listing services (pick all that apply) and opening hours.
--
-- Boundary (as P2-4): every new table is SELECT-only for clients; writes go
-- through the SECURITY DEFINER functions below (owner postgres, search_path
-- ''), each reached through a SECURITY INVOKER wrapper in public. listing_public
-- keeps its exact columns. Audit rows for new tables carry no details.
--
-- Location provenance (§9): coordinates only ever come from the provider's own
-- pin tap or device location. There is no column for a geocoder result.
--
-- Errors: 42501 not_allowed, 22023 invalid_input, P0001 fixed message keys.

-- ---------------------------------------------------------------------------
-- 1. Mode 'both'
-- ---------------------------------------------------------------------------
alter table public.listings drop constraint listings_mode_check;
alter table public.listings add constraint listings_mode_check check (mode in ('fixed','mobile','both'));
alter table public.listings drop constraint listings_check1;
alter table public.listings add constraint listings_branch_by_mode check ((mode in ('fixed','both')) = (branch_public_id is not null));
alter table public.service_areas drop constraint service_areas_listing_mode_check;
alter table public.service_areas add constraint service_areas_listing_mode_check check (listing_mode in ('mobile','both'));

-- Capability policies follow the premises (fixed, both) and the private area
-- (mobile, both). Column grants are unchanged.
drop policy catalogue_projection on public.branches;
create policy catalogue_projection on public.branches for select to listing_projection
  using (exists(select from public.listings l where l.branch_public_id = branches.public_id and l.mode in ('fixed','both') and l.status = 'live'));
drop policy catalogue_eligibility on public.listings;
create policy catalogue_eligibility on public.listings for select to listing_eligibility
  using (status = 'live' and mode in ('mobile','both'));
drop policy catalogue_eligibility on public.service_areas;
create policy catalogue_eligibility on public.service_areas for select to listing_eligibility
  using (exists(select from public.listings l where l.public_id = service_areas.listing_public_id and l.status = 'live' and l.mode in ('mobile','both')));

-- ---------------------------------------------------------------------------
-- 2. listing_public: same columns; the premises is public for fixed AND both.
-- ---------------------------------------------------------------------------
grant listing_projection to postgres with set true, inherit true;
create or replace view public.listing_public with (security_invoker = false, security_barrier = true) as
select l.public_id, l.display_name, l.description, l.metro, l.mode,
  s.slug as service_slug, s.name as service_name, c.slug as category_slug, c.name as category_name,
  case when l.mode in ('fixed','both') then b.public_address end as public_address,
  case when l.mode in ('fixed','both') then b.public_latitude end as public_latitude,
  case when l.mode in ('fixed','both') then b.public_longitude end as public_longitude,
  array(select case v.method when 'identity_checked' then 'Identity checked'
    when 'business_details_checked' then 'Business details checked' when 'premises_visited' then 'Premises visited' end
    from public.verifications v where v.listing_public_id = l.public_id and v.revoked_at is null and v.verified_at <= now() order by v.method) as verification_labels
from public.listings l
join public.services s on s.slug = l.service_slug
join public.categories c on c.slug = s.category_slug
left join public.branches b on b.public_id = l.branch_public_id
where l.status = 'live';
grant listing_projection to postgres with set false, inherit false;

-- ---------------------------------------------------------------------------
-- 3. Search with 'both' (§10). api.search_listings keeps its signature.
-- ---------------------------------------------------------------------------
drop function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer);
drop function private.mobile_eligible_ids(double precision, double precision, text[], uuid, integer);

-- Coarse discovery eligibility at the 2-decimal point (unchanged rule), now
-- for mobile and both, minus the both-listings that are already in the fixed
-- group (p_exclude, computed by the projection owner from public premises).
create function private.mobile_eligible_ids(
  p_lat double precision,
  p_lng double precision,
  p_services text[],
  p_exclude uuid[],
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
  v_services text[];
  v_exclude uuid[];
begin
  if p_lat is null or p_lng is null
     or not (p_lat between -35 and -22) or not (p_lng between 16 and 33)
     or p_radius is null or p_radius not in (5, 10, 25, 50)
     or p_limit is null or not (p_limit between 1 and 21)
     or p_group is null or p_group not in ('fixed', 'mobile')
     or (p_service is not null and p_service !~ '^[a-z][a-z0-9-]{0,79}$')
     or (p_category is not null and p_category !~ '^[a-z][a-z0-9-]{0,79}$')
     or (p_service is not null and p_category is not null)
     or (p_group = 'mobile' and p_after_bucket is not null)
     or (p_group = 'fixed' and (p_after_bucket is null) <> (p_after_id is null))
     or (p_after_bucket is not null and not (p_after_bucket between 0 and 500))
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
    v_lat := round(p_lat::numeric, 2)::double precision;
    v_lng := round(p_lng::numeric, 2)::double precision;
    return query
    select p.public_id, p.display_name, p.description, p.metro, p.mode,
      p.service_slug, p.service_name, p.category_slug, p.category_name,
      null::text, null::double precision, null::double precision,
      p.verification_labels, null::integer
    from private.mobile_eligible_ids(v_lat, v_lng, v_services, v_exclude, p_after_id, p_limit) e(id)
    join public.listing_public p on p.public_id = e.id
    where p.mode in ('mobile','both')
    order by p.public_id
    limit p_limit;
  end if;
end $$;

comment on function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer) is
  'O2 wrapper. Only catalogue_server may execute. Projection columns only; mobile-group rows (mobile or both) have no location or distance; a both-listing is in exactly one group.';

revoke all on function private.mobile_eligible_ids(double precision, double precision, text[], uuid[], uuid, integer) from public, anon, authenticated, service_role;
revoke all on function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function private.mobile_eligible_ids(double precision, double precision, text[], uuid[], uuid, integer) to listing_projection;
grant execute on function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer) to catalogue_server;

grant create on schema private to listing_eligibility;
grant create on schema api to listing_projection;
grant listing_eligibility to postgres with set true, inherit false;
grant listing_projection to postgres with set true, inherit false;
alter function private.mobile_eligible_ids(double precision, double precision, text[], uuid[], uuid, integer) owner to listing_eligibility;
alter function api.search_listings(double precision, double precision, text, text, integer, text, integer, uuid, integer) owner to listing_projection;
grant listing_eligibility to postgres with set false, inherit false;
grant listing_projection to postgres with set false, inherit false;
revoke create on schema private from listing_eligibility;
revoke create on schema api from listing_projection;

-- ---------------------------------------------------------------------------
-- 4. Admin review: the premises label is allowed for fixed AND both (§7).
--    Everything else is unchanged from P2-4.
-- ---------------------------------------------------------------------------
create or replace function private.admin_decide_application(
  p_listing uuid, p_decision text, p_method text, p_labels text[], p_evidence text, p_reason text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin(); v_l public.listings; v_labels text[]; v_evidence text; v_reason text; v_label text;
begin
  if p_decision is null or p_decision not in ('approve','reject') then perform private.bad_input(); end if;
  select * into v_l from public.listings where public_id = p_listing for update;
  if not found then perform private.bad_input(); end if;
  if v_l.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  if p_decision = 'reject' then
    v_reason := private.clean_text(p_reason, 5, 500);
    update public.listings set status = 'draft' where public_id = p_listing;
    insert into public.listing_decisions(listing_public_id, organisation_id, decision, reason, decided_by)
      values (p_listing, v_l.organisation_id, 'rejected', v_reason, v_admin);
    return;
  end if;
  v_labels := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_labels, '{}')) x), '{}');
  if p_method is null or p_method not in ('phone_call','video_call','document_check','registry_check','site_visit')
     or not (v_labels <@ array['identity_checked','business_details_checked','premises_visited'])
     or ('premises_visited' = any (v_labels) and v_l.mode not in ('fixed','both')) then
    perform private.bad_input();
  end if;
  if cardinality(v_labels) > 0 then v_evidence := private.clean_text(p_evidence, 3, 200); end if;
  if p_reason is not null then v_reason := private.clean_text(p_reason, 5, 500); end if;
  update public.listings set status = 'live' where public_id = p_listing;
  foreach v_label in array v_labels loop
    insert into public.verifications(organisation_id, listing_public_id, method, verified_by, evidence_reference)
      values (v_l.organisation_id, p_listing, v_label, v_admin, v_evidence)
      on conflict (listing_public_id, method) do update
        set verified_at = now(), verified_by = excluded.verified_by, evidence_reference = excluded.evidence_reference, revoked_at = null;
  end loop;
  insert into public.listing_decisions(listing_public_id, organisation_id, decision, review_method, labels, reason, decided_by)
    values (p_listing, v_l.organisation_id, 'approved', p_method, v_labels, v_reason, v_admin);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Organisation settings. No client column grants: set_team_settings only.
--    team_mfa_policy stays 'optional' until O7 ships its enforcement (§8).
-- ---------------------------------------------------------------------------
alter table public.organisations
  add column team_size_band text check (team_size_band in ('solo','2-5','6-15','16+')),
  add column trading_since date check (trading_since >= date '1900-01-01'),
  add column assign_mode text not null default 'business' check (assign_mode in ('customer','business')),
  add column offer_anyone boolean not null default false,
  add column staff_contact_visibility text not null default 'booking_only'
    check (staff_contact_visibility in ('phone','first_name','booking_only')),
  add column team_mfa_policy text not null default 'optional' check (team_mfa_policy in ('optional','managers','everyone')),
  -- Bumped whenever ownership changes (claims, dispute reversals, any owner
  -- membership change). An invite only works in the generation it was made in.
  add column control_generation integer not null default 0;

-- A composite key for staff_profiles' organisation-bound foreign key.
alter table public.memberships add constraint memberships_id_org_key unique (id, organisation_id);

-- ---------------------------------------------------------------------------
-- 6. New tables (SELECT-only for clients; audited with empty details)
-- ---------------------------------------------------------------------------
create table public.listing_services (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null,
  organisation_id uuid not null,
  service_slug text not null references public.services(slug),
  position smallint not null check (position between 0 and 7),
  unique (listing_public_id, service_slug),
  unique (listing_public_id, position),
  foreign key (listing_public_id, organisation_id) references public.listings(public_id, organisation_id) on delete cascade
);
create index listing_services_org_idx on public.listing_services(organisation_id);
comment on table public.listing_services is 'Pick all that apply. Position 0 is the main service and always equals listings.service_slug, so search and listing_public are unchanged.';

create table public.listing_hours (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null,
  organisation_id uuid not null,
  day smallint not null check (day between 1 and 7),
  opens time not null,
  closes time not null,
  check (closes > opens),
  unique (listing_public_id, day),
  foreign key (listing_public_id, organisation_id) references public.listings(public_id, organisation_id) on delete cascade
);
create index listing_hours_org_idx on public.listing_hours(organisation_id);
comment on table public.listing_hours is 'Opening hours; 1 = Monday. Public for live listings from O3 (owner, 2026-11-12) through a separate projection; no anon read yet.';

create table public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id),
  step smallint not null default 1 check (step between 1 and 12),
  business_name text check (length(business_name) between 2 and 160),
  service_slugs text[] not null default '{}' check (cardinality(service_slugs) <= 8),
  mode text check (mode in ('fixed','mobile','both')),
  metro text check (length(metro) between 2 and 120),
  description text check (length(description) between 10 and 2000),
  public_address text check (length(public_address) between 5 and 300),
  pin_lat double precision check (pin_lat between -35 and -22),
  pin_lng double precision check (pin_lng between 16 and 33),
  pin_source text check (pin_source in ('tap','device')),
  radius_km integer check (radius_km between 1 and 100),
  hours jsonb not null default '[]' check (jsonb_typeof(hours) = 'array' and jsonb_array_length(hours) <= 7),
  team_size_band text check (team_size_band in ('solo','2-5','6-15','16+')),
  trading_since date check (trading_since >= date '1900-01-01'),
  applicant_role text check (applicant_role in ('owner','manager','other')),
  adult_attested_at timestamptz,
  probing_notice_ack_at timestamptz,
  probing_notice_version text check (probing_notice_version ~ '^[a-z0-9.-]{1,40}$'),
  submitted_at timestamptz,
  submitted_listing_public_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pin_lat is null) = (pin_lng is null) and (pin_lat is null) = (pin_source is null)),
  check (submitted_at is null or (adult_attested_at is not null and submitted_listing_public_id is not null and organisation_id is not null))
);
-- One open draft per person; submitted applications are kept as context.
create unique index provider_applications_open_idx on public.provider_applications(user_id) where submitted_at is null;
create index provider_applications_org_idx on public.provider_applications(organisation_id);
comment on table public.provider_applications is 'Server-side application draft and the context kept after submit. No date of birth or ID number (D-088). Pins come only from a tap or the device; never a geocoder result (§9).';

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  role text not null check (role in ('manager','staff')),
  token_hash bytea not null unique check (length(token_hash) = 32),
  email text check (length(email) <= 254),
  created_by uuid not null references auth.users(id),
  control_generation integer not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users(id),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days'),
  check ((used_at is null) = (used_by is null))
);
create index invites_org_idx on public.invites(organisation_id, created_at);
comment on table public.invites is 'Single-use, 7-day team invites. Only a SHA-256 of the token is stored, and no client role can read it.';

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique,
  organisation_id uuid not null,
  first_name text check (length(first_name) between 1 and 60),
  service_slugs text[] not null default '{}' check (cardinality(service_slugs) <= 16),
  days smallint[] not null default '{}' check (days <@ array[1,2,3,4,5,6,7]::smallint[]),
  updated_at timestamptz not null default now(),
  foreign key (membership_id, organisation_id) references public.memberships(id, organisation_id) on delete cascade
);
create index staff_profiles_org_idx on public.staff_profiles(organisation_id);
comment on table public.staff_profiles is 'Organisation-internal. first_name may be shown publicly only when the organisation assign_mode is customer (Bookings, later).';

do $$ declare t text; begin
  foreach t in array array['listing_services','listing_hours','provider_applications','invites','staff_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role, listing_projection, listing_eligibility, catalogue_server, forms_server', t);
    execute format('create policy onboarding_admin_select on public.%I for select to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin()))', t);
    execute format('create trigger catalogue_audit after insert or update or delete on public.%I for each row execute function private.write_catalogue_audit()', t);
  end loop;
end $$;
grant select on public.listing_services, public.listing_hours, public.provider_applications, public.staff_profiles to authenticated;
-- Never the token hash.
grant select (id, organisation_id, role, email, created_by, created_at, expires_at, used_at, used_by) on public.invites to authenticated;

create policy listing_services_member_select on public.listing_services for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager','staff'])));
create policy listing_hours_member_select on public.listing_hours for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager','staff'])));
create policy staff_profiles_member_select on public.staff_profiles for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager','staff'])));
create policy invites_manager_select on public.invites for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager'])));
create policy provider_applications_own_select on public.provider_applications for select to authenticated
  using (user_id = (select auth.uid()));

-- Position 0 mirrors listings.service_slug, in both directions. The guards
-- stop the two triggers from re-firing each other.
create function private.sync_main_service_from_list() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.position = 0 then
    update public.listings set service_slug = new.service_slug
      where public_id = new.listing_public_id and service_slug is distinct from new.service_slug;
  end if;
  return null;
end $$;
create trigger listing_services_main after insert or update on public.listing_services
  for each row execute function private.sync_main_service_from_list();

create function private.sync_main_service_from_listing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.listing_services set service_slug = new.service_slug
    where listing_public_id = new.public_id and position = 0 and service_slug is distinct from new.service_slug;
  return null;
end $$;
create trigger listings_main_service after update of service_slug on public.listings
  for each row execute function private.sync_main_service_from_listing();
revoke all on function private.sync_main_service_from_list(), private.sync_main_service_from_listing()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Helpers
-- ---------------------------------------------------------------------------
-- Service slugs: 1..p_max distinct, existing, order kept (first = main).
create function private.clean_services(p jsonb, p_max integer) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare v text[];
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) not between 1 and p_max
     or exists (select from jsonb_array_elements(p) e where jsonb_typeof(e) <> 'string') then
    perform private.bad_input();
  end if;
  select array_agg(e order by o) into v from jsonb_array_elements_text(p) with ordinality x(e, o);
  if cardinality(v) <> (select count(distinct x) from unnest(v) x)
     or exists (select from unnest(v) x where not exists (select from public.services s where s.slug = x)) then
    perform private.bad_input();
  end if;
  return v;
end $$;

-- Opening hours: up to 7 {day 1..7, opens HH:MM, closes HH:MM} with closes
-- after opens and no repeated day. Returned normalised and sorted by day.
create function private.clean_hours(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 7
     or exists (select from jsonb_array_elements(p) e
                where jsonb_typeof(e) <> 'object'
                   or (select count(*) from jsonb_object_keys(e)) <> 3
                   or not (e ? 'day' and e ? 'opens' and e ? 'closes')
                   or jsonb_typeof(e->'day') <> 'number' or (e->>'day') !~ '^[1-7]$'
                   or coalesce(e->>'opens', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                   or coalesce(e->>'closes', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                   or (e->>'closes')::time <= (e->>'opens')::time) then
    perform private.bad_input();
  end if;
  if (select count(distinct e->>'day') from jsonb_array_elements(p) e) <> jsonb_array_length(p) then
    perform private.bad_input();
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('day', (e->>'day')::int, 'opens', e->>'opens', 'closes', e->>'closes')
           order by (e->>'day')::int), '[]') into v
  from jsonb_array_elements(p) e;
  return v;
end $$;

-- base64url of 32 random bytes, and its SHA-256.
create function private.invite_token_hash(p_token text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
$$;

revoke all on function private.clean_services(jsonb, integer), private.clean_hours(jsonb), private.invite_token_hash(text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Provider application: draft, then submit (replaces provider_apply,
--    which is kept unchanged for one release).
-- ---------------------------------------------------------------------------
create function private.provider_save_draft(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v public.provider_applications;
  k text;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or pg_catalog.pg_column_size(p) > 16384 then perform private.bad_input(); end if;
  -- Only known keys. A geocoder field has nowhere to go (§9).
  for k in select jsonb_object_keys(p) loop
    if k not in ('step','business_name','service_slugs','mode','metro','description','public_address',
                 'pin','radius_km','hours','team_size_band','trading_since','applicant_role') then
      perform private.bad_input();
    end if;
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(172906, pg_catalog.hashtext(v_uid::text));
  select * into v from public.provider_applications where user_id = v_uid and submitted_at is null for update;
  if not found then
    v.id := gen_random_uuid(); v.user_id := v_uid; v.step := 1; v.service_slugs := '{}'; v.hours := '[]';
    v.created_at := now();
  end if;

  -- A present key with a null value clears that field.
  if p ? 'step' then
    if jsonb_typeof(p->'step') <> 'number' or (p->>'step') !~ '^[0-9]{1,2}$' or (p->>'step')::int not between 1 and 12 then
      perform private.bad_input();
    end if;
    v.step := (p->>'step')::smallint;
  end if;
  if p ? 'business_name' then
    v.business_name := case when p->'business_name' = 'null' then null else private.clean_text(p->>'business_name', 2, 160) end;
  end if;
  if p ? 'service_slugs' then
    v.service_slugs := case when p->'service_slugs' = '[]' then '{}' else private.clean_services(p->'service_slugs', 8) end;
  end if;
  if p ? 'mode' then
    if p->'mode' <> 'null' and coalesce(p->>'mode', '') not in ('fixed','mobile','both') then perform private.bad_input(); end if;
    v.mode := p->>'mode';
  end if;
  if p ? 'metro' then
    v.metro := case when p->'metro' = 'null' then null else private.clean_text(p->>'metro', 2, 120) end;
  end if;
  if p ? 'description' then
    v.description := case when p->'description' = 'null' then null else private.clean_multiline(p->>'description', 10, 2000) end;
  end if;
  if p ? 'public_address' then
    v.public_address := case when p->'public_address' = 'null' then null else private.clean_text(p->>'public_address', 5, 300) end;
  end if;
  if p ? 'pin' then
    if p->'pin' = 'null' then
      v.pin_lat := null; v.pin_lng := null; v.pin_source := null;
    elsif jsonb_typeof(p->'pin') <> 'object' or (select count(*) from jsonb_object_keys(p->'pin')) <> 3
       or jsonb_typeof(p->'pin'->'lat') <> 'number' or jsonb_typeof(p->'pin'->'lng') <> 'number'
       or coalesce(p->'pin'->>'source', '') not in ('tap','device')
       or not ((p->'pin'->>'lat')::double precision between -35 and -22)
       or not ((p->'pin'->>'lng')::double precision between 16 and 33) then
      perform private.bad_input();
    else
      v.pin_lat := (p->'pin'->>'lat')::double precision;
      v.pin_lng := (p->'pin'->>'lng')::double precision;
      v.pin_source := p->'pin'->>'source';
    end if;
  end if;
  if p ? 'radius_km' then
    if p->'radius_km' <> 'null' and (jsonb_typeof(p->'radius_km') <> 'number' or (p->>'radius_km') !~ '^[0-9]{1,3}$'
       or (p->>'radius_km')::int not between 1 and 100) then
      perform private.bad_input();
    end if;
    v.radius_km := (p->>'radius_km')::int;
  end if;
  if p ? 'hours' then v.hours := private.clean_hours(p->'hours'); end if;
  if p ? 'team_size_band' then
    if p->'team_size_band' <> 'null' and coalesce(p->>'team_size_band', '') not in ('solo','2-5','6-15','16+') then perform private.bad_input(); end if;
    v.team_size_band := p->>'team_size_band';
  end if;
  if p ? 'trading_since' then
    if p->'trading_since' <> 'null' and (coalesce(p->>'trading_since', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or (p->>'trading_since') !~ '^(19|20)' ) then
      perform private.bad_input();
    end if;
    begin
      v.trading_since := (p->>'trading_since')::date;
    exception when others then perform private.bad_input();
    end;
    if v.trading_since > current_date then perform private.bad_input(); end if;
  end if;
  if p ? 'applicant_role' then
    if p->'applicant_role' <> 'null' and coalesce(p->>'applicant_role', '') not in ('owner','manager','other') then perform private.bad_input(); end if;
    v.applicant_role := p->>'applicant_role';
  end if;
  v.updated_at := now();

  insert into public.provider_applications values (v.*)
  on conflict (id) do update set
    step = excluded.step, business_name = excluded.business_name, service_slugs = excluded.service_slugs,
    mode = excluded.mode, metro = excluded.metro, description = excluded.description,
    public_address = excluded.public_address, pin_lat = excluded.pin_lat, pin_lng = excluded.pin_lng,
    pin_source = excluded.pin_source, radius_km = excluded.radius_km, hours = excluded.hours,
    team_size_band = excluded.team_size_band, trading_since = excluded.trading_since,
    applicant_role = excluded.applicant_role, updated_at = excluded.updated_at;
  return v.id;
end $$;

create function private.provider_submit(p_adult boolean, p_probing_ack boolean, p_notice text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v public.provider_applications;
  v_org uuid; v_source uuid; v_branch uuid; v_listing uuid; v_slug text; v_pos integer; v_h jsonb;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- 18+ is a yes, never a date of birth (D-088).
  perform private.require_consent(p_adult, p_notice);

  perform pg_catalog.pg_advisory_xact_lock(172906, pg_catalog.hashtext(v_uid::text));
  select * into v from public.provider_applications where user_id = v_uid and submitted_at is null for update;
  if not found then raise exception 'no_draft' using errcode = 'P0001'; end if;

  if v.business_name is null or v.metro is null or v.description is null or v.mode is null
     or cardinality(v.service_slugs) = 0 or v.applicant_role is null or v.pin_lat is null
     or (v.mode in ('fixed','both') and v.public_address is null)
     or (v.mode = 'mobile' and v.public_address is not null)
     or (v.mode in ('mobile','both') and v.radius_km is null)
     or (v.mode = 'fixed' and v.radius_km is not null) then
    raise exception 'draft_incomplete' using errcode = 'P0001';
  end if;
  -- Someone determined could work out roughly where a mobile base is: the
  -- provider must have been told (probing-risk M1).
  if v.mode in ('mobile','both') then perform private.require_consent(p_probing_ack, p_notice); end if;

  if exists (select from public.listings l join public.memberships m on m.organisation_id = l.organisation_id
             where m.user_id = v_uid and m.status = 'active' and m.role = 'owner' and l.status = 'submitted') then
    raise exception 'application_pending' using errcode = 'P0001';
  end if;

  insert into public.organisations(name, team_size_band, trading_since)
    values (v.business_name, v.team_size_band, v.trading_since) returning id into v_org;
  insert into public.memberships(organisation_id, user_id, role, status) values (v_org, v_uid, 'owner', 'active');
  insert into public.coordinate_sources(organisation_id, source_kind, licence_note)
    values (v_org, 'provider_supplied', case v.pin_source
      when 'tap' then 'Pin tapped by the provider on the map in their application; no geocoding result stored'
      else 'Device location shared by the provider in their application; no geocoding result stored' end)
    returning id into v_source;
  if v.mode in ('fixed','both') then
    insert into public.branches(organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id)
      values (v_org, v.business_name, v.public_address, v.pin_lat, v.pin_lng, v_source) returning public_id into v_branch;
  end if;
  insert into public.listings(organisation_id, service_slug, branch_public_id, display_name, description, metro, mode,
      status, provenance_kind, provenance_reference, submitted_at)
    values (v_org, v.service_slugs[1], v_branch, v.business_name, v.description, v.metro, v.mode,
      'submitted', 'provider_application', 'Signed-in provider application', now())
    returning public_id into v_listing;
  v_pos := 0;
  foreach v_slug in array v.service_slugs loop
    insert into public.listing_services(listing_public_id, organisation_id, service_slug, position)
      values (v_listing, v_org, v_slug, v_pos);
    v_pos := v_pos + 1;
  end loop;
  if v.mode in ('mobile','both') then
    -- For both, the base is the premises pin (already public); for mobile it is private.
    insert into public.service_areas(listing_public_id, listing_mode, organisation_id, centre_latitude, centre_longitude, radius_km, coordinate_source_id)
      values (v_listing, v.mode, v_org, v.pin_lat, v.pin_lng, v.radius_km, v_source);
  end if;
  for v_h in select * from jsonb_array_elements(private.clean_hours(v.hours)) loop
    insert into public.listing_hours(listing_public_id, organisation_id, day, opens, closes)
      values (v_listing, v_org, (v_h->>'day')::smallint, (v_h->>'opens')::time, (v_h->>'closes')::time);
  end loop;

  update public.provider_applications set
    organisation_id = v_org, submitted_at = now(), submitted_listing_public_id = v_listing,
    adult_attested_at = now(),
    probing_notice_ack_at = case when v.mode in ('mobile','both') then now() end,
    probing_notice_version = p_notice, updated_at = now()
  where id = v.id;
  return v_listing;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Team: invites, settings, staff profiles
-- ---------------------------------------------------------------------------
-- Owners invite managers or staff; managers invite staff only (owner,
-- 2026-11-12). Nobody invites an owner. Returns the token once.
create function private.create_invite(p_org uuid, p_role text, p_email text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_email text; v_token text;
begin
  if v_uid is null or p_org is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('manager','staff') then perform private.bad_input(); end if;
  perform from public.organisations where id = p_org for update;
  if not (private.has_org_role(p_org, array['owner'])
          or (p_role = 'staff' and private.has_org_role(p_org, array['manager']))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_email is not null then v_email := private.clean_email(p_email); end if;
  if (select count(*) from public.invites i where i.organisation_id = p_org and i.used_at is null and i.expires_at > now()) >= 50 then
    raise exception 'invite_limit' using errcode = 'P0001';
  end if;
  v_token := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.invites(organisation_id, role, token_hash, email, created_by, control_generation)
    values (p_org, p_role, private.invite_token_hash(v_token), v_email, v_uid,
      (select o.control_generation from public.organisations o where o.id = p_org));
  return v_token;
end $$;

-- Unknown, expired, used and wrong-email tokens all fail the same way, and so
-- does an invite whose authority is gone: ownership changed since it was made
-- (claim approved, dispute reversed: Codex P1 on #79), or its creator no
-- longer holds the role that could make it. Lock order as P2-4: the
-- organisation row first, then the invite, then memberships.
create function private.accept_invite(p_token text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_i public.invites; v_email text; v_m public.memberships; v_gen integer;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  select i.organisation_id into v_org from public.invites i where i.token_hash = private.invite_token_hash(p_token);
  if not found then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  select o.control_generation into v_gen from public.organisations o where o.id = v_org for update;
  select * into v_i from public.invites where token_hash = private.invite_token_hash(p_token) for update;
  if not found or v_i.used_at is not null or v_i.expires_at <= now() or v_i.control_generation <> v_gen
     or not exists (select from public.memberships c
                    where c.organisation_id = v_org and c.user_id = v_i.created_by and c.status = 'active'
                      and (c.role = 'owner' or (c.role = 'manager' and v_i.role = 'staff'))) then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  if v_i.email is not null then
    select pg_catalog.lower(u.email) into v_email from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;
    if v_email is distinct from v_i.email then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  end if;
  select * into v_m from public.memberships where organisation_id = v_org and user_id = v_uid for update;
  if found and v_m.status = 'active' then raise exception 'already_member' using errcode = 'P0001'; end if;
  if found then
    update public.memberships set role = v_i.role, status = 'active' where id = v_m.id;
  else
    insert into public.memberships(organisation_id, user_id, role, status) values (v_org, v_uid, v_i.role, 'active');
  end if;
  update public.invites set used_at = now(), used_by = v_uid where id = v_i.id;
  return v_org;
end $$;

-- Any change that touches an owner membership (added, removed, revoked,
-- restored, promoted or demoted) starts a new control generation, which
-- voids every invite made before it. Fires for client writes and for the
-- P2-4 claim and dispute functions alike.
create function private.bump_control_generation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.role = 'owner' then
      update public.organisations set control_generation = control_generation + 1 where id = new.organisation_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.role = 'owner' then
      update public.organisations set control_generation = control_generation + 1 where id = old.organisation_id;
    end if;
  elsif (old.role = 'owner' or new.role = 'owner') and (old.role, old.status) is distinct from (new.role, new.status) then
    update public.organisations set control_generation = control_generation + 1 where id = new.organisation_id;
  end if;
  return null;
end $$;
revoke all on function private.bump_control_generation() from public, anon, authenticated, service_role;
create trigger memberships_control_generation after insert or update or delete on public.memberships
  for each row execute function private.bump_control_generation();

-- The owner sets everything; a manager only who gets the booking.
create function private.set_team_settings(p_org uuid, p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_owner boolean; k text; v public.organisations;
begin
  if v_uid is null or p_org is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform private.bad_input(); end if;
  select * into v from public.organisations where id = p_org for update;
  v_owner := private.has_org_role(p_org, array['owner']);
  if not found or not (v_owner or private.has_org_role(p_org, array['manager'])) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('team_size_band','trading_since','assign_mode','offer_anyone','staff_contact_visibility','team_mfa_policy') then
      perform private.bad_input();
    end if;
    if not v_owner and k not in ('assign_mode','offer_anyone') then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end loop;
  if p ? 'team_size_band' then
    if p->'team_size_band' <> 'null' and coalesce(p->>'team_size_band', '') not in ('solo','2-5','6-15','16+') then perform private.bad_input(); end if;
    v.team_size_band := p->>'team_size_band';
  end if;
  if p ? 'trading_since' then
    if p->'trading_since' <> 'null' and coalesce(p->>'trading_since', '') !~ '^(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$' then perform private.bad_input(); end if;
    begin
      v.trading_since := (p->>'trading_since')::date;
    exception when others then perform private.bad_input();
    end;
    if v.trading_since > current_date then perform private.bad_input(); end if;
  end if;
  if p ? 'assign_mode' then
    if coalesce(p->>'assign_mode', '') not in ('customer','business') then perform private.bad_input(); end if;
    v.assign_mode := p->>'assign_mode';
  end if;
  if p ? 'offer_anyone' then
    if jsonb_typeof(p->'offer_anyone') <> 'boolean' then perform private.bad_input(); end if;
    v.offer_anyone := (p->>'offer_anyone')::boolean;
  end if;
  if p ? 'staff_contact_visibility' then
    if coalesce(p->>'staff_contact_visibility', '') not in ('phone','first_name','booking_only') then perform private.bad_input(); end if;
    v.staff_contact_visibility := p->>'staff_contact_visibility';
  end if;
  if p ? 'team_mfa_policy' then
    if coalesce(p->>'team_mfa_policy', '') not in ('optional','managers','everyone') then perform private.bad_input(); end if;
    -- No policy can switch on before O7 ships its enforcement (§8).
    if p->>'team_mfa_policy' <> 'optional' then raise exception 'not_yet_available' using errcode = 'P0001'; end if;
    v.team_mfa_policy := p->>'team_mfa_policy';
  end if;
  update public.organisations set team_size_band = v.team_size_band, trading_since = v.trading_since,
    assign_mode = v.assign_mode, offer_anyone = v.offer_anyone,
    staff_contact_visibility = v.staff_contact_visibility, team_mfa_policy = v.team_mfa_policy
  where id = p_org;
end $$;

-- The owner or a manager of the organisation, or the staff member themself.
create function private.set_staff_profile(p_membership uuid, p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_m public.memberships; v public.staff_profiles; k text;
begin
  if v_uid is null or p_membership is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform private.bad_input(); end if;
  select * into v_m from public.memberships where id = p_membership and status = 'active';
  if not found or not (v_m.user_id = v_uid or private.has_org_role(v_m.organisation_id, array['owner','manager'])) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('first_name','service_slugs','days') then perform private.bad_input(); end if;
  end loop;
  select * into v from public.staff_profiles where membership_id = p_membership for update;
  if not found then
    v.id := gen_random_uuid(); v.membership_id := p_membership; v.organisation_id := v_m.organisation_id;
    v.service_slugs := '{}'; v.days := '{}';
  end if;
  if p ? 'first_name' then
    v.first_name := case when p->'first_name' = 'null' then null else private.clean_text(p->>'first_name', 1, 60) end;
  end if;
  if p ? 'service_slugs' then
    v.service_slugs := case when p->'service_slugs' = '[]' then '{}' else private.clean_services(p->'service_slugs', 16) end;
  end if;
  if p ? 'days' then
    if jsonb_typeof(p->'days') <> 'array' or jsonb_array_length(p->'days') > 7
       or exists (select from jsonb_array_elements(p->'days') e where e::text !~ '^[1-7]$') then
      perform private.bad_input();
    end if;
    select coalesce(array_agg(distinct e::text::smallint order by e::text::smallint), '{}') into v.days
      from jsonb_array_elements(p->'days') e;
  end if;
  v.updated_at := now();
  insert into public.staff_profiles values (v.*)
  on conflict (id) do update set first_name = excluded.first_name, service_slugs = excluded.service_slugs,
    days = excluded.days, updated_at = excluded.updated_at;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Grants and public wrappers (SECURITY INVOKER; authenticated only)
-- ---------------------------------------------------------------------------
revoke all on function
  private.provider_save_draft(jsonb),
  private.provider_submit(boolean, boolean, text),
  private.create_invite(uuid, text, text),
  private.accept_invite(text),
  private.set_team_settings(uuid, jsonb),
  private.set_staff_profile(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function
  private.provider_save_draft(jsonb),
  private.provider_submit(boolean, boolean, text),
  private.create_invite(uuid, text, text),
  private.accept_invite(text),
  private.set_team_settings(uuid, jsonb),
  private.set_staff_profile(uuid, jsonb)
  to authenticated;

create function public.provider_save_draft(p jsonb) returns uuid
language sql volatile security invoker set search_path = '' as $$ select private.provider_save_draft(p) $$;
create function public.provider_submit(p_adult boolean, p_probing_ack boolean, p_notice text) returns uuid
language sql volatile security invoker set search_path = '' as $$ select private.provider_submit(p_adult, p_probing_ack, p_notice) $$;
create function public.create_invite(p_org uuid, p_role text, p_email text) returns text
language sql volatile security invoker set search_path = '' as $$ select private.create_invite(p_org, p_role, p_email) $$;
create function public.accept_invite(p_token text) returns uuid
language sql volatile security invoker set search_path = '' as $$ select private.accept_invite(p_token) $$;
create function public.set_team_settings(p_org uuid, p jsonb) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_team_settings(p_org, p) $$;
create function public.set_staff_profile(p_membership uuid, p jsonb) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_staff_profile(p_membership, p) $$;

revoke all on function
  public.provider_save_draft(jsonb),
  public.provider_submit(boolean, boolean, text),
  public.create_invite(uuid, text, text),
  public.accept_invite(text),
  public.set_team_settings(uuid, jsonb),
  public.set_staff_profile(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function
  public.provider_save_draft(jsonb),
  public.provider_submit(boolean, boolean, text),
  public.create_invite(uuid, text, text),
  public.accept_invite(text),
  public.set_team_settings(uuid, jsonb),
  public.set_staff_profile(uuid, jsonb)
  to authenticated;
