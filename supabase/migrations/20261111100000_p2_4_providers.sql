-- P2-4 + P2-7 (Claude 21): provider applications, admin review, claims,
-- disputes and suspension. SYNTHETIC DATA ONLY.
--
-- Boundary: listing status, decisions, claims and disputes change ONLY through
-- the SECURITY DEFINER functions below (owner postgres, search_path = '').
-- Each is called through a SECURITY INVOKER wrapper in public (the only
-- PostgREST schema), with the user's own JWT. Admin functions require
-- private.is_platform_admin(), i.e. a listed admin AND aal2. New tables have
-- SELECT-only client grants, so RLS decides reads and nothing else writes.
-- listing_public is not touched: no column, owner or grant changes.
--
-- Errors: 42501 not allowed, 22023 bad input, P0001 with a fixed message key
-- for a refused state transition. Messages never echo input.

-- ---------------------------------------------------------------------------
-- Listings: queue order, and no direct status writes by clients.
-- ---------------------------------------------------------------------------
alter table public.listings add column submitted_at timestamptz;
update public.listings set submitted_at = created_at where status = 'submitted';
create index listings_submitted_idx on public.listings(submitted_at, public_id) where status = 'submitted';
revoke update(status) on public.listings from authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.listing_decisions (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null,
  organisation_id uuid not null,
  decision text not null check (decision in ('approved','rejected','suspended','reinstated')),
  review_method text check (review_method in ('phone_call','video_call','document_check','registry_check','site_visit')),
  labels text[] not null default '{}',
  reason text check (reason is null or length(reason) between 5 and 500),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  -- No cascade: a decided listing keeps its record (append-only), so it can't be deleted.
  foreign key(listing_public_id, organisation_id) references public.listings(public_id, organisation_id),
  check ((decision = 'approved') = (review_method is not null)),
  check (decision = 'approved' or reason is not null),
  check (labels <@ array['identity_checked','business_details_checked','premises_visited'])
);
comment on table public.listing_decisions is 'Append-only admin decisions on listings (D-023 method recorded). Written by private.admin_* only.';
create index listing_decisions_listing_idx on public.listing_decisions(listing_public_id, decided_at);
create index listing_decisions_org_idx on public.listing_decisions(organisation_id);

create table public.listing_claims (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null,
  organisation_id uuid not null,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in ('business_email','document')),
  email_domain text check (email_domain is null or email_domain ~ '^[a-z0-9.-]{1,253}$'),
  document_reference text check (document_reference is null or length(document_reference) between 3 and 200),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','disputed','reversed')),
  review_method text check (review_method in ('phone_call','video_call','document_check','registry_check','site_visit')),
  review_note text check (review_note is null or length(review_note) between 5 and 500),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  approved_at timestamptz,
  revoked_membership_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key(listing_public_id, organisation_id) references public.listings(public_id, organisation_id) on delete cascade,
  check ((evidence_kind = 'business_email') = (email_domain is not null)),
  check ((evidence_kind = 'document') = (document_reference is not null)),
  check (approved_at is null or review_method is not null)
);
comment on table public.listing_claims is 'Claims on a listing. Control transfers only after admin review (Claude 17 section 3). Document evidence is a typed reference only: nothing is uploaded.';
create unique index listing_claims_one_open on public.listing_claims(listing_public_id, claimant_id) where status in ('submitted','disputed');
create index listing_claims_org_idx on public.listing_claims(organisation_id);
create index listing_claims_status_idx on public.listing_claims(status, created_at);

create table public.claim_disputes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.listing_claims(id) on delete cascade,
  organisation_id uuid not null,
  raised_by uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(reason) between 10 and 1000),
  status text not null default 'open' check (status in ('open','upheld','dismissed')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or length(resolution_note) between 5 and 500),
  created_at timestamptz not null default now(),
  check ((status = 'open') = (resolved_at is null))
);
create unique index claim_disputes_one_open on public.claim_disputes(claim_id) where status = 'open';
create index claim_disputes_org_idx on public.claim_disputes(organisation_id);

-- ---------------------------------------------------------------------------
-- Grants and RLS: SELECT only; every admin policy checks aal2 inline.
-- ---------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['listing_decisions','listing_claims','claim_disputes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role, listing_projection, listing_eligibility, catalogue_server', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy provider_admin_select on public.%I for select to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select private.is_platform_admin()))', t);
  end loop;
end $$;
create policy listing_decisions_member_select on public.listing_decisions for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager','staff'])));
create policy listing_claims_claimant_select on public.listing_claims for select to authenticated
  using (claimant_id = (select auth.uid()));
create policy listing_claims_controller_select on public.listing_claims for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager'])));
-- Someone displaced by an approved transfer can still see that claim, so they
-- can dispute it (their own revoked membership row is already self-readable).
create policy listing_claims_displaced_select on public.listing_claims for select to authenticated
  using (exists (select from public.memberships m
    where m.id = any (listing_claims.revoked_membership_ids) and m.user_id = (select auth.uid())));
create policy claim_disputes_party_select on public.claim_disputes for select to authenticated
  using (raised_by = (select auth.uid())
    or exists (select from public.listing_claims c where c.id = claim_disputes.claim_id and c.claimant_id = (select auth.uid())));

-- Decisions are append-only for every role, including the definer functions.
create function private.listing_decisions_append_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'listing_decisions is append-only' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.listing_decisions_append_only() from public, anon, authenticated, service_role;
create trigger listing_decisions_no_update_delete before update or delete on public.listing_decisions
  for each row execute function private.listing_decisions_append_only();
create trigger listing_decisions_no_truncate before truncate on public.listing_decisions
  for each statement execute function private.listing_decisions_append_only();

-- ---------------------------------------------------------------------------
-- Audit. Details carry states and decisions only: never reasons, notes,
-- addresses, coordinates or email domains (PLAN section 9.1 log redaction).
-- ---------------------------------------------------------------------------
-- private.write_catalogue_audit is unchanged (its details stay '{}'); each
-- status change is audited through its listing_decisions row instead.
create function private.write_provider_audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare rec jsonb; detail jsonb; begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  detail := case tg_table_name
    when 'listing_decisions' then jsonb_build_object('listing_public_id', rec->'listing_public_id', 'decision', rec->'decision', 'review_method', rec->'review_method', 'labels', rec->'labels')
    when 'listing_claims' then jsonb_build_object('listing_public_id', rec->'listing_public_id', 'status', rec->'status', 'evidence_kind', rec->'evidence_kind')
    else jsonb_build_object('claim_id', rec->'claim_id', 'status', rec->'status') end;
  if tg_op = 'UPDATE' then detail := detail || jsonb_build_object('old_status', to_jsonb(old)->'status'); end if;
  insert into public.audit_log(actor_id, organisation_id, action, target_table, target_id, details)
  values(auth.uid(), (rec->>'organisation_id')::uuid, lower(tg_op), tg_table_name, rec->>'id', detail);
  return null;
end $$;
revoke all on function private.write_provider_audit() from public, anon, authenticated, service_role;
do $$ declare t text; begin
  foreach t in array array['listing_decisions','listing_claims','claim_disputes'] loop
    execute format('create trigger provider_audit after insert or update or delete on public.%I for each row execute function private.write_provider_audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create function private.bad_input() returns void
language plpgsql immutable set search_path = '' as $$
begin
  raise exception 'invalid_input' using errcode = '22023';
end $$;

-- Free webmail and ISP mail domains are never business-domain evidence.
create function private.is_free_mail_domain(p_domain text) returns boolean
language sql immutable set search_path = '' as $$
  select p_domain = any (array[
    'gmail.com','googlemail.com','yahoo.com','yahoo.co.za','ymail.com','outlook.com','hotmail.com','hotmail.co.za',
    'live.com','live.co.za','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com',
    'gmx.com','gmx.net','mail.com','zoho.com','yandex.com','mweb.co.za','telkomsa.net','webmail.co.za',
    'vodamail.co.za','vodacom.co.za','afrihost.co.za','iafrica.com','lantic.net','cybersmart.co.za'])
$$;

create function private.clean_text(p text, p_min integer, p_max integer) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := pg_catalog.btrim(p);
begin
  if v is null or length(v) < p_min or length(v) > p_max or v ~ '[[:cntrl:]]' then
    perform private.bad_input();
  end if;
  return v;
end $$;

-- A later approved transfer on the same organisation supersedes an earlier
-- one: the earlier claim can no longer be disputed or reversed.
create function private.transfer_superseded(p_claim public.listing_claims) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select from public.listing_claims o
    where o.organisation_id = p_claim.organisation_id and o.id <> p_claim.id
      and o.approved_at > p_claim.approved_at and o.status in ('approved','disputed'))
$$;

-- ---------------------------------------------------------------------------
-- Provider functions (signed in, aal1 is enough)
-- ---------------------------------------------------------------------------
create function private.provider_apply(
  p_business_name text, p_service_slug text, p_mode text, p_metro text, p_description text,
  p_address text, p_lat double precision, p_lng double precision, p_radius_km integer
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text; v_metro text; v_desc text; v_address text;
  v_org uuid; v_source uuid; v_branch uuid; v_listing uuid;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_name := private.clean_text(p_business_name, 2, 160);
  v_metro := private.clean_text(p_metro, 2, 120);
  v_desc := private.clean_text(p_description, 10, 2000);
  if p_mode is null or p_mode not in ('fixed','mobile')
     or p_lat is null or p_lng is null or not (p_lat between -35 and -22) or not (p_lng between 16 and 33)
     or not exists (select from public.services s where s.slug = p_service_slug)
     or (p_mode = 'fixed' and (p_radius_km is not null or p_address is null))
     or (p_mode = 'mobile' and (p_address is not null or p_radius_km is null or not (p_radius_km between 1 and 100))) then
    perform private.bad_input();
  end if;
  if p_mode = 'fixed' then v_address := private.clean_text(p_address, 5, 300); end if;

  -- One pending application per person, serialised per applicant.
  perform pg_catalog.pg_advisory_xact_lock(172906, pg_catalog.hashtext(v_uid::text));
  if exists (select from public.listings l join public.memberships m on m.organisation_id = l.organisation_id
             where m.user_id = v_uid and m.status = 'active' and m.role = 'owner' and l.status = 'submitted') then
    raise exception 'application_pending' using errcode = 'P0001';
  end if;

  insert into public.organisations(name) values (v_name) returning id into v_org;
  insert into public.memberships(organisation_id, user_id, role, status) values (v_org, v_uid, 'owner', 'active');
  insert into public.coordinate_sources(organisation_id, source_kind, licence_note)
    values (v_org, 'provider_supplied', 'Pin supplied by the provider in their application; no geocoding service')
    returning id into v_source;
  if p_mode = 'fixed' then
    insert into public.branches(organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id)
      values (v_org, v_name, v_address, p_lat, p_lng, v_source) returning public_id into v_branch;
  end if;
  insert into public.listings(organisation_id, service_slug, branch_public_id, display_name, description, metro, mode,
      status, provenance_kind, provenance_reference, submitted_at)
    values (v_org, p_service_slug, v_branch, v_name, v_desc, v_metro, p_mode,
      'submitted', 'provider_application', 'Signed-in provider application', now())
    returning public_id into v_listing;
  if p_mode = 'mobile' then
    insert into public.service_areas(listing_public_id, organisation_id, centre_latitude, centre_longitude, radius_km, coordinate_source_id)
      values (v_listing, v_org, p_lat, p_lng, p_radius_km, v_source);
  end if;
  return v_listing;
end $$;

create function private.provider_resubmit(p_listing uuid, p_display_name text, p_description text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_l public.listings; v_name text; v_desc text;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_l from public.listings where public_id = p_listing for update;
  if not found or not private.has_org_role(v_l.organisation_id, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_name := private.clean_text(p_display_name, 2, 160);
  v_desc := private.clean_text(p_description, 10, 2000);
  if v_l.status <> 'draft' then raise exception 'not_draft' using errcode = 'P0001'; end if;
  update public.listings set status = 'submitted', submitted_at = now(), display_name = v_name, description = v_desc
    where public_id = p_listing;
end $$;

create function private.claim_listing(p_listing uuid, p_evidence text, p_document_reference text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_org uuid; v_email text; v_confirmed timestamptz;
  v_domain text; v_doc text; v_id uuid;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_evidence is null or p_evidence not in ('business_email','document') then perform private.bad_input(); end if;
  select organisation_id into v_org from public.listings where public_id = p_listing and status = 'live' for share;
  if not found then raise exception 'not_claimable' using errcode = 'P0001'; end if;
  if exists (select from public.memberships m where m.organisation_id = v_org and m.user_id = v_uid and m.status = 'active') then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  if p_evidence = 'business_email' then
    if p_document_reference is not null then perform private.bad_input(); end if;
    select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
    if v_email is null or v_confirmed is null then raise exception 'email_unconfirmed' using errcode = 'P0001'; end if;
    v_domain := split_part(v_email, '@', 2);
    if v_domain !~ '^[a-z0-9.-]{1,253}$' or private.is_free_mail_domain(v_domain) then
      raise exception 'free_mail_domain' using errcode = 'P0001';
    end if;
  else
    v_doc := private.clean_text(p_document_reference, 3, 200);
  end if;
  begin
    insert into public.listing_claims(listing_public_id, organisation_id, claimant_id, evidence_kind, email_domain, document_reference)
      values (p_listing, v_org, v_uid, p_evidence, v_domain, v_doc) returning id into v_id;
  exception when unique_violation then
    raise exception 'claim_pending' using errcode = 'P0001';
  end;
  return v_id;
end $$;

create function private.dispute_claim(p_claim uuid, p_reason text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_c public.listing_claims; v_reason text; v_id uuid;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_c from public.listing_claims where id = p_claim for update;
  if not found or v_c.claimant_id = v_uid then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not (
    (v_c.status = 'submitted' and private.has_org_role(v_c.organisation_id, array['owner','manager']))
    or (v_c.status = 'approved' and exists (select from public.memberships m
         where m.id = any (v_c.revoked_membership_ids) and m.user_id = v_uid))
  ) then
    if v_c.status in ('submitted','approved') then raise exception 'not_allowed' using errcode = '42501'; end if;
    raise exception 'claim_not_disputable' using errcode = 'P0001';
  end if;
  if v_c.status = 'approved' and private.transfer_superseded(v_c) then
    raise exception 'claim_superseded' using errcode = 'P0001';
  end if;
  v_reason := private.clean_text(p_reason, 10, 1000);
  insert into public.claim_disputes(claim_id, organisation_id, raised_by, reason)
    values (p_claim, v_c.organisation_id, v_uid, v_reason) returning id into v_id;
  update public.listing_claims set status = 'disputed' where id = p_claim;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Admin functions (listed admin AND aal2, checked here as well as by the Worker)
-- ---------------------------------------------------------------------------
create function private.admin_decide_application(
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
     or ('premises_visited' = any (v_labels) and v_l.mode <> 'fixed') then
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

create function private.admin_set_suspension(p_listing uuid, p_suspend boolean, p_reason text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin(); v_l public.listings; v_reason text;
begin
  if p_suspend is null then perform private.bad_input(); end if;
  v_reason := private.clean_text(p_reason, 5, 500);
  select * into v_l from public.listings where public_id = p_listing for update;
  if not found then perform private.bad_input(); end if;
  if p_suspend and v_l.status <> 'live' then raise exception 'not_live' using errcode = 'P0001'; end if;
  if not p_suspend and v_l.status <> 'suspended' then raise exception 'not_suspended' using errcode = 'P0001'; end if;
  update public.listings set status = case when p_suspend then 'suspended' else 'live' end where public_id = p_listing;
  insert into public.listing_decisions(listing_public_id, organisation_id, decision, reason, decided_by)
    values (p_listing, v_l.organisation_id, case when p_suspend then 'suspended' else 'reinstated' end, v_reason, v_admin);
end $$;

create function private.admin_decide_claim(p_claim uuid, p_decision text, p_method text, p_note text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin(); v_c public.listing_claims; v_note text; v_revoked uuid[];
begin
  if p_decision is null or p_decision not in ('approve','reject') then perform private.bad_input(); end if;
  select * into v_c from public.listing_claims where id = p_claim for update;
  if not found then perform private.bad_input(); end if;
  if v_c.status <> 'submitted' then raise exception 'claim_not_pending' using errcode = 'P0001'; end if;
  if p_decision = 'reject' then
    v_note := private.clean_text(p_note, 5, 500);
    update public.listing_claims set status = 'rejected', review_note = v_note, decided_by = v_admin, decided_at = now() where id = p_claim;
    return;
  end if;
  if p_method is null or p_method not in ('phone_call','video_call','document_check','registry_check','site_visit') then
    perform private.bad_input();
  end if;
  if p_note is not null then v_note := private.clean_text(p_note, 5, 500); end if;
  -- Ownership changes are serialised per organisation, and never stack on a
  -- transfer that is still under dispute.
  perform from public.organisations where id = v_c.organisation_id for update;
  if exists (select from public.listing_claims o where o.organisation_id = v_c.organisation_id
             and o.status = 'disputed' and o.approved_at is not null) then
    raise exception 'transfer_disputed' using errcode = 'P0001';
  end if;
  -- Transfer of control: everyone else loses access; their IDs are kept so an
  -- upheld dispute can restore them.
  perform from public.memberships where organisation_id = v_c.organisation_id for update;
  with revoked as (
    update public.memberships set status = 'revoked'
    where organisation_id = v_c.organisation_id and status = 'active' and user_id <> v_c.claimant_id
    returning id
  ) select coalesce(array_agg(id), '{}') into v_revoked from revoked;
  insert into public.memberships(organisation_id, user_id, role, status) values (v_c.organisation_id, v_c.claimant_id, 'owner', 'active')
    on conflict (organisation_id, user_id) do update set role = 'owner', status = 'active';
  update public.listing_claims set status = 'approved', review_method = p_method, review_note = v_note,
    decided_by = v_admin, decided_at = now(), approved_at = clock_timestamp(), revoked_membership_ids = v_revoked
    where id = p_claim;
end $$;

create function private.admin_resolve_dispute(p_dispute uuid, p_outcome text, p_note text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin(); v_d public.claim_disputes; v_c public.listing_claims; v_note text;
begin
  if p_outcome is null or p_outcome not in ('uphold','dismiss') then perform private.bad_input(); end if;
  v_note := private.clean_text(p_note, 5, 500);
  select * into v_d from public.claim_disputes where id = p_dispute for update;
  if not found then perform private.bad_input(); end if;
  if v_d.status <> 'open' then raise exception 'dispute_closed' using errcode = 'P0001'; end if;
  select * into v_c from public.listing_claims where id = v_d.claim_id for update;
  if p_outcome = 'uphold' then
    if v_c.approved_at is not null then
      perform from public.organisations where id = v_c.organisation_id for update;
      if private.transfer_superseded(v_c) then raise exception 'claim_superseded' using errcode = 'P0001'; end if;
      -- Restore the snapshot exactly: everyone active now (the claimant and
      -- anyone they granted access to) is revoked, then the displaced return.
      perform from public.memberships where organisation_id = v_c.organisation_id for update;
      update public.memberships set status = 'revoked'
        where organisation_id = v_c.organisation_id and status = 'active' and not (id = any (v_c.revoked_membership_ids));
      update public.memberships set status = 'active' where id = any (v_c.revoked_membership_ids);
    end if;
    update public.listing_claims set status = case when v_c.approved_at is not null then 'reversed' else 'rejected' end,
      decided_by = v_admin, decided_at = now() where id = v_c.id;
  else
    update public.listing_claims set status = case when v_c.approved_at is not null then 'approved' else 'submitted' end
      where id = v_c.id;
  end if;
  update public.claim_disputes set status = case when p_outcome = 'uphold' then 'upheld' else 'dismissed' end,
    resolved_by = v_admin, resolved_at = now(), resolution_note = v_note where id = p_dispute;
end $$;

-- ---------------------------------------------------------------------------
-- Grants on private functions: authenticated only (helpers: nobody).
-- ---------------------------------------------------------------------------
revoke all on function private.transfer_superseded(public.listing_claims) from public, anon, authenticated, service_role;
revoke all on function private.require_admin(), private.bad_input(), private.is_free_mail_domain(text),
  private.clean_text(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function
  private.provider_apply(text, text, text, text, text, text, double precision, double precision, integer),
  private.provider_resubmit(uuid, text, text),
  private.claim_listing(uuid, text, text),
  private.dispute_claim(uuid, text),
  private.admin_decide_application(uuid, text, text, text[], text, text),
  private.admin_set_suspension(uuid, boolean, text),
  private.admin_decide_claim(uuid, text, text, text),
  private.admin_resolve_dispute(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function
  private.provider_apply(text, text, text, text, text, text, double precision, double precision, integer),
  private.provider_resubmit(uuid, text, text),
  private.claim_listing(uuid, text, text),
  private.dispute_claim(uuid, text),
  private.admin_decide_application(uuid, text, text, text[], text, text),
  private.admin_set_suspension(uuid, boolean, text),
  private.admin_decide_claim(uuid, text, text, text),
  private.admin_resolve_dispute(uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC wrappers in public: SECURITY INVOKER, so nothing runs with more than
-- the caller's rights until the private function's own checks pass.
-- ---------------------------------------------------------------------------
create function public.provider_apply(
  p_business_name text, p_service_slug text, p_mode text, p_metro text, p_description text,
  p_address text, p_lat double precision, p_lng double precision, p_radius_km integer
) returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.provider_apply(p_business_name, p_service_slug, p_mode, p_metro, p_description, p_address, p_lat, p_lng, p_radius_km)
$$;
create function public.provider_resubmit(p_listing uuid, p_display_name text, p_description text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.provider_resubmit(p_listing, p_display_name, p_description)
$$;
create function public.claim_listing(p_listing uuid, p_evidence text, p_document_reference text)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.claim_listing(p_listing, p_evidence, p_document_reference)
$$;
create function public.dispute_claim(p_claim uuid, p_reason text)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.dispute_claim(p_claim, p_reason)
$$;
create function public.admin_decide_application(p_listing uuid, p_decision text, p_method text, p_labels text[], p_evidence text, p_reason text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.admin_decide_application(p_listing, p_decision, p_method, p_labels, p_evidence, p_reason)
$$;
create function public.admin_set_suspension(p_listing uuid, p_suspend boolean, p_reason text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.admin_set_suspension(p_listing, p_suspend, p_reason)
$$;
create function public.admin_decide_claim(p_claim uuid, p_decision text, p_method text, p_note text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.admin_decide_claim(p_claim, p_decision, p_method, p_note)
$$;
create function public.admin_resolve_dispute(p_dispute uuid, p_outcome text, p_note text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.admin_resolve_dispute(p_dispute, p_outcome, p_note)
$$;
revoke all on function
  public.provider_apply(text, text, text, text, text, text, double precision, double precision, integer),
  public.provider_resubmit(uuid, text, text),
  public.claim_listing(uuid, text, text),
  public.dispute_claim(uuid, text),
  public.admin_decide_application(uuid, text, text, text[], text, text),
  public.admin_set_suspension(uuid, boolean, text),
  public.admin_decide_claim(uuid, text, text, text),
  public.admin_resolve_dispute(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.provider_apply(text, text, text, text, text, text, double precision, double precision, integer),
  public.provider_resubmit(uuid, text, text),
  public.claim_listing(uuid, text, text),
  public.dispute_claim(uuid, text),
  public.admin_decide_application(uuid, text, text, text[], text, text),
  public.admin_set_suspension(uuid, boolean, text),
  public.admin_decide_claim(uuid, text, text, text),
  public.admin_resolve_dispute(uuid, text, text)
  to authenticated;
