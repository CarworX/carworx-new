-- Phase 3 CI blockers in the money and messaging lane, fixed by Claude with
-- the owner's approval (14 Nov 2026) for Codex's review. Behaviour is kept;
-- only where the code lives, and two seeding/permission details, change.

-- ---------------------------------------------------------------------------
-- 1. No SECURITY DEFINER function in the API-exposed public schema
--    (00_catalog #11). Each of these twelve moves to private unchanged (body,
--    owner and grants move with it), and its public name becomes a thin
--    SECURITY INVOKER wrapper with the same signature, as everywhere else.
--    Owner decision: organisation_reviews is signed-in only for now. anon has
--    no usage on private and may SELECT only the catalogue projection, so a
--    public reviews read needs its own design (Codex).
-- ---------------------------------------------------------------------------
do $$
declare
  sig text; fn regprocedure; p record; call text; body text; vol text; g record;
begin
  foreach sig in array array[
    'mail_operations()', 'payment_details(text)', 'configure_test_subaccount(uuid,text)',
    'request_payment_refund(uuid,bigint,text,uuid)', 'refund_late_payment(uuid)', 'money_operations()',
    'settlement_operations()', 'submit_booking_review(uuid,integer,text)', 'my_booking_review(uuid)',
    'review_queue()', 'moderate_booking_review(uuid,text,text,boolean)', 'organisation_reviews(uuid)'
  ] loop
    fn := ('public.' || sig)::regprocedure;
    select pr.proname, pr.proretset, pr.provolatile, pr.pronargs, pr.proargnames, pr.proargmodes,
           pg_get_function_arguments(pr.oid) as decl, pg_get_function_result(pr.oid) as result, pr.proacl
      into p from pg_proc pr where pr.oid = fn;
    if not (select prosecdef from pg_proc where oid = fn) then
      raise exception 'expected % to be security definer', sig;
    end if;
    -- Input argument names, in order (table functions list OUT names too).
    select coalesce(string_agg(quote_ident(n), ', ' order by i), '') into call
    from unnest(coalesce(p.proargnames, '{}'::text[]),
                coalesce(p.proargmodes, array_fill('i'::"char", array[coalesce(cardinality(p.proargnames), 0)])))
         with ordinality as a(n, m, i)
    where m in ('i', 'b', 'v');
    if p.pronargs > 0 and call = '' then raise exception 'unnamed arguments on %', sig; end if;
    execute format('alter function public.%s set schema private', sig);
    vol := case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end;
    body := case when p.proretset then format('select * from private.%I(%s)', p.proname, call)
                 else format('select private.%I(%s)', p.proname, call) end;
    execute format('create function public.%I(%s) returns %s language sql %s security invoker set search_path = %L as %L',
                   p.proname, p.decl, p.result, vol, '', body);
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', sig);
    -- The wrapper gets exactly the moved function's client grants, minus anon.
    for g in
      select r.rolname from aclexplode(p.proacl) a join pg_roles r on r.oid = a.grantee
      where a.privilege_type = 'EXECUTE' and r.rolname in ('authenticated', 'service_role')
    loop
      execute format('grant execute on function public.%s to %I', sig, g.rolname);
    end loop;
    execute format('revoke all on function private.%s from public, anon', sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. K4 restore: the settlements cursor row is created on first use instead
--    of seeded by a migration, so a data-only restore into a freshly
--    migrated target no longer hits a duplicate key.
-- ---------------------------------------------------------------------------
delete from private.payment_reconcile_cursor where job = 'settlements' and page = 1 and checked_at = '-infinity';

create or replace function private.settlement_list_page() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_page integer;
begin
  insert into private.payment_reconcile_cursor(job) values ('settlements') on conflict (job) do nothing;
  update private.payment_reconcile_cursor set checked_at = clock_timestamp()
  where job = 'settlements' and checked_at < clock_timestamp() - interval '15 minutes'
  returning page into v_page;
  return v_page;
end $$;
