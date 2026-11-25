-- Finish-build follow-up to PR 4b and PR 5 (D-098): a sole owner may close
-- their account once their business is closed, as the plan says ("transfer
-- or close their business"). Before, any sole owner was refused, even with
-- every listing closed through Account > Business.
--
-- Rule: refused (owner_must_transfer) only while the person is the only
-- active owner of a business that still has a listing in search, under
-- review or suspended. Suspended listings can't be closed by the owner, so
-- that business still needs a transfer or CarworX. Everything else in
-- close_account is unchanged (re-confirmation, admins, already closing,
-- memberships end at once).

create or replace function private.close_account() returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_after timestamptz;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Re-confirmed at this boundary, not only in the Worker: the caller's
  -- token must carry a password or authenticator check from the last 10
  -- minutes (the Worker signs in again, or verifies a code, just before).
  -- A stolen older session cannot close the account through the API.
  if not exists (select from jsonb_array_elements(
                   case when jsonb_typeof(auth.jwt()->'amr') = 'array' then auth.jwt()->'amr' else '[]'::jsonb end) a
                 where a->>'method' in ('password','totp')
                   and (a->>'timestamp') ~ '^[0-9]{1,12}$'
                   and (a->>'timestamp')::bigint >= extract(epoch from now())::bigint - 600) then
    raise exception 'reconfirm_required' using errcode = 'P0001';
  end if;
  if exists (select from private.platform_admins a where a.user_id = v_uid) then
    raise exception 'admin_account' using errcode = 'P0001';
  end if;
  -- Lock this person's businesses in a fixed order before reading owners.
  perform from public.organisations o
    where o.id in (select m.organisation_id from public.memberships m where m.user_id = v_uid and m.status = 'active')
    order by o.id for update;
  -- A sole owner must first hand the business over (PR 5 transfer) or
  -- close it: no listing of it may still be in search, under review or
  -- suspended. A business whose listings are all closed or drafts can be
  -- left; its history stays with it.
  if exists (select from public.memberships m
             where m.user_id = v_uid and m.status = 'active' and m.role = 'owner'
               and not exists (select from public.memberships o
                               where o.organisation_id = m.organisation_id and o.id <> m.id
                                 and o.role = 'owner' and o.status = 'active')
               and exists (select from public.listings l
                           where l.organisation_id = m.organisation_id
                             and l.status in ('live','submitted','suspended'))) then
    raise exception 'owner_must_transfer' using errcode = 'P0001';
  end if;
  if exists (select from private.account_closures c where c.user_id = v_uid) then
    raise exception 'already_closing' using errcode = 'P0001';
  end if;
  -- Disabled at once: every membership ends (audited, and owner changes
  -- start a new control generation through the existing triggers).
  update public.memberships set status = 'revoked' where user_id = v_uid and status = 'active';
  insert into private.account_closures(user_id) values (v_uid) returning delete_after into v_after;
  return v_after;
end $$;
