-- Phase 3, Claude: the customer's payment receipt (planning/claude/25 §3a (a),
-- D-096). Read only. The receipt reference is "CX-" plus the first 12 hex
-- digits of the payment attempt's own opaque reference (cx_<32 hex>), so it
-- fits the email reference format and carries no personal data.
--
-- Owner only: the paying customer, and only once the payment is paid. Anyone
-- else (another customer, the business, an admin, an unknown or unpaid
-- reference) gets NULL, which the route turns into a 404, so the answer never
-- confirms that a receipt exists. The business and admins have their own
-- views; a customer receipt is the customer's document.
--
-- It reads the money lane's tables but changes none of them.

create function private.customer_receipt(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  a private.payment_attempts;
  b public.bookings;
  v_prefix text;
begin
  if auth.uid() is null or p_ref is null or p_ref !~ '^CX-[0-9A-F]{12}$' then
    return null;
  end if;
  v_prefix := 'cx_' || lower(substring(p_ref from 4));
  select * into a from private.payment_attempts
   where customer_id = auth.uid() and state = 'paid'
     and left(reference, 15) = v_prefix
   order by created_at limit 1;
  if not found then return null; end if;
  select * into b from public.bookings where id = a.booking_id and customer_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'ref', p_ref,
    'paid_at', coalesce((select e.applied_at from private.payment_effects e where e.attempt_id = a.id), a.created_at),
    'amount_minor', a.amount_minor,
    'currency', a.currency,
    'mode', a.mode,
    'starts_at', lower(b.during),
    'state', b.state,
    'business', coalesce(
      (select l.display_name from public.service_offers o
         join public.listings l on l.public_id = o.listing_public_id and l.organisation_id = o.organisation_id
        where o.id = b.offer_id),
      (select g.name from public.organisations g where g.id = a.organisation_id)),
    'area', (select l.metro from public.service_offers o
               join public.listings l on l.public_id = o.listing_public_id and l.organisation_id = o.organisation_id
              where o.id = b.offer_id),
    'service', (select o.name from public.service_offers o where o.id = b.offer_id),
    'quote_version', (select v.version from public.quote_versions v where v.id = a.quote_version_id),
    'quote_lines', (select v.lines from public.quote_versions v where v.id = a.quote_version_id),
    'travel_minor', b.travel_charge_minor,
    'refunded_minor', (select coalesce(sum(r.amount_minor), 0) from private.payment_refunds r
                        where r.attempt_id = a.id and r.state = 'processed'));
end $$;

-- The API-exposed name is a thin SECURITY INVOKER wrapper (00_catalog #11).
create function public.customer_receipt(p_ref text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.customer_receipt(p_ref) $$;

revoke all on function private.customer_receipt(text) from public, anon, authenticated, service_role;
revoke all on function public.customer_receipt(text) from public, anon, authenticated, service_role;
grant execute on function private.customer_receipt(text) to authenticated;
grant execute on function public.customer_receipt(text) to authenticated;
