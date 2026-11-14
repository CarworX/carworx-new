-- Removes the staging businesses added by seed-staging.sql. Nothing else.
begin;
delete from public.verifications where organisation_id::text like 'de300000-%';
delete from public.listing_hours where organisation_id::text like 'de300000-%';
delete from public.listing_services where organisation_id::text like 'de300000-%';
delete from public.service_areas where organisation_id::text like 'de300000-%';
delete from public.listings where organisation_id::text like 'de300000-%';
delete from public.branches where organisation_id::text like 'de300000-%';
delete from public.coordinate_sources where organisation_id::text like 'de300000-%';
delete from public.organisations where id::text like 'de300000-%';
-- Put back only the names seed-staging.sql set, so a name someone changed
-- since is left alone.
update public.services s set name = v.old
from (values ('wash','Wash & valet','Synthetic wash'),('service','Mechanical service','Synthetic service'),
 ('tyres','Tyres & alignment','Synthetic tyres'),('paint','Panel & paint','Synthetic paint'),
 ('electrical','Auto electrical','Synthetic electrical'),('mobile-repair','Mobile mechanic','Synthetic mobile repair'),
 ('glass','Windscreen & glass','Synthetic glass repair')) v(slug, new, old)
where s.slug = v.slug and s.name = v.new;
commit;
