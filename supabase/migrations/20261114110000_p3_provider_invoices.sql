-- Phase 3, Claude: CarworX's invoice to providers, which is also their
-- monthly statement (planning/claude/25 §3a (b), D-054, D-096).
--
-- Off until commission starts (G-PAY, D-054): with no settings row, or with
-- invoices_enabled false, nothing is issued and nothing is listed. Commission
-- is what the split already took (payment_attempts.platform_fee_amount_minor),
-- so until the money lane starts charging (fee_basis 'none' today) there is
-- nothing to invoice either.
--
-- VAT (OQ-E1, pending the accountant): one switch, vat_registered, off by
-- default. Each invoice copies the VAT status, number and rate when it is
-- issued, so turning the switch on or off never changes an issued invoice.
-- With VAT on, the commission taken is treated as VAT-inclusive and the VAT
-- share is shown (rate/(100+rate)); the accountant confirms this before the
-- switch is used.
--
-- Retention (OQ-E4): 5 years from the document date, then deleted by the
-- daily retention run.
--
-- Settings have no seeded row: a data-only restore into a freshly migrated
-- target must not hit a duplicate key (same reason as #115's cursor fix).

create table private.billing_settings (
  id boolean primary key default true check (id),
  invoices_enabled boolean not null default false,
  vat_registered boolean not null default false,
  vat_number text check (vat_number is null or vat_number ~ '^4[0-9]{9}$'),
  vat_rate_bp integer not null default 1500 check (vat_rate_bp between 1 and 10000),
  updated_at timestamptz not null default now(),
  check (not vat_registered or vat_number is not null)
);
comment on table private.billing_settings is
  'One row at most. invoices_enabled is the G-PAY/D-054 gate; vat_registered is the OQ-E1 switch. Absent row = everything off.';

create table private.provider_invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  -- At least 6 digits, never truncated (lpad would cut 1000000 to 100000).
  ref text generated always as ('CXI-' || case when number < 1000000 then lpad(number::text, 6, '0') else number::text end) stored unique,
  organisation_id uuid not null references public.organisations(id),
  -- The recipient's name when issued: a later rename never changes an invoice.
  business_name text not null check (length(business_name) between 1 and 200),
  period_start date not null check (extract(day from period_start) = 1),
  period_end date not null,
  issued_at timestamptz not null default now(),
  -- Per job: date, service and amounts only. No customer names or contacts.
  -- No upper bound: one busy business must never block everyone's invoices.
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) >= 1),
  jobs integer not null check (jobs >= 1),
  gross_minor bigint not null check (gross_minor >= 0),
  total_minor bigint not null check (total_minor > 0),
  vat_registered boolean not null,
  vat_number text,
  vat_rate_bp integer,
  vat_minor bigint not null default 0 check (vat_minor >= 0 and vat_minor < total_minor),
  check (period_end = (period_start + interval '1 month' - interval '1 day')::date),
  check (vat_registered = (vat_number is not null and vat_rate_bp is not null)),
  check (vat_registered or vat_minor = 0),
  unique (organisation_id, period_start)
);
comment on table private.provider_invoices is
  'CarworX invoices to providers, one per business per month (also the monthly statement). Snapshot at issue; kept 5 years (D-096).';
create index provider_invoices_org_idx on private.provider_invoices(organisation_id, period_start desc);
create index provider_invoices_issued_idx on private.provider_invoices(issued_at);

do $$ declare t text; begin
  foreach t in array array['billing_settings', 'provider_invoices'] loop
    execute format('alter table private.%I enable row level security', t);
    execute format('revoke all on private.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

-- Issued invoices never change.
create function private.provider_invoice_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'append_only' using errcode = '42501'; end $$;
create trigger provider_invoice_immutable before update on private.provider_invoices
  for each row execute function private.provider_invoice_immutable();
revoke all on function private.provider_invoice_immutable() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Issuing: one invoice per business for a whole SAST month, idempotent.
-- ---------------------------------------------------------------------------
create function private.issue_invoices_for(p_month date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  s private.billing_settings;
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_from timestamptz := v_start::timestamp at time zone 'Africa/Johannesburg';
  v_to timestamptz := (v_end + 1)::timestamp at time zone 'Africa/Johannesburg';
  v_count integer;
begin
  select * into s from private.billing_settings where id;
  if not found or not s.invoices_enabled then return 0; end if;
  -- Only whole months that are over.
  if v_to > clock_timestamp() then raise exception 'invalid_input' using errcode = '22023'; end if;
  with jobs as (
    select a.organisation_id, e.applied_at, a.amount_minor, a.platform_fee_amount_minor as fee,
           coalesce((select o.name from public.bookings b join public.service_offers o on o.id = b.offer_id
                      where b.id = a.booking_id), 'Booking') as service
    from private.payment_attempts a
    join private.payment_effects e on e.attempt_id = a.id
    where a.state = 'paid' and a.platform_fee_amount_minor > 0
      and e.applied_at >= v_from and e.applied_at < v_to
  ), grouped as (
    select organisation_id,
           jsonb_agg(jsonb_build_object(
             'date', (applied_at at time zone 'Africa/Johannesburg')::date,
             'label', service, 'gross_minor', amount_minor, 'fee_minor', fee)
             order by applied_at) as lines,
           count(*)::integer as jobs, sum(amount_minor) as gross, sum(fee) as total
    from jobs group by organisation_id
  ), ins as (
    insert into private.provider_invoices(organisation_id, business_name, period_start, period_end, lines, jobs, gross_minor,
      total_minor, vat_registered, vat_number, vat_rate_bp, vat_minor)
    select g.organisation_id, (select o.name from public.organisations o where o.id = g.organisation_id),
      v_start, v_end, g.lines, g.jobs, g.gross, g.total, s.vat_registered,
      case when s.vat_registered then s.vat_number end,
      case when s.vat_registered then s.vat_rate_bp end,
      case when s.vat_registered then round(g.total * s.vat_rate_bp::numeric / (10000 + s.vat_rate_bp))::bigint else 0 end
    from grouped g
    -- Skip businesses already invoiced for the month, so daily retries
    -- don't use up serial numbers (ON CONFLICT alone would).
    where not exists (select 1 from private.provider_invoices p
                      where p.organisation_id = g.organisation_id and p.period_start = v_start)
    on conflict (organisation_id, period_start) do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end $$;

-- The daily cron calls this; it issues last month's invoices once.
create function private.issue_monthly_invoices() returns integer
language sql security definer set search_path = '' as $$
  select private.issue_invoices_for(
    (date_trunc('month', (clock_timestamp() at time zone 'Africa/Johannesburg')) - interval '1 month')::date) $$;

-- Retention (OQ-E4): 5 years from the document date.
create function private.purge_old_invoices() returns integer
language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  delete from private.provider_invoices where issued_at < clock_timestamp() - interval '5 years';
  get diagnostics v = row_count;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Reads: owners and managers of the business only (D-089: earnings and money
-- are owners and managers only). Anyone else gets NULL / an empty list, and
-- everything is hidden while the gate is off.
-- ---------------------------------------------------------------------------
create function private.invoices_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select invoices_enabled from private.billing_settings where id), false) $$;

create function private.provider_invoices() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.invoices_enabled() then
    return jsonb_build_object('enabled', false, 'invoices', '[]'::jsonb);
  end if;
  return jsonb_build_object('enabled', true, 'invoices', coalesce((
    select jsonb_agg(jsonb_build_object('ref', i.ref, 'business', i.business_name, 'period_start', i.period_start,
             'issued_at', i.issued_at, 'jobs', i.jobs, 'total_minor', i.total_minor)
             order by i.period_start desc, i.business_name)
    from private.provider_invoices i
    where private.has_org_role(i.organisation_id, array['owner', 'manager'])), '[]'::jsonb));
end $$;

create function private.provider_invoice(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare i private.provider_invoices;
begin
  if auth.uid() is null or p_ref is null or p_ref !~ '^CXI-[0-9]{6,12}$' or not private.invoices_enabled() then
    return null;
  end if;
  select * into i from private.provider_invoices where ref = p_ref;
  if not found or not private.has_org_role(i.organisation_id, array['owner', 'manager']) then return null; end if;
  return jsonb_build_object('ref', i.ref, 'business', i.business_name,
    'period_start', i.period_start, 'period_end', i.period_end, 'issued_at', i.issued_at, 'lines', i.lines,
    'jobs', i.jobs, 'gross_minor', i.gross_minor, 'total_minor', i.total_minor,
    'vat_registered', i.vat_registered, 'vat_number', i.vat_number, 'vat_rate_bp', i.vat_rate_bp, 'vat_minor', i.vat_minor);
end $$;

-- Admin (aal2) only: the gate and the VAT switch. Not wired to any page;
-- turned on deliberately when commission starts / the accountant answers.
create function private.set_billing_settings(p_invoices_enabled boolean, p_vat_registered boolean, p_vat_number text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into private.billing_settings(id, invoices_enabled, vat_registered, vat_number, updated_at)
  values (true, p_invoices_enabled, p_vat_registered, p_vat_number, clock_timestamp())
  on conflict (id) do update set invoices_enabled = excluded.invoices_enabled,
    vat_registered = excluded.vat_registered, vat_number = excluded.vat_number, updated_at = excluded.updated_at;
end $$;

-- API-exposed names are thin SECURITY INVOKER wrappers (00_catalog #11).
create function public.provider_invoices() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.provider_invoices() $$;
create function public.provider_invoice(p_ref text) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.provider_invoice(p_ref) $$;
create function public.set_billing_settings(p_invoices_enabled boolean, p_vat_registered boolean, p_vat_number text)
returns void language sql security invoker set search_path = '' as $$
  select private.set_billing_settings(p_invoices_enabled, p_vat_registered, p_vat_number) $$;

revoke all on function private.issue_invoices_for(date), private.issue_monthly_invoices(), private.purge_old_invoices(),
  private.invoices_enabled(), private.provider_invoices(), private.provider_invoice(text),
  private.set_billing_settings(boolean, boolean, text),
  public.provider_invoices(), public.provider_invoice(text), public.set_billing_settings(boolean, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function private.issue_monthly_invoices() to money_server;
grant execute on function private.purge_old_invoices() to retention_server;
grant execute on function private.provider_invoices(), private.provider_invoice(text),
  private.set_billing_settings(boolean, boolean, text),
  public.provider_invoices(), public.provider_invoice(text), public.set_billing_settings(boolean, boolean, text)
  to authenticated;
