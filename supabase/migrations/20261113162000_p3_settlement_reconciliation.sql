
create table private.payment_reconcile_cursor(job text primary key,page integer not null default 1,checked_at timestamptz not null default '-infinity');
insert into private.payment_reconcile_cursor(job) values('settlements');
create table private.payment_settlements(
 provider_id text primary key check(provider_id ~ '^[1-9][0-9]{0,29}$'),
 gross_minor bigint not null check(gross_minor>=0),fees_minor bigint not null check(fees_minor>=0),net_minor bigint not null check(net_minor>=0),
 state text not null default 'scanning' check(state in('scanning','matched','mismatch')),
 page integer not null default 1,lease uuid,lease_until timestamptz,checked_at timestamptz not null default '-infinity'
);
create table private.payment_settlement_lines(
 settlement_id text not null references private.payment_settlements(provider_id),provider_id text not null,
 reference text,amount_minor bigint not null check(amount_minor>0),fees_minor bigint not null check(fees_minor>=0),subaccount text,
 primary key(settlement_id,provider_id)
);
alter table private.payment_reconcile_cursor enable row level security;
alter table private.payment_settlements enable row level security;
alter table private.payment_settlement_lines enable row level security;
revoke all on private.payment_reconcile_cursor,private.payment_settlements,private.payment_settlement_lines from public,anon,authenticated,service_role,money_server;
create function private.settlement_list_page() returns integer
language sql volatile security definer set search_path='' as $$
 update private.payment_reconcile_cursor set checked_at=clock_timestamp() where job='settlements'
 and checked_at<clock_timestamp()-interval '15 minutes' returning page
$$;
create function private.record_settlement_list(p_page integer,p_rows jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 perform 1 from private.payment_reconcile_cursor where job='settlements' and page=p_page for update;
 if not found or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10 then raise exception 'invalid_input'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  insert into private.payment_settlements(provider_id,gross_minor,fees_minor,net_minor)
  values(r->>'id',(r->>'gross')::bigint,(r->>'fees')::bigint,(r->>'net')::bigint)
  on conflict(provider_id) do update set state=case when payment_settlements.gross_minor<>excluded.gross_minor or payment_settlements.fees_minor<>excluded.fees_minor
  or payment_settlements.net_minor<>excluded.net_minor then 'mismatch' else payment_settlements.state end;
 end loop;
 update private.payment_reconcile_cursor set page=case when jsonb_array_length(p_rows)<10 then 1 else page+1 end where job='settlements';
end $$;
create function private.claim_settlement() returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.payment_settlements;
begin
 select * into s from private.payment_settlements where state='scanning'
 and (lease_until is null or lease_until<now()) order by checked_at,provider_id for update skip locked limit 1;
 if not found then return null; end if;
 update private.payment_settlements set lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',checked_at=clock_timestamp()
 where provider_id=s.provider_id returning * into s;
 return jsonb_build_object('id',s.provider_id,'page',s.page,'lease',s.lease);
end $$;
create function private.record_settlement_page(p_id text,p_page integer,p_lease uuid,p_rows jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s private.payment_settlements; r jsonb; gross bigint; fees bigint; bad boolean;
begin
 select * into s from private.payment_settlements where provider_id=p_id and state='scanning' and page=p_page and lease=p_lease and lease_until>clock_timestamp() for update;
 if not found or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10 then raise exception 'settlement_unavailable'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  insert into private.payment_settlement_lines(settlement_id,provider_id,reference,amount_minor,fees_minor,subaccount)
  values(p_id,r->>'id',r->>'reference',(r->>'amount')::bigint,(r->>'fees')::bigint,r->>'subaccount')
  on conflict(settlement_id,provider_id) do nothing;
  if not exists(select from private.payment_settlement_lines where settlement_id=p_id and provider_id=r->>'id'
   and reference is not distinct from r->>'reference' and amount_minor=(r->>'amount')::bigint and fees_minor=(r->>'fees')::bigint
   and subaccount is not distinct from r->>'subaccount') then raise exception 'settlement_changed'; end if;
 end loop;
 select coalesce(sum(amount_minor),0),coalesce(sum(fees_minor),0) into gross,fees from private.payment_settlement_lines where settlement_id=p_id;
 select exists(select from private.payment_settlement_lines l left join private.payment_attempts a on a.reference=l.reference
 where l.settlement_id=p_id and l.reference is not null and
 (a.id is null or a.provider_id is distinct from l.provider_id or a.amount_minor<>l.amount_minor or a.subaccount is distinct from l.subaccount or a.state<>'paid')) into bad;
 update private.payment_settlements set lease=null,lease_until=null,page=page+1,
 state=case when bad or gross>s.gross_minor or fees>s.fees_minor then 'mismatch'
 when jsonb_array_length(p_rows)<10 then case when gross=s.gross_minor and fees=s.fees_minor and gross-fees=s.net_minor then 'matched' else 'mismatch' end else 'scanning' end
 where provider_id=p_id;
 insert into private.payment_cases(attempt_id,kind)
 select distinct a.id,'settlement_mismatch' from private.payment_attempts a join private.payment_settlement_lines l on l.reference=a.reference
 where l.settlement_id=p_id and (a.provider_id is distinct from l.provider_id or a.amount_minor<>l.amount_minor or a.subaccount is distinct from l.subaccount)
 on conflict do nothing;
end $$;
create function public.settlement_operations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
 select provider_id,gross_minor,fees_minor,net_minor,state,page from private.payment_settlements order by checked_at desc limit 100)t);
end $$;
revoke all on function private.settlement_list_page(),private.record_settlement_list(integer,jsonb),
 private.claim_settlement(),private.record_settlement_page(text,integer,uuid,jsonb),public.settlement_operations()
 from public,anon,authenticated,service_role;
grant execute on function private.settlement_list_page(),private.record_settlement_list(integer,jsonb),
 private.claim_settlement(),private.record_settlement_page(text,integer,uuid,jsonb) to money_server;
grant execute on function public.settlement_operations() to authenticated;
