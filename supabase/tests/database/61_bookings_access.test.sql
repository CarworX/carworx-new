-- Phase 3 test round (P3-O2), Claude's bookings lane, part 2: mobile jobs
-- (A30, T-2), address privacy (A31), membership revocation (A34), and the
-- RLS / grant refusals for anon, other customers, other organisations and
-- staff who are neither assigned nor managers. Rolled back. SYNTHETIC.
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
create function tests.hold(p_k text) returns uuid language sql stable security definer set search_path = '' as $$
  select hold_id from public.bookings where id = tests.id(p_k) $$;
-- Rows of a query visible to the current role, or -1 if it has no privilege.
create function tests.rows(stmt text) returns integer language plpgsql set search_path = '' as $$
declare n integer;
begin execute 'select count(*) from (' || stmt || ') s' into n; return n;
exception when insufficient_privilege then return -1; end $$;
grant execute on all functions in schema tests to anon, authenticated, booking_contract;

select plan(70);

-- ===== A30 mobile: straight-line bands, provider-confirmed buffer, manual timing. Team capacity 1, day 0 =====
select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('m1', public.request_mobile_booking('c7000000-0000-4000-8000-000000000004', tests.at('09:00'), 'Rosebank',
  '12 Synthetic Street, Rosebank', -26.145, 28.0, 'Gate code 0000 (synthetic)'));
reset role;
select results_eq($$select travel_minutes, travel_charge_minor, amount_minor, upper(during) - lower(during), distance_km, state
    from public.bookings where id = tests.id('m1')$$,
  $$values (20, 5000::bigint, 35000::bigint, interval '80 minutes', 5.0::numeric(6,1), 'requested'::text)$$,
  'A30: ~5 km straight-line picks the 10 km band: +20 min and +R50, and the request waits for a person');
select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select throws_ok($$select public.request_mobile_booking('c7000000-0000-4000-8000-000000000004', tests.at('12:00'), 'Far', '1 Far Road', -26.6, 28.0)$$,
  'P0001', 'outside_area', 'A30: an address beyond the service radius is refused');
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select throws_ok($$select public.accept_booking(tests.id('m1'))$$, 'P0001', 'travel_unconfirmed',
  'A30/T-2: no routing, so a mobile job cannot be accepted until the provider confirms its timing');
reset role; select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select throws_ok($$select public.set_travel_buffer(tests.id('m1'), 30, 6000)$$, '42501', null, 'A30: staff cannot set the travel buffer');
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select lives_ok($$select public.set_travel_buffer(tests.id('m1'), 30, 6000)$$, 'A30: the owner confirms 30 minutes of travel');
reset role;
select results_eq($$select upper(during) - lower(during), amount_minor from public.bookings where id = tests.id('m1')$$,
  $$values (interval '90 minutes', 36000::bigint)$$, 'A30: the confirmed buffer is in the reserved interval and the price');
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select tests.put('hm1', public.accept_booking(tests.id('m1')));
reset role; select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select tests.put('m2', public.request_mobile_booking('c7000000-0000-4000-8000-000000000004', tests.at('10:15'), 'Parktown', '3 Synthetic Lane, Parktown', -26.15, 28.0));
select tests.put('m3', public.request_mobile_booking('c7000000-0000-4000-8000-000000000004', tests.at('10:30'), 'Parktown', '4 Synthetic Lane, Parktown', -26.15, 28.0));
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$ begin perform public.set_travel_buffer(tests.id('m2'), 20); perform public.set_travel_buffer(tests.id('m3'), 20); end $$;
select throws_ok($$select public.accept_booking(tests.id('m2'))$$, 'P0001', 'capacity_full', 'A30: 10:15 overlaps job 1''s travel buffer (to 10:30) on the one team');
select lives_ok($$select tests.put('hm3', public.accept_booking(tests.id('m3')))$$, 'A30: 10:30, right after the buffer, fits');
select throws_ok($$select public.set_travel_buffer(tests.id('m1'), 10)$$, 'P0001', 'wrong_state', 'A30: travel cannot change after acceptance');
reset role; set local role booking_contract;
select is(private.confirm_paid(tests.id('hm1'), 'c9000000-0000-4000-8000-000000000101'), 'confirmed', 'A30: job 1 is paid');
reset role;

-- ===== A31 address: assigned staff only, after confirmation, hidden 7 days after completion =====
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$ begin
  perform public.assign_staff(tests.id('m1'), 'c2000000-0000-4000-8000-000000000003');
  perform public.assign_staff(tests.id('m3'), 'c2000000-0000-4000-8000-000000000003');
end $$;
reset role; select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m3'))$$, '42501', null, 'A31: assigned staff get no address before confirmation');
select is((select suburb from public.bookings where id = tests.id('m3')), 'Parktown', 'A31: before confirmation the provider sees only the suburb');
select results_eq($$select address, access_notes from public.job_address(tests.id('m1'))$$,
  $$values ('12 Synthetic Street, Rosebank'::text, 'Gate code 0000 (synthetic)'::text)$$, 'A31: assigned staff read the full address once confirmed');
reset role;
select is((select count(*)::int from private.booking_event where booking_id = tests.id('m1') and kind = 'address_read'
  and data ->> 'reader_id' = 'c0000000-0000-4000-8000-000000000003'), 1, 'A31: that read is logged with the reader');
select ok(not exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name ilike '%address%'),
  'A31: the bookings table carries no address column');
select tests.act('c0000000-0000-4000-8000-000000000004'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m1'))$$, '42501', null, 'A31: unassigned staff are refused');
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m1'))$$, '42501', null, 'A31: even the owner needs an assignment');
reset role; select tests.act('c0000000-0000-4000-8000-000000000005'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m1'))$$, '42501', null, 'A31: another organisation is refused');
reset role; select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m1'))$$, '42501', null, 'A31: another customer is refused');
reset role; select tests.act('c0000000-0000-4000-8000-000000000008', 'aal1'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m1'))$$, '42501', null, 'A31: an admin without aal2 is refused');
reset role; select tests.act('c0000000-0000-4000-8000-000000000008', 'aal2'); set local role authenticated;
select is((select address from public.job_address(tests.id('m1'))), '12 Synthetic Street, Rosebank', 'A31: an aal2 admin can read it');
reset role;
select is((select count(*)::int from private.booking_event where booking_id = tests.id('m1') and kind = 'admin_address_read'
  and data ->> 'reader_id' = 'c0000000-0000-4000-8000-000000000008'), 1, 'A31: and the admin read is audited');
update public.bookings set during = tstzrange(now() - interval '3 hours', now() - interval '90 minutes', '[)') where id = tests.id('m1');
select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$ begin perform public.complete_booking(tests.id('m1')); end $$;
reset role; select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select lives_ok($$select * from public.job_address(tests.id('m1'))$$, 'A31: still readable within 7 days of completion');
reset role;
update public.bookings set completed_at = now() - interval '7 days 1 minute' where id = tests.id('m1');
select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m1'))$$, '42501', null, 'A31: hidden 7 days after completion');
reset role;
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname in ('booking_addresses','booking_event') and not c.relrowsecurity$$,
  'A31: private.booking_addresses and private.booking_event have RLS on');
select is_empty($$select policyname from pg_policies where schemaname = 'private' and tablename in ('booking_addresses','booking_event')$$,
  'A31: and no policies (only definer functions reach them)');
select ok(not has_table_privilege('authenticated', 'private.booking_addresses', 'select')
  and not has_table_privilege('anon', 'private.booking_addresses', 'select')
  and not has_table_privilege('service_role', 'private.booking_addresses', 'select')
  and not has_table_privilege('authenticated', 'private.booking_event', 'select')
  and not has_table_privilege('authenticated', 'private.booking_event', 'insert'), 'A31: no client role can read addresses or the event feed directly');

-- ===== A34 a revoked member loses booking and quote access on the next request =====
set local role booking_contract;
select is(private.confirm_paid(tests.id('hm3'), 'c9000000-0000-4000-8000-000000000103'), 'confirmed', 'A34 setup: job 3 is paid');
reset role; select tests.act('c0000000-0000-4000-8000-000000000006'); set local role authenticated;
select tests.put('q1', public.request_quote('c7000000-0000-4000-8000-000000000002', 'Noise (synthetic)'));
reset role; select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select tests.put('f1', public.request_booking('c7000000-0000-4000-8000-000000000001', tests.at('09:00',1)));
reset role; select tests.act('c0000000-0000-4000-8000-000000000002'); set local role authenticated;
select lives_ok($$select tests.put('qv1', public.issue_quote_version(tests.id('q1'), '[{"label":"Check","amount_minor":30000}]', 60))$$,
  'A34 before: the manager issues a quote version');
select ok(tests.rows('select 1 from public.bookings') > 0 and tests.rows('select 1 from public.quote_versions') > 0,
  'A34 before: the manager sees bookings and quote versions');
reset role; select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select ok(exists(select 1 from public.my_jobs() where booking_id = tests.id('m3')), 'A34 before: the job is in staff "my jobs"');
select lives_ok($$select * from public.job_address(tests.id('m3'))$$, 'A34 before: staff read the confirmed job''s address');
select ok(tests.rows('select 1 from public.bookings') > 0 and tests.rows('select 1 from public.quotes') > 0,
  'A34 before: staff see the organisation''s bookings and quotes');
reset role;
update public.memberships set status = 'revoked' where id in ('c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000003');
-- Same JWTs as before: nothing is cached, every request re-checks membership.
select tests.act('c0000000-0000-4000-8000-000000000003'); set local role authenticated;
select throws_ok($$select * from public.job_address(tests.id('m3'))$$, '42501', null, 'A34: revoked staff lose the address on the next request');
select is((select count(*)::int from public.my_jobs()), 0, 'A34: "my jobs" is empty');
select is(tests.rows('select 1 from public.bookings') + tests.rows('select 1 from public.reservations') + tests.rows('select 1 from public.booking_assignments'), 0,
  'A34: no bookings, reservations or assignments are visible');
select is(tests.rows('select 1 from public.quotes') + tests.rows('select 1 from public.quote_versions'), 0, 'A34: no quotes or versions are visible');
reset role; select tests.act('c0000000-0000-4000-8000-000000000002'); set local role authenticated;
select throws_ok($$select public.issue_quote_version(tests.id('q1'), '[{"label":"Check","amount_minor":20000}]', 60)$$, '42501', null,
  'A34: a revoked manager cannot revise a quote');
select throws_ok($$select public.accept_booking(tests.id('f1'))$$, '42501', null, 'A34: or accept a booking');
select throws_ok($$select public.cancel_booking(tests.id('f1'))$$, '42501', null, 'A34: or cancel one');
select is(tests.rows('select 1 from public.bookings') + tests.rows('select 1 from public.quote_versions'), 0, 'A34: and sees no bookings or quotes');
reset role; select tests.act('c0000000-0000-4000-8000-000000000001'); set local role authenticated;
select throws_ok($$select public.assign_staff(tests.id('m3'), 'c2000000-0000-4000-8000-000000000003')$$, '22023', null,
  'A34: a revoked membership cannot be assigned again');
reset role;

-- ===== RLS and grants: direct-RPC and table refusals =====
-- anon
set local request.jwt.claims = '{"role":"anon"}'; set local role anon;
select throws_ok($$select public.request_booking('c7000000-0000-4000-8000-000000000001', tests.at('09:00',2))$$, '42501', null, 'anon: cannot request a booking');
select throws_ok($$select * from public.available_slots('c7000000-0000-4000-8000-000000000001', tests.day())$$, '42501', null, 'anon: cannot list slots');
select is(tests.rows('select 1 from public.bookings') + tests.rows('select 1 from public.quotes') + tests.rows('select 1 from public.reservations')
  + tests.rows('select 1 from public.resources') + tests.rows('select 1 from public.service_offers'), -5, 'anon: no SELECT on any booking table');
reset role;
select is_empty($$select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and has_function_privilege('anon', p.oid, 'execute')
      and p.proname in ('request_booking','accept_booking','decline_booking','request_quote','issue_quote_version','approve_quote_version',
        'start_change_quote','decline_quote','reschedule_booking','cancel_booking','complete_booking','rebook_options','rebook_after_late_payment',
        'request_mobile_booking','set_travel_buffer','assign_staff','unassign_staff','job_address','my_jobs','save_travel_band','save_resource',
        'set_resource_hours','add_resource_closure','save_service_offer','available_slots','bookable_offers','hold_snapshot','my_hold_snapshot',
        'confirm_paid','reserve','release_reservation','place_hold','place_change_hold','expire_holds','expire_due_bookings','booking_log')$$,
  'anon: executes no booking function at all');
select is_empty($$select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('reserve','release_reservation','place_hold','place_change_hold','booking_log','hold_snapshot',
      'confirm_paid','booking_reservation','booking_actor','peak_concurrency','within_opening','km_between')
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute'))$$,
  'authenticated/service_role: cannot execute the capacity primitives or the contract');
select is_empty($$select table_name || ':' || privilege_type from information_schema.role_table_grants
    where grantee in ('anon','authenticated','service_role') and table_schema = 'public'
      and table_name in ('resources','resource_hours','resource_closures','public_holiday_extras','service_offers','reservations','bookings',
        'quotes','quote_versions','travel_bands','booking_assignments')
      and (grantee <> 'authenticated' or privilege_type <> 'SELECT')$$,
  'grants: clients hold only SELECT for authenticated on booking tables; every write goes through functions');
select is_empty($$select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
    and relname in ('resources','resource_hours','resource_closures','public_holiday_extras','service_offers','reservations','bookings',
      'quotes','quote_versions','travel_bands','booking_assignments') and not relrowsecurity$$, 'RLS is on for every booking table');
select is_empty($$select r.rolname from pg_roles r where r.rolname in ('booking_server','booking_contract')
    and (r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb or r.rolinherit)$$, 'booking_server and booking_contract are limited, non-inheriting roles');
select is_empty($$select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles g on g.oid = m.member
    where r.rolname in ('booking_server','booking_contract') and g.rolname in ('authenticator','anon','authenticated','service_role')$$,
  'PostgREST roles cannot switch to booking_server or booking_contract');
-- other customer (Cody) against Cara's booking m1 and quote q1
select tests.act('c0000000-0000-4000-8000-000000000007'); set local role authenticated;
select is(tests.rows($$select 1 from public.bookings where customer_id = 'c0000000-0000-4000-8000-000000000006'$$)
  + tests.rows($$select 1 from public.quotes where customer_id = 'c0000000-0000-4000-8000-000000000006'$$)
  + tests.rows($$select 1 from public.reservations where booking_id = tests.id('m1')$$), 0, 'other customer: sees none of Cara''s bookings, quotes or reservations');
select throws_ok($$select public.cancel_booking(tests.id('m1'))$$, '42501', null, 'other customer: cannot cancel Cara''s booking');
select throws_ok($$select public.approve_quote_version(tests.id('qv1'), tests.at('09:00',3))$$, '42501', null, 'other customer: cannot approve Cara''s quote');
select throws_ok($$select public.decline_quote(tests.id('q1'))$$, '42501', null, 'other customer: cannot decline Cara''s quote');
select is((select count(*)::int from public.hold_snapshot(tests.id('hm1'))), 0, 'other customer: no snapshot of Cara''s hold');
-- other organisation (Bob, owner of org B)
reset role; select tests.act('c0000000-0000-4000-8000-000000000005'); set local role authenticated;
select is(tests.rows('select 1 from public.bookings') + tests.rows('select 1 from public.reservations') + tests.rows('select 1 from public.quotes')
  + tests.rows('select 1 from public.quote_versions') + tests.rows('select 1 from public.resources') + tests.rows('select 1 from public.service_offers')
  + tests.rows('select 1 from public.travel_bands') + tests.rows('select 1 from public.booking_assignments'), 0, 'other org: sees no row of org A''s booking data');
select throws_ok($$select public.accept_booking(tests.id('f1'))$$, '42501', null, 'other org: cannot accept');
select throws_ok($$select public.decline_booking(tests.id('f1'))$$, '42501', null, 'other org: cannot decline');
select throws_ok($$select public.set_travel_buffer(tests.id('m2'), 20)$$, '42501', null, 'other org: cannot set travel');
select throws_ok($$select public.assign_staff(tests.id('m3'), 'c2000000-0000-4000-8000-000000000005')$$, '42501', null, 'other org: cannot assign staff');
select throws_ok($$select public.complete_booking(tests.id('m3'))$$, '42501', null, 'other org: cannot complete');
select throws_ok($$select public.cancel_booking(tests.id('m3'))$$, '42501', null, 'other org: cannot cancel');
select throws_ok($$select public.save_resource('c1000000-0000-4000-8000-00000000000a', null, 'bay', 'Sneaky bay', 5::smallint, false, true)$$, '42501', null,
  'other org: cannot add a resource to org A');
select throws_ok($$select public.start_change_quote(tests.id('m3'))$$, '42501', null, 'other org: cannot start a change quote');
-- non-assigned, non-manager staff (Sam)
reset role; select tests.act('c0000000-0000-4000-8000-000000000004'); set local role authenticated;
select throws_ok($$select public.accept_booking(tests.id('f1'))$$, '42501', null, 'staff: cannot accept');
select throws_ok($$select public.cancel_booking(tests.id('m3'))$$, '42501', null, 'staff: cannot cancel');
select throws_ok($$select public.complete_booking(tests.id('m3'))$$, '42501', null, 'staff: cannot complete');
select throws_ok($$select public.assign_staff(tests.id('m3'), 'c2000000-0000-4000-8000-000000000004')$$, '42501', null, 'staff: cannot assign themselves');
select is((select count(*)::int from public.my_jobs()), 0, 'staff: an unassigned member has no jobs');
reset role;

select * from finish();
rollback;
