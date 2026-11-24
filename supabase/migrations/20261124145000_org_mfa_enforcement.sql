-- O7 database enforcement uses the same canonical predicate as the Worker.
-- Keep policy writes disabled until every Worker route and O8 are connected.

-- VOLATILE is deliberate: acceptance checks the membership inserted earlier in
-- its transaction, and expiry is checked at wall-clock time after lock waits.
create or replace function private.org_mfa_satisfied(p_org uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_role text; v_policy text; v_session text;
begin
  if v_uid is null or p_org is null then return false; end if;
  select m.role, o.team_mfa_policy into v_role, v_policy
    from public.memberships m join public.organisations o on o.id = m.organisation_id
    where m.organisation_id = p_org and m.user_id = v_uid and m.status = 'active';
  if not found then return false; end if;
  if v_role = 'owner' or v_policy = 'optional'
    or (v_policy = 'managers' and v_role = 'staff') then return true; end if;
  if auth.jwt()->>'aal' = 'aal2' then return true; end if;
  -- An administrator never gets access from a custom email proof.
  if exists (select from private.platform_admins where user_id = v_uid) then return false; end if;
  v_session := auth.jwt()->>'session_id';
  if v_session is null or v_session !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
    then return false; end if;
  return exists (
    select from private.mfa_stepups p
      join auth.sessions s on s.id = p.session_id and s.user_id = p.user_id
      join auth.users u on u.id = p.user_id
    where p.user_id = v_uid and p.session_id = v_session::uuid
      and p.issued_at <= clock_timestamp() and p.expires_at > clock_timestamp() and p.revoked_at is null
      and coalesce(u.encrypted_password, '') <> ''
      and (s.not_after is null or s.not_after > clock_timestamp())
      -- Conservative invalidation also catches direct Auth API password/profile
      -- changes and factor enrolment, before Worker revocation is connected.
      and u.updated_at <= p.issued_at
      and not exists (select from auth.mfa_factors f where f.user_id = p.user_id and f.created_at > p.issued_at)
  );
end $$;
alter function public.org_mfa_satisfied(uuid) volatile;

create function private.require_org_mfa(p_org uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.org_mfa_satisfied(p_org) then
    raise exception 'mfa_required' using errcode = 'P0001';
  end if;
end $$;
revoke all on function private.require_org_mfa(uuid) from public, anon, authenticated, service_role;

-- Own identity/authorization metadata only, needed before protected org rows
-- are visible. No names, contacts, settings, invites or other members' rows.
create function public.my_org_memberships(p_org uuid default null)
returns table(id uuid, organisation_id uuid, user_id uuid, role text, status text, mfa_satisfied boolean)
language sql volatile security definer set search_path = '' as $$
  select m.id, m.organisation_id, m.user_id, m.role, m.status,
    private.org_mfa_satisfied(m.organisation_id)
  from public.memberships m
  where m.user_id = auth.uid() and m.status = 'active'
    and (p_org is null or m.organisation_id = p_org)
  order by m.organisation_id;
$$;
revoke all on function public.my_org_memberships(uuid) from public, anon, authenticated, service_role;
grant execute on function public.my_org_memberships(uuid) to authenticated;

-- Restrictive policies can only narrow existing role/participant policies.
-- Nonmember access remains whatever the original policies allow (e.g. a
-- displaced claimant's own dispute). Catalogue projection/eligibility roles
-- and native admin guards are unchanged; no grant is widened.
do $guard$ declare t text; org_col text; begin
  foreach t in array array['organisations','memberships','audit_log','coordinate_sources','branches','listings','service_areas','verifications','listing_decisions','listing_claims','claim_disputes','enquiries','listing_services','listing_hours','provider_applications','invites','staff_profiles'] loop
    if not exists (select from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity) then
      raise exception 'org_rls_required' using errcode = 'P0001';
    end if;
    org_col := case when t = 'organisations' then 'id' else 'organisation_id' end;
    execute format(
      'create policy org_mfa_member_guard on public.%I as restrictive for all to authenticated
       using ((not (select private.is_org_member(%I))) or (select private.org_mfa_satisfied(%I)))
       with check ((not (select private.is_org_member(%I))) or (select private.org_mfa_satisfied(%I)))',
      t, org_col, org_col, org_col, org_col);
  end loop;
end $guard$;

create or replace function private.provider_resubmit(p_listing uuid, p_display_name text, p_description text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_l public.listings; v_name text; v_desc text;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Same per-applicant lock as provider_apply, taken first, so apply and
  -- resubmit together still leave at most one pending application.
  perform pg_catalog.pg_advisory_xact_lock(172906, pg_catalog.hashtext(v_uid::text));
  select * into v_l from public.listings where public_id = p_listing for update;
  if not found or not private.has_org_role(v_l.organisation_id, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(v_l.organisation_id);
  v_name := private.clean_text(p_display_name, 2, 160);

  v_desc := private.clean_multiline(p_description, 10, 2000);
  if v_l.status <> 'draft' then raise exception 'not_draft' using errcode = 'P0001'; end if;
  if exists (select from public.listings l join public.memberships m on m.organisation_id = l.organisation_id
             where m.user_id = v_uid and m.status = 'active' and m.role = 'owner' and l.status = 'submitted') then
    raise exception 'application_pending' using errcode = 'P0001';
  end if;
  update public.listings set status = 'submitted', submitted_at = now(), display_name = v_name, description = v_desc
    where public_id = p_listing;
end $$;

create or replace function private.create_invite(p_org uuid, p_role text, p_email text) returns text
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
  perform private.require_org_mfa(p_org);
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

create or replace function private.set_team_settings(p_org uuid, p jsonb) returns void
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
  perform private.require_org_mfa(p_org);
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

create or replace function private.set_staff_profile(p_membership uuid, p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_m public.memberships; v public.staff_profiles; k text;
begin
  if v_uid is null or p_membership is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform private.bad_input(); end if;
  select * into v_m from public.memberships where id = p_membership and status = 'active';
  if not found or not (v_m.user_id = v_uid or private.has_org_role(v_m.organisation_id, array['owner','manager'])) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(v_m.organisation_id);
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

create or replace function private.team_changes(p_org uuid)
returns table(id bigint, occurred_at timestamptz, action text, target_table text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_org_role(p_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(p_org);
  return query
    select a.id, a.occurred_at, a.action, a.target_table
    from public.audit_log a
    where a.organisation_id = p_org
      and a.target_table in ('memberships','invites','staff_profiles','organisations')
    order by a.occurred_at desc, a.id desc
    limit 100;
end $$;

create or replace function private.dispute_claim(p_claim uuid, p_reason text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_c public.listing_claims; v_reason text; v_id uuid;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_c from public.listing_claims where id = p_claim for update;
  if not found or v_c.claimant_id = v_uid then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Same organisation lock as approval and reversal, taken before the
  -- supersession check, so a dispute and a later approval can't both commit.
  -- The checks below are later statements, so they see whatever committed
  -- while this transaction waited (READ COMMITTED).
  perform from public.organisations where id = v_c.organisation_id for update;
  if not (
    (v_c.status = 'submitted' and private.has_org_role(v_c.organisation_id, array['owner','manager']))
    or (v_c.status = 'approved' and v_uid = any (v_c.displaced_user_ids))
  ) then
    if v_c.status in ('submitted','approved') then raise exception 'not_allowed' using errcode = '42501'; end if;
    raise exception 'claim_not_disputable' using errcode = 'P0001';
  end if;
  if v_c.status = 'approved' and private.transfer_superseded(v_c) then
    raise exception 'claim_superseded' using errcode = 'P0001';
  end if;
  if private.is_org_member(v_c.organisation_id) then
    perform private.require_org_mfa(v_c.organisation_id);
  end if;
  v_reason := private.clean_text(p_reason, 10, 1000);
  insert into public.claim_disputes(claim_id, organisation_id, raised_by, reason)
    values (p_claim, v_c.organisation_id, v_uid, v_reason) returning id into v_id;
  update public.listing_claims set status = 'disputed' where id = p_claim;
  return v_id;
end $$;

create or replace function private.guard_membership_write(p_org uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform from public.organisations where id = p_org for update;
  if private.is_platform_admin() then return; end if;
  if not exists (select from public.memberships m
                 where m.organisation_id = p_org and m.user_id = auth.uid()
                   and m.status = 'active' and m.role = 'owner') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(p_org);
end $;

create or replace function private.provider_submit(p_adult boolean, p_probing_ack boolean, p_notice text) returns uuid
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
  perform private.require_org_mfa(v_org);
  return v_listing;
end $$;

create or replace function private.accept_invite(p_token text) returns uuid
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
  perform private.require_org_mfa(v_org);
  update public.invites set used_at = now(), used_by = v_uid where id = v_i.id;
  return v_org;
end $$;
