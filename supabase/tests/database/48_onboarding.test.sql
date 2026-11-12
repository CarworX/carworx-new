-- O2 (Claude 23 §3, §7, §8 activation, §9): mode 'both', application drafts
-- and submit, the admin premises label, team settings, invites, staff
-- profiles and audit redaction. Runs in one transaction and is rolled back.
-- SYNTHETIC.
--
-- Actors: Bo applies as a both-business and becomes its owner; Pia applies as
-- fixed premises; Mo applies as mobile only; Mel manager and Sam staff of Bo's
-- business; Ivy and Ian are invitees; Ola is unrelated; Ada admin.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('b8000000-0000-4000-8000-000000000001', 'bo.both@example.test', now()),
  ('b8000000-0000-4000-8000-000000000002', 'pia.premises@example.test', now()),
  ('b8000000-0000-4000-8000-000000000003', 'mo.mobile@example.test', now()),
  ('b8000000-0000-4000-8000-000000000004', 'mel.manager@example.test', now()),
  ('b8000000-0000-4000-8000-000000000005', 'sam.staff@example.test', now()),
  ('b8000000-0000-4000-8000-000000000006', 'ivy.invitee@example.test', now()),
  ('b8000000-0000-4000-8000-000000000007', 'ian.invitee@example.test', now()),
  ('b8000000-0000-4000-8000-000000000008', 'ola.other@example.test', now()),
  ('b8000000-0000-4000-8000-000000000009', 'ada.admin@example.test', now()),
  ('b8000000-0000-4000-8000-00000000000a', 'cy.claimant@example.test', now()),
  ('b8000000-0000-4000-8000-00000000000b', 'zed.newcomer@example.test', now());
-- Own catalogue fixtures: recovery CI (K4) runs without the seed.
insert into public.categories(slug, name) values ('o2-cat', 'O2 test category (synthetic)');
insert into public.services(slug, category_slug, name) values
  ('o2-wash', 'o2-cat', 'O2 wash (synthetic)'), ('o2-valet', 'o2-cat', 'O2 valet (synthetic)'), ('o2-polish', 'o2-cat', 'O2 polish (synthetic)');
insert into private.platform_admins (user_id) values ('b8000000-0000-4000-8000-000000000009');

select plan(93);

-- ===== Mode 'both' shape ====================================================
insert into public.organisations(id, name) values ('b8100000-0000-4000-8000-0000000000f1', 'Shape fixture (synthetic)');
select throws_ok($$insert into public.listings(organisation_id, service_slug, display_name, description, metro, mode, provenance_kind, provenance_reference)
  values ('b8100000-0000-4000-8000-0000000000f1', 'o2-wash', 'Synthetic', 'Synthetic', 'Gauteng', 'both', 'admin_import', 'Synthetic')$$,
  '23514', null, 'a both-listing needs a premises branch');
insert into public.coordinate_sources(id, organisation_id, source_kind, licence_note)
  values ('b8100000-0000-4000-8000-0000000000c1', 'b8100000-0000-4000-8000-0000000000f1', 'provider_supplied', 'Synthetic');
insert into public.branches(public_id, organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id)
  values ('b8100000-0000-4000-8000-0000000000b1', 'b8100000-0000-4000-8000-0000000000f1', 'Synthetic', '1 Synthetic Road', -26.1, 28.0, 'b8100000-0000-4000-8000-0000000000c1');
insert into public.listings(public_id, organisation_id, service_slug, branch_public_id, display_name, description, metro, mode, provenance_kind, provenance_reference)
  values ('b8100000-0000-4000-8000-0000000000d1', 'b8100000-0000-4000-8000-0000000000f1', 'o2-wash', 'b8100000-0000-4000-8000-0000000000b1', 'Synthetic', 'Synthetic', 'Gauteng', 'both', 'admin_import', 'Synthetic');
select throws_ok($$insert into public.service_areas(listing_public_id, organisation_id, centre_latitude, centre_longitude, radius_km, coordinate_source_id)
  values ('b8100000-0000-4000-8000-0000000000d1', 'b8100000-0000-4000-8000-0000000000f1', -26.1, 28.0, 10, 'b8100000-0000-4000-8000-0000000000c1')$$,
  '23503', null, 'a service area must carry the listing''s own mode');

-- ===== Draft and submit (Bo, both) ==========================================
set local role anon;
select throws_ok($$select public.provider_save_draft('{"step":1}')$$, '42501', null, 'anon cannot save a draft');
reset role;

set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.provider_save_draft('{"mapbox_id":"abc"}')$$, '22023', null, 'unknown keys are refused, so no geocoder field can be stored');
select throws_ok($$select public.provider_save_draft('{"pin":{"lat":-26.1,"lng":28.0,"source":"search"}}')$$, '22023', null,
  'a pin must come from a tap or the device');
select throws_ok($$select public.provider_save_draft('{"pin":{"lat":51.5,"lng":-0.1,"source":"tap"}}')$$, '22023', null, 'a pin must be in South Africa');
select throws_ok($$select public.provider_save_draft('{"hours":[{"day":1,"opens":"17:00","closes":"08:00"}]}')$$, '22023', null, 'closing must be after opening');
select throws_ok($$select public.provider_save_draft('{"service_slugs":["o2-wash","o2-wash"]}')$$, '22023', null, 'services are distinct');
select ok(public.provider_save_draft('{"step":1,"business_name":"Bo Both Wash (synthetic)","applicant_role":"owner"}') is not null, 'a draft saves');
select is(public.provider_save_draft('{"step":2}'), (select id from public.provider_applications), 'saving again updates the same open draft');
select is((select count(*)::integer from public.provider_applications), 1, 'the applicant reads their own draft');
select throws_ok($$update public.provider_applications set business_name = 'Rewritten'$$, '42501', null, 'no direct draft writes');
select throws_ok($$select public.provider_submit(true, true, 'onboarding-v1')$$, 'P0001', 'draft_incomplete', 'an incomplete draft cannot be submitted');
select ok(public.provider_save_draft('{"step":6,"service_slugs":["o2-valet","o2-wash"],"mode":"both","metro":"Synthetic Johannesburg",
  "description":"Synthetic both business description.","public_address":"2 Synthetic Avenue",
  "pin":{"lat":-26.2,"lng":28.05,"source":"tap"},"radius_km":15,
  "hours":[{"day":2,"opens":"08:00","closes":"17:00"},{"day":1,"opens":"08:30","closes":"16:00"}],
  "team_size_band":"2-5","trading_since":"2019-03-01"}') is not null, 'the draft is completed');
select throws_ok($$select public.provider_submit(false, true, 'onboarding-v1')$$, 'P0001', 'consent_required', '18+ must be confirmed');
select throws_ok($$select public.provider_submit(true, false, 'onboarding-v1')$$, 'P0001', 'consent_required',
  'a both-business must acknowledge the probing-risk notice');
select ok(public.provider_submit(true, true, 'onboarding-v1') is not null, 'a complete both application submits');
reset role;

create temporary table o2 as
  select a.organisation_id as bo_org, a.submitted_listing_public_id as bo_listing from public.provider_applications a
  where a.user_id = 'b8000000-0000-4000-8000-000000000001';
grant select on o2 to authenticated;
select ok((select l.mode = 'both' and l.status = 'submitted' and l.branch_public_id is not null and l.service_slug = 'o2-valet'
  from public.listings l join o2 on l.public_id = o2.bo_listing), 'listing: both, submitted, with premises and the first service as main');
select is((select array_agg(s.service_slug order by s.position) from public.listing_services s join o2 on s.listing_public_id = o2.bo_listing),
  array['o2-valet','o2-wash'], 'listing services keep the picked order');
select ok((select a.listing_mode = 'both' and a.radius_km = 15 from public.service_areas a join o2 on a.listing_public_id = o2.bo_listing),
  'the service area carries mode both and the radius');
select is((select array_agg(h.day order by h.day) from public.listing_hours h join o2 on h.listing_public_id = o2.bo_listing),
  array[1,2]::smallint[], 'opening hours are stored per day');
select ok((select a.submitted_at is not null and a.adult_attested_at is not null and a.probing_notice_ack_at is not null and a.probing_notice_version = 'onboarding-v1'
  from public.provider_applications a where a.user_id = 'b8000000-0000-4000-8000-000000000001'), 'submit records the 18+ and probing acknowledgements');
select ok((select o.team_size_band = '2-5' and o.trading_since = date '2019-03-01' and o.team_mfa_policy = 'optional'
  from public.organisations o join o2 on o.id = o2.bo_org), 'the organisation gets its team size and trading date; MFA policy optional');
select is((select c.licence_note from public.coordinate_sources c join o2 on c.organisation_id = o2.bo_org),
  'Pin tapped by the provider on the map in their application; no geocoding result stored', 'location provenance says the pin was tapped');
select is_empty($$select a.attname from pg_attribute a where a.attrelid = 'public.provider_applications'::regclass and a.attnum > 0
  and a.attname ~* '(birth|dob|id_number|identity|geocod|mapbox|place)'$$, 'no date of birth, ID number or geocoder column');

set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(public.provider_save_draft('{"step":1,"business_name":"Bo Second (synthetic)"}') is not null, 'a new application starts a new draft');
select ok(public.provider_save_draft('{"service_slugs":["o2-wash"],"mode":"mobile","metro":"Synthetic Johannesburg","description":"Synthetic second description.",
  "pin":{"lat":-26.2,"lng":28.05,"source":"device"},"radius_km":10,"applicant_role":"owner"}') is not null, 'the second draft is completed');
select throws_ok($$select public.provider_submit(true, true, 'onboarding-v1')$$, 'P0001', 'application_pending', 'one pending application per applicant');
reset role;

set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::integer from public.provider_applications), 0, 'another person reads no one else''s application');
select is((select count(*)::integer from public.listing_services), 0, 'a stranger reads no listing services');
reset role;

-- Pia: fixed premises, no probing acknowledgement needed.
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(public.provider_save_draft('{"business_name":"Pia Premises (synthetic)","service_slugs":["o2-polish"],"mode":"fixed",
  "metro":"Synthetic Pretoria","description":"Synthetic premises description.","pin":{"lat":-25.7,"lng":28.2,"source":"device"},
  "radius_km":5,"applicant_role":"manager"}') is not null, 'a fixed draft with a radius saves');
select throws_ok($$select public.provider_submit(true, false, 'onboarding-v1')$$, 'P0001', 'draft_incomplete', 'fixed needs a typed address and no radius');
select ok(public.provider_save_draft('{"public_address":"3 Synthetic Street","radius_km":null}') is not null, 'the address is typed and the radius cleared');
select ok(public.provider_submit(true, false, 'onboarding-v1') is not null, 'fixed premises submits without the probing acknowledgement');
reset role;

-- Mo: mobile only, through explicit draft and acknowledged submission.
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($q$do $submit$
begin
  perform public.provider_save_draft('{"step":5,"business_name":"Mo Mobile (synthetic)","service_slugs":["o2-wash"],"mode":"mobile","metro":"Synthetic Durban","description":"Synthetic mobile description.","pin":{"lat":-29.8,"lng":31.0,"source":"tap"},"radius_km":20,"applicant_role":"owner"}');
  perform public.provider_submit(true, true, 'onboarding-v1');
end $submit$;$q$, 'mobile application uses the acknowledged submission path');
reset role;

-- ===== Admin premises label (§7) ============================================
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000009","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_decide_application((select bo_listing from o2), 'approve', 'site_visit',
  array['premises_visited','identity_checked'], 'Synthetic visit', null)$$, 'a both-listing can be labelled premises visited');
select throws_ok($$select public.admin_decide_application((select l.public_id from public.listings l where l.display_name = 'Mo Mobile (synthetic)'),
  'approve', 'site_visit', array['premises_visited'], 'Synthetic visit', null)$$, '22023', null, 'mobile-only is still refused the premises label');
select lives_ok($$select public.admin_decide_application((select l.public_id from public.listings l where l.display_name = 'Pia Premises (synthetic)'),
  'approve', 'site_visit', array['premises_visited'], 'Synthetic visit', null)$$, 'fixed premises keeps the premises label');
reset role;
select is((select d.labels from public.listing_decisions d join o2 on d.listing_public_id = o2.bo_listing),
  array['identity_checked','premises_visited'], 'the decision row records the labels');
select ok((select p.public_address = '2 Synthetic Avenue' and p.public_latitude is not null from public.listing_public p join o2 on p.public_id = o2.bo_listing),
  'a live both-listing shows its premises publicly');
select ok((select not exists (select from jsonb_object_keys(to_jsonb(p)) k where k ~ '(radius|centre|base|organisation)')
  from public.listing_public p join o2 on p.public_id = o2.bo_listing),
  'a live both-listing shows no base or radius');

-- ===== Team settings ========================================================
insert into public.memberships(organisation_id, user_id, role, status)
  select bo_org, 'b8000000-0000-4000-8000-000000000004'::uuid, 'manager', 'active' from o2
  union all select bo_org, 'b8000000-0000-4000-8000-000000000005'::uuid, 'staff', 'active' from o2;

set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_team_settings((select bo_org from o2), '{"assign_mode":"customer"}')$$, '42501', null, 'staff cannot change team settings');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.set_team_settings((select bo_org from o2), '{"assign_mode":"customer","offer_anyone":true}')$$,
  'a manager sets who gets the booking');
select throws_ok($$select public.set_team_settings((select bo_org from o2), '{"staff_contact_visibility":"phone"}')$$, '42501', null,
  'a manager cannot set what staff can see');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_team_settings((select bo_org from o2), '{"team_mfa_policy":"managers"}')$$, 'P0001', 'not_yet_available',
  'no team two-step policy can switch on before O7 enforces it');
select lives_ok($$select public.set_team_settings((select bo_org from o2), '{"team_mfa_policy":"optional","staff_contact_visibility":"first_name"}')$$,
  'the owner sets what staff can see');
select throws_ok($$select public.set_team_settings((select bo_org from o2), '{"name":"Renamed"}')$$, '22023', null, 'unknown settings are refused');
select throws_ok($$update public.organisations set assign_mode = 'business'$$, '42501', null, 'no direct writes to team settings');
reset role;
select ok((select o.assign_mode = 'customer' and o.offer_anyone and o.staff_contact_visibility = 'first_name' and o.team_mfa_policy = 'optional'
  from public.organisations o join o2 on o.id = o2.bo_org), 'team settings are stored');

-- ===== Invites ==============================================================
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.create_invite((select bo_org from o2), 'staff', null)$$, '42501', null, 'staff cannot invite');
select is((select count(*)::integer from public.invites), 0, 'staff cannot see invites');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.create_invite((select bo_org from o2), 'manager', null)$$, '42501', null, 'a manager cannot invite a manager');
select ok(set_config('tests.staff_token', public.create_invite((select bo_org from o2), 'staff', null), true) ~ '^[A-Za-z0-9_-]{43}$',
  'a manager invites staff and gets a one-time token');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.create_invite((select bo_org from o2), 'owner', null)$$, '22023', null, 'nobody can invite an owner');
select ok(set_config('tests.ivy_token', public.create_invite((select bo_org from o2), 'manager', 'Ivy.Invitee@example.test'), true) is not null,
  'the owner invites a manager by email');
select throws_ok($$select token_hash from public.invites$$, '42501', null, 'the token hash is never readable');
select is((select count(*)::integer from public.invites), 2, 'the owner sees the organisation''s invites');
reset role;
select is_empty($$select 1 from public.invites where token_hash = convert_to(current_setting('tests.staff_token'), 'UTF8')$$, 'only a hash is stored');

set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(public.accept_invite(current_setting('tests.staff_token')), (select bo_org from o2), 'Ian accepts the staff invite');
reset role;
select ok((select m.role = 'staff' and m.status = 'active' from public.memberships m join o2 on m.organisation_id = o2.bo_org
  where m.user_id = 'b8000000-0000-4000-8000-000000000007'), 'Ian is now active staff');
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_invite(current_setting('tests.staff_token'))$$, 'P0001', 'invite_invalid', 'a used invite cannot be replayed');
select throws_ok($$select public.accept_invite('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$$, 'P0001', 'invite_invalid', 'an unknown token fails the same way');
select throws_ok($$select public.accept_invite('not a token')$$, 'P0001', 'invite_invalid', 'a malformed token fails the same way');
select throws_ok($$select public.accept_invite(current_setting('tests.ivy_token'))$$, 'P0001', 'invite_invalid', 'an emailed invite needs that email');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(public.accept_invite(current_setting('tests.ivy_token')), (select bo_org from o2), 'Ivy accepts her emailed manager invite');
reset role;

set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.old_token', public.create_invite((select bo_org from o2), 'staff', null), true) is not null, 'another staff invite');
select ok(set_config('tests.sam_token', public.create_invite((select bo_org from o2), 'staff', null), true) is not null, 'one more staff invite');
reset role;
update public.invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
  where token_hash = private.invite_token_hash(current_setting('tests.old_token'));
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_invite(current_setting('tests.old_token'))$$, 'P0001', 'invite_invalid', 'an expired invite fails the same way');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_invite(current_setting('tests.sam_token'))$$, 'P0001', 'already_member', 'an active member cannot re-join through an invite');
reset role;
-- Codex P1 on #79: an invite dies when its creator loses the role, or when
-- control of the organisation changes (claim approved, dispute reversed).
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.mel_token', public.create_invite((select bo_org from o2), 'staff', null), true) is not null, 'Mel makes a staff invite');
reset role;
update public.memberships set status = 'revoked' where user_id = 'b8000000-0000-4000-8000-000000000004';
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-00000000000b","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_invite(current_setting('tests.mel_token'))$$, 'P0001', 'invite_invalid',
  'an invite dies when its creator loses their role');
reset role;
update public.memberships set status = 'active' where user_id = 'b8000000-0000-4000-8000-000000000004';
-- Demotion: a manager made staff loses the authority behind their invites.
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.mel_token2', public.create_invite((select bo_org from o2), 'staff', null), true) is not null, 'Mel makes another staff invite');
reset role;
update public.memberships set role = 'staff' where user_id = 'b8000000-0000-4000-8000-000000000004';
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-00000000000b","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_invite(current_setting('tests.mel_token2'))$$, 'P0001', 'invite_invalid',
  'an invite dies when its creator is demoted');
reset role;
update public.memberships set role = 'manager' where user_id = 'b8000000-0000-4000-8000-000000000004';
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.pre_transfer', public.create_invite((select bo_org from o2), 'manager', null), true) is not null,
  'the owner makes a manager invite before a transfer');
reset role;
create temporary table gen as select control_generation as before from public.organisations o join o2 on o.id = o2.bo_org;
-- The real P2-4 path: Cy claims the listing, the admin approves the transfer
-- (Bo's team is revoked, Cy becomes owner), Cy makes an invite, then Bo
-- disputes and the admin upholds the reversal (Cy's team revoked, Bo's back).
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.claim', public.claim_listing((select bo_listing from o2), 'document', 'Synthetic utility bill')::text, true) is not null,
  'Cy claims the listing');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000009","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_decide_claim(current_setting('tests.claim')::uuid, 'approve', 'document_check', null)$$,
  'the admin approves the transfer');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.cy_token', public.create_invite((select bo_org from o2), 'staff', null), true) is not null,
  'the new owner can invite while in control');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.dispute', public.dispute_claim(current_setting('tests.claim')::uuid, 'Synthetic: this transfer was wrong')::text, true) is not null,
  'Bo disputes the transfer');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000009","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_resolve_dispute(current_setting('tests.dispute')::uuid, 'uphold', 'Synthetic reversal')$$,
  'the admin upholds the dispute and reverses the transfer');
reset role;
select ok((select o.control_generation > g.before from public.organisations o join o2 on o.id = o2.bo_org, gen g),
  'a change of control starts a new generation');
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-00000000000b","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_invite(current_setting('tests.pre_transfer'))$$, 'P0001', 'invite_invalid',
  'an invite made before a change of control cannot be redeemed after it, even once the owner is restored');
select throws_ok($$select public.accept_invite(current_setting('tests.cy_token'))$$, 'P0001', 'invite_invalid',
  'an invite made by the reversed claimant is dead after the reversal');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(set_config('tests.post_transfer', public.create_invite((select bo_org from o2), 'staff', null), true) is not null,
  'the restored owner makes a new invite');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-00000000000b","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(public.accept_invite(current_setting('tests.post_transfer')), (select bo_org from o2), 'an invite from the current generation works');
reset role;

insert into public.invites(organisation_id, role, token_hash, created_by, control_generation)
  select o2.bo_org, 'staff', extensions.digest('o2-filler-' || g, 'sha256'), 'b8000000-0000-4000-8000-000000000001',
    (select control_generation from public.organisations where id = o2.bo_org)
  from o2, generate_series(1, 49) g;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.create_invite((select bo_org from o2), 'staff', null)$$, 'P0001', 'invite_limit', 'at most 50 open invites per organisation');
reset role;

-- ===== Staff profiles =======================================================
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.set_staff_profile((select m.id from public.memberships m where m.user_id = 'b8000000-0000-4000-8000-000000000005'),
  '{"first_name":"Sam","days":[5,1,1,3]}')$$, 'staff set their own profile');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_staff_profile((select m.id from public.memberships m where m.user_id = 'b8000000-0000-4000-8000-000000000005'),
  '{"first_name":"Hijack"}')$$, '42501', null, 'a stranger cannot edit a staff profile');
select is((select count(*)::integer from public.staff_profiles), 0, 'a stranger reads no staff profiles');
reset role;
set local request.jwt.claims = '{"sub":"b8000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.set_staff_profile((select m.id from public.memberships m where m.user_id = 'b8000000-0000-4000-8000-000000000005'),
  '{"service_slugs":["o2-wash"]}')$$, 'a manager sets what a staff member does');
reset role;
select ok((select p.first_name = 'Sam' and p.days = array[1,3,5]::smallint[] and p.service_slugs = array['o2-wash'] from public.staff_profiles p),
  'the profile keeps the name, sorted days and services');

-- ===== Main-service mirror and audit ========================================
update public.listings set service_slug = 'o2-polish' where public_id = (select bo_listing from o2);
select is((select service_slug from public.listing_services s join o2 on s.listing_public_id = o2.bo_listing and s.position = 0), 'o2-polish',
  'changing the main service on the listing keeps position 0 in step');
select ok((select count(*) >= 1 from public.audit_log where target_table = 'provider_applications')
  and (select count(*) >= 1 from public.audit_log where target_table = 'invites'), 'onboarding writes are audited');
select is_empty($$select details from public.audit_log where target_table in ('listing_services','listing_hours','provider_applications','invites','staff_profiles')
  and details <> '{}'::jsonb$$, 'onboarding audit rows carry no details (no addresses, pins, emails or tokens)');

select * from finish();
rollback;
