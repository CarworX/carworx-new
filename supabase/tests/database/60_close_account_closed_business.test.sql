-- Follow-up to PR 4b/PR 5 (D-098): a sole owner may close their account once
-- their business is closed (no listing in search, under review or
-- suspended). One transaction, rolled back. SYNTHETIC.
--
-- Actors: Lia owns Open (live listing); Mo owns Held (suspended listing);
-- Ned owns Empty (no listings).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

create function pg_temp.as_user(p_uid text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1',
    'amr', json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint)))::text, true)
$f$;

insert into auth.users (id, email, email_confirmed_at) values
  ('d6000000-0000-4000-8000-000000000001', 'lia.open@example.test', now()),
  ('d6000000-0000-4000-8000-000000000002', 'mo.held@example.test', now()),
  ('d6000000-0000-4000-8000-000000000003', 'ned.empty@example.test', now());
insert into public.categories(slug, name) values ('x8-cat', 'X8 category (synthetic)');
insert into public.services(slug, category_slug, name) values ('x8-wash', 'x8-cat', 'X8 wash (synthetic)');
insert into public.organisations (id, name) values
  ('d6010000-0000-4000-8000-000000000001', 'Open fixture (synthetic)'),
  ('d6010000-0000-4000-8000-000000000002', 'Held fixture (synthetic)'),
  ('d6010000-0000-4000-8000-000000000003', 'Empty fixture (synthetic)');
insert into auth.users (id, email, email_confirmed_at) values
  ('d6000000-0000-4000-8000-000000000004', 'max.manager@example.test', now());
insert into public.memberships (organisation_id, user_id, role) values
  ('d6010000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000004', 'manager'),
  ('d6010000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000001', 'owner'),
  ('d6010000-0000-4000-8000-000000000002', 'd6000000-0000-4000-8000-000000000002', 'owner'),
  ('d6010000-0000-4000-8000-000000000003', 'd6000000-0000-4000-8000-000000000003', 'owner');
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference) values
  ('d6020000-0000-4000-8000-000000000001', 'd6010000-0000-4000-8000-000000000001', 'x8-wash', 'Open wash (synthetic)', 'Synthetic live listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic'),
  ('d6020000-0000-4000-8000-000000000002', 'd6010000-0000-4000-8000-000000000002', 'x8-wash', 'Held wash (synthetic)', 'Synthetic suspended listing', 'Gauteng', 'mobile', 'suspended', 'admin_import', 'synthetic');

select plan(8);

do $$ begin perform pg_temp.as_user('d6000000-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
select throws_ok($$select public.close_account()$$, 'P0001', 'owner_must_transfer',
  'a sole owner with a listing in search must hand over or close the business first');
select lives_ok($$select public.close_listing('d6020000-0000-4000-8000-000000000001')$$,
  'they close the listing (Account > Business)');
select ok(public.close_account() is not null, 'then they can close their account');
reset role;
select is((select status from public.memberships where user_id = 'd6000000-0000-4000-8000-000000000001'), 'revoked',
  'their ownership ends; the closed business keeps its history');

-- Max, a manager of the now ownerless Open business, cannot reopen it.
do $$ begin perform pg_temp.as_user('d6000000-0000-4000-8000-000000000004'); end $$;
set local role authenticated;
select throws_ok($$select public.provider_resubmit('d6020000-0000-4000-8000-000000000001', 'Open wash (synthetic)', 'Synthetic description text')$$,
  'P0001', 'owner_required', 'a manager cannot resubmit a closed draft once the business has no owner');
reset role;
select is((select status from public.listings where public_id = 'd6020000-0000-4000-8000-000000000001'), 'draft',
  'the listing stays closed');

do $$ begin perform pg_temp.as_user('d6000000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select throws_ok($$select public.close_account()$$, 'P0001', 'owner_must_transfer',
  'a suspended listing still needs a transfer (the owner cannot close it)');
reset role;

do $$ begin perform pg_temp.as_user('d6000000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
select ok(public.close_account() is not null, 'a business that never listed anything does not block closing');
reset role;

select * from finish();
rollback;
