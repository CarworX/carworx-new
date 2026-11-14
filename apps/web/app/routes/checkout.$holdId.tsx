import { data, Form, redirect } from "react-router";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { payableHold } from "../server/payments/snapshot.server";
import { paymentRuntime } from "../server/payments/runtime.server";
import { Button, ButtonLink } from "../ui/Button";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/checkout.$holdId";

function headers(h: Headers) {
  h.set("Cache-Control", "private, no-store");
  h.set("Referrer-Policy", "no-referrer");
  return h;
}
export const meta: Route.MetaFunction = () => [
  { title: "Test checkout · CarworX" },
];
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = await requireSignedIn(request, context.security);
  const hold = await payableHold(auth.supabase, params.holdId);
  return data(
    {
      hold,
      enabled: paymentRuntime(context.cloudflare.env) !== null,
      csrf: context.security.csrfToken,
    },
    { headers: headers(auth.headers) },
  );
}
export async function action({ request, params, context }: Route.ActionArgs) {
  const auth = await requireSignedIn(request, context.security);
  headers(auth.headers);
  const ready = paymentRuntime(context.cloudflare.env),
    hold = await payableHold(auth.supabase, params.holdId);
  if (ready === null || hold === null || typeof auth.user.email !== "string")
    return data(
      {
        error: "Payment is unavailable. No payment has been confirmed.",
        pending: false,
      },
      { status: 503, headers: auth.headers },
    );
  try {
    const attempt = await ready.db.prepare(hold.holdId, auth.user.id);
    if (
      Number(attempt.amount_minor) !== hold.amountMinor ||
      attempt.booking_id !== hold.bookingId
    )
      throw new Error("payment_snapshot_changed");
    if (!attempt.dispatch) {
      if (attempt.state === "ready" && attempt.checkout_url !== null) {
        const url = new URL(attempt.checkout_url);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "checkout.paystack.com" ||
          url.username ||
          url.password ||
          url.port
        )
          throw new Error("payment_input_invalid");
        return redirect(url.href, { headers: auth.headers });
      }
      return data({ error: null, pending: true }, { headers: auth.headers });
    }
    const result = await ready.provider.initialise(
      hold,
      auth.user.email,
      attempt.reference,
      attempt.subaccount,
    );
    await ready.db.saveCheckout(attempt.id, result.url);
    return redirect(result.url, { headers: auth.headers });
  } catch {
    return data(
      {
        error:
          "Payment setup needs checking. Please return to your booking before trying again.",
        pending: false,
      },
      { status: 503, headers: auth.headers },
    );
  }
}
export default function Checkout({
  loaderData: d,
  actionData: a,
}: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <section className="mx-auto max-w-2xl px-4 py-8">
        <p>TEST MODE · No live payment</p>
        <h1>Pay for your booking</h1>
        {d.hold === null ? (
          <p>
            This payment link is unavailable. Return to your booking for the
            current options.
          </p>
        ) : (
          <>
            <p>
              {new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: "ZAR",
              }).format(d.hold.amountMinor / 100)}
            </p>
            <p>
              Your slot is held until{" "}
              {new Intl.DateTimeFormat("en-ZA", {
                timeZone: "Africa/Johannesburg",
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(d.hold.expiresAt))}
              .
            </p>
            <p>
              Payment happens on Paystack's hosted test checkout. Returning here
              does not confirm payment.
            </p>
            <Form method="post">
              <CsrfField token={d.csrf} />
              <Button type="submit" variant="primary" disabled={!d.enabled}>
                Continue to test payment
              </Button>
            </Form>
            {!d.enabled ? (
              <p role="status">Test payment configuration is not ready.</p>
            ) : null}
            <ButtonLink
              href={"/bookings/" + d.hold.bookingId}
              variant="outline"
            >
              Back to booking
            </ButtonLink>
          </>
        )}
        {a?.error ? <p role="alert">{a.error}</p> : null}
        {a?.pending ? (
          <p role="status">
            This attempt is being checked. Use your booking's payment status;
            don't start another payment.
          </p>
        ) : null}
      </section>
    </PublicShell>
  );
}
