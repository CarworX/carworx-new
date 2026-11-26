-- K5: reviews, replies and reports with writes confined to the public RPCs.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null,
  organisation_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  author_display text not null check (char_length(author_display) between 1 and 120),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  service_slug text references public.services(slug),
  status text not null default 'visible' check (status in ('visible','hidden')),
  hidden_reason text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  unique (listing_public_id, author_id),
  foreign key (listing_public_id, organisation_id)
    references public.listings(public_id, organisation_id) on delete cascade,
  check ((status = 'hidden') = (hidden_reason is not null))
);
create index reviews_visible_listing_idx on public.reviews(listing_public_id) include (rating) where status = 'visible';
create index reviews_author_idx on public.reviews(author_id) where author_id is not null;

create table public.review_replies (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 10 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index review_replies_author_idx on public.review_replies(author_id) where author_id is not null;

create table public.review_reports (
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (review_id, reporter_id)
);
create index review_reports_reporter_idx on public.review_reports(reporter_id);
create index review_reports_pending_idx on public.review_reports(review_id) where resolved_at is null;

alter table public.reviews enable row level security;
alter table public.review_replies enable row level security;
alter table public.review_reports enable row level security;
revoke all on public.reviews, public.review_replies, public.review_reports
  from public, anon, authenticated, service_role, listing_projection;
grant select (id, listing_public_id, author_display, rating, body,
  service_slug, status, created_at, edited_at) on public.reviews to anon, authenticated;
grant select (review_id, body, created_at, edited_at) on public.review_replies to anon, authenticated;
grant select (listing_public_id, rating, status) on public.reviews to listing_projection;
grant select on public.review_reports to authenticated;

-- The projection uses only visible ratings on listings it already exposes.
create policy reviews_projection on public.reviews for select to listing_projection using (status = 'visible');

create function private.review_listing_live(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select from public.listings where public_id = p_listing and status = 'live')
$$;
revoke all on function private.review_listing_live(uuid) from public, anon, authenticated, service_role;
grant execute on function private.review_listing_live(uuid) to anon, authenticated;

create policy reviews_visible on public.reviews for select to anon, authenticated
  using (status = 'visible' and private.review_listing_live(listing_public_id));
create policy reviews_own on public.reviews for select to authenticated using (author_id = (select auth.uid()));
create policy reviews_admin on public.reviews for select to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2' and (select private.is_platform_admin()));
create policy review_replies_read on public.review_replies for select to anon, authenticated
  using (exists (select from public.reviews r where r.id = review_id));
create policy review_reports_admin on public.review_reports for select to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2' and (select private.is_platform_admin()));

-- The auth FK clears the ID at final closure. Drop the display name in the
-- same statement so retained review text cannot retain the profile label.
create function private.anonymize_review_author() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.author_display := 'Former customer';
  return new;
end $$;
revoke all on function private.anonymize_review_author() from public, anon, authenticated, service_role;
create trigger reviews_anonymize_author before update of author_id on public.reviews
  for each row when (old.author_id is not null and new.author_id is null)
  execute function private.anonymize_review_author();

create function public.can_review(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select from public.enquiries e
    where e.sender_user_id = auth.uid() and e.listing_public_id = p_listing)
$$;

-- The author can discover their own row without exposing account UUIDs on
-- publicly visible reviews.
create function public.my_review(p_listing uuid) returns table (
  id uuid, rating smallint, body text, service_slug text, status text, created_at timestamptz, edited_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.body, r.service_slug, r.status, r.created_at, r.edited_at
  from public.reviews r where r.listing_public_id = p_listing and r.author_id = auth.uid()
$$;

create function public.upsert_review(p_listing uuid, p_rating smallint, p_body text, p_service text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_id uuid;
  v_display text;
  v_names text[];
  v_body text;
begin
  if v_user is null or exists (select from private.account_closures where user_id = v_user) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_listing is null or p_rating is null or p_rating not between 1 and 5 then perform private.bad_input(); end if;
  v_body := private.clean_multiline(p_body, 10, 1000);
  if p_service is not null and not exists (select from public.listings
    where public_id = p_listing and service_slug = p_service)
    and not exists (select from public.listing_services
    where listing_public_id = p_listing and service_slug = p_service) then
    perform private.bad_input();
  end if;

  -- Serialise create, edit and delete for this account and listing, including
  -- the first write, when there is no review row to lock.
  perform pg_advisory_xact_lock(175509, hashtext(v_user::text || p_listing::text));
  select id into v_id from public.reviews where listing_public_id = p_listing and author_id = v_user;
  if found then
    update public.reviews set rating = p_rating, body = v_body, service_slug = p_service, edited_at = now()
      where id = v_id;
    return v_id;
  end if;

  select organisation_id into v_org from public.listings where public_id = p_listing and status = 'live';
  if not found or not public.can_review(p_listing) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select regexp_split_to_array(btrim(display_name), '[[:space:]]+') into v_names
    from public.profiles where id = v_user;
  v_display := case
    when coalesce(v_names[1], '') in ('', 'Customer') or v_names[1] like '%@%' then 'Customer'
    when cardinality(v_names) = 1 then v_names[1]
    else left(v_names[1], 116) || ' ' || upper(left(v_names[cardinality(v_names)], 1)) || '.'
  end;
  insert into public.reviews(listing_public_id, organisation_id, author_id, author_display, rating, body, service_slug)
    values (p_listing, v_org, v_user, v_display, p_rating, v_body, p_service) returning id into v_id;
  return v_id;
end $$;

create function public.delete_my_review(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_listing uuid;
begin
  select listing_public_id into v_listing from public.reviews where id = p_id and author_id = auth.uid();
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(175509, hashtext(auth.uid()::text || v_listing::text));
  delete from public.reviews where id = p_id and author_id = auth.uid();
end $$;

create function public.reply_to_review(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_org uuid;
begin
  select r.organisation_id into v_org from public.reviews r
    join public.memberships m on m.organisation_id = r.organisation_id
    where r.id = p_id and r.status = 'visible' and m.user_id = v_user
      and m.status = 'active' and m.role in ('owner','manager') for share of r, m;
  if not found or exists (select from private.account_closures where user_id = v_user) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(v_org);
  insert into public.review_replies(review_id, author_id, body)
    values (p_id, v_user, private.clean_multiline(p_body, 10, 1000))
  on conflict (review_id) do update set body = excluded.body, author_id = excluded.author_id, edited_at = now();
end $$;

create function public.report_review(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or exists (select from private.account_closures where user_id = v_user) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.reviews r where r.id = p_id and r.status = 'visible'
    and private.review_listing_live(r.listing_public_id) for share;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into public.review_reports(review_id, reporter_id, reason)
    values (p_id, v_user, private.clean_multiline(p_reason, 10, 500))
  on conflict (review_id, reporter_id) do nothing;
end $$;

create function public.admin_review_queue() returns table (
  id uuid, listing_public_id uuid, author_display text, rating smallint, body text,
  status text, hidden_reason text, report_count integer, first_reported_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (auth.jwt()->>'aal') is distinct from 'aal2' or not private.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select r.id, r.listing_public_id, r.author_display, r.rating, r.body, r.status, r.hidden_reason,
      count(*)::integer, min(rr.created_at)
    from public.reviews r join public.review_reports rr on rr.review_id = r.id
    where rr.resolved_at is null
    group by r.id order by min(rr.created_at), r.id;
end $$;

create function public.admin_moderate_review(p_id uuid, p_decision text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_reason text; v_org uuid; v_status text;
begin
  if (auth.jwt()->>'aal') is distinct from 'aal2' or not private.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('hide','restore','dismiss') then perform private.bad_input(); end if;
  v_reason := private.clean_multiline(p_reason, 10, 500);
  if p_decision = 'hide' and (
    v_reason !~ '[[:alpha:]]' or
    lower(v_reason) ~ '(^|[^[:alpha:]])(rating|stars?|score|negative review|bad review)([^[:alpha:]]|$)' or
    lower(v_reason) ~ '^(other|general|unspecified|not applicable|policy (violation|breach)|inappropriate|moderation|no reason)[[:punct:][:space:]]*$'
  ) then perform private.bad_input(); end if;
  select r.organisation_id, r.status into v_org, v_status from public.reviews r where r.id = p_id for update;
  if not found then perform private.bad_input(); end if;
  if p_decision in ('hide','restore') then
    update public.reviews set status = case when p_decision = 'hide' then 'hidden' else 'visible' end,
      hidden_reason = case when p_decision = 'hide' then v_reason end where id = p_id;
  end if;
  update public.review_reports set resolved_at = now() where review_id = p_id and resolved_at is null;
  insert into public.audit_log(actor_id, organisation_id, action, target_table, target_id, details)
    values (auth.uid(), v_org, 'update', 'reviews', p_id::text,
      jsonb_build_object('decision', p_decision, 'reason', v_reason, 'previous_status', v_status));
end $$;

revoke all on function public.can_review(uuid), public.my_review(uuid), public.upsert_review(uuid,smallint,text,text),
  public.delete_my_review(uuid), public.reply_to_review(uuid,text), public.report_review(uuid,text),
  public.admin_review_queue(), public.admin_moderate_review(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.can_review(uuid), public.my_review(uuid), public.upsert_review(uuid,smallint,text,text),
  public.delete_my_review(uuid), public.reply_to_review(uuid,text), public.report_review(uuid,text),
  public.admin_review_queue(), public.admin_moderate_review(uuid,text,text) to authenticated;

-- Extend the public projection while preserving its owner and column order.
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
  (select lc.object_key from public.listing_covers lc where lc.listing_public_id = l.public_id) as cover_key,
  r.rating_avg, r.rating_count
from public.listings l
join public.services s on s.slug = l.service_slug
join public.categories c on c.slug = s.category_slug
left join public.branches b on b.public_id = l.branch_public_id
left join lateral (
  select avg(rr.rating)::numeric(2,1) as rating_avg, count(*)::integer as rating_count
  from public.reviews rr where rr.listing_public_id = l.public_id and rr.status = 'visible'
) r on true
where l.status = 'live';
grant listing_projection to postgres with set false, inherit false;
