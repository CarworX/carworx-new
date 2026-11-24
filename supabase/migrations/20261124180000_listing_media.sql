-- Finish-build PR 3 (D-098): one cover photo per listing, shown at once
-- (no pre-approval); an aal2 admin can take it down. Files live in the R2
-- bucket bound as MEDIA under a random key; this table only points at them.
--
-- * Owners and managers set or replace the cover through set_listing_cover.
--   The Worker has already sniffed the real type, stripped all metadata
--   (EXIF, GPS, XMP, ICC, comments, thumbnails) and stored the cleaned file.
-- * Replacing or removing a cover, or deleting its listing, queues the old
--   key in private.media_deletions. The daily retention run deletes those
--   files from MEDIA and confirms them here (claim/confirm, keys only).
-- * The public projection listing_public gains cover_key, so /p/:id, the
--   home list and the search cards show a cover as soon as it is set, and
--   only for live listings.
-- * Audit: every set, replace and removal writes public.audit_log with
--   states only (no reasons, PLAN section 9.1).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.listing_covers (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null unique references public.listings(public_id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  object_key text not null unique check (object_key ~ '^covers/[0-9a-f]{32}\.(jpg|png|webp)$'),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes between 1 and 5242880),
  width integer not null check (width between 1 and 6000),
  height integer not null check (height between 1 and 6000),
  check (width::bigint * height <= 40000000),
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index listing_covers_org_idx on public.listing_covers(organisation_id);
comment on table public.listing_covers is
  'One cover photo per listing (D-098). Points at a metadata-stripped file in R2 MEDIA. Shown at once on live listings; admins can remove it.';

create table private.media_deletions (
  object_key text primary key check (object_key ~ '^covers/[0-9a-f]{32}\.(jpg|png|webp)$'),
  reason text not null check (reason in ('replaced', 'removed', 'listing_deleted')),
  queued_at timestamptz not null default now(),
  claimed_at timestamptz
);
comment on table private.media_deletions is
  'R2 keys waiting for the daily retention run to delete them. Keys are random; no personal data.';

alter table public.listing_covers enable row level security;
-- Every table has RLS (00_catalog); with no policy, only definer functions reach it.
alter table private.media_deletions enable row level security;
revoke all on public.listing_covers from public, anon, authenticated, service_role,
  listing_projection, listing_eligibility, catalogue_server, forms_server, retention_server;
revoke all on private.media_deletions from public, anon, authenticated, service_role,
  listing_projection, listing_eligibility, catalogue_server, forms_server, retention_server;
grant select on public.listing_covers to authenticated;
create policy listing_covers_member_select on public.listing_covers for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager','staff'])));
create policy listing_covers_admin_select on public.listing_covers for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- 2. Audit and the deletion queue (triggers: every write path is covered)
-- ---------------------------------------------------------------------------
create function private.write_cover_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rec public.listing_covers; v_state text;
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  v_state := case tg_op when 'INSERT' then 'set' when 'UPDATE' then 'replaced' else 'removed' end;
  insert into public.audit_log(actor_id, organisation_id, action, target_table, target_id, details)
  values (auth.uid(), rec.organisation_id, lower(tg_op), 'listing_covers', rec.id::text,
    jsonb_build_object('listing_public_id', rec.listing_public_id, 'state', v_state,
      'by_admin', coalesce(private.is_platform_admin(), false)));
  return null;
end $$;
revoke all on function private.write_cover_audit() from public, anon, authenticated, service_role;
create trigger listing_covers_audit after insert or update or delete on public.listing_covers
  for each row execute function private.write_cover_audit();

create function private.queue_cover_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.object_key is distinct from new.object_key then
    insert into private.media_deletions(object_key, reason) values (old.object_key, 'replaced')
      on conflict (object_key) do nothing;
  elsif tg_op = 'DELETE' then
    insert into private.media_deletions(object_key, reason)
      values (old.object_key, case when exists (select from public.listings l where l.public_id = old.listing_public_id)
                                   then 'removed' else 'listing_deleted' end)
      on conflict (object_key) do nothing;
  end if;
  return null;
end $$;
revoke all on function private.queue_cover_deletion() from public, anon, authenticated, service_role;
create trigger listing_covers_queue_deletion after update or delete on public.listing_covers
  for each row execute function private.queue_cover_deletion();

-- ---------------------------------------------------------------------------
-- 3. Set or replace a cover (owners and managers of the listing's business)
-- ---------------------------------------------------------------------------
create function private.set_listing_cover(p_listing uuid, p_key text, p_type text,
  p_bytes integer, p_width integer, p_height integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid;
begin
  if v_uid is null or p_listing is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select l.organisation_id into v_org from public.listings l where l.public_id = p_listing;
  if not found or not private.has_org_role(v_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^covers/[0-9a-f]{32}\.(jpg|png|webp)$'
     or p_type is null or p_type not in ('image/jpeg','image/png','image/webp')
     or (p_type = 'image/jpeg') <> (p_key like '%.jpg')
     or (p_type = 'image/png') <> (p_key like '%.png')
     or p_bytes is null or p_bytes not between 1 and 5242880
     or p_width is null or p_width not between 1 and 6000
     or p_height is null or p_height not between 1 and 6000
     or p_width::bigint * p_height > 40000000 then
    perform private.bad_input();
  end if;
  perform from public.organisations where id = v_org for update;
  if not private.has_org_role(v_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- A retired key (queued for deletion) never becomes a cover again: the
  -- retention run would delete the live file (Codex review on #146).
  if exists (select from private.media_deletions d where d.object_key = p_key) then
    perform private.bad_input();
  end if;
  insert into public.listing_covers(listing_public_id, organisation_id, object_key, content_type, bytes, width, height, uploaded_by)
    values (p_listing, v_org, p_key, p_type, p_bytes, p_width, p_height, v_uid)
  on conflict (listing_public_id) do update set object_key = excluded.object_key,
    content_type = excluded.content_type, bytes = excluded.bytes, width = excluded.width,
    height = excluded.height, uploaded_by = excluded.uploaded_by, uploaded_at = now();
end $$;

-- The business removes its own cover.
create function private.remove_listing_cover(p_listing uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.uid() is null or p_listing is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select l.organisation_id into v_org from public.listings l where l.public_id = p_listing;
  if not found or not private.has_org_role(v_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.organisations where id = v_org for update;
  delete from public.listing_covers where listing_public_id = p_listing;
end $$;

-- An aal2 admin takes a cover down (D-098). Audited by the trigger with
-- by_admin = true. Returns false when the listing has no cover.
create function private.admin_remove_listing_cover(p_listing uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_listing is null then perform private.bad_input(); end if;
  delete from public.listing_covers where listing_public_id = p_listing;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Public projection: the current cover key of live listings
-- ---------------------------------------------------------------------------
-- The projection owner reads just the key, and only for live listings (the
-- verifications pattern); listings RLS for this role is already set up.
grant select (listing_public_id, object_key) on public.listing_covers to listing_projection;
create policy catalogue_projection on public.listing_covers for select to listing_projection
  using (exists (select from public.listings l where l.public_id = listing_public_id and l.status = 'live'));
-- Same pattern as onboarding: borrow the owner role only for the replace.
grant listing_projection to postgres with set true, inherit true;
create or replace view public.listing_public with (security_invoker = false, security_barrier = true) as
select l.public_id, l.display_name, l.description, l.metro, l.mode,
  s.slug as service_slug, s.name as service_name, c.slug as category_slug, c.name as category_name,
  case when l.mode in ('fixed','both') then b.public_address end as public_address,
  case when l.mode in ('fixed','both') then b.public_latitude end as public_latitude,
  case when l.mode in ('fixed','both') then b.public_longitude end as public_longitude,
  array(select case v.method when 'identity_checked' then 'Identity checked'
    when 'business_details_checked' then 'Business details checked' when 'premises_visited' then 'Premises visited' end
    from public.verifications v where v.listing_public_id = l.public_id and v.revoked_at is null and v.verified_at <= now() order by v.method) as verification_labels,
  (select lc.object_key from public.listing_covers lc where lc.listing_public_id = l.public_id) as cover_key
from public.listings l
join public.services s on s.slug = l.service_slug
join public.categories c on c.slug = s.category_slug
left join public.branches b on b.public_id = l.branch_public_id
where l.status = 'live';
grant listing_projection to postgres with set false, inherit false;

-- ---------------------------------------------------------------------------
-- 5. Retention: claim keys to delete from R2, then confirm them
-- ---------------------------------------------------------------------------
-- A claim older than an hour is offered again, so a run that died between
-- the R2 delete and the confirm is retried. Deleting a missing R2 key is a
-- no-op, so a repeat is harmless.
create function private.claim_media_deletions(p_limit integer) returns setof text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit not between 1 and 1000 then perform private.bad_input(); end if;
  return query
    update private.media_deletions d set claimed_at = now()
    where d.object_key in (select x.object_key from private.media_deletions x
                           where (x.claimed_at is null or x.claimed_at < now() - interval '1 hour')
                             -- Never offer a key that is in use (belt and braces).
                             and not exists (select from public.listing_covers c where c.object_key = x.object_key)
                           order by x.queued_at limit p_limit for update skip locked)
    returning d.object_key;
end $$;

-- Only keys that were claimed and are no longer in use are confirmed.
create function private.confirm_media_deletions(p_keys text[]) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_keys is null or cardinality(p_keys) > 1000 then perform private.bad_input(); end if;
  delete from private.media_deletions d
  where d.object_key = any(p_keys) and d.claimed_at is not null
    and not exists (select from public.listing_covers c where c.object_key = d.object_key);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.claim_media_deletions(p_limit integer) returns setof text
language sql volatile security invoker set search_path = '' as $$ select * from private.claim_media_deletions(p_limit) $$;
create function public.confirm_media_deletions(p_keys text[]) returns integer
language sql volatile security invoker set search_path = '' as $$ select private.confirm_media_deletions(p_keys) $$;

-- ---------------------------------------------------------------------------
-- 6. Grants and public wrappers
-- ---------------------------------------------------------------------------
revoke all on function
  private.set_listing_cover(uuid, text, text, integer, integer, integer),
  private.remove_listing_cover(uuid),
  private.admin_remove_listing_cover(uuid),
  private.claim_media_deletions(integer),
  private.confirm_media_deletions(text[]),
  public.claim_media_deletions(integer),
  public.confirm_media_deletions(text[])
  from public, anon, authenticated, service_role, forms_server, catalogue_server, retention_server;
grant execute on function
  private.set_listing_cover(uuid, text, text, integer, integer, integer),
  private.remove_listing_cover(uuid),
  private.admin_remove_listing_cover(uuid)
  to authenticated;
grant execute on function
  private.claim_media_deletions(integer),
  private.confirm_media_deletions(text[]),
  public.claim_media_deletions(integer),
  public.confirm_media_deletions(text[])
  to retention_server;

create function public.set_listing_cover(p_listing uuid, p_key text, p_type text,
  p_bytes integer, p_width integer, p_height integer) returns void
language sql volatile security invoker set search_path = '' as $$
  select private.set_listing_cover(p_listing, p_key, p_type, p_bytes, p_width, p_height) $$;
create function public.remove_listing_cover(p_listing uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.remove_listing_cover(p_listing) $$;
create function public.admin_remove_listing_cover(p_listing uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$ select private.admin_remove_listing_cover(p_listing) $$;

revoke all on function
  public.set_listing_cover(uuid, text, text, integer, integer, integer),
  public.remove_listing_cover(uuid),
  public.admin_remove_listing_cover(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.set_listing_cover(uuid, text, text, integer, integer, integer),
  public.remove_listing_cover(uuid),
  public.admin_remove_listing_cover(uuid)
  to authenticated;
