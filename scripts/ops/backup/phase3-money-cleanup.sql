-- App triggers are paused by the existing BK-1 cleanup transaction.
delete from private.provider_invoices where organisation_id='5eed0000-0000-4000-8000-0000000000a1' and period_start='2026-10-01';
delete from private.billing_settings where id;
delete from private.review_moderation where review_id='bac30000-0000-4000-8000-000000000005';
delete from private.booking_reviews where id='bac30000-0000-4000-8000-000000000005';
delete from private.booking_notifications where logical_key='bk1/booking-update';
delete from private.payment_reconcile_cursor where job='settlements';
delete from private.payment_settlement_lines where settlement_id='9900000004';
delete from private.payment_settlements where provider_id='9900000004';
delete from private.payment_disputes where provider_id='9900000003';
delete from private.payment_refunds where id='bac30000-0000-4000-8000-000000000004';
delete from private.payment_cases where attempt_id='bac30000-0000-4000-8000-000000000001';
delete from private.payment_effects where attempt_id='bac30000-0000-4000-8000-000000000001';
delete from private.payment_inbox where event_key=repeat('b',64);
delete from private.notification_cursor where source='payment' and event_id in(select id from private.payment_event where booking_id='bac30000-0000-4000-8000-000000000003');
delete from private.payment_event where booking_id='bac30000-0000-4000-8000-000000000003';
delete from private.payment_attempts where id='bac30000-0000-4000-8000-000000000001';
delete from private.payment_accounts where organisation_id='5eed0000-0000-4000-8000-0000000000a1' and subaccount='ACCT_BK1synthetic';
