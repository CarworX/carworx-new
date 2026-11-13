import { data } from "react-router";
import { requireSignedIn } from "../auth/session.server";
import { ButtonLink } from "../ui/Button";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/payments.result";
interface Summary {
  booking_id: string;
  amount_minor: number;
  currency: "ZAR";
  state: string;
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = await requireSignedIn(request, context.security);
  auth.headers.set("Cache-Control", "private, no-store");
  auth.headers.set("Referrer-Policy", "no-referrer");
  const ref = new URL(request.url).searchParams.get("reference");
  let summary: Summary | null = null;
  if (ref !== null && /^cx_[a-f0-9]{32}$/.test(ref)) {
    const r: { data: unknown; error: unknown } = await auth.supabase.rpc(
      "payment_details",
      { p_reference: ref },
    );
    if (r.error === null && typeof r.data === "object" && r.data !== null) {
      const x = r.data as Record<string, unknown>,
        booking = x["booking_id"],
        amount = Number(x["amount_minor"]),
        state = x["state"];
      if (
        typeof booking === "string" &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          booking,
        ) &&
        Number.isSafeInteger(amount) &&
        amount > 0 &&
        x["currency"] === "ZAR" &&
        typeof state === "string"
      )
        summary = {
          booking_id: booking,
          amount_minor: amount,
          currency: "ZAR",
          state,
        };
    }
  }
  return data({ summary }, { headers: auth.headers });
}
export default function PaymentResult({
  loaderData: { summary: s },
}: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <section className="mx-auto max-w-2xl px-4 py-8">
        <p>TEST MODE</p>
        <h1>Payment status</h1>
        {s === null ? (
          <p>No verified payment status is available for this account.</p>
        ) : (
          <>
            <p role="status">
              {s.state === "paid"
                ? "Payment received. Open your booking to check confirmation or resolve a late payment."
                : s.state === "refunded"
                  ? "Refund processed."
                  : s.state === "partially_refunded"
                    ? "Part of this payment has been refunded."
                    : s.state === "disputed"
                      ? "A dispute is being handled."
                      : "Payment is still being checked. Returning from checkout is not proof of payment."}
            </p>
            <ButtonLink href={"/bookings/" + s.booking_id}>
              Open booking
            </ButtonLink>
          </>
        )}
        <ButtonLink href="/bookings" variant="outline">
          Your bookings
        </ButtonLink>
      </section>
    </PublicShell>
  );
}
