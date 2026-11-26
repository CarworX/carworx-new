begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to authenticated, retention_server;
grant usage on schema extensions to retention_server;
grant retention_server to postgres with set true, inherit false;
select plan(16);
select count(*)::int as existing_identity from private.identity_checks where status='in_review' \gset
select count(distinct review_id)::int as existing_reports from public.review_reports where resolved_at is null \gset

insert into auth.users(id,email) values
  ('d6200000-0000-4000-8000-000000000001','review-hooks-subject@example.test'),
  ('d6200000-0000-4000-8000-000000000002','review-hooks-admin@example.test');
insert into private.platform_admins(user_id) values ('d6200000-0000-4000-8000-000000000002');
insert into public.consents(user_id,purpose,notice_version) values
  ('d6200000-0000-4000-8000-000000000001','account_terms','account-terms-v1');
insert into private.identity_checks(user_id,provider_session_id,status,id_last4,attempt) values
  ('d6200000-0000-4000-8000-000000000001','d6210000-0000-4000-8000-000000000001','in_review','1234',1);
insert into public.fines_payments(id,user_id,notice_ids,cents,provider_ref)
  values ('d6220000-0000-4000-8000-000000000001','d6200000-0000-4000-8000-000000000001',
    array['GP-2026-118452'],45000,'sandbox:d6220000-0000-4000-8000-000000000001');

insert into public.reviews(id,listing_public_id,organisation_id,author_id,author_display,rating,body,service_slug,status,hidden_reason,created_at,edited_at) values
 ('d6230000-0000-4000-8000-000000000001','ca7c1000-0000-4000-8000-000000000001',
   '5eed0000-0000-4000-8000-0000000000a1','d6200000-0000-4000-8000-000000000002','Other customer',3,
   'A fictional review for the queue.',null,'visible',null,'2026-11-20 08:00+00',null),
 ('d6230000-0000-4000-8000-000000000002','ca7c1000-0000-4000-8000-000000000001',
   '5eed0000-0000-4000-8000-0000000000a1','d6200000-0000-4000-8000-000000000001','Review author',4,
   'The account holder wrote this review.','service','hidden','Contains a private phone number.','2026-11-20 08:00+00','2026-11-21 09:00+00');
insert into public.review_replies(review_id,author_id,body,created_at,edited_at) values
 ('d6230000-0000-4000-8000-000000000001','d6200000-0000-4000-8000-000000000001','The account holder wrote this reply.','2026-11-20 08:00+00','2026-11-21 09:00+00'),
 ('d6230000-0000-4000-8000-000000000002','d6200000-0000-4000-8000-000000000002','Another account wrote this reply.','2026-11-20 08:00+00',null);
insert into public.review_reports(review_id,reporter_id,reason,created_at) values
 ('d6230000-0000-4000-8000-000000000001','d6200000-0000-4000-8000-000000000001','First report for the same review.','2026-11-20 08:00+00'),
 ('d6230000-0000-4000-8000-000000000001','d6200000-0000-4000-8000-000000000002','Second report for the same review.','2026-11-20 08:00+00');

select is(private.personal_data('d6200000-0000-4000-8000-000000000001')#>>'{identity_checks,0,id_last4}','1234','export includes ID suffix');
select ok(private.personal_data('d6200000-0000-4000-8000-000000000001')::text not like '%d6210000%', 'export excludes the provider session ID');
select is(private.personal_data('d6200000-0000-4000-8000-000000000001')#>>'{consents,0,purpose}','account_terms','export includes account terms even without subject email');
select is(private.personal_data('d6200000-0000-4000-8000-000000000001')#>>'{fines_payments,0,cents}','45000','export includes the customer payment');

create temp view review_export_subject as
  select private.personal_data('d6200000-0000-4000-8000-000000000001') as doc,
    l.display_name as listing
  from public.listings l where l.public_id='ca7c1000-0000-4000-8000-000000000001';

select is((select doc->'reviews' from review_export_subject),
  (select jsonb_build_array(jsonb_build_object(
    'listing',listing,'rating',4,'body','The account holder wrote this review.',
    'service_slug','service','status','hidden','hidden_reason','Contains a private phone number.',
    'created_at','2026-11-20 08:00+00'::timestamptz,'edited_at','2026-11-21 09:00+00'::timestamptz))
    from review_export_subject), 'export includes only the customer''s review with moderation and edit details');
select is((select doc->'review_replies' from review_export_subject),
  (select jsonb_build_array(jsonb_build_object(
    'listing',listing,'body','The account holder wrote this reply.',
    'created_at','2026-11-20 08:00+00'::timestamptz,'edited_at','2026-11-21 09:00+00'::timestamptz))
    from review_export_subject), 'export includes only the customer''s reply');
select is((select doc->'review_reports' from review_export_subject),
  (select jsonb_build_array(jsonb_build_object(
    'listing',listing,'reason','First report for the same review.',
    'created_at','2026-11-20 08:00+00'::timestamptz,'resolved_at',null))
    from review_export_subject), 'export includes only the customer''s report');

set local request.jwt.claims = '{"sub":"d6200000-0000-4000-8000-000000000002","aal":"aal1"}';
set local role authenticated;
select throws_ok('select public.admin_today_review_counts()','42501','not_allowed','AAL1 admin cannot see review counts');
reset role;
set local request.jwt.claims = '{"sub":"d6200000-0000-4000-8000-000000000002","aal":"aal2"}';
set local role authenticated;
select is((select pending_identity_reviews from public.admin_today_review_counts()),(:'existing_identity')::int+1,'AAL2 admin sees pending checks');
select is((select reported_reviews from public.admin_today_review_counts()),(:'existing_reports')::int+1,'two reports on one review count as one item');
reset role;

insert into private.account_closures(user_id,requested_at,delete_after,claimed_at)
 values ('d6200000-0000-4000-8000-000000000001',now()-interval '16 days',now()-interval '2 days',now());
set local role retention_server;
select is(public.finalize_account_deletion('d6200000-0000-4000-8000-000000000001'),true,'account deletion finishes and durably queues provider erasure');
select id, claim_id from public.claim_didit_deletions(10) where provider_session_id='d6210000-0000-4000-8000-000000000001' \gset
select is(public.complete_didit_deletion(:'id',gen_random_uuid()),false,'a stale or foreign lease cannot acknowledge a deletion');
select is(public.complete_didit_deletion(:'id',:'claim_id'),true,'a successful deletion acknowledges and removes the task');
reset role;
select is((select count(*)::integer from private.identity_checks where user_id='d6200000-0000-4000-8000-000000000001'),0,'identity data is removed locally');
select ok((select user_id is null from public.fines_payments where id='d6220000-0000-4000-8000-000000000001'),'payment survives with the account unlinked');
select ok(exists(select from public.audit_log where target_table='didit_session_deletions' and target_id=:'id' and details->>'outcome'='erased'),'audit records completion by local instruction ID');
select * from finish();
rollback;
