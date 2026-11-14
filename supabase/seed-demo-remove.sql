-- Removes the staging DEMO businesses added by seed-demo.sql. Nothing else.
begin;
-- Remove any earlier copy (children first). Only DEMO ids (de3...) match.
delete from public.verifications where organisation_id::text like 'de300000-%';
delete from public.listing_hours where organisation_id::text like 'de300000-%';
delete from public.listing_services where organisation_id::text like 'de300000-%';
delete from public.service_areas where organisation_id::text like 'de300000-%';
delete from public.listings where organisation_id::text like 'de300000-%';
delete from public.branches where organisation_id::text like 'de300000-%';
delete from public.coordinate_sources where organisation_id::text like 'de300000-%';
delete from public.organisations where id::text like 'de300000-%';
update public.services s set name = v.name
from (values ('wash','Synthetic wash'),('service','Synthetic service'),('tyres','Synthetic tyres'),
 ('paint','Synthetic paint'),('electrical','Synthetic electrical'),('mobile-repair','Synthetic mobile repair'),
 ('glass','Synthetic glass repair')) v(slug, name)
where s.slug = v.slug;
commit;
