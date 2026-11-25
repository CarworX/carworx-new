-- Finish-build PR 6 (D-098, planning/claude/finish-build-plan.md): profile
-- fields. An optional mobile number (validated, private) and a profile
-- photo. Email change uses Supabase Auth's own confirm-both-addresses flow
-- (double_confirm_changes), so it needs no table here.
--
-- * Mobile: South African numbers only, stored as +27 and 9 digits. Kept on
--   profiles, which only the person and aal2 admins can read (RLS); no team
--   function returns it. Deleted with the account.
-- * Photo: one per person, re-written by the Worker like the cover photo
--   (server/media/image.ts: no EXIF or GPS kept), under avatars/ in the
--   private part of MEDIA. Only the person can fetch it (/account/photo). A
--   replaced or removed photo, and the photo of a deleted account, go to the
--   R2 deletion queue the daily retention run empties.
-- * The "Download my data" document now holds the mobile number and whether
--   a photo is on file.

-- ---------------------------------------------------------------------------
-- 1. Mobile number
-- ---------------------------------------------------------------------------
alter table public.profiles add column mobile text
  check (mobile is null or mobile ~ '^\+27[1-9][0-9]{8}$');
comment on column public.profiles.mobile is
  'Optional South African mobile, +27 and 9 digits (D-098 PR 6). Private: the person and aal2 admins only.';
grant insert (mobile) on public.profiles to authenticated;
grant update (mobile) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Profile photo
-- ---------------------------------------------------------------------------
create table public.profile_photos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  object_key text not null unique check (object_key ~ '^avatars/[0-9a-f]{32}\.(jpg|png|webp)$'),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  bytes integer not null check (bytes between 1 and 5242880),
  width integer not null check (width between 1 and 6000),
  height integer not null check (height between 1 and 6000),
  check (width::bigint * height <= 40000000),
  updated_at timestamptz not null default now()
);
comment on table public.profile_photos is
  'One profile photo per person (D-098 PR 6). Readable by the person only; written through set/remove_profile_photo.';
alter table public.profile_photos enable row level security;
revoke all on public.profile_photos from public, anon, authenticated, service_role,
  listing_projection, listing_eligibility, catalogue_server, forms_server, retention_server;
grant select on public.profile_photos to authenticated;
create policy profile_photos_select_self on public.profile_photos
  for select to authenticated using (user_id = (select auth.uid()));

-- The deletion queue takes avatars too.
alter table private.media_deletions drop constraint media_deletions_object_key_check;
alter table private.media_deletions add constraint media_deletions_object_key_check
  check (object_key ~ '^(covers/[0-9a-f]{32}\.(jpg|png|webp)|avatars/[0-9a-f]{32}\.(jpg|png|webp)|exports/[0-9a-f]{32}\.json)$');

-- Replaced, removed or deleted with the account (the row cascades): the old
-- file is queued for deletion from R2.
create function private.profile_photo_retire() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    insert into private.media_deletions(object_key, reason) values (old.object_key, 'removed')
      on conflict (object_key) do nothing;
  elsif old.object_key <> new.object_key then
    insert into private.media_deletions(object_key, reason) values (old.object_key, 'replaced')
      on conflict (object_key) do nothing;
  end if;
  return null;
end $$;
revoke all on function private.profile_photo_retire() from public, anon, authenticated, service_role;
create trigger profile_photo_retire after update or delete on public.profile_photos
  for each row execute function private.profile_photo_retire();

create function private.set_profile_photo(p_key text, p_type text, p_bytes integer,
  p_width integer, p_height integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^avatars/[0-9a-f]{32}\.(jpg|png|webp)$'
     or p_type is null or p_type not in ('image/jpeg','image/png','image/webp')
     or p_bytes is null or p_bytes not between 1 and 5242880
     or p_width is null or p_width not between 1 and 6000
     or p_height is null or p_height not between 1 and 6000
     or p_width::bigint * p_height > 40000000 then
    perform private.bad_input();
  end if;
  -- A key is never reused: one that was ever queued for deletion is refused.
  if exists (select from private.media_deletions d where d.object_key = p_key)
     or exists (select from public.profile_photos p where p.object_key = p_key and p.user_id <> v_uid) then
    perform private.bad_input();
  end if;
  insert into public.profile_photos(user_id, object_key, content_type, bytes, width, height)
    values (v_uid, p_key, p_type, p_bytes, p_width, p_height)
    on conflict (user_id) do update set object_key = excluded.object_key,
      content_type = excluded.content_type, bytes = excluded.bytes,
      width = excluded.width, height = excluded.height, updated_at = now();
end $$;

create function private.remove_profile_photo() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.profile_photos where user_id = auth.uid();
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- 3. "Download my data" (PR 4a): add the mobile number and the photo
-- ---------------------------------------------------------------------------
create or replace function private.personal_data(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'format', 'carworx-personal-data-v1',
    'generated_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
        'display_name', (select p.display_name from public.profiles p where p.id = u.id),
        'mobile', (select p.mobile from public.profiles p where p.id = u.id),
        'profile_photo', (select jsonb_build_object('type', f.content_type, 'width', f.width,
            'height', f.height, 'updated_at', f.updated_at)
          from public.profile_photos f where f.user_id = u.id))
      from auth.users u where u.id = p_uid),
    'notification_settings', (select jsonb_build_object('optional_email', n.optional_email)
      from public.notification_preferences n where n.user_id = p_uid),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object(
        'business', o.name, 'role', m.role, 'status', m.status, 'since', m.created_at,
        'staff_profile', (select jsonb_build_object('first_name', s.first_name,
            'services', s.service_slugs, 'days', s.days)
          from public.staff_profiles s where s.membership_id = m.id))
        order by m.created_at)
      from public.memberships m join public.organisations o on o.id = m.organisation_id
      where m.user_id = p_uid), '[]'::jsonb),
    'enquiries_sent', coalesce((select jsonb_agg(jsonb_build_object(
        'listing', l.display_name, 'name', e.sender_name, 'email', e.sender_email,
        'message', e.message, 'sent_at', e.created_at) order by e.created_at)
      from public.enquiries e left join public.listings l on l.public_id = e.listing_public_id
      where e.sender_user_id = p_uid), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(jsonb_build_object(
        'purpose', c.purpose, 'notice_version', c.notice_version, 'method', c.method,
        'granted_at', c.granted_at, 'withdrawn_at', c.withdrawn_at) order by c.granted_at)
      from public.consents c
      where c.subject_email = (select pg_catalog.lower(u.email) from auth.users u where u.id = p_uid)), '[]'::jsonb),
    'provider_applications', coalesce((select jsonb_agg(jsonb_build_object(
        'business_name', a.business_name, 'services', a.service_slugs, 'mode', a.mode,
        'metro', a.metro, 'description', a.description, 'public_address', a.public_address,
        'hours', a.hours, 'applicant_role', a.applicant_role, 'submitted_at', a.submitted_at,
        'created_at', a.created_at) order by a.created_at)
      from public.provider_applications a where a.user_id = p_uid), '[]'::jsonb),
    'claims_made', coalesce((select jsonb_agg(jsonb_build_object(
        'listing', l.display_name, 'status', c.status, 'evidence_kind', c.evidence_kind,
        'made_at', c.created_at, 'decided_at', c.decided_at) order by c.created_at)
      from public.listing_claims c left join public.listings l on l.public_id = c.listing_public_id
      where c.claimant_id = p_uid), '[]'::jsonb),
    'team_history', coalesce((select jsonb_agg(jsonb_build_object(
        'at', a.occurred_at, 'business', o.name, 'change', a.action,
        'role', a.details->>'role', 'status', a.details->>'status',
        'previous_role', a.details->>'old_role', 'previous_status', a.details->>'old_status')
        order by a.occurred_at, a.id)
      from public.audit_log a left join public.organisations o on o.id = a.organisation_id
      where a.target_table = 'memberships' and a.details->>'user_id' = p_uid::text), '[]'::jsonb)
  );
$$;
revoke all on function private.personal_data(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Grants and public wrappers
-- ---------------------------------------------------------------------------
revoke all on function private.set_profile_photo(text, text, integer, integer, integer),
  private.remove_profile_photo() from public, anon, authenticated, service_role;
grant execute on function private.set_profile_photo(text, text, integer, integer, integer),
  private.remove_profile_photo() to authenticated;

create function public.set_profile_photo(p_key text, p_type text, p_bytes integer,
  p_width integer, p_height integer) returns void
language sql volatile security invoker set search_path = '' as $$
  select private.set_profile_photo(p_key, p_type, p_bytes, p_width, p_height) $$;
create function public.remove_profile_photo() returns boolean
language sql volatile security invoker set search_path = '' as $$ select private.remove_profile_photo() $$;
revoke all on function public.set_profile_photo(text, text, integer, integer, integer),
  public.remove_profile_photo() from public, anon, authenticated, service_role;
grant execute on function public.set_profile_photo(text, text, integer, integer, integer),
  public.remove_profile_photo() to authenticated;
