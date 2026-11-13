-- O3/O6: the stepped flow is now the only application submission path.
-- The old RPC lacks age/probing consent and pin provenance; retaining its
-- client grants would bypass provider_submit even after the old page redirects.
revoke all on function public.provider_apply(text,text,text,text,text,text,double precision,double precision,integer)
  from public, anon, authenticated, service_role;
revoke all on function private.provider_apply(text,text,text,text,text,text,double precision,double precision,integer)
  from public, anon, authenticated, service_role;

-- Team history is a narrow projection. Do not broaden audit_log's admin-only
-- RLS or return actor identifiers, row IDs, reasons, invitation data or details.
create function private.team_changes(p_org uuid)
returns table(id bigint, occurred_at timestamptz, action text, target_table text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_org_role(p_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select a.id, a.occurred_at, a.action, a.target_table
    from public.audit_log a
    where a.organisation_id = p_org
      and a.target_table in ('memberships','invites','staff_profiles','organisations')
    order by a.occurred_at desc, a.id desc
    limit 100;
end $$;

create function public.team_changes(p_org uuid)
returns table(id bigint, occurred_at timestamptz, action text, target_table text)
language sql stable security invoker set search_path = '' as $$
  select * from private.team_changes(p_org)
$$;

revoke all on function private.team_changes(uuid), public.team_changes(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.team_changes(uuid), public.team_changes(uuid)
  to authenticated;
