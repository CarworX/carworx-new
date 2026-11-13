import { data, Form, Link } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  expireDue,
  BOOKING_PROBLEM_TEXT,
  bookingProblem,
  checkoutHref,
  clock,
  dayLabel,
  nextDays,
  parseDay,
  parseInstant,
  parseOptionalText,
  parseRange,
  rand,
  rpc,
  STATE_COPY,
  todayLocal,
  UUID,
  when,
  type BookingProblem,
  type BookingState,
} from "../server/bookings/shared";
import { Receipt } from "../ui/Booking";
import { Button, ButtonLink } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/bookings.$id";

export const meta: Route.MetaFunction = () => [{ title: "Booking · CarworX" }];

interface Booking {
  id: string;
  state: BookingState;
  during: string;
  amount_minor: number | null;
  travel_charge_minor: number;
  travel_minutes: number;
  mobile: boolean;
  suburb: string | null;
  accept_by: string;
  hold_id: string | null;
  offer_id: string;
  quote_version_id: string | null;
  customer_note: string | null;
  cancelled_by: string | null;
  customer_id: string;
}
interface Slot {
  resource_id: string;
  starts_at: string;
  ends_at: string;
}
interface Hold {
  expires_at: string | null;
}

const COLUMNS =
  "id, state, during, amount_minor, travel_charge_minor, travel_minutes, mobile, suburb, accept_by, hold_id, offer_id, quote_version_id, customer_note, cancelled_by, customer_id";

/**
 * /bookings/:id: one booking for its customer. Pay (the money lane's
 * checkout, while the 15-minute hold runs), cancel, reschedule, or, after a
 * payment that arrived too late (A23), pick a new time.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  await expireDue(signedIn.supabase);
  if (!UUID.test(params.id)) throwStatus(404, signedIn.headers);
  const db = signedIn.supabase;
  const { data: b, error } = await db
    .from("bookings")
    .select(COLUMNS)
    .eq("id", params.id)
    .eq("customer_id", signedIn.user.id)
    .maybeSingle<Booking>();
  if (error !== null) throwStatus(503, signedIn.headers);
  if (b === null) throwStatus(404, signedIn.headers);
  const url = new URL(request.url);
  const day = parseDay(url.searchParams.get("day")) ?? todayLocal();
  const range = parseRange(b.during);
  let slots: Slot[] = [];
  const picking =
    (b.state === "confirmed" && url.searchParams.get("reschedule") === "1") ||
    b.state === "paid_after_expiry";
  if (picking) {
    const res =
      b.state === "paid_after_expiry"
        ? await rpc(db, "rebook_options", { p_booking: b.id })
        : await rpc(db, "available_slots", { p_offer: b.offer_id, p_day: day });
    if (res.error !== null) throwStatus(503, signedIn.headers);
    slots = res.data as Slot[];
  }
  // Seconds left on the hold, from the hold snapshot the customer can read
  // through their own booking (no separate reservation read).
  let holdSecondsLeft: number | null = null;
  if (b.state === "awaiting_payment" && b.hold_id !== null) {
    const hold = await db
      .from("bookings")
      .select("hold:reservations!bookings_hold_id_fkey(expires_at)")
      .eq("id", b.id)
      .maybeSingle<{ hold: Hold | null }>();
    const exp = hold.data?.hold?.expires_at;
    if (exp)
      holdSecondsLeft = Math.max(
        0,
        Math.round((Date.parse(exp) - Date.now()) / 1000),
      );
  }
  return data(
    {
      csrf: context.security.csrfToken,
      booking: b,
      range,
      picking,
      day,
      days: nextDays(14),
      slots,
      holdSecondsLeft,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, signedIn.headers);
  const form = await request.formData();
  const fail = (problem: BookingProblem) =>
    data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  const intent = field(form, "intent");
  const db = signedIn.supabase;
  if (intent === "cancel") {
    const reason = parseOptionalText(form, "reason", 200);
    if (reason === false) return fail("invalid_input");
    const { error } = await rpc(db, "cancel_booking", {
      p_booking: params.id,
      p_reason: reason,
    });
    if (error !== null) return fail(bookingProblem(error));
  } else if (intent === "reschedule" || intent === "rebook") {
    // One radio per slot carries both its resource and its start, so the
    // rebook goes to the bay or team that actually has the room.
    const [resource = "", start = ""] = field(form, "slot").split("|");
    const slotForm = new FormData();
    slotForm.set("starts_at", start);
    const startsAt = parseInstant(slotForm, "starts_at");
    if (startsAt === null) return fail("invalid_input");
    if (intent === "reschedule") {
      const { error } = await rpc(db, "reschedule_booking", {
        p_booking: params.id,
        p_new_starts_at: startsAt,
      });
      if (error !== null) return fail(bookingProblem(error));
    } else {
      if (!UUID.test(resource)) return fail("invalid_input");
      const { error } = await rpc(db, "rebook_after_late_payment", {
        p_booking: params.id,
        p_resource: resource,
        p_starts_at: startsAt,
      });
      if (error !== null) return fail(bookingProblem(error));
    }
  } else {
    return fail("invalid_input");
  }
  return throwRedirect(`/bookings/${params.id}`, signedIn.headers);
}

export default function BookingPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    booking: b,
    range,
    picking,
    day,
    days,
    slots,
    holdSecondsLeft,
    csrf,
  } = loaderData;
  const state = STATE_COPY[b.state];
  const lines = [
    {
      label: "Service",
      amount: rand((b.amount_minor ?? 0) - b.travel_charge_minor),
    },
    ...(b.mobile && b.travel_charge_minor > 0
      ? [
          {
            label: "Travel (straight-line distance)",
            amount: rand(b.travel_charge_minor),
          },
        ]
      : []),
  ];
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[70ch] gap-5" data-booking-state={b.state}>
        <h1 className="type-title">{when(range.start)}</h1>
        <p>
          <StatusLabel tone={state.tone}>{state.label}</StatusLabel>
        </p>
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {BOOKING_PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        ) : null}
        <Receipt
          title="Booking"
          lines={lines}
          total={{ label: "Total", amount: rand(b.amount_minor) }}
        />
        {b.mobile && b.suburb ? (
          <p className="type-body">
            At your address in {b.suburb}. Travel time included:{" "}
            {b.travel_minutes} min.
          </p>
        ) : null}

        {b.state === "requested" ? (
          <StatusNote title="Waiting for the business.">
            They have until {when(b.accept_by)} to accept. Nothing is charged
            until you pay after they accept.
          </StatusNote>
        ) : null}

        {b.state === "awaiting_payment" && b.hold_id !== null ? (
          <div className="grid gap-3">
            <StatusNote tone="warn" title="Accepted. Pay to confirm.">
              The time is held for you
              {holdSecondsLeft !== null
                ? ` for about ${String(Math.ceil(holdSecondsLeft / 60))} more minutes`
                : ""}
              . If the hold runs out, the time goes back to others.
            </StatusNote>
            <div>
              <ButtonLink href={checkoutHref(b.hold_id)} variant="primary">
                Pay {rand(b.amount_minor)}
              </ButtonLink>
            </div>
          </div>
        ) : null}

        {b.state === "payment_expired" ? (
          <StatusNote tone="warn" title="The hold ran out before payment.">
            Nothing was charged. You can book again.
          </StatusNote>
        ) : null}

        {picking ? (
          <section className="grid gap-3" aria-labelledby="pick">
            <h2 id="pick" className="type-label">
              {b.state === "paid_after_expiry"
                ? "Your payment arrived after the hold ran out. Pick a new time, or ask for a refund."
                : `Choose a new time on ${dayLabel(day)}`}
            </h2>
            {b.state === "confirmed" ? (
              <ul className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <li key={d}>
                    <Link
                      to={`/bookings/${b.id}?reschedule=1&day=${d}`}
                      aria-current={d === day ? "date" : undefined}
                      className={
                        d === day
                          ? "cx-chip bg-[var(--ink)] text-[var(--white)]"
                          : "cx-chip"
                      }
                    >
                      {dayLabel(d)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <Form method="post" className="grid gap-3">
              <CsrfField token={csrf} />
              <input
                type="hidden"
                name="intent"
                value={
                  b.state === "paid_after_expiry" ? "rebook" : "reschedule"
                }
              />
              {slots.length === 0 ? (
                <StatusNote title="No free times.">Try another day.</StatusNote>
              ) : (
                <fieldset className="cx-slots">
                  <legend className="cx-vh">New start time</legend>
                  {slots.map((s) => (
                    <label
                      key={`${s.resource_id}${s.starts_at}`}
                      className="cx-slot"
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={`${s.resource_id}|${s.starts_at}`}
                        required
                      />
                      {b.state === "paid_after_expiry"
                        ? when(s.starts_at)
                        : clock(s.starts_at)}
                    </label>
                  ))}
                </fieldset>
              )}
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={slots.length === 0}
                >
                  {b.state === "paid_after_expiry"
                    ? "Book this time"
                    : "Move my booking"}
                </Button>
              </div>
            </Form>
          </section>
        ) : null}

        {b.state === "confirmed" && !picking ? (
          <p>
            <ButtonLink
              href={`/bookings/${b.id}?reschedule=1`}
              variant="outline"
            >
              Change the time
            </ButtonLink>
          </p>
        ) : null}

        {[
          "requested",
          "awaiting_payment",
          "confirmed",
          "paid_after_expiry",
        ].includes(b.state) ? (
          <Form method="post" className="grid gap-3">
            <CsrfField token={csrf} />
            <input type="hidden" name="intent" value="cancel" />
            <TextField
              label="Reason (optional)"
              name="reason"
              maxLength={200}
            />
            <p className="type-caption">
              Cancelling at least 24 hours before the start, or after a late
              payment, refunds you in full. Closer to the start, the business
              decides.
            </p>
            <div>
              <Button type="submit" variant="outline">
                Cancel booking
              </Button>
            </div>
          </Form>
        ) : null}
        <p>
          <Link to="/bookings" className="cx-tlink">
            All my bookings
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
