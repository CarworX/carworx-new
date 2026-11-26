-- K3: one durable payment record per checkout; retain final records for five years.
create table public.fines_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  notice_ids text[] not null check (cardinality(notice_ids) between 1 and 20),
  cents integer not null check (cents > 0),
  status text not null default 'created' check (status in ('created','pending_issuer','paid','failed','cancelled')),
  provider_ref text unique not null,
  idempotency_key uuid unique not null default gen_random_uuid(),
  receipt_number text unique,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check ((status = 'paid') = (settled_at is not null) and (status = 'paid') = (receipt_number is not null))
);
alter table public.fines_payments enable row level security;
revoke all on public.fines_payments from public, anon, authenticated, service_role, forms_server;
grant select on public.fines_payments to authenticated;
create index fines_payments_user_created_idx on public.fines_payments(user_id, created_at desc);
-- Reserve the eight UUID hex digits used in receipts when a payment is created.
create unique index fines_payments_receipt_prefix_idx on public.fines_payments ((left(id::text, 8)));
create policy fines_payments_select_own on public.fines_payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy fines_payments_select_admin on public.fines_payments
  for select to authenticated using ((select auth.jwt()->>'aal') = 'aal2' and (select private.is_platform_admin()));
comment on table public.fines_payments is
  'Retain financial records for at least five years. Account erasure unlinks the user without deleting the payment.';

create function private.start_fines_payment(p_user uuid, p_notices text[], p_cents integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_notices text[]; v_id uuid;
begin
  if p_user is null or p_notices is null or cardinality(p_notices) not between 1 and 20
    or p_cents is null or p_cents <= 0
    or exists (select from unnest(p_notices) n where n is null or n !~ '^[A-Za-z0-9_-]{1,64}$')
  then raise exception 'invalid_fines_checkout' using errcode = '22023'; end if;
  select array_agg(distinct n order by n) into v_notices from unnest(p_notices) n;
  perform pg_advisory_xact_lock(172912, hashtext(p_user::text));
  perform from private.identity_checks where user_id = p_user and status = 'approved' limit 1 for update;
  if not found or exists (select from private.account_closures where user_id = p_user) then
    raise exception 'identity_required' using errcode = '42501';
  end if;
  select id into v_id from public.fines_payments
   where user_id = p_user and notice_ids = v_notices and status in ('created','pending_issuer','paid')
   order by created_at desc, id limit 1;
  if found then return v_id; end if;
  if exists (select from public.fines_payments where user_id = p_user
    and notice_ids && v_notices and status in ('created','pending_issuer','paid')) then
    raise exception 'fines_checkout_exists' using errcode = 'P0001';
  end if;
  loop
    v_id := gen_random_uuid();
    insert into public.fines_payments(id,user_id,notice_ids,cents,provider_ref)
      values(v_id,p_user,v_notices,p_cents,'sandbox:' || v_id::text)
      on conflict ((left(id::text, 8))) do nothing;
    if found then return v_id; end if;
  end loop;
end $$;

create function private.apply_fines_callback(p_payment uuid, p_status text) returns void
language sql security definer set search_path = '' as $$
  update public.fines_payments
  set status = p_status,
      settled_at = case when p_status = 'paid' then now() end,
      receipt_number = case when p_status = 'paid' then 'CXF-' || upper((left(id::text, 8))) end
  where id = p_payment and provider_ref = 'sandbox:' || id::text
    and status <> p_status
    and status in ('created','pending_issuer')
    and p_status in ('paid','failed','cancelled','pending_issuer')
$$;

revoke all on function private.start_fines_payment(uuid,text[],integer), private.apply_fines_callback(uuid,text)
  from public, anon, authenticated, service_role, forms_server;
grant execute on function private.start_fines_payment(uuid,text[],integer),
  private.apply_fines_callback(uuid,text) to forms_server;
