-- BK-1: removes exactly the rows fixture.sql added, after the drill has
-- proven they were restored. The RLS suite then runs on the same data as
-- before BK-1 (its matrix tests count whole tables). The drill runs this
-- with app triggers paused, so no audit rows are written.
do $$ begin
  if to_regclass('private.mail_delivery_events') is not null then
    execute $q$delete from private.mail_delivery_events where provider_id = '00000000-0000-4000-8000-0000000000b1'$q$;
  end if;
  if to_regclass('private.mail_outbox') is not null then
    execute $q$delete from private.mail_outbox where logical_key = 'bk1/synthetic-invite'$q$;
  end if;
end $$;
delete from public.staff_profiles where first_name = 'Synthetic' and membership_id in (
  select id from public.memberships where user_id = '5eed0000-0000-4000-8000-000000000002');
delete from public.provider_applications where business_name = 'Synthetic Applicant';
delete from public.invites where email = 'bk1.invite@example.test';
delete from public.support_cases where email = 'bk1.support@example.test';
delete from public.demand_requests where email = 'bk1.demand@example.test';
delete from public.enquiries where sender_email = 'bk1.enquiry@example.test';
delete from public.consents where id in ('bac20000-0000-4000-8000-000000000001','bac20000-0000-4000-8000-000000000002');
delete from public.claim_disputes where claim_id = 'bac10000-0000-4000-8000-000000000001';
delete from public.listing_claims where id = 'bac10000-0000-4000-8000-000000000001';
delete from public.listing_decisions where listing_public_id = 'ca7c1000-0000-4000-8000-000000000001' and decided_by = '5eed0000-0000-4000-8000-000000000004';
delete from public.listing_services where listing_public_id = 'ca7c1000-0000-4000-8000-000000000001' and service_slug = 'service';
delete from public.listing_hours where listing_public_id = 'ca7c1000-0000-4000-8000-000000000001' and day = 1;

delete from public.notification_preferences where user_id = '5eed0000-0000-4000-8000-000000000001';

delete from public.listing_covers where object_key = 'covers/' || repeat('b', 32) || '.jpg';
delete from private.media_deletions where object_key in
  ('covers/' || repeat('b', 32) || '.jpg', 'covers/' || repeat('c', 32) || '.png');

delete from private.data_exports where object_key = 'exports/' || repeat('d', 32) || '.json';

delete from private.account_closures where user_id = '5eed0000-0000-4000-8000-000000000001';

delete from public.profile_photos where object_key = 'avatars/' || repeat('e', 32) || '.jpg';
delete from private.ownership_offers where organisation_id = '5eed0000-0000-4000-8000-0000000000a1';
delete from private.listing_closures where listing_public_id = 'ca7c1000-0000-4000-8000-000000000003';

delete from private.identity_checks where provider_session_id = 'b1900000-0000-4000-8000-000000000001';
delete from public.fines_payments where id = 'b2000000-0000-4000-8000-000000000001';
delete from public.reviews where id = 'b2100000-0000-4000-8000-000000000001';
