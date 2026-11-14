-- SYNTHETIC ONLY: invoked by the disposable local BK-1 source stack.
insert into private.payment_accounts(organisation_id,subaccount) values('5eed0000-0000-4000-8000-0000000000a1','ACCT_BK1synthetic');
insert into private.payment_attempts(id,hold_id,booking_id,customer_id,organisation_id,amount_minor,subaccount,hold_expires_at,state,provider_id,reference)
values('bac30000-0000-4000-8000-000000000001','bac30000-0000-4000-8000-000000000002','bac30000-0000-4000-8000-000000000003',
'5eed0000-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-0000000000a1',10000,'ACCT_BK1synthetic',now()+interval '1 hour','paid','9900000001','cx_bac30000000040008000000000000001');
insert into private.payment_inbox(event_key,reference,kind,provider_id,amount_minor,currency,status,state,applied_at)
values(repeat('b',64),'cx_bac30000000040008000000000000001','charge.success','9900000001',10000,'ZAR','success','applied',now());
insert into private.payment_effects(attempt_id,provider_id,event_key)
values('bac30000-0000-4000-8000-000000000001','9900000001',repeat('b',64));
insert into private.payment_event(booking_id,kind) values('bac30000-0000-4000-8000-000000000003','paid');
insert into private.payment_cases(attempt_id,kind) values('bac30000-0000-4000-8000-000000000001','settlement_mismatch');
insert into private.payment_refunds(id,attempt_id,amount_minor,reason,actor,state,provider_id)
values('bac30000-0000-4000-8000-000000000004','bac30000-0000-4000-8000-000000000001',1000,'Synthetic BK-1 refund','bk1/refund','processed','9900000002');
insert into private.payment_disputes(provider_id,attempt_id,amount_minor,state)
values('9900000003','bac30000-0000-4000-8000-000000000001',9000,'open');
-- The settlements cursor is created on first use, not by a migration;
-- give BK-1 its row so the table is covered by the restore.
insert into private.payment_reconcile_cursor(job,page) values('settlements',1) on conflict(job) do nothing;
insert into private.payment_settlements(provider_id,gross_minor,fees_minor,net_minor,state)
values('9900000004',10000,300,9700,'matched');
insert into private.payment_settlement_lines(settlement_id,provider_id,reference,amount_minor,fees_minor,subaccount)
values('9900000004','9900000001','cx_bac30000000040008000000000000001',10000,300,'ACCT_BK1synthetic');
insert into private.booking_notifications(logical_key,booking_id,recipient_id,expected_state,expires_at,state)
values('bk1/booking-update','bac30000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-000000000001','completed',now()+interval '1 hour','suppressed');
insert into private.booking_reviews(id,booking_id,organisation_id,author_id,stars,published_text,state,moderated_at)
values('bac30000-0000-4000-8000-000000000005','bac30000-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-0000000000a1','5eed0000-0000-4000-8000-000000000001',5,'Synthetic workshop review.','published',now());
insert into private.review_moderation(review_id,decision,moderator_id)
values('bac30000-0000-4000-8000-000000000005','published','5eed0000-0000-4000-8000-000000000004');

insert into private.notification_cursor(source,event_id) select 'payment',id from private.payment_event where booking_id='bac30000-0000-4000-8000-000000000003';
