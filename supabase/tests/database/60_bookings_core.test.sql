-- Phase 3 test round (P3-O2), Claude's bookings lane, part 1: capacity,
-- holds, the lane contract, quotes, reschedule, cancel and late payment.
-- A18 (staggered capacity; the N+1 race is in integration/bookings-concurrency),
-- A19, A20, A22, A23 (rebook half), A27, A28, A29 (cancel half), and T-1.
-- Time can't move inside one transaction, so "15 minutes pass" or "8 days
-- ago" is written straight into the row as the table owner. Rolled back.
-- SYNTHETIC.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to booking_contract;
grant execute on all functions in schema extensions to anon, authenticated, booking_contract;
-- Let the test session act as the contract role (rolled back with the rest).
grant booking_contract to postgres;
create schema tests;
grant usage on schema tests to anon, authenticated, booking_contract;
create table tests.ids (k text primary key, v uuid not null);
-- Remember an id under a short key; tests.id() reads it back (any role).
create function tests.put(p_k text, p_v uuid) returns void language sql security definer set search_path = '' as $$
  insert into tests.ids(k, v) values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;
create function tests.id(p_k text) returns uuid language sql stable security definer set search_path = '' as $$
  select v from tests.ids where k = p_k $$;
-- First Tue-Thu at least 14 days out that is not an SA public holiday, so
-- every slot is in the future and past the 2-business-hour accept window.
create function tests.day() returns date language sql stable security definer set search_path = '' as $$
  select d::date from generate_series(current_date + 14, current_date + 60, interval '1 day') d
  where not private.is_public_holiday(d::date) and extract(isodow from d) between 2 and 4 order by d limit 1 $$;
create function tests.at(p_hhmi text, p_plus_days int default 0) returns timestamptz language sql stable set search_path = '' as $$
  select ((tests.day() + p_plus_days) + p_hhmi::time) at time zone 'Africa/Johannesburg' $$;
create function tests.span(p_from text, p_to text, p_plus_days int default 0) returns tstzrange language sql stable set search_path = '' as $$
  select tstzrange(tests.at(p_from, p_plus_days), tests.at(p_to, p_plus_days), '[)') $$;
-- Act as a signed-in user (call, then `set local role authenticated`).
create function tests.act(p_user uuid, p_aal text default 'aal1') returns void language sql set search_path = '' as $$
  select null::void from (select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true)) s $$;
-- A synthetic paid attempt in the money lane's table (fixture only), so the
-- contract call private.request_refund finds a paid payment.
create function tests.paid(p_booking uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare b record; v uuid;
begin
  select * into b from public.bookings where id = p_booking;
  insert into private.payment_attempts(hold_id, booking_id, customer_id, organisation_id, quote_version_id, amount_minor,
    subaccount, hold_expires_at, state, provider_id)
  values (b.hold_id, b.id, b.customer_id, b.organisation_id, b.quote_version_id, b.amount_minor, 'ACCT_synthetic1',
    coalesce((select expires_at from public.reservations where id = b.hold_id), now()), 'paid', 'test_' || b.id)
  returning id into v;
  return v;
end $$;
grant execute on all functions in schema tests to anon, authenticated, booking_contract;

-- People: owner, manager, two staff of org A; owner of org B; two customers; an admin.
insert into auth.users (id, email, email_confirmed_at) values
  ('c0000000-0000-4000-8000-000000000001','olga.owner@example.test',now()),
  ('c0000000-0000-4000-8000-000000000002','mia.manager@example.test',now()),
  ('c0000000-0000-4000-8000-000000000003','sid.staff@example.test',now()),
  ('c0000000-0000-4000-8000-000000000004','sam.staff@example.test',now()),
  ('c0000000-0000-4000-8000-000000000005','bob.otherorg@example.test',now()),
  ('c0000000-0000-4000-8000-000000000006','cara.customer@example.test',now()),
  ('c0000000-0000-4000-8000-000000000007','cody.customer@example.test',now()),
  ('c0000000-0000-4000-8000-000000000008','ada.admin@example.test',now());
insert into private.platform_admins(user_id) values ('c0000000-0000-4000-8000-000000000008');
insert into public.categories(slug,name) values ('bk-cat','Bookings test category (synthetic)');
insert into public.services(slug,category_slug,name) values ('bk-wash','bk-cat','Bookings test wash (synthetic)');
insert into public.organisations(id,name) values
  ('c1000000-0000-4000-8000-00000000000a','Org A Wash (synthetic)'),
  ('c1000000-0000-4000-8000-00000000000b','Org B Wash (synthetic)');
insert into public.memberships(id,organisation_id,user_id,role,status) values
  ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-000000000001','owner','active'),
  ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-000000000002','manager','active'),
  ('c2000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-000000000003','staff','active'),
  ('c2000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-000000000004','staff','active'),
  ('c2000000-0000-4000-8000-000000000005','c1000000-0000-4000-8000-00000000000b','c0000000-0000-4000-8000-000000000005','owner','active');
insert into public.coordinate_sources(id,organisation_id,source_kind,licence_note) values
  ('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-00000000000a','provider_supplied','Synthetic');
insert into public.branches(public_id,organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values
  ('c4000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-00000000000a','Synthetic','1 Synthetic Road',-26.1,28.0,'c3000000-0000-4000-8000-000000000001');
insert into public.listings(public_id,organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,status,provenance_kind,provenance_reference) values
  ('c5000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-00000000000a','bk-wash','c4000000-0000-4000-8000-000000000001','Synthetic fixed','Synthetic','Gauteng','fixed','live','admin_import','Synthetic'),
  ('c5000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-00000000000a','bk-wash',null,'Synthetic mobile','Synthetic','Gauteng','mobile','live','admin_import','Synthetic');
insert into public.service_areas(listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values
  ('c5000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-00000000000a',-26.1,28.0,40,'c3000000-0000-4000-8000-000000000001');
insert into private.payment_accounts(organisation_id,subaccount) values ('c1000000-0000-4000-8000-00000000000a','ACCT_synthetic1');
-- Resources: one bay of capacity 2; two calendars of capacity 1 (A20); one mobile team of capacity 1.
insert into public.resources(id,organisation_id,kind,name,capacity,mobile) values
  ('c6000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-00000000000a','bay','Bay cap 2',2,false),
  ('c6000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-00000000000a','calendar','Calendar 1',1,false),
  ('c6000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-00000000000a','calendar','Calendar 2',1,false),
  ('c6000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-00000000000a','team','Mobile team',1,true);
insert into public.resource_hours(resource_id,organisation_id,weekday,opens,closes)
  select r.id, r.organisation_id, w, '06:00', '20:00' from public.resources r, generate_series(1,7) w
  where r.organisation_id = 'c1000000-0000-4000-8000-00000000000a';
insert into public.service_offers(id,organisation_id,listing_public_id,name,pricing,price_minor,duration_minutes,buffer_minutes,resource_kind) values
  ('c7000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-00000000000a','c5000000-0000-4000-8000-000000000001','Fixed wash (bay)','fixed',25000,60,0,'bay'),
  ('c7000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-00000000000a','c5000000-0000-4000-8000-000000000001','Quoted repair (bay)','quote',null,60,0,'bay'),
  ('c7000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-00000000000a','c5000000-0000-4000-8000-000000000001','Detail with 15 min buffer (calendar)','fixed',40000,60,15,'calendar'),
  ('c7000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-00000000000a','c5000000-0000-4000-8000-000000000002','Mobile wash (team)','fixed',30000,60,0,'team');
insert into public.travel_bands(organisation_id,listing_public_id,up_to_km,travel_minutes,charge_minor) values
  ('c1000000-0000-4000-8000-00000000000a','c5000000-0000-4000-8000-000000000002',10,20,5000),
  ('c1000000-0000-4000-8000-00000000000a','c5000000-0000-4000-8000-000000000002',40,45,15000);
-- request -> accept -> (confirm) through the real functions, as the customer
-- and then the org A owner. The booking id doubles as the synthetic payment
-- attempt id.
create function tests.book(p_customer uuid, p_offer uuid, p_start timestamptz, p_confirm boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid; h uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_customer, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  v := private.request_booking(p_offer, p_start);
  perform set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-4000-8000-000000000001', 'role', 'authenticated', 'aal', 'aal1')::text, true);
  h := private.accept_booking(v, 15);
  if p_confirm then perform private.confirm_paid(h, v); end if;
  return v;
end $$;
create function tests.hold(p_k text) returns uuid language sql stable security definer set search_path = '' as $$
  select hold_id from public.bookings where id = tests.id(p_k) $$;
grant execute on all functions in schema tests to anon, authenticated, booking_contract;

select plan(105);

-- ===== A18 capacity N, staggered case (plan §5 C1). Bay capacity 2, day 0 =====
select tests.put('r1', private.reserve('c6000000-0000-4000-8000-000000000001', tests.span('09:00','10:00'), 'booking'));
select tests.put('r2', private.reserve('c6000000-0000-4000-8000-000000000001', tests.span('10:00','11:00'), 'booking'));
select isnt(tests.id('r2'), null, 'A18: [09:00,10:00) and [10:00,11:00) both reserved on a capacity-2 bay');
select lives_ok($$select private.reserve('c6000000-0000-4000-8000-000000000001', tests.span('09:00','11:00'), 'booking')$$,
  'A18 staggered: a new [09:00,11:00) still fits capacity 2 (peak 1, not "2 overlaps")');
select throws_ok($$select private.reserve('c6000000-0000-4000-8000-000000000001', tests.span('09:00','11:00'), 'booking')$$,
  'P0001', 'capacity_full', 'A18: a second [09:00,11:00) would reach peak 3 and is refused');
select throws_ok($$select private.reserve('c6000000-0000-4000-8000-000000000001', tests.span('09:30','10:30'), 'booking')$$,
  'P0001', 'capacity_full', 'A18: [09:30,10:30) meets two reservations at 09:30 and is refused');
select lives_ok($$select private.reserve('c6000000-0000-4000-8000-000000000001', tests.span('11:00','12:00'), 'booking')$$,
  'A19: [11:00,12:00) right after the full block is free');
select is(private.peak_concurrency('c6000000-0000-4000-8000-000000000001', tests.span('09:00','11:00')), 2,
  'A18: peak over [09:00,11:00) is exactly the capacity');

-- ===== A19 adjacent intervals, capacity-1 team, day 1 =====
select lives_ok($$select private.reserve('c6000000-0000-4000-8000-000000000004', tests.span('09:00','10:00',1), 'booking')$$, 'A19: [09:00,10:00) on capacity 1');
select lives_ok($$select private.reserve('c6000000-0000-4000-8000-000000000004', tests.span('10:00','11:00',1), 'booking')$$, 'A19: adjacent [10:00,11:00) after it');
select lives_ok($$select private.reserve('c6000000-0000-4000-8000-000000000004', tests.span('08:00','09:00',1), 'booking')$$, 'A19: adjacent [08:00,09:00) before it');
select throws_ok($$select private.reserve('c6000000-0000-4000-8000-000000000004', tests.span('09:59','10:01',1), 'booking')$$,
  'P0001', 'capacity_full', 'A19: a two-minute overlap is refused');

-- ===== A19 buffers + A20 parallel resources: two capacity-1 calendars, 15-min buffer, day 2 =====
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('bc1', public.request_booking('c7000000-0000-4000-8000-000000000003', tests.at('09:00',2)));
select tests.put('bc3', public.request_booking('c7000000-0000-4000-8000-000000000003', tests.at('09:30',2)));
select is((select upper(during) - lower(during) from public.bookings where id = tests.id('bc1')), interval '75 minutes',
  'A19: the reserved interval is the 60-minute job plus its 15-minute buffer');
reset role; select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select tests.put('bc2', public.request_booking('c7000000-0000-4000-8000-000000000003', tests.at('10:00',2)));
select tests.put('bc4', public.request_booking('c7000000-0000-4000-8000-000000000003', tests.at('10:15',2)));
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select tests.put('hc1', public.accept_booking(tests.id('bc1')));
select tests.put('hc2', public.accept_booking(tests.id('bc2')));
select is((select resource_id from public.bookings where id = tests.id('bc1')), 'c6000000-0000-4000-8000-000000000002'::uuid, 'A20: job 1 (09:00) on Calendar 1');
select is((select resource_id from public.bookings where id = tests.id('bc2')), 'c6000000-0000-4000-8000-000000000003'::uuid,
  'A19+A20: 10:00 hits job 1''s buffer on Calendar 1, so it runs in parallel on Calendar 2');
select throws_ok($$select public.accept_booking(tests.id('bc3'))$$, 'P0001', 'capacity_full', 'A20: 09:30 overlaps both calendars and is refused');
select lives_ok($$select tests.put('hc4', public.accept_booking(tests.id('bc4')))$$, 'A19: 10:15 starts exactly when job 1''s buffer ends');
select is((select resource_id from public.bookings where id = tests.id('bc4')), 'c6000000-0000-4000-8000-000000000002'::uuid, 'A19: and it goes back on Calendar 1');

-- ===== A22 hold expiry releases capacity. Bay capacity 2 at 12:00, day 3 =====
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('bh1', public.request_booking('c7000000-0000-4000-8000-000000000001', tests.at('12:00',3)));
select tests.put('bh3', public.request_booking('c7000000-0000-4000-8000-000000000001', tests.at('12:00',3)));
reset role; select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select tests.put('bh2', public.request_booking('c7000000-0000-4000-8000-000000000001', tests.at('12:00',3)));
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select tests.put('h1', public.accept_booking(tests.id('bh1')));
select tests.put('h2', public.accept_booking(tests.id('bh2')));
select is((select expires_at - now() from public.reservations where id = tests.id('h1')), interval '15 minutes', 'A22: a payment hold lasts 15 minutes');
select is((select state from public.bookings where id = tests.id('bh1')), 'awaiting_payment', 'A22: accepted booking waits for payment');
select throws_ok($$select public.accept_booking(tests.id('bh3'))$$, 'P0001', 'capacity_full', 'A22: both seats are held, a third acceptance is refused');
reset role;
update public.reservations set expires_at = now() - interval '1 second' where id = tests.id('h1'); -- the 15 minutes pass
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select lives_ok($$select tests.put('h3', public.accept_booking(tests.id('bh3')))$$, 'A22: an expired hold stops counting at once, before the expiry job runs');
reset role;
select is(private.expire_holds(), 1, 'A22: the expiry job marks exactly the one lapsed hold');
select is((select state from public.bookings where id = tests.id('bh1')), 'payment_expired', 'A22: its booking is payment_expired');
select is((select state from public.reservations where id = tests.id('h1')), 'expired', 'A22: its reservation is expired');

-- ===== Lane contract (plan §4) =====
select results_eq($$select amount_minor, currency, state from private.hold_snapshot(tests.id('h2'))$$,
  $$values (25000::bigint, 'ZAR'::text, 'active'::text)$$, 'contract: hold_snapshot gives the amount, ZAR and active');
select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select is((select count(*)::int from public.hold_snapshot(tests.id('h2'))), 1, 'contract: public.hold_snapshot returns the customer''s own hold');
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select is((select count(*)::int from public.hold_snapshot(tests.id('h2'))), 0, 'contract: another customer gets no row');
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select is((select count(*)::int from public.hold_snapshot(tests.id('h2'))), 0, 'contract: the provider gets no row either (customer only)');
reset role; set local request.jwt.claims = '{"role":"anon"}'; set local role anon;
select throws_ok($$select * from public.hold_snapshot(tests.id('h2'))$$, '42501', null, 'contract: anon cannot call hold_snapshot');
reset role;
select ok(not has_function_privilege('authenticated', 'private.hold_snapshot(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.confirm_paid(uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'private.confirm_paid(uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.hold_snapshot(uuid)', 'execute'),
  'contract: app roles cannot execute private.hold_snapshot or private.confirm_paid');
select ok(has_function_privilege('booking_contract', 'private.confirm_paid(uuid,uuid)', 'execute')
  and has_function_privilege('booking_contract', 'private.hold_snapshot(uuid)', 'execute')
  and has_function_privilege('money_server', 'private.confirm_paid(uuid,uuid)', 'execute'),
  'contract: booking_contract holds both, and money_server inherits them');
set local role booking_contract;
select is(private.confirm_paid(tests.id('h2'), 'c9000000-0000-4000-8000-000000000001'), 'confirmed', 'contract: confirm_paid via booking_contract confirms an active hold');
select is(private.confirm_paid(tests.id('h2'), 'c9000000-0000-4000-8000-000000000001'), 'already_confirmed', 'contract: the same payment again is idempotent');
select is(private.confirm_paid(tests.id('h2'), 'c9000000-0000-4000-8000-000000000002'), 'hold_expired', 'contract: a different second payment is never a second job');
reset role;
select results_eq($$select b.state, r.kind from public.bookings b join public.reservations r on r.id = b.hold_id where b.id = tests.id('bh2')$$,
  $$values ('confirmed'::text, 'booking'::text)$$, 'contract: confirmed booking holds a permanent reservation');
set local role booking_contract;
select is(private.confirm_paid(tests.id('h1'), 'c9000000-0000-4000-8000-000000000003'), 'hold_expired', 'A23: a payment after expiry is never confirmed silently');
reset role;
select is((select state from public.bookings where id = tests.id('bh1')), 'paid_after_expiry', 'A23: the booking moves to late-payment resolution');

-- ===== A23 rebook if available (Claude's half) =====
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select ok(exists(select 1 from public.rebook_options(tests.id('bh1'))), 'A23: rebook_options lists free slots for the late payer');
select ok(not exists(select 1 from public.rebook_options(tests.id('bh1')) where starts_at = tests.at('12:00',3)),
  'A23: the original 12:00 slot is full again and is not offered');
reset role; select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select throws_ok($$select * from public.rebook_options(tests.id('bh1'))$$, '42501', null, 'A23: another customer cannot list the options');
select throws_ok($$select public.rebook_after_late_payment(tests.id('bh1'), 'c6000000-0000-4000-8000-000000000001', tests.at('14:00',3))$$,
  '42501', null, 'A23: another customer cannot rebook it');
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select throws_ok($$select public.rebook_after_late_payment(tests.id('bh1'), 'c6000000-0000-4000-8000-000000000001', tests.at('12:00',3))$$,
  'P0001', 'capacity_full', 'A23: a slot that is taken is refused');
select is((select state from public.bookings where id = tests.id('bh1')), 'paid_after_expiry', 'A23: and the booking still waits for resolution');
select lives_ok($$select public.rebook_after_late_payment(tests.id('bh1'), 'c6000000-0000-4000-8000-000000000001', tests.at('14:00',3))$$,
  'A23: the customer rebooks a free slot');
reset role;
select results_eq($$select state, lower(during) from public.bookings where id = tests.id('bh1')$$,
  $$values ('confirmed'::text, tests.at('14:00',3))$$, 'A23: rebooked and confirmed at the new time');
select is(private.confirm_paid(tests.id('h1'), 'c9000000-0000-4000-8000-000000000003'), 'already_confirmed', 'A23: replaying the late charge after rebooking is idempotent');

-- ===== Business-hours acceptance clock and SA public holidays =====
select is(private.add_business_minutes('2026-12-24 16:00+02', 120), '2026-12-28 09:00+02'::timestamptz,
  'clock: skips Christmas Day, Day of Goodwill and Sunday');
select is(private.add_business_minutes('2027-03-20 16:30+02', 120), '2027-03-23 09:30+02'::timestamptz,
  'clock: skips a Sunday holiday (Human Rights Day 2027) and its observed Monday');
select is(private.add_business_minutes('2026-11-16 08:00+02', 120), '2026-11-16 10:00+02'::timestamptz, 'clock: plain Monday morning');
select is(private.add_business_minutes('2026-11-14 16:00+02', 120), '2026-11-16 09:00+02'::timestamptz, 'clock: Saturday counts, Sunday does not');
select ok(private.is_public_holiday('2027-03-26') and private.is_public_holiday('2027-03-29') and private.is_public_holiday('2027-03-22')
  and not private.is_public_holiday('2027-03-24'), 'holidays: Good Friday, Family Day and an observed Monday are holidays; an ordinary day is not');
select throws_ok($$select private.reserve('c6000000-0000-4000-8000-000000000001',
    tstzrange((make_date(extract(year from current_date)::int + 1, 4, 27) + time '09:00') at time zone 'Africa/Johannesburg',
              (make_date(extract(year from current_date)::int + 1, 4, 27) + time '10:00') at time zone 'Africa/Johannesburg', '[)'), 'booking')$$,
  'P0001', 'outside_hours', 'holidays: nothing is reserved on Freedom Day even inside opening hours');
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('bq', public.request_booking('c7000000-0000-4000-8000-000000000001', tests.at('15:00',3)));
reset role;
select is((select accept_by from public.bookings where id = tests.id('bq')), private.add_business_minutes(now(), 120),
  'clock: a request must be answered within 2 business hours on the holiday-aware clock');
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select throws_ok($$select public.request_booking('c7000000-0000-4000-8000-000000000001', now() + interval '5 minutes')$$,
  'P0001', 'too_soon', 'clock: a start before the accept deadline plus the hold is refused');
reset role;
update public.bookings set accept_by = now() - interval '1 second' where id = tests.id('bq');
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select throws_ok($$select public.accept_booking(tests.id('bq'))$$, 'P0001', 'request_lapsed', 'clock: a late acceptance is refused');
reset role;
do $$ begin perform private.expire_holds(); end $$;
select is((select state from public.bookings where id = tests.id('bq')), 'lapsed', 'clock: the expiry job lapses the unanswered request');

-- ===== A27 quotes. Quote offer on the bay, day 4 =====
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('q1', public.request_quote('c7000000-0000-4000-8000-000000000002', 'Brakes squeal (synthetic)'));
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select tests.put('v1', public.issue_quote_version(tests.id('q1'),
  '[{"label":"Front pads","amount_minor":120000},{"label":"Labour","amount_minor":30000}]', 60));
reset role;
select is((select total_minor from public.quote_versions where id = tests.id('v1')), 150000::bigint, 'A27: version total is the sum of its lines');
select is((select valid_until - issued_at from public.quote_versions where id = tests.id('v1')), interval '7 days', 'A27: default expiry is 7 days');
select throws_ok($$update public.quote_versions set total_minor = 100 where id = tests.id('v1')$$, 'P0001', 'immutable',
  'A27: an issued version''s content cannot change, even for the table owner');
select throws_ok($$delete from public.quote_versions where id = tests.id('v1')$$, 'P0001', 'immutable', 'A27: versions cannot be deleted');
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select tests.put('v2', public.issue_quote_version(tests.id('q1'), '[{"label":"Front pads","amount_minor":110000}]', 60));
reset role;
select is((select state from public.quote_versions where id = tests.id('v1')), 'superseded', 'A27: revision supersedes the earlier version');
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select throws_ok($$select public.approve_quote_version(tests.id('v1'), tests.at('09:00',4))$$, 'P0001', 'version_not_current',
  'A27: approving a superseded version is refused');
reset role; select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select throws_ok($$select public.approve_quote_version(tests.id('v2'), tests.at('09:00',4))$$, '42501', null, 'A27: another customer cannot approve it');
reset role; select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select throws_ok($$select public.issue_quote_version(tests.id('q1'), '[{"label":"Pads","amount_minor":1000}]', 60)$$, '42501', null,
  'A27: staff (not owner or manager) cannot issue a version');
reset role; select tests.act('c0000000-0000-4000-8000-000000000005'); set local role authenticated;
select throws_ok($$select public.issue_quote_version(tests.id('q1'), '[{"label":"Pads","amount_minor":1000}]', 60)$$, '42501', null,
  'A27: another organisation cannot issue a version');
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('qb2', public.approve_quote_version(tests.id('v2'), tests.at('09:00',4)));
reset role;
select results_eq($$select state, amount_minor from public.bookings where id = tests.id('qb2')$$, $$values ('awaiting_payment'::text, 110000::bigint)$$,
  'A27: approving the exact version gives a hold at that version''s total');
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select tests.put('v3', public.issue_quote_version(tests.id('q1'), '[{"label":"Front pads and discs","amount_minor":180000}]', 90));
reset role;
select results_eq($$select v.state, b.state, r.state from public.quote_versions v, public.bookings b join public.reservations r on r.id = b.hold_id
    where v.id = tests.id('v2') and b.id = tests.id('qb2')$$, $$values ('superseded'::text, 'cancelled'::text, 'released'::text)$$,
  'A27: revising an approved, unpaid version supersedes it, cancels its payable and frees its hold');
set local role booking_contract;
select is(private.confirm_paid(tests.hold('qb2'), 'c9000000-0000-4000-8000-000000000020'), 'hold_expired', 'A27: paying a superseded version never confirms it');
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('qb3', public.approve_quote_version(tests.id('v3'), tests.at('11:00',4)));
reset role; set local role booking_contract;
select is(private.confirm_paid(tests.hold('qb3'), 'c9000000-0000-4000-8000-000000000010'), 'confirmed', 'A27: the current version is paid');
reset role;
select results_eq($$select v.state, q.state from public.quote_versions v join public.quotes q on q.id = v.quote_id where v.id = tests.id('v3')$$,
  $$values ('paid'::text, 'paid'::text)$$, 'A27: version and quote are marked paid');
select throws_ok($$update public.quote_versions set state = 'superseded' where id = tests.id('v3')$$, 'P0001', 'immutable',
  'A27: a paid version is never relabelled');
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select throws_ok($$select public.issue_quote_version(tests.id('q1'), '[{"label":"More","amount_minor":1000}]', 60)$$, 'P0001', 'wrong_state',
  'A27: a paid quote cannot be revised');
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('q2', public.request_quote('c7000000-0000-4000-8000-000000000002', 'Diagnostic (synthetic)'));
reset role;
insert into public.quote_versions(id, quote_id, organisation_id, version, lines, total_minor, duration_minutes, valid_until, issued_by, issued_at)
values ('c8000000-0000-4000-8000-000000000001', tests.id('q2'), 'c1000000-0000-4000-8000-00000000000a', 1,
  '[{"label":"Diagnostic","amount_minor":50000}]', 50000, 60, now() - interval '1 day', 'c0000000-0000-4000-8000-000000000001', now() - interval '8 days');
update public.quotes set state = 'quoted' where id = tests.id('q2');
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select throws_ok($$select public.approve_quote_version('c8000000-0000-4000-8000-000000000001', tests.at('13:00',4))$$, 'P0001', 'quote_expired',
  'A27: a version past its 7 days cannot be approved');
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select tests.put('cq', public.start_change_quote(tests.id('qb3'), 'Extra: wipers (synthetic)'));
select tests.put('cv1', public.issue_quote_version(tests.id('cq'), '[{"label":"Wipers","amount_minor":20000}]', 15));
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('cb', public.approve_quote_version(tests.id('cv1')));
reset role;
select results_eq($$select parent_booking_id, amount_minor, state from public.bookings where id = tests.id('cb')$$,
  $$values (tests.id('qb3'), 20000::bigint, 'awaiting_payment'::text)$$, 'A27: extra work is a separate change quote with its own payable');
select is(private.peak_concurrency('c6000000-0000-4000-8000-000000000001', (select during from public.bookings where id = tests.id('qb3'))), 1,
  'A27: the change payable takes no extra capacity');

-- ===== A28 reschedule. Bay capacity 2, day 5 =====
select tests.put('rb1', tests.book('c0000000-0000-4000-8000-000000000006', 'c7000000-0000-4000-8000-000000000001', tests.at('09:00',5)));
select tests.put('rb2', tests.book('c0000000-0000-4000-8000-000000000007', 'c7000000-0000-4000-8000-000000000001', tests.at('11:00',5)));
select tests.put('rb3', tests.book('c0000000-0000-4000-8000-000000000007', 'c7000000-0000-4000-8000-000000000001', tests.at('11:00',5)));
select tests.put('rr1', private.booking_reservation(tests.id('rb1')));
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select throws_ok($$select public.reschedule_booking(tests.id('rb1'), tests.at('11:00',5))$$, 'P0001', 'capacity_full', 'A28: moving into a full slot fails');
reset role;
select results_eq($$select lower(during), reschedule_count from public.bookings where id = tests.id('rb1')$$,
  $$values (tests.at('09:00',5), 0::smallint)$$, 'A28: the original time is kept');
select results_eq($$select id, state from public.reservations where booking_id = tests.id('rb1') and state = 'active'$$,
  $$values (tests.id('rr1'), 'active'::text)$$, 'A28: the original reservation is still the only active one');
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select throws_ok($$select public.reschedule_booking(tests.id('rb1'), tests.at('19:30',5))$$, 'P0001', null, 'A28: moving past closing time fails');
reset role;
select is(private.booking_reservation(tests.id('rb1')), tests.id('rr1'), 'A28: and still nothing was released');
select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select throws_ok($$select public.reschedule_booking(tests.id('rb1'), tests.at('14:00',5))$$, '42501', null, 'A28: another customer cannot reschedule');
reset role; select tests.act('c0000000-0000-4000-8000-000000000005'); set local role authenticated;
select throws_ok($$select public.reschedule_booking(tests.id('rb1'), tests.at('14:00',5))$$, '42501', null, 'A28: another organisation cannot reschedule');
reset role; select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select throws_ok($$select public.reschedule_booking(tests.id('rb1'), tests.at('14:00',5))$$, '42501', null, 'A28: staff (not owner or manager) cannot reschedule');
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select lives_ok($$select public.reschedule_booking(tests.id('rb1'), tests.at('14:00',5))$$, 'A28: moving to a free slot works');
reset role;
select is((select state from public.reservations where id = tests.id('rr1')), 'released', 'A28: the old slot is released only after the new one is held');
select results_eq($$select lower(b.during), b.reschedule_count,
    (select count(*)::int from public.reservations r where r.booking_id = b.id and r.state = 'active') from public.bookings b where b.id = tests.id('rb1')$$,
  $$values (tests.at('14:00',5), 1::smallint, 1)$$, 'A28: one active reservation, at the new time');

-- ===== A29 cancel -> refund request (Claude's half). Bay, day 6 =====
select tests.put('cx1', tests.book('c0000000-0000-4000-8000-000000000006', 'c7000000-0000-4000-8000-000000000001', tests.at('09:00',6)));
select tests.put('pa1', tests.paid(tests.id('cx1')));
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select is(public.cancel_booking(tests.id('cx1')), 'cancelled_refund_requested', 'A29: a customer cancelling 24h+ ahead gets a full refund request');
reset role;
select results_eq($$select r.amount_minor, r.actor from private.payment_refunds r join private.payment_attempts a on a.id = r.attempt_id
    where a.booking_id = tests.id('cx1')$$, $$values (25000::bigint, 'cancel:' || tests.id('cx1'))$$,
  'A29: request_refund got the full amount and the key cancel:<booking_id>');
select is((select count(*)::int from public.reservations where booking_id = tests.id('cx1') and state = 'active'), 0, 'A29: the slot is released');
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select throws_ok($$select public.cancel_booking(tests.id('cx1'))$$, 'P0001', 'wrong_state', 'A29: a second cancel is refused');
reset role;
select is((select count(*)::int from private.payment_refunds r join private.payment_attempts a on a.id = r.attempt_id where a.booking_id = tests.id('cx1')), 1,
  'A29: so there is exactly one refund request');
select tests.put('rf1', (select r.id from private.payment_refunds r where r.attempt_id = tests.id('pa1')));
set local role booking_contract;
select is(private.request_refund(tests.id('cx1'), 25000, 'cancelled_by_customer', 'cancel:' || tests.id('cx1')),
  tests.id('rf1'), 'A29: a duplicate refund request with the same key collapses');
select is(private.confirm_paid(tests.hold('cx1'), tests.id('cx1')), 'already_confirmed', 'T-1: replaying the charge after a paid cancellation is idempotent');
reset role;
select is((select state from public.bookings where id = tests.id('cx1')), 'cancelled', 'T-1: and the booking stays cancelled');
select tests.put('cx2', tests.book('c0000000-0000-4000-8000-000000000007', 'c7000000-0000-4000-8000-000000000001', tests.at('09:00',6)));
do $$ begin perform tests.paid(tests.id('cx2')); end $$;
update public.bookings set during = tstzrange(now() + interval '2 hours', now() + interval '3 hours', '[)') where id = tests.id('cx2');
select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select is(public.cancel_booking(tests.id('cx2')), 'cancelled', 'A29: a customer cancelling under 24h ahead gets no automatic refund');
reset role;
select is((select count(*)::int from private.payment_refunds r join private.payment_attempts a on a.id = r.attempt_id where a.booking_id = tests.id('cx2')), 0,
  'A29: no refund row for the late customer cancel');
select tests.put('cx3', tests.book('c0000000-0000-4000-8000-000000000006', 'c7000000-0000-4000-8000-000000000001', tests.at('11:00',6)));
do $$ begin perform tests.paid(tests.id('cx3')); end $$;
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select is(public.cancel_booking(tests.id('cx3')), 'cancelled_refund_requested', 'A29: a provider cancel always requests a full refund');
reset role;
select tests.put('cx4', tests.book('c0000000-0000-4000-8000-000000000006', 'c7000000-0000-4000-8000-000000000001', tests.at('13:00',6), false));
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select is(public.cancel_booking(tests.id('cx4')), 'cancelled', 'A29: cancelling while payment is pending requests no refund (nothing paid yet)');
reset role;
select is((select state from public.reservations where id = tests.hold('cx4')), 'released', 'A29: and frees the hold');
set local role booking_contract;
select is(private.confirm_paid(tests.hold('cx4'), 'c9000000-0000-4000-8000-000000000044'), 'hold_expired', 'A29: a payment landing after that cancel is not confirmed');
reset role;
select is((select state from public.bookings where id = tests.id('cx4')), 'paid_after_expiry', 'A29+A23: it goes to late-payment resolution');
do $$ begin perform tests.paid(tests.id('cx4')); end $$;
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select is(public.cancel_booking(tests.id('cx4')), 'cancelled_refund_requested', 'A29+A23: the late payer choosing a refund gets a full refund request');
reset role; set local role booking_contract;
select is(private.confirm_paid(tests.hold('cx4'), 'c9000000-0000-4000-8000-000000000044'), 'hold_expired', 'T-1: replaying that charge does not reopen the refunded booking');
reset role;
select is((select state from public.bookings where id = tests.id('cx4')), 'cancelled', 'T-1: it stays cancelled');
select tests.put('cx5', tests.book('c0000000-0000-4000-8000-000000000007', 'c7000000-0000-4000-8000-000000000001', tests.at('15:00',6)));
update public.bookings set during = tstzrange(now() - interval '2 hours', now() - interval '1 hour', '[)') where id = tests.id('cx5');
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$ begin perform public.complete_booking(tests.id('cx5')); end $$;
reset role; set local role booking_contract;
select is(private.confirm_paid(tests.hold('cx5'), tests.id('cx5')), 'already_confirmed', 'T-1: replay on a completed job is idempotent (no false late-payment case)');
reset role;
do $$ begin perform tests.paid(tests.id('qb3')); end $$;
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$ begin perform public.cancel_booking(tests.id('qb3')); end $$;
reset role;
select results_eq($$select state from public.bookings where id in (tests.id('qb3'), tests.id('cb')) order by id$$,
  $$values ('cancelled'::text), ('cancelled'::text)$$, 'A29: cancelling a job also cancels its open change payable');

select * from finish();
rollback;
