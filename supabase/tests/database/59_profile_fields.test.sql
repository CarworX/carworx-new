-- Finish-build PR 6 (D-098): profile fields. The mobile number (format,
-- private to the person), the profile photo (own row only, one per person,
-- old files queued for deletion, cascades with the account) and the data
-- export. One transaction, rolled back. SYNTHETIC.
--
-- Actors: Pia has a profile; Quin is someone else (on Pia's team).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('d5900000-0000-4000-8000-000000000001', 'pia.profile@example.test', now()),
  ('d5900000-0000-4000-8000-000000000002', 'quin.other@example.test', now());
insert into public.profiles (id, display_name) values
  ('d5900000-0000-4000-8000-000000000001', 'Pia Profile (synthetic)'),
  ('d5900000-0000-4000-8000-000000000002', 'Quin Other (synthetic)');
insert into public.organisations (id, name) values ('d5910000-0000-4000-8000-000000000001', 'Profile fixture (synthetic)');
insert into public.memberships (organisation_id, user_id, role) values
  ('d5910000-0000-4000-8000-000000000001', 'd5900000-0000-4000-8000-000000000001', 'owner'),
  ('d5910000-0000-4000-8000-000000000001', 'd5900000-0000-4000-8000-000000000002', 'staff');

select plan(23);

-- ===== Grants ===============================================================
select ok(not has_function_privilege('anon', 'public.set_profile_photo(text, text, integer, integer, integer)', 'execute'),
  'anon cannot set a photo');
select ok(not has_table_privilege('authenticated', 'public.profile_photos', 'insert'), 'nobody writes photos directly');
select ok(has_column_privilege('authenticated', 'public.profiles', 'mobile', 'update'), 'the person can update their mobile');

-- ===== Mobile ===============================================================
set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$update public.profiles set mobile = '+27720000000' where id = 'd5900000-0000-4000-8000-000000000001'$$,
  'a South African mobile is saved');
select throws_ok($$update public.profiles set mobile = '0720000000' where id = 'd5900000-0000-4000-8000-000000000001'$$,
  '23514', null, 'only the +27 form is stored');
select throws_ok($$update public.profiles set mobile = '+4420000000' where id = 'd5900000-0000-4000-8000-000000000001'$$,
  '23514', null, 'and only South African numbers');
select lives_ok($$update public.profiles set mobile = null where id = 'd5900000-0000-4000-8000-000000000001'$$,
  'it is optional');
update public.profiles set mobile = '+27720000000' where id = 'd5900000-0000-4000-8000-000000000001';
reset role;
set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::integer from public.profiles where mobile is not null), 0,
  'a teammate cannot read it');
select is((select count(*)::integer from public.team_members('d5910000-0000-4000-8000-000000000001')), 2,
  'the team list still works');
update public.profiles set mobile = '+27830000000' where id = 'd5900000-0000-4000-8000-000000000001';
reset role;
select is((select mobile from public.profiles where id = 'd5900000-0000-4000-8000-000000000001'), '+27720000000',
  'nor change it');

-- ===== Photo ================================================================
set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_profile_photo('covers/' || repeat('a', 32) || '.jpg', 'image/jpeg', 100, 10, 10)$$,
  '22023', null, 'only an avatar key');
select throws_ok($$select public.set_profile_photo('avatars/' || repeat('a', 32) || '.jpg', 'image/jpeg', 5242881, 10, 10)$$,
  '22023', null, 'no larger than 5 MB');
select throws_ok($$select public.set_profile_photo('avatars/' || repeat('a', 32) || '.jpg', 'image/jpeg', 100, 7000, 10)$$,
  '22023', null, 'no side over 6000 px');
select lives_ok($$select public.set_profile_photo('avatars/' || repeat('a', 32) || '.jpg', 'image/jpeg', 100, 640, 640)$$,
  'a photo is saved');
select lives_ok($$select public.set_profile_photo('avatars/' || repeat('b', 32) || '.png', 'image/png', 100, 640, 640)$$,
  'and replaced');
select is((select count(*)::integer from public.profile_photos), 1, 'one photo per person');
reset role;
select is((select reason from private.media_deletions where object_key = 'avatars/' || repeat('a', 32) || '.jpg'),
  'replaced', 'the replaced file is queued for deletion');
set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_profile_photo('avatars/' || repeat('a', 32) || '.jpg', 'image/jpeg', 100, 640, 640)$$,
  '22023', null, 'a retired key is never reused');
reset role;
set local request.jwt.claims = '{"sub":"d5900000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::integer from public.profile_photos), 0, 'someone else cannot see the photo');
select ok(not public.remove_profile_photo(), 'or remove it');
reset role;

-- ===== Export and account deletion ==========================================
select is((select private.personal_data('d5900000-0000-4000-8000-000000000001')->'account'->>'mobile'), '+27720000000',
  'the data export holds the mobile number and the photo details');
-- An enquiry sent under the old address keeps its consent in the export
-- after the email changes.
insert into public.categories(slug, name) values ('x7-cat', 'X7 category (synthetic)');
insert into public.services(slug, category_slug, name) values ('x7-wash', 'x7-cat', 'X7 wash (synthetic)');
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
  values ('d5920000-0000-4000-8000-000000000001', 'd5910000-0000-4000-8000-000000000001', 'x7-wash', 'Profile wash (synthetic)', 'Synthetic profile listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic');
insert into public.consents (id, purpose, notice_version, subject_email) values
  ('d5930000-0000-4000-8000-000000000001', 'enquiry_share_with_provider', 'v1', 'pia.profile@example.test');
insert into public.enquiries (listing_public_id, organisation_id, sender_name, sender_email, message, consent_id, sender_user_id) values
  ('d5920000-0000-4000-8000-000000000001', 'd5910000-0000-4000-8000-000000000001', 'Pia', 'pia.profile@example.test',
   'Synthetic enquiry from Pia', 'd5930000-0000-4000-8000-000000000001', 'd5900000-0000-4000-8000-000000000001');
update auth.users set email = 'pia.new@example.test' where id = 'd5900000-0000-4000-8000-000000000001';
select is((select jsonb_array_length(private.personal_data('d5900000-0000-4000-8000-000000000001')->'consents')), 1,
  'consents given under the old email stay in the export after an email change');
delete from auth.users where id = 'd5900000-0000-4000-8000-000000000001';
select is((select reason from private.media_deletions where object_key = 'avatars/' || repeat('b', 32) || '.png'),
  'removed', 'a deleted account''s photo is queued for deletion');

select * from finish();
rollback;
