-- Keep the exposed public schema invoker-only (00_catalog.test.sql).
-- Moving implementations preserves their ownership checks and fixed paths.
alter function public.payment_details(text) set schema private;
alter function public.configure_test_subaccount(uuid,text) set schema private;
alter function public.request_payment_refund(uuid,bigint,text,uuid) set schema private;
alter function public.refund_late_payment(uuid) set schema private;
alter function public.money_operations() set schema private;
alter function public.settlement_operations() set schema private;
alter function public.mail_operations() set schema private;
alter function public.my_booking_review(uuid) set schema private;
alter function public.submit_booking_review(uuid,integer,text) set schema private;
alter function public.review_queue() set schema private;
alter function public.moderate_booking_review(uuid,text,text,boolean) set schema private;

create function public.payment_details(p_reference text) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.payment_details(p_reference) $$;
create function public.configure_test_subaccount(p_org uuid,p_code text) returns void
language sql security invoker set search_path='' as $$ select private.configure_test_subaccount(p_org,p_code) $$;
create function public.request_payment_refund(p_booking uuid,p_amount bigint,p_reason text,p_key uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.request_payment_refund(p_booking,p_amount,p_reason,p_key) $$;
create function public.refund_late_payment(p_booking uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.refund_late_payment(p_booking) $$;
create function public.money_operations() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.money_operations() $$;
create function public.settlement_operations() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.settlement_operations() $$;
create function public.mail_operations() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.mail_operations() $$;
create function public.my_booking_review(p_booking uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.my_booking_review(p_booking) $$;
create function public.submit_booking_review(p_booking uuid,p_stars integer,p_text text) returns uuid
language sql security invoker set search_path='' as $$ select private.submit_booking_review(p_booking,p_stars,p_text) $$;
create function public.review_queue() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.review_queue() $$;
create function public.moderate_booking_review(p_review uuid,p_decision text,p_public_text text,p_deidentified boolean) returns void
language sql security invoker set search_path='' as $$ select private.moderate_booking_review(p_review,p_decision,p_public_text,p_deidentified) $$;
revoke all on function public.payment_details(text),public.configure_test_subaccount(uuid,text),
 public.request_payment_refund(uuid,bigint,text,uuid),public.refund_late_payment(uuid),public.money_operations(),
 public.settlement_operations(),public.mail_operations(),public.my_booking_review(uuid),
 public.submit_booking_review(uuid,integer,text),public.review_queue(),public.moderate_booking_review(uuid,text,text,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.payment_details(text),public.configure_test_subaccount(uuid,text),
 public.request_payment_refund(uuid,bigint,text,uuid),public.refund_late_payment(uuid),public.money_operations(),
 public.settlement_operations(),public.mail_operations(),public.my_booking_review(uuid),
 public.submit_booking_review(uuid,integer,text),public.review_queue(),public.moderate_booking_review(uuid,text,text,boolean)
 to authenticated;

-- Anonymous reviews get a dedicated published-text facade. The server-only
-- api schema and private schema retain their existing client-usage denials.
create schema review_projection;
revoke all on schema review_projection from public;
alter function public.organisation_reviews(uuid) set schema review_projection;
revoke all on function review_projection.organisation_reviews(uuid) from public,anon,authenticated,service_role;
grant usage on schema review_projection to anon,authenticated;
grant execute on function review_projection.organisation_reviews(uuid) to anon,authenticated;
create function public.organisation_reviews(p_org uuid) returns table(stars integer,review text)
language sql stable security invoker set search_path='' as $$ select * from review_projection.organisation_reviews(p_org) $$;
revoke all on function public.organisation_reviews(uuid) from public,anon,authenticated,service_role;
grant execute on function public.organisation_reviews(uuid) to anon,authenticated;
