-- P2-1: synthetic catalogue foundation. No search RPC or hosted configuration.
-- Private row IDs/geometry never enter listing_public. Only admins at aal2 write.
do $$ begin
  if not exists (select from pg_roles where rolname = 'listing_projection') then
    create role listing_projection nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'listing_eligibility') then
    create role listing_eligibility nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'catalogue_server') then
    create role catalogue_server nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;
grant usage on schema public to listing_projection, listing_eligibility;
-- No authenticator membership, credentials or API schema is activated here.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{0,79}$'),
  name text not null check (length(name) between 1 and 120),
  parent_slug text references public.categories(slug),
  check (parent_slug is null or parent_slug <> slug)
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{0,79}$'),
  category_slug text not null references public.categories(slug),
  name text not null check (length(name) between 1 and 120)
);
create index services_category_idx on public.services(category_slug);

create table public.coordinate_sources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  source_kind text not null check (source_kind in ('provider_supplied','manual_verified','licensed_permanent')),
  licence_note text not null check (length(licence_note) between 1 and 500),
  captured_at timestamptz not null default now(),
  unique(id, organisation_id)
);
comment on table public.coordinate_sources is 'Private provenance. Temporary geocoding results are not accepted source types.';

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  name text not null check (length(name) between 1 and 160),
  public_address text not null check (length(public_address) between 1 and 300),
  public_latitude double precision not null check (public_latitude between -90 and 90),
  public_longitude double precision not null check (public_longitude between -180 and 180),
  coordinate_source_id uuid not null,
  unique(public_id, organisation_id),
  check (public_id <> id),
  foreign key(coordinate_source_id, organisation_id) references public.coordinate_sources(id, organisation_id)
);
create index branches_org_idx on public.branches(organisation_id);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  service_slug text not null references public.services(slug),
  branch_public_id uuid,
  display_name text not null check (length(display_name) between 1 and 160),
  description text not null check (length(description) between 1 and 2000),
  metro text not null check (length(metro) between 1 and 120),
  mode text not null check (mode in ('fixed','mobile')),
  status text not null default 'draft' check (status in ('draft','submitted','live','suspended')),
  provenance_kind text not null check (provenance_kind in ('provider_application','admin_import')),
  provenance_reference text not null check (length(provenance_reference) between 1 and 500),
  created_at timestamptz not null default now(),
  unique(public_id, organisation_id),
  unique(public_id, organisation_id, mode),
  check (public_id <> id),
  foreign key(branch_public_id, organisation_id) references public.branches(public_id, organisation_id),
  check ((mode = 'fixed' and branch_public_id is not null) or (mode = 'mobile' and branch_public_id is null))
);
create index listings_org_idx on public.listings(organisation_id);
create index listings_live_service_idx on public.listings(service_slug, public_id) where status = 'live';

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null unique,
  listing_mode text not null default 'mobile' check (listing_mode = 'mobile'),
  organisation_id uuid not null references public.organisations(id),
  centre_latitude double precision not null check (centre_latitude between -90 and 90),
  centre_longitude double precision not null check (centre_longitude between -180 and 180),
  radius_km double precision not null check (radius_km > 0 and radius_km <= 250),
  coordinate_source_id uuid not null,
  foreign key(listing_public_id, organisation_id, listing_mode) references public.listings(public_id, organisation_id, mode) on delete cascade,
  foreign key(coordinate_source_id, organisation_id) references public.coordinate_sources(id, organisation_id)
);
create index service_areas_org_idx on public.service_areas(organisation_id);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  listing_public_id uuid not null,
  method text not null check (method in ('identity_checked','business_details_checked','premises_visited')),
  verified_at timestamptz not null default now(),
  verified_by uuid not null references auth.users(id),
  evidence_reference text not null check (length(evidence_reference) between 1 and 500),
  revoked_at timestamptz,
  foreign key(listing_public_id, organisation_id) references public.listings(public_id, organisation_id) on delete cascade,
  unique(listing_public_id, method),
  check (revoked_at is null or revoked_at >= verified_at)
);
create index verifications_org_idx on public.verifications(organisation_id);

-- Private tables stay behind tenant membership and admin MFA. No client writes
-- are enabled for provider applications until the independently reviewed P2-4.
do $$ declare t text; begin
  foreach t in array array['categories','services','coordinate_sources','branches','listings','service_areas','verifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role, listing_projection, listing_eligibility, catalogue_server', t);
    execute format('grant select, insert, delete on public.%I to authenticated', t);
    execute format('create policy catalogue_admin_select on public.%I for select to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin()))',t);
    execute format('create policy catalogue_admin_insert on public.%I for insert to authenticated with check ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin()))',t);
    execute format('create policy catalogue_admin_update on public.%I for update to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin())) with check ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin()))',t);
    execute format('create policy catalogue_admin_delete on public.%I for delete to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin()))',t);
    if t not in ('categories','services','verifications') then
      execute format('create policy catalogue_member_select on public.%I for select to authenticated using ((select private.has_org_role(organisation_id, array[''owner'',''manager'',''staff''])))',t);
    end if;
  end loop;
end $$;
grant update(name, parent_slug) on public.categories to authenticated;
grant update(name, category_slug) on public.services to authenticated;
grant update(source_kind, licence_note) on public.coordinate_sources to authenticated;
grant update(name, public_address, public_latitude, public_longitude, coordinate_source_id) on public.branches to authenticated;
grant update(service_slug, branch_public_id, display_name, description, metro, mode, status, provenance_kind, provenance_reference) on public.listings to authenticated;
grant update(centre_latitude, centre_longitude, radius_km, coordinate_source_id) on public.service_areas to authenticated;
grant update(method, evidence_reference, revoked_at) on public.verifications to authenticated;

-- Dedicated projection owner: column grants and RLS both apply. Joins use
-- deliberately public keys, so this role cannot read private IDs or provenance.
grant select(slug, name) on public.categories to listing_projection;
grant select(slug, category_slug, name) on public.services to listing_projection;
grant select(public_id, name, public_address, public_latitude, public_longitude) on public.branches to listing_projection;
grant select(public_id, service_slug, branch_public_id, display_name, description, metro, mode, status) on public.listings to listing_projection;
grant select(listing_public_id, method, revoked_at, verified_at) on public.verifications to listing_projection;
create policy catalogue_projection on public.listings for select to listing_projection using (status = 'live');
create policy catalogue_projection on public.branches for select to listing_projection using (exists(select from public.listings l where l.branch_public_id = branches.public_id and l.mode = 'fixed' and l.status = 'live'));
create policy catalogue_projection on public.services for select to listing_projection using (exists(select from public.listings l where l.service_slug = services.slug and l.status = 'live'));
create policy catalogue_projection on public.categories for select to listing_projection using (exists(select from public.services s where s.category_slug = categories.slug));
create policy catalogue_projection on public.verifications for select to listing_projection using (revoked_at is null and verified_at <= now() and exists(select from public.listings l where l.public_id = verifications.listing_public_id and l.status = 'live'));

-- Separate capability for P2-2's bounded eligibility helper. No callable
-- function, role membership or exposed-schema change ships in this slice.
grant select(public_id, mode, status) on public.listings to listing_eligibility;
grant select(listing_public_id, centre_latitude, centre_longitude, radius_km) on public.service_areas to listing_eligibility;
create policy catalogue_eligibility on public.listings for select to listing_eligibility using (status = 'live' and mode = 'mobile');
create policy catalogue_eligibility on public.service_areas for select to listing_eligibility using (exists(select from public.listings l where l.public_id = service_areas.listing_public_id and l.status = 'live' and l.mode = 'mobile'));

create view public.listing_public with (security_invoker = false, security_barrier = true) as
select l.public_id, l.display_name, l.description, l.metro, l.mode,
  s.slug as service_slug, s.name as service_name, c.slug as category_slug, c.name as category_name,
  case when l.mode = 'fixed' then b.public_address end as public_address,
  case when l.mode = 'fixed' then b.public_latitude end as public_latitude,
  case when l.mode = 'fixed' then b.public_longitude end as public_longitude,
  array(select case v.method when 'identity_checked' then 'Identity checked'
    when 'business_details_checked' then 'Business details checked' when 'premises_visited' then 'Premises visited' end
    from public.verifications v where v.listing_public_id = l.public_id order by v.method) as verification_labels
from public.listings l
join public.services s on s.slug = l.service_slug
join public.categories c on c.slug = s.category_slug
left join public.branches b on b.public_id = l.branch_public_id
where l.status = 'live';
-- PostgreSQL requires CREATE on the containing schema to transfer ownership.
grant create on schema public to listing_projection;
-- Hosted/local postgres is CREATEROLE rather than a superuser. PG17's automatic
-- creator membership does not necessarily include SET, required for ownership transfer.
grant listing_projection to postgres with set true, inherit true;
alter view public.listing_public owner to listing_projection;
revoke create on schema public from listing_projection;
revoke all on public.listing_public from public, anon, authenticated, service_role;
grant select on public.listing_public to anon, authenticated, postgres;
comment on view public.listing_public is 'Exact public catalogue projection; no organisation/private row IDs, provenance, private centres, radius or base-derived distance. Free-text publication requires admin review.';
-- Finish owner-only ACL/comment work before dropping the temporary capability.
-- postgres retains SELECT on the public surface for dump/introspection tools.
grant listing_projection to postgres with set false, inherit false;

create function private.write_catalogue_audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare rec jsonb; begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.audit_log(actor_id, organisation_id, action, target_table, target_id, details)
  values(auth.uid(), (rec->>'organisation_id')::uuid, lower(tg_op), tg_table_name, rec->>'id', '{}'::jsonb);
  return null;
end $$;
revoke all on function private.write_catalogue_audit() from public, anon, authenticated, service_role;
do $$ declare t text; begin
  foreach t in array array['categories','services','coordinate_sources','branches','listings','service_areas','verifications'] loop
    execute format('create trigger catalogue_audit after insert or update or delete on public.%I for each row execute function private.write_catalogue_audit()',t);
  end loop;
end $$;
