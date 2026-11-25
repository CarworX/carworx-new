-- Finish-build PR 4a (D-098): "Download my data". What the export holds (and
-- does not), the 24-hour limit, the one-time link, cancel, and the 7-day
-- expiry into the R2 deletion queue. One transaction, rolled back. SYNTHETIC.
--
-- Actors: Dee requests her data; Eli is someone else.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('d5600000-0000-4000-8000-000000000001', 'dee.data@example.test', now()),
  ('d5600000-0000-4000-8000-000000000002', 'eli.else@example.test', now());
insert into public.profiles (id, display_name) values
  ('d5600000-0000-4000-8000-000000000001', 'Dee Data (synthetic)'),
  ('d5600000-0000-4000-8000-000000000002', 'Eli Else (synthetic)');
insert into public.categories(slug, name) values ('x4-cat', 'X4 category (synthetic)');
insert into public.services(slug, category_slug, name) values ('x4-wash', 'x4-cat', 'X4 wash (synthetic)');
insert into public.organisations (id, name) values ('d5610000-0000-4000-8000-000000000001', 'Export fixture (synthetic)');
insert into public.memberships (organisation_id, user_id, role) values
  ('d5610000-0000-4000-8000-000000000001', 'd5600000-0000-4000-8000-000000000001', 'staff'),
  ('d5610000-0000-4000-8000-000000000001', 'd5600000-0000-4000-8000-000000000002', 'owner');
update public.memberships set role = 'manager'
  where user_id = 'd5600000-0000-4000-8000-000000000001';
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
  values ('d5620000-0000-4000-8000-000000000001', 'd5610000-0000-4000-8000-000000000001', 'x4-wash', 'Export wash (synthetic)', 'Synthetic export listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic');
insert into public.consents (id, purpose, notice_version, subject_email) values
  ('d5630000-0000-4000-8000-000000000001', 'enquiry_share_with_provider', 'v1', 'dee.data@example.test'),
  ('d5630000-0000-4000-8000-000000000002', 'enquiry_share_with_provider', 'v1', 'eli.else@example.test');
insert into public.enquiries (listing_public_id, organisation_id, sender_name, sender_email, message, consent_id, sender_user_id) values
  ('d5620000-0000-4000-8000-000000000001', 'd5610000-0000-4000-8000-000000000001', 'Dee', 'dee.data@example.test',
   'DEE-MESSAGE synthetic enquiry text', 'd5630000-0000-4000-8000-000000000001', 'd5600000-0000-4000-8000-000000000001'),
  ('d5620000-0000-4000-8000-000000000001', 'd5610000-0000-4000-8000-000000000001', 'Eli', 'eli.else@example.test',
   'ELI-MESSAGE synthetic enquiry text', 'd5630000-0000-4000-8000-000000000002', 'd5600000-0000-4000-8000-000000000002');

select plan(28);

-- ===== Grants ===============================================================
select ok(not has_function_privilege('anon', 'public.request_data_export(text, bytea)', 'execute'), 'anon cannot request an export');
select ok(not has_function_privilege('anon', 'public.consume_data_export(bytea)', 'execute'), 'anon cannot download one');
select ok(not has_table_privilege('authenticated', 'private.data_exports', 'select'), 'nobody reads the exports table directly');
select ok(not has_function_privilege('authenticated', 'private.personal_data(uuid)', 'execute'),
  'nobody can build someone else''s document directly');

-- ===== Request ==============================================================
set local request.jwt.claims = '{"sub":"d5600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.request_data_export('../x.json', extensions.digest('t1', 'sha256'))$$, '22023', null,
  'the key must be an export key');
select throws_ok($$select public.request_data_export('exports/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json', '\x00'::bytea)$$, '22023', null,
  'the token hash must be SHA-256');
create temporary table doc as select public.request_data_export('exports/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json',
  extensions.digest('token-one', 'sha256')) as d;
select is((select d->>'format' from doc), 'carworx-personal-data-v1', 'the document has a format marker');
select is((select d->'account'->>'email' from doc), 'dee.data@example.test', 'it holds the account email');
select is((select d->'account'->>'display_name' from doc), 'Dee Data (synthetic)', 'and the display name');
select is((select d->'memberships'->0->>'role' from doc), 'manager', 'memberships with the current role');
select is((select jsonb_array_length(d->'enquiries_sent') from doc), 1, 'only her own enquiries');
select is((select d->'enquiries_sent'->0->>'message' from doc), 'DEE-MESSAGE synthetic enquiry text', 'with their text');
select is((select jsonb_array_length(d->'consents') from doc), 1, 'consents under her email');
select ok((select jsonb_array_length(d->'team_history') from doc) >= 2, 'team history about her (joined, promoted)');
select ok((select d::text from doc) !~ 'ELI|eli\.else|Eli Else', 'nothing about anyone else');
select ok((select d::text from doc) !~ 'd5600000-0000-4000-8000-000000000002', 'not even another person''s ID');
select throws_ok($$select public.request_data_export('exports/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.json', extensions.digest('token-two', 'sha256'))$$,
  'P0001', 'export_limit', 'one request per 24 hours');
select is((select count(*)::integer from public.data_export_status() where downloaded_at is null), 1,
  'the page can show the pending request');

-- Cancel (storage failed): the person may try again at once.
select lives_ok($$select public.cancel_data_export('exports/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json')$$, 'a failed store is undone');
select ok(public.request_data_export('exports/cccccccccccccccccccccccccccccccc.json',
  extensions.digest('token-three', 'sha256')) is not null, 'so a new request works');
reset role;

-- ===== One-time download ====================================================
set local request.jwt.claims = '{"sub":"d5600000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.consume_data_export(extensions.digest('token-three', 'sha256'))$$, 'P0001', 'export_invalid',
  'someone else cannot use the link');
reset role;
set local request.jwt.claims = '{"sub":"d5600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is(public.peek_data_export(extensions.digest('token-three', 'sha256')),
  'exports/cccccccccccccccccccccccccccccccc.json', 'checking the link does not spend it');
select is(public.peek_data_export(extensions.digest('token-three', 'sha256')),
  'exports/cccccccccccccccccccccccccccccccc.json', 'so it can be checked again');
select is(public.consume_data_export(extensions.digest('token-three', 'sha256')),
  'exports/cccccccccccccccccccccccccccccccc.json', 'the owner downloads it once');
select throws_ok($$select public.consume_data_export(extensions.digest('token-three', 'sha256'))$$, 'P0001', 'export_invalid',
  'and never twice');
reset role;
select is((select reason from private.media_deletions where object_key = 'exports/cccccccccccccccccccccccccccccccc.json'),
  'export_downloaded', 'a downloaded file is queued for deletion');

-- ===== Expiry after 7 days ==================================================
insert into private.data_exports(user_id, object_key, token_hash, created_at, expires_at)
  values ('d5600000-0000-4000-8000-000000000002', 'exports/dddddddddddddddddddddddddddddddd.json',
    extensions.digest('token-old', 'sha256'), now() - interval '8 days', now() - interval '1 day');
select ok('exports/dddddddddddddddddddddddddddddddd.json' in (select * from public.claim_media_deletions(100)),
  'the retention run queues and claims an expired export');
select is((select count(*)::integer from private.data_exports where object_key = 'exports/dddddddddddddddddddddddddddddddd.json'), 0,
  'and drops its row');

select * from finish();
rollback;
