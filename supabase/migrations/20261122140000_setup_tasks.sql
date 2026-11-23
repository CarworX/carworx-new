-- Port group 1 (Sites preview "Finish setup" hub, #83 @ b88a8ca): which setup
-- tasks a business has finished. The team settings all have defaults, so a
-- saved choice can't be told apart from one never made; the hub's Done/To do
-- badges and its progress ring read this list instead.
--
-- Tasks: team (invited someone, or "It's just me for now"), assign (who gets
-- the booking), contact (what staff can see), secure (team sign-in security),
-- cover (cover photo). Only an owner or a manager of the business may mark
-- one, through the RPC below; nobody writes the column directly. Members read
-- it with the rest of their organisation row (existing SELECT grant + RLS).

alter table public.organisations
  add column setup_done text[] not null default '{}'
    check (setup_done <@ array['team','assign','contact','secure','cover']::text[]);
comment on column public.organisations.setup_done is
  'Finish-setup tasks the business has done (port group 1). Written only by private.mark_setup_task.';

create function private.mark_setup_task(p_org uuid, p_task text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or p_org is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_task is null or p_task not in ('team','assign','contact','secure','cover') then
    perform private.bad_input();
  end if;
  if not private.has_org_role(p_org, array['owner','manager']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.organisations
    set setup_done = (select array_agg(distinct t order by t) from unnest(setup_done || array[p_task]) t)
  where id = p_org and not (p_task = any(setup_done));
end $$;

create function public.mark_setup_task(p_org uuid, p_task text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.mark_setup_task(p_org, p_task) $$;

revoke all on function private.mark_setup_task(uuid, text), public.mark_setup_task(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.mark_setup_task(uuid, text), public.mark_setup_task(uuid, text)
  to authenticated;
