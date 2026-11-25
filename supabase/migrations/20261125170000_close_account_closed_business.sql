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

-- Follow-up (review finding): a business left without an active owner stays
-- closed. Same function as before, plus the owner check above.
create or replace function private.provider_resubmit(p_listing uuid, p_display_name text, p_description text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_l public.listings; v_name text; v_desc text;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Same per-applicant lock as provider_apply, taken first, so apply and
  -- resubmit together still leave at most one pending application.
  perform pg_catalog.pg_advisory_xact_lock(172906, pg_catalog.hashtext(v_uid::text));
  select * into v_l from public.listings where public_id = p_listing for update;
  if not found or not private.has_org_role(v_l.organisation_id, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.require_org_mfa(v_l.organisation_id);
  -- A business left without an active owner (its sole owner closed their
  -- account after closing the listings) cannot be reopened by a manager:
  -- nobody could then close it or hand it over, as both are owner-only.
  if not exists (select from public.memberships o
                 where o.organisation_id = v_l.organisation_id and o.role = 'owner' and o.status = 'active') then
    raise exception 'owner_required' using errcode = 'P0001';
  end if;
  v_name := private.clean_text(p_display_name, 2, 160);

  v_desc := private.clean_multiline(p_description, 10, 2000);
  if v_l.status <> 'draft' then raise exception 'not_draft' using errcode = 'P0001'; end if;
  if exists (select from public.listings l join public.memberships m on m.organisation_id = l.organisation_id
             where m.user_id = v_uid and m.status = 'active' and m.role = 'owner' and l.status = 'submitted') then
    raise exception 'application_pending' using errcode = 'P0001';
  end if;
  update public.listings set status = 'submitted', submitted_at = now(), display_name = v_name, description = v_desc
    where public_id = p_listing;
end $$;
