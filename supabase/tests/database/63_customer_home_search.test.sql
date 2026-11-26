begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into public.reviews(listing_public_id,organisation_id,author_display,rating,body)
  values ('ca7c1000-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-0000000000a1',
    'Mila W.',4,'A fictional mobile provider review.');
select is((select count(*)::int from api.search_listings(null,null,null,null,null,'all',null,null,20,null,true)),1,
  'comes-to-you browse excludes fixed premises');
select is((select rating_avg from api.search_listings(null,null,null,null,null,'all',null,null,20,null,true)),4.0::numeric,
  'comes-to-you browse returns the rating');
select is((select rating_count from api.search_listings(-26.11,28.11,null,null,25,'mobile',null,null,20,null,true)),1,
  'located mobile results return the review count');
select ok((select public_address is null and public_latitude is null and public_longitude is null and distance_bucket is null
  from api.search_listings(-26.11,28.11,null,null,25,'mobile',null,null,20,null,true)),
  'the mobile filter preserves service-area privacy');
select is((select count(*)::int from api.search_listings(-26.2,28.04,null,null,25,'fixed',null,null,20,null,true)),0,
  'the mobile filter excludes the fixed group');
select is((select count(*)::int from api.search_listings(null,null,null,null,null,'all',null,null,20,null)),2,
  'the prior search signature retains unfiltered browse');
select ok(not has_function_privilege('anon','api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text,boolean)','execute'),
  'the search overload remains private to the catalogue login');
select is(pg_get_userbyid((select proowner from pg_proc where oid =
    'api.search_listings(double precision,double precision,text,text,integer,text,integer,uuid,integer,text,boolean)'::regprocedure)),
  'listing_projection'::name,'new search wrapper runs under the restricted projection owner');
select * from finish();
rollback;
