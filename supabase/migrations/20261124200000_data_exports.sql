-- Finish-build PR 4a (D-098): "Download my data". A signed-in person asks
-- for a copy of what CarworX holds about them. The database builds one JSON
-- document; the Worker stores it in the private exports/ part of the R2
-- bucket MEDIA (never served by the public media route) and shows a one-time
-- download link. At most one request per 24 hours; the file is kept 7 days,
-- or until it is downloaded, then the daily retention run deletes it.
--
-- Contents: account (email, display name, created), notification settings,
-- memberships (business, role, status) and staff profile, enquiries sent,
-- consents given under the account email, provider applications, claims made
-- (status and dates), and the team history about the person (role and status
-- changes). Never other people's identifiers, admin notes or token hashes.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table private.data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  object_key text not null unique check (object_key ~ '^exports/[0-9a-f]{32}\.json$'),
  token_hash bytea not null unique check (length(token_hash) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  downloaded_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);
create index data_exports_user_idx on private.data_exports(user_id, created_at desc);
comment on table private.data_exports is
  'One-time personal data exports (D-098): 1 per 24 h, kept 7 days in R2 MEDIA exports/. Only a SHA-256 of the link token is stored.';
alter table private.data_exports enable row level security;
revoke all on private.data_exports from public, anon, authenticated, service_role,
  listing_projection, listing_eligibility, catalogue_server, forms_server, retention_server;

-- The deletion queue (PR 3) also takes export files.
alter table private.media_deletions drop constraint media_deletions_object_key_check;
alter table private.media_deletions add constraint media_deletions_object_key_check
  check (object_key ~ '^(covers/[0-9a-f]{32}\.(jpg|png|webp)|exports/[0-9a-f]{32}\.json)$');
alter table private.media_deletions drop constraint media_deletions_reason_check;
alter table private.media_deletions add constraint media_deletions_reason_check
  check (reason in ('replaced', 'removed', 'listing_deleted', 'export_downloaded', 'export_expired'));

-- ---------------------------------------------------------------------------
-- 2. The document
-- ---------------------------------------------------------------------------
create function private.personal_data(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'format', 'carworx-personal-data-v1',
    'generated_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
        'display_name', (select p.display_name from public.profiles p where p.id = u.id))
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
  )
$$;
revoke all on function private.personal_data(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Request, cancel, download
-- ---------------------------------------------------------------------------
-- The Worker sends a fresh random key and the SHA-256 of a fresh random
-- token; this records them and returns the document to store. One request
-- per 24 hours per person (export_limit), checked under a per-user lock.
create function private.request_data_export(p_key text, p_token_hash bytea) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^exports/[0-9a-f]{32}\.json$'
     or p_token_hash is null or length(p_token_hash) <> 32 then
    perform private.bad_input();
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('data_export:' || v_uid::text, 0));
  if exists (select from private.data_exports d
             where d.user_id = v_uid and d.created_at > now() - interval '24 hours') then
    raise exception 'export_limit' using errcode = 'P0001';
  end if;
  insert into private.data_exports(user_id, object_key, token_hash) values (v_uid, p_key, p_token_hash);
  return private.personal_data(v_uid);
end $$;

-- The Worker could not store the file: undo the request so the person can
-- try again at once (their own, still-undownloaded request only).
create function private.cancel_data_export(p_key text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from private.data_exports
    where user_id = auth.uid() and object_key = p_key and downloaded_at is null;
end $$;

-- One-time download: the signed-in owner of the export, with the token from
-- the link, before it expires. Marks it used and queues the file for
-- deletion. Unknown, used, expired and someone else's links fail alike.
create function private.consume_data_export(p_token_hash bytea) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_row private.data_exports;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_token_hash is null or length(p_token_hash) <> 32 then raise exception 'export_invalid' using errcode = 'P0001'; end if;
  select * into v_row from private.data_exports where token_hash = p_token_hash for update;
  if not found or v_row.user_id <> auth.uid() or v_row.downloaded_at is not null or v_row.expires_at <= now() then
    raise exception 'export_invalid' using errcode = 'P0001';
  end if;
  update private.data_exports set downloaded_at = now() where id = v_row.id;
  insert into private.media_deletions(object_key, reason) values (v_row.object_key, 'export_downloaded')
    on conflict (object_key) do nothing;
  return v_row.object_key;
end $$;

-- What the privacy page shows: when the last request was made, whether its
-- link is still usable, and when a new request is allowed.
create function private.data_export_status()
returns table(requested_at timestamptz, expires_at timestamptz, downloaded_at timestamptz, next_allowed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.created_at, d.expires_at, d.downloaded_at, d.created_at + interval '24 hours'
  from private.data_exports d where d.user_id = auth.uid()
  order by d.created_at desc limit 1
$$;

-- ---------------------------------------------------------------------------
-- 4. Retention: expired exports join the R2 deletion queue
-- ---------------------------------------------------------------------------
create or replace function private.claim_media_deletions(p_limit integer) returns setof text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit not between 1 and 1000 then perform private.bad_input(); end if;
  -- Exports past their 7 days: queue the file, keep no row (or none for a
  -- downloaded one: its file was queued at download).
  with gone as (
    delete from private.data_exports d
    where d.expires_at <= now()
    returning d.object_key, d.downloaded_at
  )
  insert into private.media_deletions(object_key, reason)
    select g.object_key, 'export_expired' from gone g where g.downloaded_at is null
    on conflict (object_key) do nothing;
  return query
    update private.media_deletions d set claimed_at = now()
    where d.object_key in (select x.object_key from private.media_deletions x
                           where (x.claimed_at is null or x.claimed_at < now() - interval '1 hour')
                             and not exists (select from public.listing_covers c where c.object_key = x.object_key)
                           order by x.queued_at limit p_limit for update skip locked)
    returning d.object_key;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Grants and public wrappers
-- ---------------------------------------------------------------------------
revoke all on function
  private.request_data_export(text, bytea),
  private.cancel_data_export(text),
  private.consume_data_export(bytea),
  private.data_export_status()
  from public, anon, authenticated, service_role;
grant execute on function
  private.request_data_export(text, bytea),
  private.cancel_data_export(text),
  private.consume_data_export(bytea),
  private.data_export_status()
  to authenticated;

create function public.request_data_export(p_key text, p_token_hash bytea) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select private.request_data_export(p_key, p_token_hash) $$;
create function public.cancel_data_export(p_key text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.cancel_data_export(p_key) $$;
create function public.consume_data_export(p_token_hash bytea) returns text
language sql volatile security invoker set search_path = '' as $$ select private.consume_data_export(p_token_hash) $$;
create function public.data_export_status()
returns table(requested_at timestamptz, expires_at timestamptz, downloaded_at timestamptz, next_allowed_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.data_export_status() $$;

revoke all on function
  public.request_data_export(text, bytea),
  public.cancel_data_export(text),
  public.consume_data_export(bytea),
  public.data_export_status()
  from public, anon, authenticated, service_role;
grant execute on function
  public.request_data_export(text, bytea),
  public.cancel_data_export(text),
  public.consume_data_export(bytea),
  public.data_export_status()
  to authenticated;
