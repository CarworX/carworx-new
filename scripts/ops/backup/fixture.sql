-- BK-1 drill fixture: at least one SYNTHETIC row in every public/private
-- table the seed leaves empty, so the drill proves each one survives export
-- and restore. Loaded after supabase/seed.sql on the drill's throwaway source
-- stack only. Never run against a hosted project.
insert into public.listing_hours(listing_public_id, organisation_id, day, opens, closes) values
  ('ca7c1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1',1,'08:00','17:00');
insert into public.listing_services(listing_public_id, organisation_id, service_slug, position) values
  ('ca7c1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','service',0);
insert into public.listing_decisions(listing_public_id, organisation_id, decision, review_method, labels, decided_by) values
  ('ca7c1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','approved','phone_call','{identity_checked}','5eed0000-0000-4000-8000-000000000004');
insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, email_domain, status, review_method, review_note, decided_by, decided_at) values
  ('bac10000-0000-4000-8000-000000000001','ca7c1000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000b2','5eed0000-0000-4000-8000-000000000003','business_email','example.test','rejected','phone_call','Synthetic review note','5eed0000-0000-4000-8000-000000000004', now());
insert into public.claim_disputes(claim_id, organisation_id, raised_by, reason) values
  ('bac10000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000b2','5eed0000-0000-4000-8000-000000000001','Synthetic dispute reason');
insert into public.consents(id, purpose, notice_version, subject_email) values
  ('bac20000-0000-4000-8000-000000000001','enquiry_share_with_provider','privacy-2026-11-01','bk1.enquiry@example.test'),
  ('bac20000-0000-4000-8000-000000000002','demand_notify','privacy-2026-11-01','bk1.demand@example.test');
insert into public.enquiries(listing_public_id, organisation_id, sender_name, sender_email, message, consent_id) values
  ('ca7c1000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1','Synthetic Sender','bk1.enquiry@example.test','Synthetic enquiry message','bac20000-0000-4000-8000-000000000001');
insert into public.demand_requests(email, category_slug, province, consent_id, expires_at, last_activity_at) values
  ('bk1.demand@example.test','wash-and-detailing','gauteng','bac20000-0000-4000-8000-000000000002', date_trunc('second', now()) + interval '12 months', date_trunc('second', now()));
insert into public.support_cases(email, topic, message) values
  ('bk1.support@example.test','other','Synthetic support message');
insert into public.invites(organisation_id, role, token_hash, email, created_by, control_generation, expires_at) values
  ('5eed0000-0000-4000-8000-0000000000a1','staff', decode(repeat('ab', 32), 'hex'),'bk1.invite@example.test','5eed0000-0000-4000-8000-000000000001', (select control_generation from public.organisations where id = '5eed0000-0000-4000-8000-0000000000a1'), now() + interval '3 days');
insert into public.provider_applications(user_id, business_name, mode, metro, description, public_address, radius_km, hours, team_size_band, applicant_role, probing_notice_version) values
  ('5eed0000-0000-4000-8000-000000000003','Synthetic Applicant','mobile','Gauteng','Synthetic application description','2 Synthetic Road, Exampleville',10,'[]','solo','owner','probing-2026-11-01');
insert into public.staff_profiles(membership_id, organisation_id, first_name, service_slugs, days)
  select id, organisation_id, 'Synthetic', '{service}', '{1,2}' from public.memberships
  where user_id = '5eed0000-0000-4000-8000-000000000002' and organisation_id = '5eed0000-0000-4000-8000-0000000000a1';
-- O5 mail outbox (#84). Applied only once those tables exist; opaque
-- synthetic values, no address or payload in plaintext.
do $$ begin
  if to_regclass('private.mail_outbox') is not null then
    execute $q$insert into private.mail_outbox(logical_key, template, recipient_hash, encrypted_payload, expires_at)
      values ('bk1/synthetic-invite', 'invite', repeat('0', 64),
        'v1.' || repeat('A', 16) || '.' || repeat('B', 60), now() + interval '1 day')$q$;
  end if;
  if to_regclass('private.mail_delivery_events') is not null then
    execute $q$insert into private.mail_delivery_events(provider_id, event)
      values ('00000000-0000-4000-8000-0000000000b1', 'email.bounced')$q$;
  end if;
end $$;
