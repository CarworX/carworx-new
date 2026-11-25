-- Finish-build PR 5 (D-098): transfer ownership (the new owner accepts) and
-- close a listing. Who may, wrong business, re-checks at accept time, the
-- audit rows and the two-step rule. One transaction, rolled back. SYNTHETIC.
--
-- Actors: Olu owner and Max manager at Bay; Sia staff at Bay; Ola owner at
-- Other (wrong business).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('d5800000-0000-4000-8000-000000000001', 'olu.owner@example.test', now()),
  ('d5800000-0000-4000-8000-000000000002', 'max.manager@example.test', now()),
  ('d5800000-0000-4000-8000-000000000003', 'sia.staff@example.test', now()),
  ('d5800000-0000-4000-8000-000000000004', 'ola.other@example.test', now());
insert into public.profiles (id, display_name) values
  ('d5800000-0000-4000-8000-000000000001', 'Olu Owner (synthetic)'),
  ('d5800000-0000-4000-8000-000000000002', 'Max Manager (synthetic)');
insert into public.categories(slug, name) values ('x6-cat', 'X6 category (synthetic)');
insert into public.services(slug, category_slug, name) values ('x6-wash', 'x6-cat', 'X6 wash (synthetic)');
insert into public.organisations (id, name) values
  ('d5810000-0000-4000-8000-000000000001', 'Bay fixture (synthetic)'),
  ('d5810000-0000-4000-8000-000000000002', 'Other fixture (synthetic)');
insert into public.memberships (id, organisation_id, user_id, role) values
  ('d5820000-0000-4000-8000-000000000001', 'd5810000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000001', 'owner'),
  ('d5820000-0000-4000-8000-000000000002', 'd5810000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000002', 'staff'),
  ('d5820000-0000-4000-8000-000000000003', 'd5810000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000003', 'staff'),
  ('d5820000-0000-4000-8000-000000000004', 'd5810000-0000-4000-8000-000000000002', 'd5800000-0000-4000-8000-000000000004', 'owner');
update public.memberships set role = 'manager' where id = 'd5820000-0000-4000-8000-000000000002';
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference) values
  ('d5830000-0000-4000-8000-000000000001', 'd5810000-0000-4000-8000-000000000001', 'x6-wash', 'Bay wash (synthetic)', 'Synthetic live listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic'),
  ('d5830000-0000-4000-8000-000000000002', 'd5810000-0000-4000-8000-000000000001', 'x6-wash', 'Bay held (synthetic)', 'Synthetic suspended listing', 'Gauteng', 'mobile', 'suspended', 'admin_import', 'synthetic');

select plan(34);

-- ===== Grants ===============================================================
select ok(not has_function_privilege('anon', 'public.offer_ownership(uuid)', 'execute'), 'anon cannot offer ownership');
select ok(not has_function_privilege('anon', 'public.close_listing(uuid)', 'execute'), 'anon cannot close a listing');
select ok(not has_table_privilege('authenticated', 'private.ownership_offers', 'select'), 'nobody reads offers directly');
select ok(not has_table_privilege('authenticated', 'private.listing_closures', 'select'), 'nobody reads closures directly');
select is((select count(*)::integer from public.listing_public where public_id = 'd5830000-0000-4000-8000-000000000001'), 1,
  'the live listing is in search before closing');

-- ===== Offer: owners only, to their own team =================================
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.offer_ownership('d5820000-0000-4000-8000-000000000003')$$, '42501', 'not_allowed',
  'a manager cannot offer ownership');
select throws_ok($$select public.close_listing('d5830000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'a manager cannot close a listing');
reset role;
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.offer_ownership('d5820000-0000-4000-8000-000000000002')$$, '42501', 'not_allowed',
  'an owner of another business cannot offer this one');
select throws_ok($$select public.close_listing('d5830000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'nor close its listing');
select is((select count(*)::integer from public.ownership_offers()), 0, 'and sees no offer of another business');
reset role;

set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.offer_ownership('d5820000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'an owner cannot offer it to themself');
select throws_ok($$select public.offer_ownership('d5820000-0000-4000-8000-000000000004')$$, '42501', 'not_allowed',
  'nor to someone at another business');
-- Called once and kept: BETWEEN would evaluate a volatile call twice.
do $$ begin perform set_config('tests.expires', public.offer_ownership('d5820000-0000-4000-8000-000000000002')::text, true); end $$;
select ok(current_setting('tests.expires')::timestamptz between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days',
  'the owner offers it to the manager, for 7 days');
select throws_ok($$select public.offer_ownership('d5820000-0000-4000-8000-000000000003')$$, 'P0001', 'offer_pending',
  'one open offer per business');
select is((select other_name || ' ' || incoming::text from public.ownership_offers()), 'Max Manager (synthetic) false',
  'the owner sees who it was offered to');
select ok(public.cancel_ownership_offer('d5810000-0000-4000-8000-000000000001'), 'the owner can cancel it');
select ok(not public.cancel_ownership_offer('d5810000-0000-4000-8000-000000000001'), 'cancelling again does nothing');
select lives_ok($$select public.offer_ownership('d5820000-0000-4000-8000-000000000002')$$, 'and offer it again');
reset role;

-- ===== Respond: only the person offered =====================================
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.respond_ownership_offer('d5810000-0000-4000-8000-000000000001', true)$$, 'P0001', 'offer_invalid',
  'someone else on the team cannot accept it');
select is((select count(*)::integer from public.ownership_offers()), 0, 'or see it');
reset role;

-- An expired offer cannot be accepted.
update private.ownership_offers set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
  where organisation_id = 'd5810000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.respond_ownership_offer('d5810000-0000-4000-8000-000000000001', true)$$, 'P0001', 'offer_invalid',
  'an expired offer cannot be accepted');
reset role;
update private.ownership_offers set created_at = now(), expires_at = now() + interval '7 days'
  where organisation_id = 'd5810000-0000-4000-8000-000000000001';

set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select organisation_name || ' ' || other_name || ' ' || incoming::text from public.ownership_offers()),
  'Bay fixture (synthetic) Olu Owner (synthetic) true', 'the manager sees the offer and who made it');
select ok(public.respond_ownership_offer('d5810000-0000-4000-8000-000000000001', true), 'the manager accepts');
reset role;
select is((select role from public.memberships where id = 'd5820000-0000-4000-8000-000000000002'), 'owner', 'the manager is now the owner');
select is((select role from public.memberships where id = 'd5820000-0000-4000-8000-000000000001'), 'manager', 'and the old owner a manager');
select is((select count(*)::integer from private.ownership_offers), 0, 'the offer is gone');
select is((select array_agg(details->>'event' order by id) from public.audit_log where target_table = 'ownership_offers'),
  array['offered','cancelled','offered','accepted'], 'each step is in the audit log (IDs only)');
select ok(exists (select from public.audit_log where target_table = 'memberships' and action = 'update'
  and details->>'role' = 'owner' and details->>'user_id' = 'd5800000-0000-4000-8000-000000000002'),
  'and the team history records the new owner');

-- A stale offer from someone who is no longer an owner is refused.
insert into private.ownership_offers(organisation_id, from_user, to_membership, to_user) values
  ('d5810000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000001',
   'd5820000-0000-4000-8000-000000000003', 'd5800000-0000-4000-8000-000000000003');
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.respond_ownership_offer('d5810000-0000-4000-8000-000000000001', true)$$, 'P0001', 'offer_invalid',
  'an offer from someone who is no longer an owner is refused');
select ok(not public.respond_ownership_offer('d5810000-0000-4000-8000-000000000001', false), 'it can be declined');
reset role;

-- ===== Close a listing ======================================================
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.close_listing('d5830000-0000-4000-8000-000000000002')$$, 'P0001', 'listing_suspended',
  'a suspended listing stays as the admin left it');
select lives_ok($$select public.close_listing('d5830000-0000-4000-8000-000000000001')$$, 'the new owner closes the live listing');
select is((select listing_public_id from public.closed_listings('d5810000-0000-4000-8000-000000000001')),
  'd5830000-0000-4000-8000-000000000001'::uuid, 'the business sees it as closed');
reset role;
select is((select count(*)::integer from public.listing_public where public_id = 'd5830000-0000-4000-8000-000000000001'), 0,
  'it is out of search at once');

select * from finish();
rollback;
