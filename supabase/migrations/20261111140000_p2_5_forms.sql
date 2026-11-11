-- P2-5 (Claude 22): visitor enquiries, private demand capture, consents and
-- support cases. SYNTHETIC DATA ONLY.
--
-- Boundary: visitors aren't signed in, so the three submit functions must not
-- be reachable through PostgREST (that would skip Turnstile and the Worker's
-- limiter). Each is a SECURITY INVOKER wrapper in public calling a SECURITY
-- DEFINER function in private (search_path = ''), as in Bundle A, but EXECUTE
-- goes ONLY to the scoped login forms_server, which the Worker reaches through
-- the FORMS_DB Hyperdrive binding (the catalogue_server pattern, D-081).
-- PostgREST can never switch to forms_server. The submit functions return
-- void, so a caller learns nothing about existing rows.
--
-- Reads: SELECT-only client grants; RLS decides. Demand requests, consents and
-- support cases are readable only by a listed admin at aal2 (A13). Enquiries
-- are also readable by the listing organisation's owners and managers.
--
-- Redaction (PLAN section 9.1): audit details never hold a name, an email, a
-- message or a note. Errors: 42501 not allowed, 22023 bad input, P0001 with a
-- fixed key. Messages never echo input.

do $$ begin
  if not exists (select from pg_roles where rolname = 'forms_server') then
    create role forms_server nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('enquiry_share_with_provider','demand_notify')),
  notice_version text not null check (notice_version ~ '^[a-z0-9.-]{1,40}$'),
  method text not null default 'checkbox_unticked_default' check (method = 'checkbox_unticked_default'),
  subject_email text not null check (length(subject_email) between 6 and 254),
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  processing_ended_at timestamptz,
  -- Set once processing ends (withdrawn, superseded or purged): proof is kept
  -- 3 years after that (retention schedule, s11(2)(a)).
  retain_until timestamptz,
  check ((retain_until is null) = (processing_ended_at is null))
);
comment on table public.consents is 'Proof of explicit consent (box unticked by default). Admin aal2 read only. Written by private form functions only.';
create index consents_retain_idx on public.consents(retain_until) where retain_until is not null;

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_public_id uuid not null,
  organisation_id uuid not null,
  sender_name text not null check (length(sender_name) between 2 and 80),
  sender_email text not null check (length(sender_email) between 6 and 254),
  message text not null check (length(message) between 10 and 1000),
  consent_id uuid not null unique references public.consents(id),
  created_at timestamptz not null default now(),
  foreign key(listing_public_id, organisation_id) references public.listings(public_id, organisation_id) on delete cascade
);
comment on table public.enquiries is 'Visitor enquiries to a live listing. Read by the organisation''s owners/managers and admin aal2. Kept 12 months.';
create index enquiries_org_idx on public.enquiries(organisation_id, created_at desc);
create index enquiries_created_idx on public.enquiries(created_at);

-- Expiry is not the only deletion path: deleting a listing cascades here.
-- Start the proof-retention clock for every deletion without extending a
-- clock that withdrawal or an earlier end-of-processing already started.
create function private.end_enquiry_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.consents set processing_ended_at = now(),
    retain_until = coalesce(retain_until, now() + interval '3 years')
  where id = old.consent_id and processing_ended_at is null;
  return old;
end $$;
revoke all on function private.end_enquiry_consent() from public, anon, authenticated, service_role, forms_server;
create trigger end_enquiry_consent before delete on public.enquiries
  for each row execute function private.end_enquiry_consent();

create table public.demand_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 6 and 254),
  category_slug text not null references public.categories(slug),
  province text not null check (province in ('eastern-cape','free-state','gauteng','kwazulu-natal','limpopo','mpumalanga','north-west','northern-cape','western-cape')),
  consent_id uuid not null unique references public.consents(id),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(email, category_slug, province),
  check (expires_at = last_activity_at + interval '12 months')
);
comment on table public.demand_requests is 'PRIVATE (A13): "tell me when a provider joins". Admin aal2 read only. No point, geocode or search text (A17). Kept 12 months from last activity.';
create index demand_requests_expires_idx on public.demand_requests(expires_at);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 6 and 254),
  topic text not null check (topic in ('listing_problem','account','privacy_request','other')),
  message text not null check (length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open','closed')),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  close_note text check (close_note is null or length(close_note) between 5 and 500),
  created_at timestamptz not null default now(),
  check ((status = 'closed') = (closed_at is not null)),
  check ((status = 'closed') = (close_note is not null))
);
comment on table public.support_cases is 'Visitor support cases, including privacy requests. Admin aal2 read only. Kept 3 years after closing.';
create index support_cases_status_idx on public.support_cases(status, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants and RLS: SELECT only; every admin policy checks aal2 inline.
-- ---------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['consents','enquiries','demand_requests','support_cases'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role, listing_projection, listing_eligibility, catalogue_server, forms_server', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
create policy consents_admin_select on public.consents for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy support_cases_admin_select on public.support_cases for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy enquiries_admin_select on public.enquiries for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()));
create policy enquiries_controller_select on public.enquiries for select to authenticated
  using ((select private.has_org_role(organisation_id, array['owner','manager'])));
-- Expired demand is hidden at once, before the purge job removes it.
create policy demand_requests_admin_select on public.demand_requests for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select private.is_platform_admin()) and expires_at > now());

-- ---------------------------------------------------------------------------
-- Audit. Details carry kinds and states only (PLAN section 9.1).
-- ---------------------------------------------------------------------------
create function private.write_forms_audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare rec jsonb; detail jsonb; org uuid; begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  detail := case tg_table_name
    when 'enquiries' then jsonb_build_object('listing_public_id', rec->'listing_public_id')
    when 'demand_requests' then jsonb_build_object('category_slug', rec->'category_slug')
    when 'consents' then jsonb_build_object('purpose', rec->'purpose', 'withdrawn', rec->'withdrawn_at' <> 'null'::jsonb, 'ended', rec->'processing_ended_at' <> 'null'::jsonb)
    else jsonb_build_object('topic', rec->'topic', 'status', rec->'status') end;
  if tg_op = 'UPDATE' and tg_table_name = 'support_cases' then
    detail := detail || jsonb_build_object('old_status', to_jsonb(old)->'status');
  end if;
  org := case when tg_table_name = 'enquiries' then (rec->>'organisation_id')::uuid end;
  insert into public.audit_log(actor_id, organisation_id, action, target_table, target_id, details)
  values(auth.uid(), org, lower(tg_op), tg_table_name, rec->>'id', detail);
  return null;
end $$;
revoke all on function private.write_forms_audit() from public, anon, authenticated, service_role;
do $$ declare t text; begin
  foreach t in array array['consents','enquiries','demand_requests','support_cases'] loop
    execute format('create trigger forms_audit after insert or update or delete on public.%I for each row execute function private.write_forms_audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- A bounded shape check, lower-cased. Nothing is ever sent to the address.
create function private.clean_email(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := pg_catalog.lower(pg_catalog.btrim(p));
begin
  if v is null or length(v) > 254 or v !~ '^[^@[:space:][:cntrl:]]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$' or v ~ '\.\.' then
    perform private.bad_input();
  end if;
  return v;
end $$;

create function private.require_consent(p_consent boolean, p_notice text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  -- Only an explicit true counts: a missing or false value is never consent.
  if p_consent is distinct from true then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  if p_notice is null or p_notice !~ '^[a-z0-9.-]{1,40}$' then perform private.bad_input(); end if;
end $$;

-- ---------------------------------------------------------------------------
-- Submit functions (forms_server only)
-- ---------------------------------------------------------------------------
create function private.submit_enquiry(
  p_listing uuid, p_name text, p_email text, p_message text, p_consent boolean, p_notice text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text; v_email text; v_message text; v_org uuid; v_consent uuid;
begin
  perform private.require_consent(p_consent, p_notice);
  v_name := private.clean_text(p_name, 2, 80);
  v_email := private.clean_email(p_email);
  v_message := private.clean_multiline(p_message, 10, 1000);
  select l.organisation_id into v_org from public.listings l where l.public_id = p_listing and l.status = 'live';
  if v_org is null then raise exception 'listing_not_available' using errcode = 'P0001'; end if;
  insert into public.consents(purpose, notice_version, subject_email)
    values ('enquiry_share_with_provider', p_notice, v_email) returning id into v_consent;
  insert into public.enquiries(listing_public_id, organisation_id, sender_name, sender_email, message, consent_id)
    values (p_listing, v_org, v_name, v_email, v_message, v_consent);
end $$;

-- A repeat for the same email, category and province refreshes the one row
-- (and its 12 months) and supersedes the earlier consent; the caller can't
-- tell a new request from a repeat.
create function private.capture_demand(
  p_email text, p_category text, p_province text, p_consent boolean, p_notice text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text; v_consent uuid; v_old public.demand_requests;
begin
  perform private.require_consent(p_consent, p_notice);
  v_email := private.clean_email(p_email);
  if p_category is null or not exists (select from public.categories c where c.slug = p_category)
     or p_province is null or p_province not in ('eastern-cape','free-state','gauteng','kwazulu-natal','limpopo','mpumalanga','north-west','northern-cape','western-cape') then
    perform private.bad_input();
  end if;
  perform pg_catalog.pg_advisory_xact_lock(172907, pg_catalog.hashtext(v_email));
  insert into public.consents(purpose, notice_version, subject_email)
    values ('demand_notify', p_notice, v_email) returning id into v_consent;
  select * into v_old from public.demand_requests d
    where d.email = v_email and d.category_slug = p_category and d.province = p_province for update;
  if found then
    update public.demand_requests set consent_id = v_consent, last_activity_at = now(), expires_at = now() + interval '12 months'
      where id = v_old.id;
    update public.consents set processing_ended_at = now(), retain_until = now() + interval '3 years'
      where id = v_old.consent_id;
  else
    insert into public.demand_requests(email, category_slug, province, consent_id, last_activity_at, expires_at)
      values (v_email, p_category, p_province, v_consent, now(), now() + interval '12 months');
  end if;
end $$;

create function private.open_support_case(p_email text, p_topic text, p_message text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text; v_message text;
begin
  v_email := private.clean_email(p_email);
  if p_topic is null or p_topic not in ('listing_problem','account','privacy_request','other') then
    perform private.bad_input();
  end if;
  v_message := private.clean_multiline(p_message, 10, 2000);
  insert into public.support_cases(email, topic, message) values (v_email, p_topic, v_message);
end $$;

-- ---------------------------------------------------------------------------
-- Admin functions (listed admin at aal2, via private.require_admin)
-- ---------------------------------------------------------------------------
create function private.admin_close_support_case(p_case uuid, p_note text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin(); v_note text; v_status text;
begin
  v_note := private.clean_text(p_note, 5, 500);
  select status into v_status from public.support_cases where id = p_case for update;
  if not found then perform private.bad_input(); end if;
  if v_status <> 'open' then raise exception 'case_not_open' using errcode = 'P0001'; end if;
  update public.support_cases set status = 'closed', closed_by = v_admin, closed_at = now(), close_note = v_note where id = p_case;
end $$;

-- On a privacy request: the demand row goes at once; the consent is marked
-- withdrawn and kept as proof for 3 years.
create function private.admin_withdraw_demand(p_request uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin(); v_consent uuid;
begin
  delete from public.demand_requests where id = p_request returning consent_id into v_consent;
  if v_consent is null then perform private.bad_input(); end if;
  update public.consents set withdrawn_at = now(), processing_ended_at = now(), retain_until = now() + interval '3 years'
    where id = v_consent;
end $$;

-- ---------------------------------------------------------------------------
-- Retention (Claude 22 section 5). Executable by its owner only; scheduling
-- it is a G-PROD item (retention schedule gap R-2).
-- ---------------------------------------------------------------------------
create function private.purge_expired_forms(
  out demand_deleted integer, out enquiries_deleted integer, out support_deleted integer, out consents_deleted integer
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  with gone as (
    delete from public.demand_requests where expires_at <= now() returning consent_id
  ), ended as (
    update public.consents c set processing_ended_at = now(), retain_until = now() + interval '3 years'
    from gone where c.id = gone.consent_id and c.processing_ended_at is null returning c.id
  ) select count(*) into demand_deleted from gone;
  with gone as (
    delete from public.enquiries where created_at <= now() - interval '12 months' returning consent_id
  ), ended as (
    update public.consents c set processing_ended_at = now(), retain_until = now() + interval '3 years'
    from gone where c.id = gone.consent_id and c.processing_ended_at is null returning c.id
  ) select count(*) into enquiries_deleted from gone;
  with gone as (
    delete from public.support_cases where status = 'closed' and closed_at <= now() - interval '3 years' returning id
  ) select count(*) into support_deleted from gone;
  with gone as (
    delete from public.consents c where c.retain_until <= now()
      and not exists (select from public.enquiries e where e.consent_id = c.id)
      and not exists (select from public.demand_requests d where d.consent_id = c.id)
    returning c.id
  ) select count(*) into consents_deleted from gone;
end $$;

-- ---------------------------------------------------------------------------
-- Grants on functions
-- ---------------------------------------------------------------------------
revoke all on function private.clean_email(text), private.require_consent(boolean, text),
  private.purge_expired_forms()
  from public, anon, authenticated, service_role;
revoke all on function
  private.submit_enquiry(uuid, text, text, text, boolean, text),
  private.capture_demand(text, text, text, boolean, text),
  private.open_support_case(text, text, text),
  private.admin_close_support_case(uuid, text),
  private.admin_withdraw_demand(uuid)
  from public, anon, authenticated, service_role;
grant usage on schema private to forms_server;
grant execute on function
  private.submit_enquiry(uuid, text, text, text, boolean, text),
  private.capture_demand(text, text, text, boolean, text),
  private.open_support_case(text, text, text)
  to forms_server;
grant execute on function
  private.admin_close_support_case(uuid, text),
  private.admin_withdraw_demand(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Wrappers in public: SECURITY INVOKER.
-- ---------------------------------------------------------------------------
create function public.submit_enquiry(p_listing uuid, p_name text, p_email text, p_message text, p_consent boolean, p_notice text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.submit_enquiry(p_listing, p_name, p_email, p_message, p_consent, p_notice)
$$;
create function public.capture_demand(p_email text, p_category text, p_province text, p_consent boolean, p_notice text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.capture_demand(p_email, p_category, p_province, p_consent, p_notice)
$$;
create function public.open_support_case(p_email text, p_topic text, p_message text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.open_support_case(p_email, p_topic, p_message)
$$;
create function public.admin_close_support_case(p_case uuid, p_note text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.admin_close_support_case(p_case, p_note)
$$;
create function public.admin_withdraw_demand(p_request uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.admin_withdraw_demand(p_request)
$$;
revoke all on function
  public.submit_enquiry(uuid, text, text, text, boolean, text),
  public.capture_demand(text, text, text, boolean, text),
  public.open_support_case(text, text, text),
  public.admin_close_support_case(uuid, text),
  public.admin_withdraw_demand(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.submit_enquiry(uuid, text, text, text, boolean, text),
  public.capture_demand(text, text, text, boolean, text),
  public.open_support_case(text, text, text)
  to forms_server;
grant execute on function
  public.admin_close_support_case(uuid, text),
  public.admin_withdraw_demand(uuid)
  to authenticated;

-- The scoped server credential. No password ships here: private test tooling
-- sets a synthetic one locally; the owner sets the hosted one with VALID UNTIL.
alter role forms_server login connection limit 5;
