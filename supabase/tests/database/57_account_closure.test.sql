-- Finish-build PR 4b (D-098, owner 2026-11-24): close my account. Who may
-- close, disabled at once, reinstate within 14 days, and the deletion after
-- 14 days (claim with the address, then delete or de-identify). One
-- transaction, rolled back. SYNTHETIC.
--
-- Actors: Sam staff; Oli sole owner; Co and Cy co-owners; Ada admin.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('d5700000-0000-4000-8000-000000000001', 'sam.staff@example.test', now()),
  ('d5700000-0000-4000-8000-000000000002', 'oli.owner@example.test', now()),
  ('d5700000-0000-4000-8000-000000000003', 'co.owner@example.test', now()),
  ('d5700000-0000-4000-8000-000000000004', 'cy.owner@example.test', now()),
  ('d5700000-0000-4000-8000-000000000005', 'ada.admin@example.test', now());
insert into private.platform_admins (user_id) values ('d5700000-0000-4000-8000-000000000005');
insert into public.profiles (id, display_name) values ('d5700000-0000-4000-8000-000000000001', 'Sam Staff (synthetic)');
insert into public.categories(slug, name) values ('x5-cat', 'X5 category (synthetic)');
insert into public.services(slug, category_slug, name) values ('x5-wash', 'x5-cat', 'X5 wash (synthetic)');
insert into public.organisations (id, name) values
  ('d5710000-0000-4000-8000-000000000001', 'Solo fixture (synthetic)'),
  ('d5710000-0000-4000-8000-000000000002', 'Shared fixture (synthetic)');
insert into public.memberships (organisation_id, user_id, role) values
  ('d5710000-0000-4000-8000-000000000001', 'd5700000-0000-4000-8000-000000000002', 'owner'),
  ('d5710000-0000-4000-8000-000000000001', 'd5700000-0000-4000-8000-000000000001', 'staff'),
  ('d5710000-0000-4000-8000-000000000002', 'd5700000-0000-4000-8000-000000000003', 'owner'),
  ('d5710000-0000-4000-8000-000000000002', 'd5700000-0000-4000-8000-000000000004', 'owner');
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
  values ('d5720000-0000-4000-8000-000000000001', 'd5710000-0000-4000-8000-000000000001', 'x5-wash', 'Closure wash (synthetic)', 'Synthetic closure listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic');
insert into public.consents (id, purpose, notice_version, subject_email) values
  ('d5730000-0000-4000-8000-000000000001', 'enquiry_share_with_provider', 'v1', 'sam.staff@example.test');
insert into public.enquiries (listing_public_id, organisation_id, sender_name, sender_email, message, consent_id, sender_user_id) values
  ('d5720000-0000-4000-8000-000000000001', 'd5710000-0000-4000-8000-000000000001', 'Sam', 'sam.staff@example.test',
   'Synthetic enquiry from Sam', 'd5730000-0000-4000-8000-000000000001', 'd5700000-0000-4000-8000-000000000001');

-- Claims for a user whose token carries a password check from now (or from
-- p_age seconds ago, or none), as close_account requires.
create function pg_temp.as_user(p_uid text, p_aal text, p_age integer default 0) returns void
language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal,
    'amr', case when p_age is null then '[]'::json
      else json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint - p_age)) end)::text, true)
$f$;

select plan(30);

-- ===== Grants ===============================================================
select ok(not has_function_privilege('anon', 'public.close_account()', 'execute'), 'anon cannot close an account');
select ok(not has_function_privilege('authenticated', 'public.claim_account_deletions(integer)', 'execute'),
  'signed-in users cannot run the deletion');
select ok(has_function_privilege('retention_server', 'public.finalize_account_deletion(uuid)', 'execute'),
  'the retention login can finish a deletion');
select ok(not has_table_privilege('retention_server', 'private.account_closures', 'select'),
  'the retention login reads no closure table directly');

-- ===== Who may close ========================================================
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000005', 'aal2'); end $$;
set local role authenticated;
select throws_ok($$select public.close_account()$$, 'P0001', 'admin_account', 'an admin is removed by another admin');
reset role;
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000002', 'aal1'); end $$;
set local role authenticated;
select throws_ok($$select public.close_account()$$, 'P0001', 'owner_must_transfer',
  'a sole owner must hand over the business first');
reset role;
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000003', 'aal1'); end $$;
set local role authenticated;
select ok(public.close_account() is not null, 'a co-owner may close while another owner remains');
reset role;

-- ===== Re-confirmed at the database boundary ================================
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000001', 'aal1', null); end $$;
set local role authenticated;
select throws_ok($$select public.close_account()$$, 'P0001', 'reconfirm_required',
  'a token without a password or authenticator check cannot close the account');
reset role;
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000001', 'aal1', 3600); end $$;
set local role authenticated;
select throws_ok($$select public.close_account()$$, 'P0001', 'reconfirm_required',
  'nor one whose last check is an hour old (a stolen session)');
reset role;

-- ===== Close: disabled at once, 14 days ======================================
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000001', 'aal1'); end $$;
set local role authenticated;
-- Called once and kept: BETWEEN would evaluate a volatile call twice.
do $$ begin perform set_config('tests.delete_after', public.close_account()::text, true); end $$;
select ok(current_setting('tests.delete_after')::timestamptz between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour',
  'staff close their account; it is deleted in 14 days');
select ok(public.account_closure_status() is not null, 'the account knows it is closing');
select throws_ok($$select public.close_account()$$, 'P0001', 'already_closing', 'closing twice is refused');
select is((select count(*)::integer from public.memberships where status = 'active'), 0,
  'every membership ended at once (the person no longer sees any team)');
reset role;
select is((select status from public.memberships where user_id = 'd5700000-0000-4000-8000-000000000001'), 'revoked',
  'the staff membership is revoked');
select ok(exists (select from public.audit_log where target_table = 'memberships' and action = 'update'
  and details->>'user_id' = 'd5700000-0000-4000-8000-000000000001' and details->>'status' = 'revoked'),
  'and the team history records it');

-- ===== Reinstate within 14 days =============================================
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000001', 'aal1'); end $$;
set local role authenticated;
select ok(public.reinstate_account(), 'signing back in and confirming reinstates the account');
select is(public.account_closure_status(), null, 'it is no longer closing');
select ok(not public.reinstate_account(), 'reinstating again does nothing');
select ok(public.close_account() is not null, 'it can be closed again');
reset role;

-- ===== Deletion after 14 days ===============================================
select is((select count(*)::integer from public.claim_account_deletions(10)), 0, 'nothing is due before 14 days');
update private.account_closures set requested_at = now() - interval '15 days', delete_after = now() - interval '1 day'
  where user_id = 'd5700000-0000-4000-8000-000000000001';
do $$ begin perform pg_temp.as_user('d5700000-0000-4000-8000-000000000001', 'aal1'); end $$;
set local role authenticated;
select ok(not public.reinstate_account(), 'after the 14 days it can no longer be reinstated');
select ok(public.account_closure_status() is not null,
  'but it still counts as closing (signed out) until the daily run deletes it');
reset role;
create temporary table due as select * from public.claim_account_deletions(10);
select is((select email from due where user_id = 'd5700000-0000-4000-8000-000000000001'), 'sam.staff@example.test',
  'the run gets the address for the final email');
select lives_ok($$select private.enqueue_mail('account-deleted/d5700000-0000-4000-8000-000000000001', 'account_deleted',
  repeat('a', 64), 'v1.AAAAAAAAAAAAAAAA.' || repeat('B', 60), now() + interval '7 days')$$,
  'the final email is accepted by the outbox');
select ok(public.finalize_account_deletion('d5700000-0000-4000-8000-000000000001'), 'the account is deleted');
select is((select count(*)::integer from auth.users where id = 'd5700000-0000-4000-8000-000000000001'), 0,
  'the sign-in account is gone');
select is((select count(*)::integer from public.profiles where id = 'd5700000-0000-4000-8000-000000000001'), 0,
  'and the profile');
select is((select sender_name || ' ' || sender_email from public.enquiries where consent_id = 'd5730000-0000-4000-8000-000000000001'),
  'Deleted account deleted-account@carworx.invalid', 'enquiries the business received keep no name or email');
select ok(exists (select from public.audit_log where details->>'user_id' = 'd5700000-0000-4000-8000-000000000001'),
  'the audit log keeps its ID-only entries');
select ok(not public.finalize_account_deletion('d5700000-0000-4000-8000-000000000001'), 'finishing twice does nothing');

select * from finish();
rollback;
