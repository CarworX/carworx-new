import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayableHold } from "./paystack.server";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Own-JWT wrapper MUST enforce customer ownership. Never fall back to a broad login. */
export async function payableHold(
  db: SupabaseClient,
  holdId: string,
): Promise<PayableHold | null> {
  if (!UUID.test(holdId)) return null;
  const result: { data: unknown; error: unknown } = await db.rpc(
    "hold_snapshot",
    { p_hold: holdId },
  );
  if (
    result.error !== null ||
    !Array.isArray(result.data) ||
    result.data.length !== 1
  )
    return null;
  const value: unknown = result.data[0];
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  const hold = r["hold_id"],
    booking = r["booking_id"],
    org = r["organisation_id"],
    quote = r["quote_version_id"],
    expiry = r["expires_at"];
  if (
    typeof hold !== "string" ||
    hold.toLowerCase() !== holdId.toLowerCase() ||
    typeof booking !== "string" ||
    !UUID.test(booking) ||
    typeof org !== "string" ||
    !UUID.test(org) ||
    (quote !== null && (typeof quote !== "string" || !UUID.test(quote))) ||
    typeof expiry !== "string" ||
    !Number.isFinite(Date.parse(expiry)) ||
    Date.parse(expiry) <= Date.now() ||
    r["state"] !== "active" ||
    r["currency"] !== "ZAR"
  )
    return null;
  const raw = r["amount_minor"];
  if (
    !(typeof raw === "number" && Number.isSafeInteger(raw)) &&
    !(typeof raw === "string" && /^[1-9][0-9]{0,15}$/.test(raw))
  )
    return null;
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return {
    holdId: hold,
    bookingId: booking,
    organisationId: org,
    quoteVersionId: quote,
    amountMinor: amount,
    currency: "ZAR",
    expiresAt: expiry,
  };
}
