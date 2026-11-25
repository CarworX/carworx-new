-- Finish-build PR 5 (D-098, planning/claude/finish-build-plan.md): the
-- Account "Business" tab. Transfer ownership to someone on the team, who must
-- accept, and close a business listing (take it out of search, history kept).
--
-- Rules:
-- * Only an active owner offers ownership, to an active manager or staff
--   member of the same business. One open offer per business; it lasts 7
--   days. The owner can cancel it; the person offered can accept or decline.
-- * Accepting re-checks everything under the organisation lock: the offer is
--   theirs and unexpired, they are still an active member, and the person who
--   offered is still an active owner. Then the new owner becomes "owner" and
--   the old owner becomes "manager" in one transaction, so the business always
--   has an owner. The memberships_control_generation trigger runs on the owner
--   change (old invites stop working) and memberships_audit writes the team
--   history. Access is re-read from memberships on every request.
-- * Closing a listing is owner-only. A live or submitted listing goes back to
--   draft, so it leaves search at once; coming back is the existing
--   "send for review" path (provider_resubmit), so an admin looks again.
--   A suspended listing stays as the admin left it.
-- * Every step writes an ID-only audit row. The closure is kept in its own
--   table, not listing_decisions: decided_by there has no cascade, so an
--   owner recorded in it could never delete their account (PR 4b).
-- * The business's two-step rule (O7) applies: private.require_org_mfa.
--
-- Lock order as P2-4: the organisation row first, then memberships/listings.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table private.ownership_offers (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_membership uuid not null references public.memberships(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  check (from_user <> to_user),
  check (expires_at = created_at + interval '7 days')
);
create index ownership_offers_to_user_idx on private.ownership_offers(to_user);
comment on table private.ownership_offers is
  'Open ownership offers (D-098 PR 5): one per business, 7 days, accepted by the person offered.';

create table private.listing_closures (
  listing_public_id uuid primary key references public.listings(public_id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  closed_at timestamptz not null default now()
);
comment on table private.listing_closures is
  'Listings their owner closed (D-098 PR 5). Cleared when the listing leaves draft again. Who closed it is in audit_log (IDs only).';

alter table private.ownership_offers enable row level security;
alter table private.listing_closures enable row level security;
revoke all on private.ownership_offers, private.listing_closures from public, anon, authenticated, service_role,
  listing_projection, listing_eligibility, catalogue_server, forms_server, retention_server;

-- A closure label only means something while the listing is a closed draft.
create function private.listing_closure_clear() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'draft' then
    delete from private.listing_closures where listing_public_id = new.public_id;
  end if;
  return null;
end $$;
revoke all on function private.listing_closure_clear() from public, anon, authenticated, service_role;
create trigger listing_closure_clear after update of status on public.listings
  for each row when (old.status is distinct from new.status)
  execute function private.listing_closure_clear();

-- ID-only audit rows, the same shape the triggers write.
create function private.business_audit(p_org uuid, p_table text, p_target text, p_details jsonb) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.audit_log(actor_id, organisation_id, action, target_table, target_id, details)
  values (auth.uid(), p_org, 'update', p_table, p_target, p_details);
$$;
revoke all on function private.business_audit(uuid, text, text, jsonb) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Transfer ownership
-- ---------------------------------------------------------------------------
create function private.offer_ownership(p_membership uuid) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_m public.memberships; v_expires timestamptz;
begin
  if v_uid is null or p_membership is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select m.organisation_id into v_org from public.memberships m where m.id = p_membership;
  if not found or not private.has_org_role(v_org, array['owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.organisations where id = v_org for update;
  -- Re-read after the lock: the caller may have lost ownership meanwhile.
  if not private.has_org_role(v_org, array['owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(v_org);
  select * into v_m from public.memberships where id = p_membership and status = 'active' for update;
  if not found or v_m.user_id = v_uid or v_m.role not in ('manager','staff') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from private.ownership_offers where organisation_id = v_org and expires_at <= now();
  if exists (select from private.ownership_offers where organisation_id = v_org) then
    raise exception 'offer_pending' using errcode = 'P0001';
  end if;
  insert into private.ownership_offers(organisation_id, from_user, to_membership, to_user)
    values (v_org, v_uid, v_m.id, v_m.user_id) returning expires_at into v_expires;
  perform private.business_audit(v_org, 'ownership_offers', v_org::text,
    jsonb_build_object('event', 'offered', 'to_user_id', v_m.user_id));
  return v_expires;
end $$;

create function private.cancel_ownership_offer(p_org uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_to uuid;
begin
  if auth.uid() is null or p_org is null or not private.has_org_role(p_org, array['owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.organisations where id = p_org for update;
  perform private.require_org_mfa(p_org);
  delete from private.ownership_offers where organisation_id = p_org returning to_user into v_to;
  if v_to is null then return false; end if;
  perform private.business_audit(p_org, 'ownership_offers', p_org::text,
    jsonb_build_object('event', 'cancelled', 'to_user_id', v_to));
  return true;
end $$;

-- Open offers the caller can see: ones made to them, and the one open at a
-- business they own. Names are display labels only.
create function private.ownership_offers()
returns table(organisation_id uuid, organisation_name text, incoming boolean,
  other_name text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.organisation_id, g.name, o.to_user = auth.uid(),
    p.display_name, o.expires_at
  from private.ownership_offers o
  join public.organisations g on g.id = o.organisation_id
  join public.memberships t on t.id = o.to_membership and t.status = 'active'
  left join public.profiles p on p.id = case when o.to_user = auth.uid() then o.from_user else o.to_user end
  where auth.uid() is not null and o.expires_at > now()
    and (o.to_user = auth.uid() or private.has_org_role(o.organisation_id, array['owner']))
  order by g.name, o.organisation_id
  limit 50;
$$;

create function private.respond_ownership_offer(p_org uuid, p_accept boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_o private.ownership_offers;
begin
  if v_uid is null or p_org is null or p_accept is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform from public.organisations where id = p_org for update;
  select * into v_o from private.ownership_offers
    where organisation_id = p_org and to_user = v_uid for update;
  if not found or v_o.expires_at <= now() then raise exception 'offer_invalid' using errcode = 'P0001'; end if;
  if not p_accept then
    delete from private.ownership_offers where organisation_id = p_org;
    perform private.business_audit(p_org, 'ownership_offers', p_org::text,
      jsonb_build_object('event', 'declined', 'to_user_id', v_uid));
    return false;
  end if;
  perform private.require_org_mfa(p_org);
  if not exists (select from public.memberships m where m.id = v_o.to_membership
                   and m.user_id = v_uid and m.status = 'active')
     or not exists (select from public.memberships m where m.organisation_id = p_org
                      and m.user_id = v_o.from_user and m.role = 'owner' and m.status = 'active') then
    raise exception 'offer_invalid' using errcode = 'P0001';
  end if;
  -- New owner first, then the old one steps down: never zero owners.
  update public.memberships set role = 'owner' where id = v_o.to_membership;
  update public.memberships set role = 'manager'
    where organisation_id = p_org and user_id = v_o.from_user and role = 'owner' and status = 'active';
  delete from private.ownership_offers where organisation_id = p_org;
  perform private.business_audit(p_org, 'ownership_offers', p_org::text,
    jsonb_build_object('event', 'accepted', 'to_user_id', v_uid, 'from_user_id', v_o.from_user));
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Close a listing
-- ---------------------------------------------------------------------------
create function private.close_listing(p_listing uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_org uuid; v_status text;
begin
  if auth.uid() is null or p_listing is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select l.organisation_id into v_org from public.listings l where l.public_id = p_listing;
  if not found or not private.has_org_role(v_org, array['owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform from public.organisations where id = v_org for update;
  if not private.has_org_role(v_org, array['owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(v_org);
  select l.status into v_status from public.listings l where l.public_id = p_listing for update;
  if v_status = 'suspended' then raise exception 'listing_suspended' using errcode = 'P0001'; end if;
  if v_status not in ('live','submitted') then raise exception 'not_open' using errcode = 'P0001'; end if;
  update public.listings set status = 'draft' where public_id = p_listing;
  insert into private.listing_closures(listing_public_id, organisation_id) values (p_listing, v_org)
    on conflict (listing_public_id) do update set closed_at = excluded.closed_at;
  perform private.business_audit(v_org, 'listing_closures', p_listing::text,
    jsonb_build_object('event', 'closed_by_owner', 'listing_public_id', p_listing, 'old_status', v_status));
end $$;

-- Closed listings of a business, for its members (the provider page label).
create function private.closed_listings(p_org uuid)
returns table(listing_public_id uuid, closed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_org is null or not private.is_org_member(p_org) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select c.listing_public_id, c.closed_at from private.listing_closures c
      join public.listings l on l.public_id = c.listing_public_id and l.status = 'draft'
    where c.organisation_id = p_org
    order by c.closed_at desc limit 100;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Grants and public wrappers (SECURITY INVOKER; authenticated only)
-- ---------------------------------------------------------------------------
revoke all on function
  private.offer_ownership(uuid), private.cancel_ownership_offer(uuid), private.ownership_offers(),
  private.respond_ownership_offer(uuid, boolean), private.close_listing(uuid), private.closed_listings(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  private.offer_ownership(uuid), private.cancel_ownership_offer(uuid), private.ownership_offers(),
  private.respond_ownership_offer(uuid, boolean), private.close_listing(uuid), private.closed_listings(uuid)
  to authenticated;

create function public.offer_ownership(p_membership uuid) returns timestamptz
language sql volatile security invoker set search_path = '' as $$ select private.offer_ownership(p_membership) $$;
create function public.cancel_ownership_offer(p_org uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$ select private.cancel_ownership_offer(p_org) $$;
create function public.ownership_offers()
returns table(organisation_id uuid, organisation_name text, incoming boolean, other_name text, expires_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.ownership_offers() $$;
create function public.respond_ownership_offer(p_org uuid, p_accept boolean) returns boolean
language sql volatile security invoker set search_path = '' as $$ select private.respond_ownership_offer(p_org, p_accept) $$;
create function public.close_listing(p_listing uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.close_listing(p_listing) $$;
create function public.closed_listings(p_org uuid) returns table(listing_public_id uuid, closed_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.closed_listings(p_org) $$;

revoke all on function
  public.offer_ownership(uuid), public.cancel_ownership_offer(uuid), public.ownership_offers(),
  public.respond_ownership_offer(uuid, boolean), public.close_listing(uuid), public.closed_listings(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.offer_ownership(uuid), public.cancel_ownership_offer(uuid), public.ownership_offers(),
  public.respond_ownership_offer(uuid, boolean), public.close_listing(uuid), public.closed_listings(uuid)
  to authenticated;
