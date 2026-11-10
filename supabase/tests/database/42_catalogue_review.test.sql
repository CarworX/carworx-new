begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to anon;
select plan(10);

select lives_ok($$insert into public.categories(slug,name,parent_slug) values
 ('review-tree-a','Synthetic A',null),('review-tree-b','Synthetic B','review-tree-a'),
 ('review-tree-c','Synthetic C','review-tree-b')$$,'valid multi-row category tree');
select throws_ok($$update public.categories set parent_slug=slug where slug='review-tree-a'$$,'23514',null,'self cycle rejected');
select throws_ok($$update public.categories set parent_slug='review-tree-b' where slug='review-tree-a'$$,'23514',null,'two-node cycle rejected');
select throws_ok($$update public.categories set parent_slug='review-tree-c' where slug='review-tree-a'$$,'23514',null,'longer cycle rejected');
select throws_ok($$update public.categories set parent_slug=case slug when 'review-tree-a' then 'review-tree-b' else 'review-tree-a' end where slug in ('review-tree-a','review-tree-b')$$,'23514',null,'cycle formed by one multi-row update rejected');
select lives_ok($$update public.categories set parent_slug=case slug when 'review-tree-a' then 'review-tree-b' when 'review-tree-b' then 'review-tree-c' else null end where slug like 'review-tree-%'$$,'valid multi-row reparenting accepted');
select lives_ok($$update public.categories set parent_slug=null where slug='review-tree-b'$$,'detaching a subtree is valid');

insert into auth.users(id,email) values ('b4000000-0000-4000-8000-000000000001','review.synthetic@example.test');
insert into public.organisations(id,name) values ('b4000000-0000-4000-8000-000000000002','Synthetic review');
insert into public.services(slug,category_slug,name) values ('review-service','review-tree-a','Synthetic review');
insert into public.listings(id,public_id,organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
 values ('b4000000-0000-4000-8000-000000000003','b4000000-0000-4000-8000-000000000004','b4000000-0000-4000-8000-000000000002','review-service','Synthetic review','Synthetic review','Gauteng','mobile','live','admin_import','synthetic-review');
insert into public.verifications(organisation_id,listing_public_id,method,verified_at,revoked_at,verified_by,evidence_reference) values
 ('b4000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000004','identity_checked',now()-interval '2 days',now()-interval '1 day','b4000000-0000-4000-8000-000000000001','synthetic-revoked'),
 ('b4000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000004','business_details_checked',now()+interval '1 day',null,'b4000000-0000-4000-8000-000000000001','synthetic-future'),
 ('b4000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000004','premises_visited',now()-interval '1 day',null,'b4000000-0000-4000-8000-000000000001','synthetic-current');
-- Deliberately loosen the owner's RLS in this rolled-back test to prove the
-- view independently excludes revoked and future labels.
alter policy catalogue_projection on public.verifications using (true);
set local role anon;
select is((select verification_labels from public.listing_public where public_id='b4000000-0000-4000-8000-000000000004'),array['Premises visited']::text[],'view filters labels independently of owner RLS');
reset role;
select is((select pg_get_userbyid(relowner)::text from pg_class where oid='public.listing_public'::regclass),'listing_projection','restricted view owner preserved');
select ok((select reloptions @> array['security_barrier=true','security_invoker=false'] from pg_class where oid='public.listing_public'::regclass),'security options preserved');
select * from finish();
rollback;
