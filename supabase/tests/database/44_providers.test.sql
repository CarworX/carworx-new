-- P2-4 + P2-7 (Claude 21): application, review, suspension, claim, transfer
-- and dispute state machines; admin functions need a listed admin at aal2;
-- status is never directly writable; decisions are append-only; audit details
-- carry no reasons. Runs in one transaction and is rolled back. SYNTHETIC.
--
-- Actors: Pia applicant/owner, Cal business-email claimant (claimco.test),
-- Dee document claimant, Gus free-mail user, Max unrelated, Ada admin.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('b4000000-0000-4000-8000-000000000001', 'pia.applicant@example.test', now()),
  ('b4000000-0000-4000-8000-000000000002', 'cal.claimant@claimco.test', now()),
  ('b4000000-0000-4000-8000-000000000003', 'dee.document@example.test', now()),
  ('b4000000-0000-4000-8000-000000000004', 'gus.freemail@gmail.com', now()),
  ('b4000000-0000-4000-8000-000000000005', 'max.unrelated@example.test', now()),
  ('b4000000-0000-4000-8000-000000000006', 'ada.admin@example.test', now()),
  ('b4000000-0000-4000-8000-000000000007', 'una.unconfirmed@unconfirmed.test', null);
-- Own catalogue fixtures: recovery CI (K4) runs without the seed.
insert into public.categories(slug,name) values ('p24-cat','P2-4 test category (synthetic)');
insert into public.services(slug,category_slug,name) values
  ('p24-fixed','p24-cat','P2-4 fixed service (synthetic)'), ('p24-mobile','p24-cat','P2-4 mobile service (synthetic)');
insert into private.platform_admins (user_id) values ('b4000000-0000-4000-8000-000000000006');

select plan(107);

-- ===== Application ==========================================================
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select public.provider_apply('Pia Motors','p24-fixed','fixed','Gauteng','Synthetic fixed applicant','1 Synthetic Road',-26.1,28.0,null)$$,
  '42501', null, 'anon cannot apply');

reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select set_config('t.fixed', public.provider_apply('Pia Motors (synthetic)','p24-fixed','fixed','Gauteng','Synthetic fixed applicant','1 Synthetic Road, Exampleville',-26.1,28.0,null)::text, true)) is not null,
  'signed-in aal1 person applies (fixed premises)');
select throws_ok($$select public.provider_apply('Pia Two','p24-fixed','fixed','Gauteng','Synthetic second application','2 Synthetic Road',-26.1,28.0,null)$$,
  'P0001', 'application_pending', 'one pending application per applicant');
select throws_ok($$update public.listings set status = 'live' where public_id = current_setting('t.fixed')::uuid$$,
  '42501', null, 'applicant cannot write status directly');
select is((select count(*)::int from public.listings where public_id = current_setting('t.fixed')::uuid), 1,
  'applicant sees their own submitted listing');
select is((select count(*)::int from public.listing_public where public_id = current_setting('t.fixed')::uuid), 0,
  'submitted listing is not public');

reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.provider_apply('Max','p24-fixed','fixed','Gauteng','Synthetic outside SA','1 Road',-33.9,10.0,null)$$, '22023', null, 'pin outside South Africa rejected');
select throws_ok($$select public.provider_apply('Max','p24-fixed','fixed','Gauteng','Synthetic fixed radius','1 Road',-26.1,28.0,10)$$, '22023', null, 'fixed premises with a radius rejected');
select throws_ok($$select public.provider_apply('Max','p24-mobile','mobile','Gauteng','Synthetic no radius',null,-26.1,28.0,null)$$, '22023', null, 'mobile without a radius rejected');
select throws_ok($$select public.provider_apply('Max','p24-mobile','mobile','Gauteng','Synthetic huge radius',null,-26.1,28.0,101)$$, '22023', null, 'mobile radius above 100 km rejected');
select throws_ok($$select public.provider_apply('Max','no-such-service','fixed','Gauteng','Synthetic bad service','1 Road',-26.1,28.0,null)$$, '22023', null, 'unknown service rejected');
select throws_ok($$select public.provider_apply('Max','p24-fixed','fixed','Gauteng',E'Synthetic line one\x01line two','1 Road',-26.1,28.0,null)$$, '22023', null, 'control characters other than line breaks rejected in a description');
select throws_ok($$select public.provider_apply(E'Max\x01','p24-fixed','fixed','Gauteng','Synthetic control char','1 Road',-26.1,28.0,null)$$, '22023', null, 'control characters rejected');

reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select set_config('t.mobile', public.provider_apply('Gus Mobile (synthetic)','p24-mobile','mobile','Gauteng',E'Synthetic mobile applicant\r\nComes to you',null,-26.05,28.05,20)::text, true)) is not null,
  'signed-in person applies (mobile, private base)');

reset role;
select is((select status from public.listings where public_id = current_setting('t.fixed')::uuid), 'submitted', 'application lands in submitted');
select is((select provenance_kind from public.listings where public_id = current_setting('t.fixed')::uuid), 'provider_application', 'provenance is provider_application');
select is((select m.role from public.memberships m join public.listings l on l.organisation_id = m.organisation_id
  where l.public_id = current_setting('t.fixed')::uuid and m.user_id = 'b4000000-0000-4000-8000-000000000001'), 'owner', 'applicant owns the new organisation');
select is((select description from public.listings where public_id = current_setting('t.mobile')::uuid), E'Synthetic mobile applicant\nComes to you',
  'a multi-line description keeps its line break, normalised to \\n');
select is((select count(*)::int from public.service_areas where listing_public_id = current_setting('t.mobile')::uuid), 1, 'mobile base stored only in private service_areas');
select is((select source_kind from public.coordinate_sources c join public.listings l on l.organisation_id = c.organisation_id
  where l.public_id = current_setting('t.mobile')::uuid), 'provider_supplied', 'pin provenance is provider_supplied');

-- ===== Admin review needs a listed admin at aal2 ============================
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.admin_decide_application(current_setting('t.fixed')::uuid,'approve','phone_call','{}',null,null)$$,
  '42501', null, 'listed admin at aal1 cannot decide');
select is((select count(*)::int from public.listing_decisions), 0, 'aal1 admin reads no decisions');

reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select public.admin_decide_application(current_setting('t.fixed')::uuid,'approve','phone_call','{}',null,null)$$,
  '42501', null, 'non-admin at aal2 cannot decide');
select throws_ok($$select public.admin_set_suspension(current_setting('t.fixed')::uuid,true,'Synthetic reason')$$,
  '42501', null, 'non-admin cannot suspend');

reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$update public.listings set status = 'live' where public_id = current_setting('t.fixed')::uuid$$,
  '42501', null, 'admin cannot write status directly either');
select throws_ok($$select public.admin_decide_application(current_setting('t.fixed')::uuid,'approve',null,'{}',null,null)$$, '22023', null, 'approval needs a review method');
select throws_ok($$select public.admin_decide_application(current_setting('t.fixed')::uuid,'approve','phone_call','{identity_checked}',null,null)$$, '22023', null, 'labels need an evidence reference');
select throws_ok($$select public.admin_decide_application(current_setting('t.fixed')::uuid,'approve','phone_call','{certified}','ref-1',null)$$, '22023', null, 'unknown label rejected');
select throws_ok($$select public.admin_decide_application(current_setting('t.mobile')::uuid,'approve','site_visit','{premises_visited}','ref-1',null)$$, '22023', null, 'premises label refused for a mobile provider');
select throws_ok($$select public.admin_decide_application(current_setting('t.mobile')::uuid,'reject',null,null,null,null)$$, '22023', null, 'rejection needs a reason');
select lives_ok($$select public.admin_decide_application(current_setting('t.fixed')::uuid,'approve','site_visit','{premises_visited,identity_checked}','synthetic-evidence-1',null)$$, 'aal2 admin approves with method and labels');
select throws_ok($$select public.admin_decide_application(current_setting('t.fixed')::uuid,'approve','site_visit','{}',null,null)$$, 'P0001', 'not_submitted', 'a live listing cannot be approved again');
select lives_ok($$select public.admin_decide_application(current_setting('t.mobile')::uuid,'reject',null,null,null,'Synthetic rejection reason: details unclear')$$, 'aal2 admin rejects with a reason');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select verification_labels from public.listing_public where public_id = current_setting('t.fixed')::uuid),
  array['Identity checked','Premises visited'], 'approved listing is live with the granted labels');
select is((select count(*)::int from public.listing_public where public_id = current_setting('t.mobile')::uuid), 0, 'rejected listing is not public');

reset role;
select is((select status from public.listings where public_id = current_setting('t.mobile')::uuid), 'draft', 'rejection returns the listing to draft');
select is((select review_method from public.listing_decisions where listing_public_id = current_setting('t.fixed')::uuid and decision = 'approved'), 'site_visit', 'review method recorded with the decision');
select is((select verified_by from public.verifications where listing_public_id = current_setting('t.fixed')::uuid and method = 'identity_checked'),
  'b4000000-0000-4000-8000-000000000006'::uuid, 'label records the reviewing admin');

-- ===== Resubmission =========================================================
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.provider_resubmit(current_setting('t.mobile')::uuid,'Max takeover','Synthetic description here')$$, '42501', null, 'stranger cannot resubmit');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select reason from public.listing_decisions where listing_public_id = current_setting('t.mobile')::uuid), 'Synthetic rejection reason: details unclear', 'provider reads the rejection reason');
-- A fresh application while the rejected one is a draft is fine, but then the
-- draft cannot also go back into the queue (rolled back to keep later state).
savepoint resubmit_limit;
select ok(public.provider_apply('Gus Second (synthetic)','p24-fixed','fixed','Gauteng','Synthetic second business','3 Synthetic Road',-26.1,28.0,null) is not null,
  'a rejected applicant may apply again');
select throws_ok($$select public.provider_resubmit(current_setting('t.mobile')::uuid,'Gus Mobile (synthetic)','Synthetic mobile applicant, clearer details')$$,
  'P0001', 'application_pending', 'resubmission respects the one-pending-application limit');
rollback to savepoint resubmit_limit;
select lives_ok($$select public.provider_resubmit(current_setting('t.mobile')::uuid,'Gus Mobile (synthetic)','Synthetic mobile applicant, clearer details')$$, 'owner resubmits after rejection');
select throws_ok($$select public.provider_resubmit(current_setting('t.mobile')::uuid,'Gus Mobile','Synthetic again and again')$$, 'P0001', 'not_draft', 'cannot resubmit a submitted listing');

-- ===== Suspension ===========================================================
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select public.admin_set_suspension(current_setting('t.fixed')::uuid,true,null)$$, '22023', null, 'suspension needs a reason');
select throws_ok($$select public.admin_set_suspension(current_setting('t.mobile')::uuid,true,'Synthetic reason')$$, 'P0001', 'not_live', 'only a live listing can be suspended');
select lives_ok($$select public.admin_set_suspension(current_setting('t.fixed')::uuid,true,'Synthetic suspension reason')$$, 'admin suspends a live listing');
select is((select count(*)::int from public.listing_public where public_id = current_setting('t.fixed')::uuid), 0, 'suspended listing disappears from the public projection');
select throws_ok($$select public.admin_set_suspension(current_setting('t.fixed')::uuid,true,'Synthetic reason')$$, 'P0001', 'not_live', 'cannot suspend twice');
select lives_ok($$select public.admin_set_suspension(current_setting('t.fixed')::uuid,false,'Synthetic reinstatement')$$, 'admin reinstates');
select throws_ok($$select public.admin_set_suspension(current_setting('t.fixed')::uuid,false,'Synthetic reason')$$, 'P0001', 'not_suspended', 'cannot reinstate a live listing');
select is((select count(*)::int from public.listing_public where public_id = current_setting('t.fixed')::uuid), 1, 'reinstated listing is public again');

-- ===== Claims ===============================================================
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.claim_listing(current_setting('t.fixed')::uuid,'business_email',null)$$, 'P0001', 'free_mail_domain', 'free-mail address is not business-domain evidence');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.claim_listing(current_setting('t.fixed')::uuid,'business_email',null)$$, 'P0001', 'email_unconfirmed', 'unconfirmed email is not evidence');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.claim_listing(current_setting('t.fixed')::uuid,'document','Synthetic ref')$$, 'P0001', 'already_member', 'a member cannot claim their own listing');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.claim_listing(current_setting('t.mobile')::uuid,'document','Synthetic ref')$$, 'P0001', 'not_claimable', 'only live listings can be claimed');
select ok((select set_config('t.cal', public.claim_listing(current_setting('t.fixed')::uuid,'business_email',null)::text, true)) is not null, 'business-domain claim accepted');
select throws_ok($$select public.claim_listing(current_setting('t.fixed')::uuid,'document','Synthetic ref')$$, 'P0001', 'claim_pending', 'one open claim per claimant and listing');
select is((select email_domain from public.listing_claims where id = current_setting('t.cal')::uuid), 'claimco.test', 'claim records the verified email domain');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.claim_listing(current_setting('t.fixed')::uuid,'document',null)$$, '22023', null, 'document claim needs a reference');
select ok((select set_config('t.dee', public.claim_listing(current_setting('t.fixed')::uuid,'document','Synthetic utility bill ref 42')::text, true)) is not null, 'document claim accepted (typed reference only)');
select is((select count(*)::int from public.listing_claims), 1, 'a claimant sees only their own claims');

-- ===== Dispute of a pending claim ===========================================
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.dispute_claim(current_setting('t.cal')::uuid,'Synthetic: disputing my own claim')$$, '42501', null, 'claimant cannot dispute their own claim');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.dispute_claim(current_setting('t.cal')::uuid,'Synthetic: unrelated dispute')$$, '42501', null, 'an unrelated person cannot dispute');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::int from public.listing_claims), 2, 'the controlling owner sees claims on their organisation');
select ok((select set_config('t.d1', public.dispute_claim(current_setting('t.cal')::uuid,'Synthetic: this is my business, not theirs')::text, true)) is not null, 'owner disputes a pending claim');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select public.admin_decide_claim(current_setting('t.cal')::uuid,'approve','phone_call',null)$$, 'P0001', 'claim_not_pending', 'a disputed claim cannot be approved');
select lives_ok($$select public.admin_resolve_dispute(current_setting('t.d1')::uuid,'uphold','Synthetic: owner evidence stronger')$$, 'admin upholds the dispute');
select is((select status from public.listing_claims where id = current_setting('t.cal')::uuid), 'rejected', 'upheld dispute rejects the pending claim');
select throws_ok($$select public.admin_resolve_dispute(current_setting('t.d1')::uuid,'dismiss','Synthetic again')$$, 'P0001', 'dispute_closed', 'a closed dispute cannot be resolved again');

-- ===== Transfer of control, then dispute by the displaced owner =============
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.admin_decide_claim(current_setting('t.dee')::uuid,'approve','document_check',null)$$, '42501', null, 'aal1 admin cannot approve a claim');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_decide_claim(current_setting('t.dee')::uuid,'approve','document_check','Synthetic document reviewed')$$, 'aal2 admin approves the document claim');
reset role;
select is((select m.status from public.memberships m join public.listings l on l.organisation_id = m.organisation_id
  where l.public_id = current_setting('t.fixed')::uuid and m.user_id = 'b4000000-0000-4000-8000-000000000001'), 'revoked', 'transfer revokes the former owner');
select is((select m.role || '/' || m.status from public.memberships m join public.listings l on l.organisation_id = m.organisation_id
  where l.public_id = current_setting('t.fixed')::uuid and m.user_id = 'b4000000-0000-4000-8000-000000000003'), 'owner/active', 'claimant becomes the active owner');
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::int from public.listings where public_id = current_setting('t.fixed')::uuid), 0, 'former owner loses access on the next query');
select is((select count(*)::int from public.listing_claims where id = current_setting('t.dee')::uuid), 1, 'displaced owner can still see the claim that displaced them');
select ok((select set_config('t.d2', public.dispute_claim(current_setting('t.dee')::uuid,'Synthetic: transfer was wrong, I still run it')::text, true)) is not null, 'displaced owner disputes the approved claim');
reset role;
select ok((select set_config('t.org', (select organisation_id::text from public.listings where public_id = current_setting('t.fixed')::uuid), true)) is not null, 'fixture: organisation of the claimed listing');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select lives_ok($$insert into public.memberships(organisation_id, user_id, role, status) values (current_setting('t.org')::uuid, 'b4000000-0000-4000-8000-000000000005', 'owner', 'active')$$,
  'while in control, the claimant grants another account owner access');
select lives_ok($$delete from public.memberships where organisation_id = current_setting('t.org')::uuid and user_id = 'b4000000-0000-4000-8000-000000000001'$$,
  'while in control, the claimant deletes the displaced owner''s membership row');
reset role;
select is((select count(*)::int from public.memberships where organisation_id = current_setting('t.org')::uuid and user_id = 'b4000000-0000-4000-8000-000000000001'), 0,
  'fixture: the displaced owner''s row is gone');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is((select count(*)::int from public.listing_claims where id = current_setting('t.dee')::uuid), 1, 'the displaced owner still sees the claim after the row is deleted');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_resolve_dispute(current_setting('t.d2')::uuid,'uphold','Synthetic: transfer reversed')$$, 'admin upholds and reverses the transfer');
reset role;
select is((select status from public.listing_claims where id = current_setting('t.dee')::uuid), 'reversed', 'claim is reversed');
select is((select string_agg(m.user_id::text || ':' || m.status, ',' order by m.user_id) from public.memberships m join public.listings l on l.organisation_id = m.organisation_id
  where l.public_id = current_setting('t.fixed')::uuid),
  'b4000000-0000-4000-8000-000000000001:active,b4000000-0000-4000-8000-000000000003:revoked,b4000000-0000-4000-8000-000000000005:revoked',
  'reversal restores the snapshot: former owner back, claimant and everyone they added revoked');
select is((select role from public.memberships where organisation_id = current_setting('t.org')::uuid and user_id = 'b4000000-0000-4000-8000-000000000001'), 'owner',
  'the restored former owner gets their original role back');

-- ===== Later transfers supersede earlier ones ===============================
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select set_config('t.cal2', public.claim_listing(current_setting('t.fixed')::uuid,'business_email',null)::text, true)) is not null, 'second claim (Cal)');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_decide_claim(current_setting('t.cal2')::uuid,'approve','registry_check',null)$$, 'transfer 1: Pia to Cal');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select set_config('t.dee2', public.claim_listing(current_setting('t.fixed')::uuid,'document','Synthetic registration letter ref 7')::text, true)) is not null, 'third claim (Dee)');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_decide_claim(current_setting('t.dee2')::uuid,'approve','document_check',null)$$, 'transfer 2: Cal to Dee');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.dispute_claim(current_setting('t.cal2')::uuid,'Synthetic: the first transfer was wrong')$$, 'P0001', 'claim_superseded',
  'an earlier transfer superseded by a later one cannot be disputed');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select set_config('t.d3', public.dispute_claim(current_setting('t.dee2')::uuid,'Synthetic: the second transfer was wrong')::text, true)) is not null, 'the latest transfer can be disputed');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select set_config('t.max', public.claim_listing(current_setting('t.fixed')::uuid,'document','Synthetic lease ref 9')::text, true)) is not null, 'another claim arrives during the dispute');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select public.admin_decide_claim(current_setting('t.max')::uuid,'approve','document_check',null)$$, 'P0001', 'transfer_disputed',
  'no new transfer while a transfer is under dispute');
select lives_ok($$select public.admin_resolve_dispute(current_setting('t.d3')::uuid,'uphold','Synthetic: second transfer reversed')$$, 'uphold reverses the latest transfer');
reset role;
select is((select string_agg(m.user_id::text || ':' || m.status, ',' order by m.user_id) from public.memberships m
  where m.organisation_id = current_setting('t.org')::uuid and m.status = 'active'),
  'b4000000-0000-4000-8000-000000000002:active', 'only the previous controller (Cal) is active again');

-- ===== One claimant, two of the organisation's listings ====================
-- Max's claim on the fixed listing is pending; Max claims a second listing of
-- the same organisation. Only the first approval transfers control.
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
  values ('b4000000-0000-4000-8000-0000000000a2', current_setting('t.org')::uuid, 'p24-mobile', 'Second listing (synthetic)', 'Synthetic second listing',
    'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-p24-second');
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok((select set_config('t.max2', public.claim_listing('b4000000-0000-4000-8000-0000000000a2','document','Synthetic lease ref 10')::text, true)) is not null,
  'the same claimant claims a second listing of the organisation');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.admin_decide_claim(current_setting('t.max')::uuid,'approve','document_check',null)$$, 'the first claim transfers control to Max');
select throws_ok($$select public.admin_decide_claim(current_setting('t.max2')::uuid,'approve','document_check',null)$$, 'P0001', 'already_member',
  'a second claim by someone who already belongs is refused, so the first transfer stays disputable');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(public.dispute_claim(current_setting('t.max')::uuid,'Synthetic: Max should not control this') is not null,
  'the displaced controller can still dispute the first transfer');
reset role;

-- ===== A repeat claim cannot block a dispute of an approved transfer =======
-- Dee (claimant) took control from Pia, then left; Dee claims again while the
-- transfer is still disputable. Pia's dispute must still go through.
savepoint repeat_claim;
insert into public.organisations(id, name) values ('b4000000-0000-4000-8000-0000000000b1', 'Repeat Claim Motors (synthetic)');
insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
  values ('b4000000-0000-4000-8000-0000000000b2', 'b4000000-0000-4000-8000-0000000000b1', 'p24-mobile', 'Repeat claim listing (synthetic)', 'Synthetic repeat claim',
    'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-p24-repeat');
insert into public.memberships(organisation_id, user_id, role, status) values
  ('b4000000-0000-4000-8000-0000000000b1', 'b4000000-0000-4000-8000-000000000003', 'owner', 'revoked'),
  ('b4000000-0000-4000-8000-0000000000b1', 'b4000000-0000-4000-8000-000000000001', 'owner', 'revoked');
insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference, status, review_method,
    decided_by, decided_at, approved_at, displaced_user_ids, displaced_roles)
  values ('b4000000-0000-4000-8000-0000000000b3', 'b4000000-0000-4000-8000-0000000000b2', 'b4000000-0000-4000-8000-0000000000b1',
    'b4000000-0000-4000-8000-000000000003', 'document', 'Synthetic ref', 'approved', 'document_check',
    'b4000000-0000-4000-8000-000000000006', now(), clock_timestamp(), array['b4000000-0000-4000-8000-000000000001'::uuid], array['owner']);
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(public.claim_listing('b4000000-0000-4000-8000-0000000000b2','document','Synthetic repeat ref') is not null,
  'the former claimant claims the same listing again');
reset role;
set local request.jwt.claims = '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select ok(public.dispute_claim('b4000000-0000-4000-8000-0000000000b3','Synthetic: the transfer was wrong') is not null,
  'the displaced owner can still dispute the approved transfer');
reset role;
rollback to savepoint repeat_claim;

-- ===== Append-only decisions, audit redaction, catalogue shape ==============
select throws_ok($$update public.listing_decisions set reason = 'Synthetic rewrite'$$, '42501', null, 'decisions cannot be rewritten, even by the owner role');
select throws_ok($$delete from public.listing_decisions$$, '42501', null, 'decisions cannot be deleted');
select ok((select count(*) from public.audit_log where target_table = 'listing_decisions' and details->>'decision' = 'approved') >= 1, 'approvals are audited');
select is_empty($$select details from public.audit_log where details::text ~* '(synthetic rejection|synthetic suspension|claimco|utility bill|-26\.|28\.0)'$$,
  'audit details carry no reasons, notes, domains, references or coordinates');
select is_empty($$
  select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('provider_apply','provider_resubmit','claim_listing','dispute_claim',
    'admin_decide_application','admin_set_suspension','admin_decide_claim','admin_resolve_dispute')
    and (p.prosecdef or p.prorettype not in ('uuid'::regtype, 'void'::regtype)
      or has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('authenticated', p.oid, 'execute'))
$$, 'RPC wrappers are invoker-only, return only uuid/void, and are callable by authenticated only');

select * from finish();
rollback;
