-- Additive review hardening. No published columns, owners or client grants change.
-- Serialize all hierarchy writes before row locks. The volatile AFTER-statement
-- check takes a fresh READ COMMITTED snapshot after a competing writer commits.
create function private.lock_category_tree() returns trigger
language plpgsql volatile set search_path = '' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Category writes require READ COMMITTED' using errcode = '25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(172905, 1);
  return null;
end $$;

create function private.check_category_tree() returns trigger
language plpgsql volatile set search_path = '' as $$
begin
  if exists (
    with recursive walk(slug, parent_slug, path, cycle) as (
      select c.slug, c.parent_slug, array[c.slug], false from public.categories c
      union all
      select c.slug, c.parent_slug, w.path || c.slug, c.slug = any(w.path)
      from walk w join public.categories c on c.slug = w.parent_slug
      where not w.cycle
    ) select from walk where cycle
  ) then
    raise exception 'Category parent cycle' using errcode = '23514';
  end if;
  return null;
end $$;
revoke all on function private.lock_category_tree(), private.check_category_tree()
  from public, anon, authenticated, service_role;
create trigger categories_lock_tree before insert or update or delete on public.categories
  for each statement execute function private.lock_category_tree();
create trigger categories_check_tree after insert or update on public.categories
  for each statement execute function private.check_category_tree();
-- Also validate existing rows under the same serialized check.
update public.categories set parent_slug = parent_slug;

-- Keep the restricted view owner and its final membership settings intact.
grant listing_projection to postgres with set true, inherit true;
create or replace view public.listing_public with (security_invoker = false, security_barrier = true) as
select l.public_id, l.display_name, l.description, l.metro, l.mode,
  s.slug as service_slug, s.name as service_name, c.slug as category_slug, c.name as category_name,
  case when l.mode = 'fixed' then b.public_address end as public_address,
  case when l.mode = 'fixed' then b.public_latitude end as public_latitude,
  case when l.mode = 'fixed' then b.public_longitude end as public_longitude,
  array(select case v.method when 'identity_checked' then 'Identity checked'
    when 'business_details_checked' then 'Business details checked' when 'premises_visited' then 'Premises visited' end
    from public.verifications v where v.listing_public_id = l.public_id and v.revoked_at is null and v.verified_at <= now() order by v.method) as verification_labels
from public.listings l
join public.services s on s.slug = l.service_slug
join public.categories c on c.slug = s.category_slug
left join public.branches b on b.public_id = l.branch_public_id
where l.status = 'live';

grant listing_projection to postgres with set false, inherit false;
