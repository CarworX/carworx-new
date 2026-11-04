-- CarworX local seed. SYNTHETIC DATA ONLY.
-- Every name is obviously fake and every email uses the reserved
-- example.test domain (RFC 2606). No passwords are set: these users cannot
-- sign in until T3 adds its own local fixtures. pgTAP tests do not rely on
-- this seed; they create their own rows inside a rolled-back transaction.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'synthetic.owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'synthetic.staff@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'synthetic.customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'synthetic.admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('5eed0000-0000-4000-8000-000000000001', 'Test Owner (synthetic)'),
  ('5eed0000-0000-4000-8000-000000000002', 'Test Staff (synthetic)'),
  ('5eed0000-0000-4000-8000-000000000003', 'Test Customer (synthetic)'),
  ('5eed0000-0000-4000-8000-000000000004', 'Test Admin (synthetic)');

insert into public.organisations (id, name) values
  ('5eed0000-0000-4000-8000-0000000000a1', 'Example Motors (synthetic)'),
  ('5eed0000-0000-4000-8000-0000000000b2', 'Sample Car Wash (synthetic)');

insert into public.memberships (organisation_id, user_id, role, status) values
  ('5eed0000-0000-4000-8000-0000000000a1', '5eed0000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('5eed0000-0000-4000-8000-0000000000a1', '5eed0000-0000-4000-8000-000000000002', 'staff', 'active');

insert into private.platform_admins (user_id) values
  ('5eed0000-0000-4000-8000-000000000004');
