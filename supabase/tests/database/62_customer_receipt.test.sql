-- Claude 25 §3a (a), D-096: customer_receipt(ref) is the paying customer's
-- only, and only once paid. Everyone else gets NULL (the route's 404).
-- Synthetic fixture; everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(19);

create function pg_temp.act(p_user uuid, p_aal text default 'aal1') returns void language sql as $$
  select null::void from (select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true)) s $$;

-- Fixture ----------------------------------------------------------------------
insert into auth.users(id, email, email_confirmed_at) values
  ('d6200000-0000-4000-8000-000000000001', 'receipt-customer@example.test', now()),
  ('d6200000-0000-4000-8000-000000000002', 'receipt-other@example.test', now()),
  ('d6200000-0000-4000-8000-000000000003', 'receipt-owner@example.test', now()),
  ('d6200000-0000-4000-8000-000000000004', 'receipt-admin@example.test', now());
insert into private.platform_admins(user_id) values ('d6200000-0000-4000-8000-000000000004');
insert into public.organisations(id, name) values ('d6200000-0000-4000-8000-000000000010', 'Receipt Org (synthetic)');
insert into public.memberships(organisation_id, user_id, role, status) values
  ('d6200000-0000-4000-8000-000000000010', 'd6200000-0000-4000-8000-000000000003', 'owner', 'active');
insert into public.categories(slug, name) values ('receipt-cat', 'Receipt test category (synthetic)');
insert into public.services(slug, category_slug, name) values ('receipt-svc', 'receipt-cat', 'Receipt test service');
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference) values
  ('d6201000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010', 'receipt-svc', 'Gleam Valet (synthetic)', 'Synthetic', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-receipt');
insert into public.service_offers(id, organisation_id, listing_public_id, name, pricing, price_minor, duration_minutes) values
  ('d6202000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010', 'd6201000-0000-4000-8000-000000000001', 'Full valet', 'fixed', 65000, 60);
insert into public.resources(id, organisation_id, kind, name, mobile) values
  ('d6203000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010', 'team', 'Team 1', true);
insert into public.reservations(id, resource_id, organisation_id, during, kind, state, expires_at, released_at) values
  ('d6204000-0000-4000-8000-000000000001', 'd6203000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010',
   tstzrange('2026-12-01 07:00+00', '2026-12-01 08:00+00', '[)'), 'hold', 'converted', now() + interval '15 minutes', now()),
  ('d6204000-0000-4000-8000-000000000002', 'd6203000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010',
   tstzrange('2026-12-02 07:00+00', '2026-12-02 08:00+00', '[)'), 'hold', 'active', now() + interval '15 minutes', null);
insert into public.bookings(id, organisation_id, customer_id, offer_id, during, state, accept_by, amount_minor, hold_id, confirmed_at, travel_charge_minor) values
  ('d6205000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010', 'd6200000-0000-4000-8000-000000000001',
   'd6202000-0000-4000-8000-000000000001', tstzrange('2026-12-01 07:00+00', '2026-12-01 08:00+00', '[)'), 'confirmed', now(), 83000,
   'd6204000-0000-4000-8000-000000000001', now(), 18000),
  ('d6205000-0000-4000-8000-000000000002', 'd6200000-0000-4000-8000-000000000010', 'd6200000-0000-4000-8000-000000000001',
   'd6202000-0000-4000-8000-000000000001', tstzrange('2026-12-02 07:00+00', '2026-12-02 08:00+00', '[)'), 'awaiting_payment', now(), 83000,
   'd6204000-0000-4000-8000-000000000002', null, 18000);
insert into private.payment_attempts(id, hold_id, booking_id, customer_id, organisation_id, amount_minor, subaccount, hold_expires_at, state, provider_id, reference) values
  ('d6206000-0000-4000-8000-000000000001', 'd6204000-0000-4000-8000-000000000001', 'd6205000-0000-4000-8000-000000000001',
   'd6200000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010', 83000, 'ACCT_receiptsynthetic', now() + interval '15 minutes',
   'paid', '9962000001', 'cx_a1b2c3d4e5f6000000000000000000a1'),
  ('d6206000-0000-4000-8000-000000000002', 'd6204000-0000-4000-8000-000000000002', 'd6205000-0000-4000-8000-000000000002',
   'd6200000-0000-4000-8000-000000000001', 'd6200000-0000-4000-8000-000000000010', 83000, 'ACCT_receiptsynthetic', now() + interval '15 minutes',
   'ready', null, 'cx_b1b2c3d4e5f6000000000000000000b2');

-- Structure and grants ------------------------------------------------------------
select ok((select prosecdef and provolatile = 's' and proconfig @> array['search_path=""'] from pg_proc
  where oid = 'private.customer_receipt(text)'::regprocedure), 'private read is STABLE SECURITY DEFINER with an empty search_path');
select ok((select not prosecdef from pg_proc where oid = 'public.customer_receipt(text)'::regprocedure), 'public name is a SECURITY INVOKER wrapper');
select ok(has_function_privilege('authenticated', 'public.customer_receipt(text)', 'execute'), 'signed-in users can call it');
select ok(not has_function_privilege('anon', 'public.customer_receipt(text)', 'execute')
  and not has_function_privilege('anon', 'private.customer_receipt(text)', 'execute'), 'anon cannot call it');
select ok(not has_function_privilege('service_role', 'public.customer_receipt(text)', 'execute'), 'no service_role grant');

-- The paying customer --------------------------------------------------------------
select pg_temp.act('d6200000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.customer_receipt('CX-A1B2C3D4E5F6')->>'ref', 'CX-A1B2C3D4E5F6', 'the customer gets their receipt');
select is((public.customer_receipt('CX-A1B2C3D4E5F6')->>'amount_minor')::bigint, 83000::bigint, 'amount paid');
select is(public.customer_receipt('CX-A1B2C3D4E5F6')->>'business', 'Gleam Valet (synthetic)', 'the listing name is the supplier');
select is(public.customer_receipt('CX-A1B2C3D4E5F6')->>'service', 'Full valet', 'service name');
select is((public.customer_receipt('CX-A1B2C3D4E5F6')->>'travel_minor')::bigint, 18000::bigint, 'travel charge');
select is(public.customer_receipt('CX-A1B2C3D4E5F6')->>'mode', 'test', 'test mode is reported');
select is(public.customer_receipt('CX-B1B2C3D4E5F6'), null, 'no receipt before the payment is paid');
select is(public.customer_receipt('CX-a1b2c3d4e5f6'), null, 'lower-case reference is not accepted');
select is(public.customer_receipt('CX-FFFFFFFFFFFF'), null, 'unknown reference');
select is(public.customer_receipt('cx_a1b2c3d4e5f6000000000000000000a1'), null, 'the internal payment reference is not a receipt reference');
reset role;

-- Everyone else: the same NULL as an unknown reference --------------------------------
select pg_temp.act('d6200000-0000-4000-8000-000000000002');
set local role authenticated;
select is(public.customer_receipt('CX-A1B2C3D4E5F6'), null, 'another customer gets nothing');
reset role;
select pg_temp.act('d6200000-0000-4000-8000-000000000003');
set local role authenticated;
select is(public.customer_receipt('CX-A1B2C3D4E5F6'), null, 'the business owner gets nothing (not their document)');
reset role;
select pg_temp.act('d6200000-0000-4000-8000-000000000004', 'aal2');
set local role authenticated;
select is(public.customer_receipt('CX-A1B2C3D4E5F6'), null, 'an aal2 admin gets nothing');
reset role;
select null::void from (select set_config('request.jwt.claims', '', true)) s;
set local role anon;
select throws_ok($$select public.customer_receipt('CX-A1B2C3D4E5F6')$$, '42501', null, 'anon is refused');
reset role;

select * from finish();
rollback;
