-- A21/A24/A25/A26/A29 local money contract. Synthetic; rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(30);
insert into auth.users(id,email) values
 ('ad210000-0000-4000-8000-000000000001','money.customer@example.test'),
 ('ad210000-0000-4000-8000-000000000002','money.other@example.test');
insert into public.organisations(id,name) values('ad210000-0000-4000-8000-000000000003','Synthetic money fixture');
insert into public.categories(slug,name) values('p3-money-test','Synthetic money category');
insert into public.services(slug,category_slug,name) values('p3-money-test','p3-money-test','Synthetic service');
insert into public.listings(public_id,organisation_id,service_slug,display_name,description,metro,mode,provenance_kind,provenance_reference)
 values('ad210000-0000-4000-8000-000000000004','ad210000-0000-4000-8000-000000000003','p3-money-test','Synthetic money provider','Synthetic fixture','Gauteng','mobile','provider_application','synthetic-money');
insert into public.service_offers(id,organisation_id,listing_public_id,name,pricing,price_minor,duration_minutes)
 values('ad210000-0000-4000-8000-000000000005','ad210000-0000-4000-8000-000000000003','ad210000-0000-4000-8000-000000000004','Synthetic wash','fixed',12500,30);
insert into public.resources(id,organisation_id,kind,name)
 values('ad210000-0000-4000-8000-000000000006','ad210000-0000-4000-8000-000000000003','bay','Synthetic bay');
insert into public.bookings(id,organisation_id,customer_id,offer_id,during,accept_by)
 values('ad210000-0000-4000-8000-000000000007','ad210000-0000-4000-8000-000000000003','ad210000-0000-4000-8000-000000000001','ad210000-0000-4000-8000-000000000005',tstzrange(now()+interval '1 day',now()+interval '1 day 30 minutes','[)'),now()+interval '2 hours');
insert into public.reservations(id,organisation_id,resource_id,booking_id,during,kind,expires_at)
 select 'ad210000-0000-4000-8000-000000000008',organisation_id,'ad210000-0000-4000-8000-000000000006',id,during,'hold',now()+interval '15 minutes' from public.bookings where id='ad210000-0000-4000-8000-000000000007';
update public.bookings set hold_id='ad210000-0000-4000-8000-000000000008',amount_minor=12500,state='awaiting_payment' where id='ad210000-0000-4000-8000-000000000007';
insert into private.payment_accounts(organisation_id,subaccount) values('ad210000-0000-4000-8000-000000000003','ACCT_synthetic');
create temporary table money_first as select private.prepare_payment('ad210000-0000-4000-8000-000000000008','ad210000-0000-4000-8000-000000000001') as value;
create temporary table money_second as select private.prepare_payment('ad210000-0000-4000-8000-000000000008','ad210000-0000-4000-8000-000000000001') as value;
select is((select value->>'dispatch' from money_first),'true','A21 first initialisation dispatches');
select is((select value->>'dispatch' from money_second),'false','A21 repeated initialisation does not dispatch');
select is((select value->>'reference' from money_first),(select value->>'reference' from money_second),'A21 reference is durable');
select is((select count(*) from private.payment_attempts where hold_id='ad210000-0000-4000-8000-000000000008'),1::bigint,'A21 one attempt per hold');
select throws_ok($$select private.prepare_payment('ad210000-0000-4000-8000-000000000008','ad210000-0000-4000-8000-000000000002')$$,'42501','not_allowed','A21 other customer cannot initialise');
-- A25 rejected mismatches leave the durable inbox empty.
select throws_ok($$select private.enqueue_payment_event(repeat('a',64),(select value->>'reference' from money_first),'charge.success','123',12501,'ZAR','success')$$,'P0001','payment_event_invalid','A25 rejects amount mismatch');
select throws_ok($$select private.enqueue_payment_event(repeat('a',64),(select value->>'reference' from money_first),'charge.success','123',12500,'USD','success')$$,'P0001','payment_event_invalid','A25 rejects currency mismatch');
select throws_ok($$select private.enqueue_payment_event(repeat('a',64),'cx_'||repeat('f',32),'charge.success','123',12500,'ZAR','success')$$,'P0001','payment_event_invalid','A25 rejects unknown reference');
select lives_ok($$select private.enqueue_payment_event(repeat('a',64),(select value->>'reference' from money_first),'charge.success','123',12500,'ZAR','success')$$,'A24 stores valid event');
select lives_ok($$select private.enqueue_payment_event(repeat('a',64),(select value->>'reference' from money_first),'charge.success','123',12500,'ZAR','success')$$,'A24 duplicate reception is safe');
select is((select count(*) from private.payment_inbox where event_key=repeat('a',64)),1::bigint,'A24 reception stores one row');
select is((select count(*) from private.pending_payment_events() where event_key=repeat('a',64)),1::bigint,'A26 stored event survives until drain');
select throws_ok($$select private.stage_verified_charge(repeat('a',64),(select value->>'reference' from money_first),'999',12500,'ZAR')$$,'P0001','payment_verification_invalid','A25 provider ID mismatch cannot apply');
savepoint before_effect;
select private.stage_verified_charge(repeat('a',64),(select value->>'reference' from money_first),'123',12500,'ZAR');
select private.confirm_paid('ad210000-0000-4000-8000-000000000008',(select (value->>'id')::uuid from money_first));
rollback to before_effect;
select is((select state from public.bookings where id='ad210000-0000-4000-8000-000000000007'),'awaiting_payment','A26 interrupted transaction rolls back booking confirmation');
select is((select count(*) from private.payment_effects where attempt_id=(select (value->>'id')::uuid from money_first)),0::bigint,'A26 interrupted effect leaves no partial money record');
select private.stage_verified_charge(repeat('a',64),(select value->>'reference' from money_first),'123',12500,'ZAR');
select private.finish_charge_effect(repeat('a',64),(select (value->>'id')::uuid from money_first),'123',private.confirm_paid('ad210000-0000-4000-8000-000000000008',(select (value->>'id')::uuid from money_first)));
select is((select state from public.bookings where id='ad210000-0000-4000-8000-000000000007'),'confirmed','A26 replay completes booking');
select is((select private.stage_verified_charge(repeat('a',64),(select value->>'reference' from money_first),'123',12500,'ZAR')->>'duplicate'),'true','A24 applied charge replay is identified');
select is((select count(*) from private.payment_effects where attempt_id=(select (value->>'id')::uuid from money_first)),1::bigint,'A24 charge has one business effect');
create temporary table money_refund as select private.request_refund('ad210000-0000-4000-8000-000000000007',1000,'Synthetic partial refund','test/refund') as id;
select is(private.request_refund('ad210000-0000-4000-8000-000000000007',1000,'Synthetic partial refund','test/refund'),(select id from money_refund),'A29 refund idempotency key collapses replay');
select throws_ok($$select private.request_refund('ad210000-0000-4000-8000-000000000007',2000,'Synthetic partial refund','test/refund')$$,'P0001','refund_key_conflict','A29 conflicting refund replay fails');
select ok(not has_table_privilege('money_server','private.payment_attempts','select'),'money login has no direct ledger read');
select ok(pg_has_role('money_server','booking_contract','usage'),'money login inherits booking contract');
-- A32 event producer, freshness guard, retry window and operator quota alert.
select private.prepare_booking_notifications();
select is((select count(*) from private.booking_notifications where logical_key in (select 'p3/payment/'||id||'/ad210000-0000-4000-8000-000000000001' from private.payment_event where booking_id='ad210000-0000-4000-8000-000000000007' and kind='paid')),1::bigint,'A32 paid event targets customer once');
select private.prepare_booking_notifications();
select is((select count(*) from private.booking_notifications where logical_key in (select 'p3/payment/'||id||'/ad210000-0000-4000-8000-000000000001' from private.payment_event where booking_id='ad210000-0000-4000-8000-000000000007' and kind='paid')),1::bigint,'A32 producer replay does not duplicate notification');
select private.enqueue_mail(logical_key,'booking_update',repeat('a',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),expires_at)
 from private.booking_notifications where booking_id='ad210000-0000-4000-8000-000000000007';
create temporary table money_mail_claim as select * from private.claim_mail(100);
select ok((select private.mail_still_current(id,lease_token) from money_mail_claim),'A32 leased action is initially current');
update public.bookings set state='completed' where id='ad210000-0000-4000-8000-000000000007';
select ok(not (select private.mail_still_current(id,lease_token) from money_mail_claim),'A32 later booking state suppresses stale action');
select private.claim_mail(100);
select is((select state from private.mail_outbox where id=(select id from money_mail_claim)),'failed','A32 claim suppresses obsolete action');
select private.enqueue_mail('invite/p3-window','invite',repeat('b',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),now()+interval '2 days');
update private.mail_outbox set first_attempt_at=now()-interval '24 hours' where logical_key='invite/p3-window';
select private.claim_mail(100);
select is((select state from private.mail_outbox where logical_key='invite/p3-window'),'reconcile','A32 retry beyond provider window is flagged');
select ok((select encrypted_payload is null from private.mail_outbox where logical_key='invite/p3-window'),'A32 flagged retry cannot be resent');
insert into private.mail_outbox(logical_key,template,recipient_hash,encrypted_payload,expires_at,state,first_attempt_at)
 select 'invite/p3-quota/'||n,'invite',repeat('c',64),null,now()+interval '1 day','sent',now() from generate_series(1,100) n;
insert into private.platform_admins(user_id) values('ad210000-0000-4000-8000-000000000001');
set local request.jwt.claims='{"sub":"ad210000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is((public.mail_operations()->>'quota_alert'),'true','A32 operator alert fires at rolling quota');
select * from finish();
rollback;
