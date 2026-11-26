begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(22);

insert into auth.users(id,email) values
  ('d6100000-0000-4000-8000-000000000001','review-customer@example.test'),
  ('d6100000-0000-4000-8000-000000000002','review-reporter@example.test');
insert into public.profiles(id,display_name) values ('d6100000-0000-4000-8000-000000000001','Mila Van Wyk')
  on conflict (id) do update set display_name = excluded.display_name;
insert into public.consents(id,purpose,notice_version,subject_email) values
  ('d6110000-0000-4000-8000-000000000001','enquiry_share_with_provider','privacy-2026-11-01','review-customer@example.test');
insert into public.enquiries(id,listing_public_id,organisation_id,sender_name,sender_email,message,consent_id,sender_user_id) values
  ('d6120000-0000-4000-8000-000000000001','ca7c1000-0000-4000-8000-000000000001',
   '5eed0000-0000-4000-8000-0000000000a1','Mila Van Wyk','review-customer@example.test','Please quote for the service',
   'd6110000-0000-4000-8000-000000000001','d6100000-0000-4000-8000-000000000001');

select ok(not has_column_privilege('anon','public.reviews','author_id','select'), 'anon cannot read account IDs');
select ok(not has_table_privilege('authenticated','public.reviews','insert,update,delete'), 'review writes go through RPCs');
set local request.jwt.claims = '{"sub":"d6100000-0000-4000-8000-000000000002","aal":"aal1"}';
set local role authenticated;
select is(public.can_review('ca7c1000-0000-4000-8000-000000000001'),false,'a signed-in customer without an enquiry cannot review');
select throws_ok($$select public.upsert_review('ca7c1000-0000-4000-8000-000000000001',1::smallint,'A detailed review.',null)$$,
  '42501','not_allowed','first write also enforces eligibility');
reset role;

set local request.jwt.claims = '{"sub":"d6100000-0000-4000-8000-000000000001","aal":"aal1"}';
set local role authenticated;
select is(public.can_review('ca7c1000-0000-4000-8000-000000000001'),true,'an enquiry grants eligibility');
select public.upsert_review('ca7c1000-0000-4000-8000-000000000001',2::smallint,'The service was slow.',null) as review \gset
select is((select id::text from public.my_review('ca7c1000-0000-4000-8000-000000000001')), :'review','author can identify their editable review');
select is((select author_display from public.reviews where id=:'review'),'Mila W.','capture first name and last initial');
reset role;
delete from public.enquiries where id='d6120000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.upsert_review('ca7c1000-0000-4000-8000-000000000001',1::smallint,'The service was very slow.',null)::text,
  :'review','the author can edit after enquiry expiry');
reset role;

set local request.jwt.claims = '{"sub":"5eed0000-0000-4000-8000-000000000001","aal":"aal1"}';
set local role authenticated;
select public.reply_to_review(:'review','Thank you for telling us.');
select public.reply_to_review(:'review','Thank you. We have followed up.');
reset role;
set local role anon;
select is((select body from public.review_replies where review_id=:'review'),'Thank you. We have followed up.','the anonymous page can read the edited business reply');
select is((select rating_avg from public.listing_public where public_id='ca7c1000-0000-4000-8000-000000000001'),1.0::numeric,'visible reviews drive the public rating');
reset role;
set local request.jwt.claims = '{"sub":"d6100000-0000-4000-8000-000000000002","aal":"aal1"}';
set local role authenticated;
select throws_ok(format('select public.reply_to_review(%L,%L)', :'review','Thanks for the feedback.'),'42501','not_allowed','unrelated customer cannot reply for a business');
select is((select count(*)::int from public.my_review('ca7c1000-0000-4000-8000-000000000001')),0,'another viewer cannot identify someone else as the author');
select public.report_review(:'review','Contains misleading details.');
select public.report_review(:'review','Duplicate report stays a no-op.');
reset role;

set local request.jwt.claims = '{"sub":"5eed0000-0000-4000-8000-000000000004","aal":"aal1"}';
set local role authenticated;
select throws_ok('select public.admin_review_queue()','42501','not_allowed','AAL1 admin cannot moderate');
reset role;
set local request.jwt.claims = '{"sub":"5eed0000-0000-4000-8000-000000000004","aal":"aal2"}';
set local role authenticated;
select is((select report_count from public.admin_review_queue() where id=:'review'),1,'one report per reporter');
select throws_ok(format('select public.admin_moderate_review(%L,%L,%L)', :'review','hide','Only one star'),
  '22023',null,'a low rating alone cannot hide a review');
select throws_ok(format('select public.admin_moderate_review(%L,%L,%L)', :'review','hide','Policy violation'),
  '22023',null,'a generic reason cannot hide a review');
select public.admin_moderate_review(:'review','hide','Contains a private phone number.');
select is((select count(*)::integer from public.admin_review_queue() where id=:'review'),0,'moderation resolves the reports');
reset role;

set local role anon;
select is((select count(id)::integer from public.reviews where id=:'review'),0,'hidden review is absent from the public feed');
select is((select count(review_id)::integer from public.review_replies where review_id=:'review'),0,'a hidden review also hides its reply');
select is((select rating_count from public.listing_public where public_id='ca7c1000-0000-4000-8000-000000000001'),0,'hidden review contributes no rating');
reset role;
select ok(exists(select from public.audit_log where target_table='reviews' and target_id=:'review' and details->>'decision'='hide'),'moderation writes an audit record');
delete from auth.users where id='d6100000-0000-4000-8000-000000000001';
select ok((select author_id is null and author_display='Former customer' and body='The service was very slow.' from public.reviews where id=:'review'),'final erasure retains text and anonymises the author');
select * from finish();
rollback;
