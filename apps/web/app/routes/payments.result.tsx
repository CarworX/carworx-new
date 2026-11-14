import { data, Form } from "react-router";
import { CsrfField } from "../auth/ui";
import { requireSignedIn } from "../auth/session.server";
import { Button, ButtonLink } from "../ui/Button";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/payments.result";
interface Summary {
  booking_id: string;
  amount_minor: number;
  currency: "ZAR";
  state: string;
  late_payment: boolean;
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
          late_payment: x["late_payment"] === true,
        };
    }
  }
  return data(
    { summary, csrf: context.security.csrfToken },
    { headers: auth.headers },
  );
}
export async function action({ request, context }: Route.ActionArgs) {
  const a = await requireSignedIn(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  a.headers.set("Referrer-Policy", "no-referrer");
  const f = await request.formData(),
    booking = f.get("booking");
  if (
    typeof booking !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      booking,
    )
  )
    return data({ ok: false }, { status: 400, headers: a.headers });
  const r = await a.supabase.rpc("refund_late_payment", { p_booking: booking });
  return data(
    { ok: r.error === null },
    { status: r.error === null ? 200 : 409, headers: a.headers },
  );
}
export default function PaymentResult({
  loaderData: { summary: s, csrf },
  actionData,
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
            {s.late_payment && s.state === "paid" ? (
              <section>
                <p>
                  The payment arrived after the hold. Open your booking to
                  choose a new slot, or request a refund.
                </p>
                <Form method="post">
                  <CsrfField token={csrf} />
                  <input type="hidden" name="booking" value={s.booking_id} />
                  <Button type="submit" variant="outline">
                    Request late-payment refund
                  </Button>
                </Form>
              </section>
            ) : null}
            <ButtonLink href={"/bookings/" + s.booking_id}>
              Open booking
            </ButtonLink>
          </>
        )}
        {actionData?.ok ? (
          <p role="status">
            Refund requested. Processing is checked with Paystack.
          </p>
        ) : null}
        {actionData?.ok === false ? (
          <p role="alert">
            The refund could not be requested. Check your booking's current
            options.
          </p>
        ) : null}
        <ButtonLink href="/bookings" variant="outline">
          Your bookings
        </ButtonLink>
      </section>
    </PublicShell>
  );
}
