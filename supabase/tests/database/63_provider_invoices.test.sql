-- Claude 25 §3a (b), D-054, D-096: provider invoices and monthly statements.
-- Off until the gate is on; owners and managers only; VAT snapshot at issue;
-- immutable; deleted after 5 years. Synthetic fixture; everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(37);

create function pg_temp.act(p_user uuid, p_aal text default 'aal1') returns void language sql as $$
  select null::void from (select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true)) s $$;

-- Commission is not charged yet (the money lane pins the fee to 0). Simulate
-- the future here only; the transaction rolls this back.
alter table private.payment_attempts drop constraint payment_attempts_platform_fee_amount_minor_check;

-- Fixture ----------------------------------------------------------------------
insert into auth.users(id, email, email_confirmed_at) values
  ('d6300000-0000-4000-8000-000000000001', 'inv-owner@example.test', now()),
  ('d6300000-0000-4000-8000-000000000002', 'inv-manager@example.test', now()),
  ('d6300000-0000-4000-8000-000000000003', 'inv-staff@example.test', now()),
  ('d6300000-0000-4000-8000-000000000004', 'inv-other-owner@example.test', now()),
  ('d6300000-0000-4000-8000-000000000005', 'inv-customer@example.test', now()),
  ('d6300000-0000-4000-8000-000000000006', 'inv-admin@example.test', now());
insert into private.platform_admins(user_id) values ('d6300000-0000-4000-8000-000000000006');
insert into public.organisations(id, name) values
  ('d6300000-0000-4000-8000-000000000010', 'Invoice Org A (synthetic)'),
  ('d6300000-0000-4000-8000-000000000020', 'Invoice Org B (synthetic)');
insert into public.memberships(organisation_id, user_id, role, status) values
  ('d6300000-0000-4000-8000-000000000010', 'd6300000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('d6300000-0000-4000-8000-000000000010', 'd6300000-0000-4000-8000-000000000002', 'manager', 'active'),
  ('d6300000-0000-4000-8000-000000000010', 'd6300000-0000-4000-8000-000000000003', 'staff', 'active'),
  ('d6300000-0000-4000-8000-000000000020', 'd6300000-0000-4000-8000-000000000004', 'owner', 'active');
-- Two paid jobs for org A last month, one this month (not invoiced yet), one with no fee.
insert into private.payment_attempts(id, hold_id, booking_id, customer_id, organisation_id, amount_minor, subaccount,
  hold_expires_at, state, provider_id, reference, platform_fee_amount_minor) values
  ('d6306000-0000-4000-8000-000000000001', gen_random_uuid(), gen_random_uuid(), 'd6300000-0000-4000-8000-000000000005',
   'd6300000-0000-4000-8000-000000000010', 83000, 'ACCT_invsynthetic', now(), 'paid', '9963000001', 'cx_d6300000000000000000000000000001', 8300),
  ('d6306000-0000-4000-8000-000000000002', gen_random_uuid(), gen_random_uuid(), 'd6300000-0000-4000-8000-000000000005',
   'd6300000-0000-4000-8000-000000000010', 900000, 'ACCT_invsynthetic', now(), 'paid', '9963000002', 'cx_d6300000000000000000000000000002', 50000),
  ('d6306000-0000-4000-8000-000000000003', gen_random_uuid(), gen_random_uuid(), 'd6300000-0000-4000-8000-000000000005',
   'd6300000-0000-4000-8000-000000000010', 20000, 'ACCT_invsynthetic', now(), 'paid', '9963000003', 'cx_d6300000000000000000000000000003', 2000),
  ('d6306000-0000-4000-8000-000000000004', gen_random_uuid(), gen_random_uuid(), 'd6300000-0000-4000-8000-000000000005',
   'd6300000-0000-4000-8000-000000000020', 20000, 'ACCT_invsynthetic', now(), 'paid', '9963000004', 'cx_d6300000000000000000000000000004', 0);
insert into private.payment_inbox(event_key, reference, kind, provider_id, amount_minor, currency, status, state) values
  (repeat('1', 64), 'cx_d6300000000000000000000000000001', 'charge.success', '9963000001', 83000, 'ZAR', 'success', 'applied'),
  (repeat('2', 64), 'cx_d6300000000000000000000000000002', 'charge.success', '9963000002', 900000, 'ZAR', 'success', 'applied'),
  (repeat('3', 64), 'cx_d6300000000000000000000000000003', 'charge.success', '9963000003', 20000, 'ZAR', 'success', 'applied'),
  (repeat('4', 64), 'cx_d6300000000000000000000000000004', 'charge.success', '9963000004', 20000, 'ZAR', 'success', 'applied');
create temp table m as select
  (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '1 month')::date as last_month,
  date_trunc('month', now() at time zone 'Africa/Johannesburg')::date as this_month;
insert into private.payment_effects(attempt_id, provider_id, event_key, applied_at)
select a, p, k, (select last_month from m)::timestamp at time zone 'Africa/Johannesburg' + d
from (values
  ('d6306000-0000-4000-8000-000000000001'::uuid, '9963000001', repeat('1', 64), interval '2 days 10 hours'),
  ('d6306000-0000-4000-8000-000000000002'::uuid, '9963000002', repeat('2', 64), interval '20 days 9 hours'),
  ('d6306000-0000-4000-8000-000000000004'::uuid, '9963000004', repeat('4', 64), interval '3 days')) v(a, p, k, d);
insert into private.payment_effects(attempt_id, provider_id, event_key, applied_at)
values ('d6306000-0000-4000-8000-000000000003', '9963000003', repeat('3', 64), now());

-- Structure and grants ------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.provider_invoices()', 'execute')
  and not has_function_privilege('anon', 'public.provider_invoice(text)', 'execute'), 'anon cannot read invoices');
select ok(has_function_privilege('authenticated', 'public.provider_invoice(text)', 'execute'), 'signed-in users can call the read');
select ok(not has_function_privilege('authenticated', 'private.issue_monthly_invoices()', 'execute')
  and not has_function_privilege('authenticated', 'private.issue_invoices_for(date)', 'execute'), 'browsers cannot issue invoices');
select ok(has_function_privilege('money_server', 'private.issue_monthly_invoices()', 'execute'), 'money_server issues');
select ok(has_function_privilege('retention_server', 'private.purge_old_invoices()', 'execute'), 'retention_server purges');
select ok(not has_table_privilege('authenticated', 'private.provider_invoices', 'select'), 'no direct table read');
select ok((select not prosecdef from pg_proc where oid = 'public.provider_invoice(text)'::regprocedure), 'public read is SECURITY INVOKER');

-- Gate off (no settings row): nothing issued, nothing listed --------------------------
select is(private.issue_monthly_invoices(), 0, 'gate off: nothing is issued');
select is((select count(*)::int from private.provider_invoices), 0, 'gate off: no invoice rows');
select pg_temp.act('d6300000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.provider_invoices()->>'enabled', 'false', 'gate off: the list says disabled');
reset role;

-- Gate on, VAT off (OQ-E1 default) ----------------------------------------------------
insert into private.billing_settings(id, invoices_enabled) values (true, true);
select is(private.issue_monthly_invoices(), 1, 'one invoice for the one business with commission');
select is(private.issue_monthly_invoices(), 0, 'idempotent: a second run issues nothing');
select throws_ok($$select private.issue_invoices_for((select this_month from m))$$, '22023', null, 'the current month cannot be invoiced yet');
select is((select total_minor from private.provider_invoices), 58300::bigint, 'total is the commission taken');
select is((select jobs from private.provider_invoices), 2, 'two jobs on the statement');
select ok((select not vat_registered and vat_minor = 0 and vat_number is null from private.provider_invoices), 'no VAT while the switch is off');
select matches((select ref from private.provider_invoices), '^CXI-[0-9]{6}$', 'reference is CXI- plus a serial number');
select ok(not exists(select 1 from private.provider_invoices, jsonb_array_elements(lines) l
  where l ?| array['customer', 'customer_id', 'email', 'name']), 'lines carry no customer details');
select throws_ok($$update private.provider_invoices set total_minor = 1$$, '42501', null, 'issued invoices cannot be changed');
-- Codex review on #121: retries don't use up serial numbers; renames don't change issued invoices.
select is((select max(number) from private.provider_invoices) + 1,
  (select last_value + 1 from private.provider_invoices_number_seq),
  'daily retries do not consume serial numbers');
update public.organisations set name = 'Renamed Org A (synthetic)' where id = 'd6300000-0000-4000-8000-000000000010';
select is((select business_name from private.provider_invoices), 'Invoice Org A (synthetic)',
  'the recipient name is the one at issue, not after a rename');

-- Access ------------------------------------------------------------------------------
create temp table r as select ref from private.provider_invoices;
grant select on r to authenticated;
select pg_temp.act('d6300000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.provider_invoice((select ref from r))->>'total_minor', '58300', 'the owner gets the invoice');
select is(jsonb_array_length(public.provider_invoices()->'invoices'), 1, 'the owner sees it listed');
reset role;
select pg_temp.act('d6300000-0000-4000-8000-000000000002');
set local role authenticated;
select isnt(public.provider_invoice((select ref from r)), null, 'a manager gets the invoice');
reset role;
select pg_temp.act('d6300000-0000-4000-8000-000000000003');
set local role authenticated;
select is(public.provider_invoice((select ref from r)), null, 'staff get nothing (D-089)');
select is(jsonb_array_length(public.provider_invoices()->'invoices'), 0, 'staff see an empty list');
reset role;
select pg_temp.act('d6300000-0000-4000-8000-000000000004');
set local role authenticated;
select is(public.provider_invoice((select ref from r)), null, 'another business gets nothing');
reset role;
select pg_temp.act('d6300000-0000-4000-8000-000000000005');
set local role authenticated;
select is(public.provider_invoice((select ref from r)), null, 'a customer gets nothing');
select throws_ok($$select public.set_billing_settings(true, true, '4123456789')$$, '42501', null, 'only admins change the switches');
reset role;

-- The VAT switch: snapshot at issue, issued invoices unchanged --------------------------
select pg_temp.act('d6300000-0000-4000-8000-000000000006', 'aal2');
set local role authenticated;
select lives_ok($$select public.set_billing_settings(true, true, '4123456789')$$, 'an aal2 admin turns VAT on');
reset role;
select ok((select not vat_registered from private.provider_invoices), 'the issued invoice keeps its no-VAT snapshot');
delete from private.provider_invoices;
select is(private.issue_invoices_for((select last_month from m)), 1, 're-issued with VAT on');
select is((select vat_minor from private.provider_invoices), round(58300 * 1500::numeric / 11500)::bigint,
  'with VAT on, the VAT share of the commission is shown');

-- Serial numbers past 999999 keep every digit ------------------------------------------
delete from private.provider_invoices;
alter table private.provider_invoices alter column number restart with 1000000;
select is(private.issue_invoices_for((select last_month from m)), 1, 'issued with a 7-digit serial');
select is((select ref from private.provider_invoices), 'CXI-1000000', 'a 7-digit serial is not truncated');

-- Retention: 5 years from the document date ---------------------------------------------
alter table private.provider_invoices disable trigger provider_invoice_immutable;
update private.provider_invoices set issued_at = now() - interval '5 years 1 day';
alter table private.provider_invoices enable trigger provider_invoice_immutable;
select is(private.purge_old_invoices(), 1, 'invoices older than 5 years are deleted');
select is(private.purge_old_invoices(), 0, 'nothing younger is deleted');

select * from finish();
rollback;
