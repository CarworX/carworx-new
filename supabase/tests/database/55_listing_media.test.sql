-- Finish-build PR 3 (D-098): cover photos. Who may set, replace and remove a
-- cover; the admin take-down; the public projection; the audit trail; and the
-- R2 deletion queue the retention run drains. One transaction, rolled back.
-- SYNTHETIC.
--
-- Actors: Ola owner, Mia manager, Sol staff of business 1; Xan owner of
-- business 2; Ada admin.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated, retention_server;

insert into auth.users (id, email, email_confirmed_at) values
  ('d5500000-0000-4000-8000-000000000001', 'ola.owner@example.test', now()),
  ('d5500000-0000-4000-8000-000000000002', 'mia.manager@example.test', now()),
  ('d5500000-0000-4000-8000-000000000003', 'sol.staff@example.test', now()),
  ('d5500000-0000-4000-8000-000000000004', 'xan.other@example.test', now()),
  ('d5500000-0000-4000-8000-000000000005', 'ada.admin@example.test', now());
insert into private.platform_admins (user_id) values ('d5500000-0000-4000-8000-000000000005');
insert into public.categories(slug, name) values ('m3-cat', 'M3 category (synthetic)');
insert into public.services(slug, category_slug, name) values ('m3-wash', 'm3-cat', 'M3 wash (synthetic)');
insert into public.organisations (id, name) values
  ('d5510000-0000-4000-8000-000000000001', 'Cover fixture (synthetic)'),
  ('d5510000-0000-4000-8000-000000000002', 'Other fixture (synthetic)');
insert into public.memberships (organisation_id, user_id, role) values
  ('d5510000-0000-4000-8000-000000000001', 'd5500000-0000-4000-8000-000000000001', 'owner'),
  ('d5510000-0000-4000-8000-000000000001', 'd5500000-0000-4000-8000-000000000002', 'manager'),
  ('d5510000-0000-4000-8000-000000000001', 'd5500000-0000-4000-8000-000000000003', 'staff'),
  ('d5510000-0000-4000-8000-000000000002', 'd5500000-0000-4000-8000-000000000004', 'owner');
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference) values
  ('d5520000-0000-4000-8000-000000000001', 'd5510000-0000-4000-8000-000000000001', 'm3-wash', 'Cover wash (synthetic)', 'Synthetic cover listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic'),
  ('d5520000-0000-4000-8000-000000000002', 'd5510000-0000-4000-8000-000000000002', 'm3-wash', 'Other wash (synthetic)', 'Synthetic other listing', 'Gauteng', 'mobile', 'draft', 'admin_import', 'synthetic');

select plan(40);

-- ===== Grants ===============================================================
select ok(not has_function_privilege('anon', 'public.set_listing_cover(uuid, text, text, integer, integer, integer)', 'execute'),
  'anon cannot set a cover');
select ok(not has_function_privilege('anon', 'public.admin_remove_listing_cover(uuid)', 'execute'), 'anon cannot remove a cover');
select ok(not has_function_privilege('authenticated', 'public.claim_media_deletions(integer)', 'execute'),
  'signed-in users cannot drain the deletion queue');
select ok(has_function_privilege('retention_server', 'public.claim_media_deletions(integer)', 'execute'),
  'the retention login can claim deletions');
select ok(not has_function_privilege('retention_server', 'public.set_listing_cover(uuid, text, text, integer, integer, integer)', 'execute'),
  'the retention login cannot set covers');
select ok(not has_table_privilege('anon', 'public.listing_covers', 'select'), 'anon cannot read the covers table');

-- ===== Who may set a cover ==================================================
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'image/jpeg', 1000, 800, 600)$$,
  '42501', 'not_allowed', 'staff cannot set a cover');
reset role;
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'image/jpeg', 1000, 800, 600)$$,
  '42501', 'not_allowed', 'an owner of another business cannot set it');
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-0000000000ff', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'image/jpeg', 1000, 800, 600)$$,
  '42501', 'not_allowed', 'an unknown listing fails the same way');
reset role;
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', '../etc/passwd', 'image/jpeg', 1000, 800, 600)$$,
  '22023', null, 'the key must be a random cover key');
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png', 'image/jpeg', 1000, 800, 600)$$,
  '22023', null, 'the extension must match the type');
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'image/jpeg', 6000000, 800, 600)$$,
  '22023', null, 'at most 5 MB');
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'image/jpeg', 1000, 6001, 600)$$,
  '22023', null, 'no side over 6000 px');
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.gif', 'image/gif', 1000, 800, 600)$$,
  '22023', null, 'only JPEG, PNG and WebP');
select lives_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'image/jpeg', 1000, 800, 600)$$,
  'a manager sets the cover');
select is((select count(*)::integer from public.listing_covers), 1, 'members can read their cover row');
reset role;

-- ===== Shown at once, live listings only =====================================
set local role anon;
select is((select cover_key from public.listing_public where public_id = 'd5520000-0000-4000-8000-000000000001'),
  'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'the public projection shows the cover at once');
reset role;

-- ===== Replace: one per listing, the old file is queued ======================
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp', 'image/webp', 2000, 1200, 800)$$,
  'the owner replaces it');
reset role;
select is((select count(*)::integer from public.listing_covers where listing_public_id = 'd5520000-0000-4000-8000-000000000001'), 1,
  'still one cover per listing');
select is((select reason from private.media_deletions where object_key = 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg'), 'replaced',
  'the replaced file is queued for deletion');
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', 'image/jpeg', 1000, 800, 600)$$,
  '22023', null, 'a retired key can never become a cover again');
reset role;
-- Even if a queued key were somehow in use, it is never offered for deletion.
insert into private.media_deletions(object_key, reason) values ('covers/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp', 'replaced');
select is((select count(*)::integer from public.claim_media_deletions(100) k where k = 'covers/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp'), 0,
  'a key in use is never claimed for deletion');
delete from private.media_deletions where object_key = 'covers/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp';
update private.media_deletions set claimed_at = null;

-- ===== Suspended or draft listings show nothing ==============================
insert into public.listing_covers(listing_public_id, organisation_id, object_key, content_type, bytes, width, height)
  values ('d5520000-0000-4000-8000-000000000002', 'd5510000-0000-4000-8000-000000000002', 'covers/cccccccccccccccccccccccccccccccc.png', 'image/png', 10, 1, 1);
set local role anon;
select is((select count(*)::integer from public.listing_public where cover_key = 'covers/cccccccccccccccccccccccccccccccc.png'), 0,
  'a draft listing''s cover is never public');
reset role;

-- ===== Admin take-down ======================================================
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.admin_remove_listing_cover('d5520000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'an owner is not an admin');
reset role;
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.admin_remove_listing_cover('d5520000-0000-4000-8000-000000000001')$$, '42501', 'not_allowed',
  'an admin needs aal2');
reset role;
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select ok(public.admin_remove_listing_cover('d5520000-0000-4000-8000-000000000001'), 'an aal2 admin removes the cover');
select ok(not public.admin_remove_listing_cover('d5520000-0000-4000-8000-000000000001'), 'removing again reports nothing to remove');
reset role;
set local role anon;
select is((select cover_key from public.listing_public where public_id = 'd5520000-0000-4000-8000-000000000001'), null,
  'the take-down applies at once');
reset role;
select is((select reason from private.media_deletions where object_key = 'covers/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp'), 'removed',
  'the removed file is queued for deletion');
select is((select details->>'state' || ':' || (details->>'by_admin') from public.audit_log
  where target_table = 'listing_covers' and action = 'delete' and organisation_id = 'd5510000-0000-4000-8000-000000000001'),
  'removed:true', 'the take-down is audited as an admin removal');
select is((select count(*)::integer from public.audit_log where target_table = 'listing_covers'
  and organisation_id = 'd5510000-0000-4000-8000-000000000001'), 3, 'set, replace and removal are all audited');
select is((select count(*)::integer from public.audit_log where target_table = 'listing_covers'
  and (details ? 'reason' or details ? 'object_key')), 0, 'audit details carry states only');

-- ===== The business removes its own cover ===================================
set local request.jwt.claims = '{"sub":"d5500000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$select public.set_listing_cover('d5520000-0000-4000-8000-000000000001', 'covers/dddddddddddddddddddddddddddddddd.png', 'image/png', 3000, 640, 480)$$,
  'a new cover after the take-down');
select lives_ok($$select public.remove_listing_cover('d5520000-0000-4000-8000-000000000001')$$, 'a manager removes it again');
reset role;

-- Deleting a listing queues its cover too.
delete from public.listings where public_id = 'd5520000-0000-4000-8000-000000000002';
select is((select reason from private.media_deletions where object_key = 'covers/cccccccccccccccccccccccccccccccc.png'), 'listing_deleted',
  'a deleted listing''s cover is queued for deletion');

-- ===== Retention: claim, delete from R2 (Worker), confirm ===================
-- The retention login is checked by privilege (as 50_retention does); the
-- functions run here as their owner.
select ok(not has_table_privilege('retention_server', 'private.media_deletions', 'select')
  and not has_table_privilege('retention_server', 'public.listing_covers', 'select'),
  'the retention login reads no media table directly');
select is((select count(*)::integer from public.claim_media_deletions(100)), 4, 'every queued key is offered once');
select is((select count(*)::integer from public.claim_media_deletions(100)), 0, 'claimed keys are not offered twice');
select is(public.confirm_media_deletions(array['covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
  'covers/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp', 'covers/dddddddddddddddddddddddddddddddd.png']), 3, 'confirmed keys leave the queue');
select is((select count(*)::integer from private.media_deletions), 1, 'only the unconfirmed key is left');

select * from finish();
rollback;
