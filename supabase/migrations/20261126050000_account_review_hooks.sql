-- K4: durable Didit erasure work survives the local account cascade.
create table private.didit_session_deletions (
  id uuid primary key default gen_random_uuid(),
  provider_session_id text unique not null check (provider_session_id ~ '^[0-9a-fA-F-]{36}$'),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_id uuid,
  check ((claimed_at is null) = (claim_id is null))
);
alter table private.didit_session_deletions enable row level security;
revoke all on private.didit_session_deletions from public, anon, authenticated, service_role, retention_server;
create index didit_session_deletions_due_idx on private.didit_session_deletions(created_at, id);

create function private.claim_didit_deletions(p_limit integer)
returns table(id uuid, provider_session_id text, claim_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then perform private.bad_input(); end if;
  return query
    with due as (
      select d.id from private.didit_session_deletions d
      where d.claimed_at is null or d.claimed_at < now() - interval '1 hour'
      order by d.created_at, d.id limit p_limit for update skip locked
    )
    update private.didit_session_deletions d set claim_id = gen_random_uuid(), claimed_at = now()
      from due where d.id = due.id returning d.id, d.provider_session_id, d.claim_id;
end $$;

create function private.complete_didit_deletion(p_id uuid, p_claim uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.didit_session_deletions d where d.id = p_id and d.claim_id = p_claim;
  if not found then return false; end if;
  insert into public.audit_log(action,target_table,target_id,details)
    values ('delete','didit_session_deletions',p_id::text,
      jsonb_build_object('outcome','erased','instruction_id',p_id));
  return true;
end $$;

create function public.claim_didit_deletions(p_limit integer)
returns table(id uuid, provider_session_id text, claim_id uuid)
language sql security invoker set search_path = '' as $$
  select * from private.claim_didit_deletions(p_limit)
$$;
create function public.complete_didit_deletion(p_id uuid,p_claim uuid) returns boolean
language sql security invoker set search_path = '' as $$
  select private.complete_didit_deletion(p_id,p_claim)
$$;
revoke all on function private.claim_didit_deletions(integer), private.complete_didit_deletion(uuid,uuid),
  public.claim_didit_deletions(integer), public.complete_didit_deletion(uuid,uuid)
  from public, anon, authenticated, service_role, retention_server;
grant execute on function private.claim_didit_deletions(integer), private.complete_didit_deletion(uuid,uuid),
  public.claim_didit_deletions(integer), public.complete_didit_deletion(uuid,uuid) to retention_server;

create function private.admin_today_review_counts()
returns table(pending_identity_reviews integer, reported_reviews integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (auth.jwt()->>'aal') is distinct from 'aal2' or not private.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select
    (select count(*)::integer from private.identity_checks i where i.status = 'in_review'),
    (select count(distinct r.review_id)::integer from public.review_reports r where r.resolved_at is null);
end $$;
create function public.admin_today_review_counts()
returns table(pending_identity_reviews integer, reported_reviews integer)
language sql stable security invoker set search_path = '' as $$
  select * from private.admin_today_review_counts()
$$;
revoke all on function private.admin_today_review_counts(), public.admin_today_review_counts()
  from public, anon, authenticated, service_role;
grant execute on function private.admin_today_review_counts(), public.admin_today_review_counts() to authenticated;

create or replace function private.finalize_account_deletion(p_user uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_user is null then perform private.bad_input(); end if;
  perform from private.account_closures c
    where c.user_id = p_user and c.delete_after <= now() and c.claimed_at is not null for update;
  if not found then return false; end if;
  update public.enquiries set sender_name = 'Deleted account',
    sender_email = 'deleted-account@carworx.invalid', sender_user_id = null
    where sender_user_id = p_user;
  -- Their export files go to the R2 deletion queue before the rows cascade.
  insert into private.media_deletions(object_key, reason)
    select d.object_key, 'export_expired' from private.data_exports d where d.user_id = p_user
    on conflict (object_key) do nothing;
  -- Invites they made or used would block the delete (no-action foreign keys).
  delete from public.invites where created_by = p_user or used_by = p_user;
  -- Queue provider erasure before the local identity rows cascade. Payments
  -- keep their receipts and lose their account link through their own FK.
  insert into private.didit_session_deletions(provider_session_id)
    select i.provider_session_id from private.identity_checks i where i.user_id = p_user
    on conflict (provider_session_id) do nothing;
  delete from auth.users where id = p_user;
  return true;
end $$;

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
      -- Under the current email, and (PR 6: the email can now change) the
      -- consents given with enquiries this account sent under an older one.
      where c.user_id = p_uid
         or (c.user_id is null and c.subject_email = (select pg_catalog.lower(u.email) from auth.users u where u.id = p_uid))
         or c.id in (select e.consent_id from public.enquiries e where e.sender_user_id = p_uid)), '[]'::jsonb),
    'identity_checks', coalesce((select jsonb_agg(jsonb_build_object(
        'status', i.status, 'id_last4', i.id_last4, 'decided_at', i.decided_at)
        order by i.created_at, i.id)
      from private.identity_checks i where i.user_id = p_uid), '[]'::jsonb),
    'fines_payments', coalesce((select jsonb_agg(jsonb_build_object(
        'notice_ids', f.notice_ids, 'cents', f.cents, 'status', f.status,
        'receipt_number', f.receipt_number, 'created_at', f.created_at, 'settled_at', f.settled_at)
        order by f.created_at, f.id)
      from public.fines_payments f where f.user_id = p_uid), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
        'listing', l.display_name, 'rating', r.rating, 'body', r.body,
        'service_slug', r.service_slug, 'status', r.status, 'hidden_reason', r.hidden_reason,
        'created_at', r.created_at, 'edited_at', r.edited_at) order by r.created_at, r.id)
      from public.reviews r join public.listings l on l.public_id = r.listing_public_id
      where r.author_id = p_uid), '[]'::jsonb),
    'review_replies', coalesce((select jsonb_agg(jsonb_build_object(
        'listing', l.display_name, 'body', rr.body, 'created_at', rr.created_at,
        'edited_at', rr.edited_at) order by rr.created_at, rr.review_id)
      from public.review_replies rr join public.reviews r on r.id = rr.review_id
      join public.listings l on l.public_id = r.listing_public_id
      where rr.author_id = p_uid), '[]'::jsonb),
    'review_reports', coalesce((select jsonb_agg(jsonb_build_object(
        'listing', l.display_name, 'reason', rr.reason, 'created_at', rr.created_at,
        'resolved_at', rr.resolved_at) order by rr.created_at, rr.review_id)
      from public.review_reports rr join public.reviews r on r.id = rr.review_id
      join public.listings l on l.public_id = r.listing_public_id
      where rr.reporter_id = p_uid), '[]'::jsonb),
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
