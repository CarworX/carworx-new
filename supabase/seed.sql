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

-- Categories follow the design's service keys (D-083, replacing the Claude 17
-- section 3 list): four bookable services; Fines stays its own guidance area (P2-6).
-- P2-1 fixtures: Gauteng is a reversible synthetic
-- fixture metro, not an owner-confirmed launch region or provider supply.
insert into public.categories(slug,name,parent_slug) values
 ('wash-and-detailing','Wash & Detailing',null), ('repairs-and-maintenance','Repairs & Maintenance',null),
 ('glass-repair-and-replacement','Glass Repair & Replacement',null), ('tyres-and-wheel-alignment','Tyres & Wheel Alignment',null),
 ('mechanical-service','Mechanical service','repairs-and-maintenance'), ('panel-and-paint','Panel and paint','repairs-and-maintenance'),
 ('auto-electrical','Auto electrical','repairs-and-maintenance'), ('mobile-mechanic','Mobile mechanic','repairs-and-maintenance');
insert into public.services(slug,category_slug,name) values
 ('wash','wash-and-detailing','Synthetic wash'), ('service','mechanical-service','Synthetic service'),
 ('tyres','tyres-and-wheel-alignment','Synthetic tyres'), ('paint','panel-and-paint','Synthetic paint'),
 ('electrical','auto-electrical','Synthetic electrical'), ('mobile-repair','mobile-mechanic','Synthetic mobile repair'),
 ('glass','glass-repair-and-replacement','Synthetic glass repair');
insert into public.coordinate_sources(id,organisation_id,source_kind,licence_note) values
 ('ca7a0000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','provider_supplied','Synthetic permanent fixture; no geocoding service'),
 ('ca7a0000-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-0000000000b2','manual_verified','Synthetic permanent fixture; no geocoding service');
insert into public.branches(id,public_id,organisation_id,name,public_address,public_latitude,public_longitude,coordinate_source_id) values
 ('ca7b0000-0000-4000-8000-000000000001','ca7b1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','Synthetic workshop','1 Synthetic Street, Exampleville',-26.2,28.04,'ca7a0000-0000-4000-8000-000000000001');
insert into public.listings(id,public_id,organisation_id,service_slug,branch_public_id,display_name,description,metro,mode,status,provenance_kind,provenance_reference) values
 ('ca7c0000-0000-4000-8000-000000000001','ca7c1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','service','ca7b1000-0000-4000-8000-000000000001','Synthetic fixed provider','Synthetic catalogue fixture; not a real provider','Gauteng','fixed','live','admin_import','synthetic-seed-fixed'),
 ('ca7c0000-0000-4000-8000-000000000002','ca7c1000-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-0000000000a1','mobile-repair',null,'Synthetic mobile provider','Synthetic catalogue fixture; not a real provider','Gauteng','mobile','live','provider_application','synthetic-seed-mobile'),
 ('ca7c0000-0000-4000-8000-000000000003','ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2','mobile-repair',null,'Synthetic pending provider','Synthetic unapproved fixture','Gauteng','mobile','submitted','provider_application','synthetic-seed-pending');
insert into public.service_areas(id,listing_public_id,organisation_id,centre_latitude,centre_longitude,radius_km,coordinate_source_id) values
 ('ca7d0000-0000-4000-8000-000000000001','ca7c1000-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-0000000000a1',-26.112233,28.112233,25,'ca7a0000-0000-4000-8000-000000000001');
insert into public.verifications(id,organisation_id,listing_public_id,method,verified_by,evidence_reference) values
 ('ca7e0000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','ca7c1000-0000-4000-8000-000000000002','identity_checked','5eed0000-0000-4000-8000-000000000004','synthetic-evidence-owner-held');
