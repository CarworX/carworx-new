-- Money lane only. Booking references are UUID contracts, not cross-lane DDL.
do $$ begin
  if not exists(select from pg_roles where rolname='booking_contract') then
    create role booking_contract nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists(select from pg_roles where rolname='money_server') then
    create role money_server login nosuperuser nocreatedb nocreaterole noinherit nobypassrls connection limit 5;
  end if;
end $$;
grant booking_contract to money_server with inherit true;
grant usage on schema private to money_server;
create table private.payment_accounts(
 organisation_id uuid primary key references public.organisations(id),
 subaccount text not null check(subaccount ~ '^ACCT_[A-Za-z0-9]{3,80}$'),
 mode text not null default 'test' check(mode='test')
);
create table private.payment_attempts(
 id uuid primary key default gen_random_uuid(), hold_id uuid not null unique,
 booking_id uuid not null, customer_id uuid not null references auth.users(id),
 organisation_id uuid not null references public.organisations(id),
 quote_version_id uuid, amount_minor bigint not null check(amount_minor between 1 and 9007199254740991),
 currency text not null default 'ZAR' check(currency='ZAR'), mode text not null default 'test' check(mode='test'),
 reference text not null unique default ('cx_'||replace(gen_random_uuid()::text,'-','')),
 subaccount text not null, hold_expires_at timestamptz not null,
 state text not null default 'created' check(state in('created','initialising','ready','reconcile','paid','failed')),
 checkout_url text check(checkout_url is null or checkout_url ~ '^https://checkout[.]paystack[.]com/'),
 provider_id text unique, lease_until timestamptz, created_at timestamptz not null default now(),
 fee_policy_version text not null default 'phase3-test-v1', fee_basis text not null default 'none' check(fee_basis='none'),
 platform_fee_amount_minor bigint not null default 0 check(platform_fee_amount_minor=0)
);
create table private.payment_inbox(
 event_key text primary key check(event_key ~ '^[a-f0-9]{64}$'),
 reference text not null references private.payment_attempts(reference),
 kind text not null check(kind in('charge.success','refund.processed','refund.failed','charge.dispute.create','charge.dispute.resolve')),
 provider_id text not null check(length(provider_id) between 1 and 160),
 amount_minor bigint not null check(amount_minor>0), currency text not null check(currency='ZAR'),
 status text not null check(length(status) between 1 and 60),
 state text not null default 'pending' check(state in('pending','applied','reconcile')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 created_at timestamptz not null default now(), applied_at timestamptz
);
create table private.payment_effects(
 attempt_id uuid primary key references private.payment_attempts(id),
 provider_id text not null unique, event_key text not null unique references private.payment_inbox(event_key),
 applied_at timestamptz not null default now()
);
create table private.payment_event(
 id bigint generated always as identity primary key, booking_id uuid not null,
 kind text not null check(kind ~ '^[a-z_]{3,40}$'), occurred_at timestamptz not null default now()
);
create table private.payment_cases(
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references private.payment_attempts(id),
 kind text not null check(kind in('late_payment','initialise_unknown','verification_mismatch','provider_unavailable','refund_unknown','settlement_mismatch')),
 status text not null default 'open' check(status in('open','resolved')),
 created_at timestamptz not null default now(), resolved_at timestamptz,
 unique(attempt_id,kind)
);
create table private.payment_refunds(
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references private.payment_attempts(id),
 amount_minor bigint not null check(amount_minor>0), reason text not null check(length(reason) between 1 and 500),
 actor text not null check(actor ~ '^[A-Za-z0-9_:/-]{1,160}$'),
 state text not null default 'requested' check(state in('requested','submitting','pending','processed','failed','reconcile')),
 provider_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(attempt_id,actor)
);
create table private.payment_disputes(
 provider_id text primary key, attempt_id uuid not null references private.payment_attempts(id),
 amount_minor bigint not null check(amount_minor>0),
 state text not null check(state in('open','resolved')), updated_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['payment_accounts','payment_attempts','payment_inbox','payment_effects','payment_event','payment_cases','payment_refunds','payment_disputes'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role,money_server',t);
 end loop;
end $$;
create function private.payment_event_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'append_only' using errcode='42501'; end $$;
create trigger payment_event_immutable before update or delete or truncate on private.payment_event
 for each statement execute function private.payment_event_immutable();
revoke all on function private.payment_event_immutable() from public,anon,authenticated,service_role;
create function private.prepare_payment(p_hold uuid,p_customer uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s record; a private.payment_attempts; v_code text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('money/hold/'||p_hold::text,0));
 -- This direct booking lookup binds the server-supplied verified user, never browser claims.
 if not exists(select from public.bookings where hold_id=p_hold and customer_id=p_customer) then
   raise exception 'not_allowed' using errcode='42501'; end if;
 select * into s from private.hold_snapshot(p_hold);
 if not found or s.state<>'active' or s.currency<>'ZAR' or s.expires_at<=clock_timestamp() then
   raise exception 'hold_expired' using errcode='P0001'; end if;
 select * into a from private.payment_attempts where hold_id=p_hold for update;
 if not found then
   select subaccount into v_code from private.payment_accounts where organisation_id=s.organisation_id;
   if not found then raise exception 'payment_unavailable' using errcode='P0001'; end if;
   insert into private.payment_attempts(hold_id,booking_id,customer_id,organisation_id,quote_version_id,amount_minor,currency,subaccount,hold_expires_at)
    values(p_hold,s.booking_id,p_customer,s.organisation_id,s.quote_version_id,s.amount_minor,s.currency,v_code,s.expires_at)
    returning * into a;
 end if;
 if a.customer_id<>p_customer or a.amount_minor<>s.amount_minor or a.currency<>s.currency
   or a.quote_version_id is distinct from s.quote_version_id then raise exception 'payment_snapshot_changed' using errcode='P0001'; end if;
 if a.state='initialising' and a.lease_until<=clock_timestamp() then
   update private.payment_attempts set state='reconcile',lease_until=null where id=a.id returning * into a;
   insert into private.payment_cases(attempt_id,kind) values(a.id,'initialise_unknown') on conflict do nothing;
 end if;
 if a.state='created' then
   update private.payment_attempts set state='initialising',lease_until=clock_timestamp()+interval '30 seconds'
    where id=a.id returning * into a;
   return to_jsonb(a)||jsonb_build_object('dispatch',true);
 end if;
 return to_jsonb(a)||jsonb_build_object('dispatch',false);
end $$;
create function private.save_checkout(p_attempt uuid,p_url text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_url is null or p_url !~ '^https://checkout[.]paystack[.]com/[A-Za-z0-9_/?=&%-]+$' then
   raise exception 'invalid_input' using errcode='22023'; end if;
 update private.payment_attempts set state='ready',checkout_url=p_url,lease_until=null
 where id=p_attempt and state='initialising' and hold_expires_at>clock_timestamp();
 if not found then raise exception 'payment_unavailable' using errcode='P0001'; end if;
end $$;
create function private.enqueue_payment_event(p_key text,p_reference text,p_kind text,p_provider text,p_amount bigint,p_currency text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts;
begin
 select * into a from private.payment_attempts where reference=p_reference or provider_id=case when p_reference ~ '^provider:[1-9][0-9]{0,29}$' then substring(p_reference from 10) end;
 if not found or p_currency<>'ZAR' or p_amount is null or p_amount<=0
  or (p_kind='charge.success' and p_amount<>a.amount_minor) or p_amount>a.amount_minor then
   raise exception 'payment_event_invalid' using errcode='P0001'; end if;
 insert into private.payment_inbox(event_key,reference,kind,provider_id,amount_minor,currency,status)
 values(p_key,a.reference,p_kind,p_provider,p_amount,p_currency,p_status) on conflict do nothing;
 if exists(select from private.payment_inbox where event_key=p_key and
  (reference<>a.reference or kind<>p_kind or provider_id<>p_provider or amount_minor<>p_amount or currency<>p_currency or status<>p_status))
 then raise exception 'payment_event_invalid' using errcode='P0001'; end if;
end $$;
-- Lock and validate inside the caller's transaction; confirm_paid is invoked by
-- money_server directly through inherited booking_contract, never by a browser.
create function private.stage_verified_charge(p_key text,p_reference text,p_provider text,p_amount bigint,p_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts; e private.payment_inbox;
begin
 select * into a from private.payment_attempts where reference=p_reference for update;
 select * into e from private.payment_inbox where event_key=p_key for update;
 if a.id is null or e.event_key is null or e.reference<>p_reference or e.kind<>'charge.success'
  or e.provider_id<>p_provider or e.amount_minor<>p_amount or a.amount_minor<>p_amount or p_currency<>'ZAR' then
   raise exception 'payment_verification_invalid' using errcode='P0001'; end if;
 if exists(select from private.payment_effects where attempt_id=a.id) then return jsonb_build_object('duplicate',true); end if;
 return jsonb_build_object('duplicate',false,'hold_id',a.hold_id,'attempt_id',a.id);
end $$;
create function private.finish_charge_effect(p_key text,p_attempt uuid,p_provider text,p_outcome text)
returns void language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts;
begin
 select * into a from private.payment_attempts where id=p_attempt for update;
 if not found or p_outcome is null or p_outcome not in('confirmed','already_confirmed','hold_expired') or
 not exists(select from private.payment_inbox where event_key=p_key and reference=a.reference and provider_id=p_provider) then
   raise exception 'payment_verification_invalid' using errcode='P0001'; end if;
 insert into private.payment_effects(attempt_id,provider_id,event_key) values(a.id,p_provider,p_key);
 update private.payment_attempts set state='paid',provider_id=p_provider where id=a.id;
 if p_outcome='hold_expired' then
  insert into private.payment_cases(attempt_id,kind) values(a.id,'late_payment') on conflict do nothing;
 end if;
 insert into private.payment_event(booking_id,kind) values(a.booking_id,case when p_outcome='hold_expired' then 'paid_after_expiry' else 'paid' end);
 update private.payment_inbox set state='applied',applied_at=clock_timestamp() where event_key=p_key;
end $$;
create function private.request_refund(p_booking uuid,p_amount_minor bigint,p_reason text,p_actor text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts; r private.payment_refunds; v_reserved bigint;
begin
 select * into a from private.payment_attempts where booking_id=p_booking and state='paid' order by created_at limit 1 for update;
 if not found then raise exception 'payment_not_paid' using errcode='P0001'; end if;
 select * into r from private.payment_refunds where attempt_id=a.id and actor=p_actor;
 if found then
  if r.amount_minor<>p_amount_minor or r.reason<>p_reason then raise exception 'refund_key_conflict' using errcode='P0001'; end if;
  return r.id;
 end if;
 select coalesce(sum(amount_minor),0) into v_reserved from private.payment_refunds
  where attempt_id=a.id and state not in('failed');
 if p_amount_minor is null or p_amount_minor<=0 or p_amount_minor>a.amount_minor-v_reserved then
  raise exception 'refund_amount_invalid' using errcode='P0001'; end if;
 insert into private.payment_refunds(attempt_id,amount_minor,reason,actor)
 values(a.id,p_amount_minor,p_reason,p_actor) returning * into r;
 insert into private.payment_event(booking_id,kind) values(p_booking,'refund_requested');
 return r.id;
end $$;
create function private.payment_state(p_booking uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare a private.payment_attempts; v_total bigint;
begin
 select * into a from private.payment_attempts where booking_id=p_booking order by (state='paid') desc,created_at desc limit 1;
 if not found then return 'unpaid'; end if;
 if exists(select from private.payment_disputes where attempt_id=a.id and state='open') then return 'disputed'; end if;
 select coalesce(sum(amount_minor),0) into v_total from private.payment_refunds where attempt_id=a.id and state='processed';
 if v_total>=a.amount_minor then return 'refunded'; end if;
 if v_total>0 then return 'partially_refunded'; end if;
 if a.state='paid' then return 'paid'; end if;
 if a.state='failed' then return 'unpaid'; end if;
 return 'pending';
end $$;
revoke all on function private.prepare_payment(uuid,uuid),private.save_checkout(uuid,text),
 private.enqueue_payment_event(text,text,text,text,bigint,text,text),
 private.stage_verified_charge(text,text,text,bigint,text),private.finish_charge_effect(text,uuid,text,text),
 private.request_refund(uuid,bigint,text,text),private.payment_state(uuid)
 from public,anon,authenticated,service_role;
grant execute on function private.prepare_payment(uuid,uuid),private.save_checkout(uuid,text),
 private.enqueue_payment_event(text,text,text,text,bigint,text,text),
 private.stage_verified_charge(text,text,text,bigint,text),private.finish_charge_effect(text,uuid,text,text),
 private.request_refund(uuid,bigint,text,text),private.payment_state(uuid) to money_server;
grant execute on function private.request_refund(uuid,bigint,text,text),private.payment_state(uuid) to booking_contract;

create function private.pending_payment_events() returns setof private.payment_inbox
language sql volatile security definer set search_path='' as $$
 select * from private.payment_inbox where state='pending' and available_at<=clock_timestamp()
 order by created_at,event_key limit 10
$$;
create function private.ack_duplicate_payment(p_key text) returns void
language plpgsql security definer set search_path='' as $$
begin
 update private.payment_inbox i set state='applied',applied_at=clock_timestamp()
 from private.payment_attempts a,private.payment_effects e
 where i.event_key=p_key and a.reference=i.reference and e.attempt_id=a.id and e.provider_id=i.provider_id;
end $$;
create function private.defer_payment_event(p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare e private.payment_inbox; a uuid;
begin
 update private.payment_inbox set attempts=attempts+1,
 available_at=clock_timestamp()+interval '1 second' * least(3600,30*power(2,least(attempts,7))),
 state=case when attempts>=11 then 'reconcile' else state end
 where event_key=p_key and state='pending' returning * into e;
 if found and e.state='reconcile' then
  select id into a from private.payment_attempts where reference=e.reference;
  insert into private.payment_cases(attempt_id,kind) values(a,'provider_unavailable') on conflict do nothing;
 end if;
end $$;
create function public.payment_details(p_reference text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.id,'booking_id',a.booking_id,'reference',a.reference,
 'amount_minor',a.amount_minor,'currency',a.currency,'state',private.payment_state(a.booking_id),
 'late_payment',exists(select from private.payment_cases c where c.attempt_id=a.id and c.kind='late_payment' and c.status='open'),
 'checkout_url',case when a.customer_id=auth.uid() and a.state='ready' and a.hold_expires_at>now() then a.checkout_url end)
 from private.payment_attempts a where a.reference=p_reference and
 (a.customer_id=auth.uid() or private.is_platform_admin() or private.has_org_role(a.organisation_id,array['owner','manager']))
$$;
create function public.configure_test_subaccount(p_org uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 insert into private.payment_accounts(organisation_id,subaccount) values(p_org,p_code)
 on conflict(organisation_id) do update set subaccount=excluded.subaccount;
end $$;
revoke all on function private.pending_payment_events(),private.ack_duplicate_payment(text),private.defer_payment_event(text),
 public.payment_details(text),public.configure_test_subaccount(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.pending_payment_events(),private.ack_duplicate_payment(text),private.defer_payment_event(text) to money_server;
grant execute on function public.payment_details(text),public.configure_test_subaccount(uuid,text) to authenticated;
