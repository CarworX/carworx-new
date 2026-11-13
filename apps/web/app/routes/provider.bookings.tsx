import { data, Form, Link } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  BOOKING_PROBLEM_TEXT,
  bookingProblem,
  parseIntIn,
  parseOptionalText,
  parseRandToMinor,
  parseRange,
  rand,
  rpc,
  STATE_COPY,
  UUID,
  when,
  type BookingProblem,
  type BookingState,
} from "../server/bookings/shared";
import { Button, ButtonLink } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { TextField } from "../ui/Field";
import { EmptyState, StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.bookings";

export const meta: Route.MetaFunction = () => [
  { title: "Bookings · Your business · CarworX" },
];

interface Membership {
  id: string;
  organisation_id: string;
  role: "owner" | "manager" | "staff";
}
interface Booking {
  id: string;
  organisation_id: string;
  state: BookingState;
  during: string;
  amount_minor: number | null;
  mobile: boolean;
  suburb: string | null;
  travel_minutes: number;
  distance_km: number | null;
  accept_by: string;
  customer_note: string | null;
  parent_booking_id: string | null;
}
interface Quote {
  id: string;
  organisation_id: string;
  state: string;
  customer_note: string | null;
  parent_booking_id: string | null;
  created_at: string;
}
interface Member {
  id: string;
  organisation_id: string;
  user_id: string;
  role: string;
}
interface Assignment {
  booking_id: string;
  membership_id: string;
}

const BOOKING_COLUMNS =
  "id, organisation_id, state, during, amount_minor, mobile, suburb, travel_minutes, distance_km, accept_by, customer_note, parent_booking_id";

/**
 * /provider/bookings: owners and managers answer requests (accept starts
 * the customer's 15-minute payment hold), confirm mobile travel time,
 * assign staff, mark jobs done and start change quotes. Every read uses the
 * signed-in person's JWT, so RLS decides what appears; a revoked membership
 * sees nothing on the next request (A34). Mobile jobs show only the suburb
 * here; the full address is on /provider/jobs for assigned staff (A31).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const db = signedIn.supabase;
  const mine = await db
    .from("memberships")
    .select("id, organisation_id, role")
    .eq("user_id", signedIn.user.id)
    .eq("status", "active")
    .overrideTypes<Membership[], { merge: false }>();
  if (mine.error !== null) throwStatus(503, signedIn.headers);
  const managed = mine.data
    .filter((m) => m.role !== "staff")
    .map((m) => m.organisation_id);
  if (managed.length === 0) {
    return data(
      {
        csrf: context.security.csrfToken,
        managed: false as const,
        requests: [],
        upcoming: [],
        quotes: [],
        members: [],
        assignments: [],
      },
      { headers: signedIn.headers },
    );
  }
  const [requests, upcoming, quotes, members] = await Promise.all([
    db
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .in("organisation_id", managed)
      .eq("state", "requested")
      .order("accept_by")
      .limit(50)
      .overrideTypes<Booking[], { merge: false }>(),
    db
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .in("organisation_id", managed)
      .in("state", ["awaiting_payment", "confirmed", "paid_after_expiry"])
      .order("during")
      .limit(100)
      .overrideTypes<Booking[], { merge: false }>(),
    db
      .from("quotes")
      .select(
        "id, organisation_id, state, customer_note, parent_booking_id, created_at",
      )
      .in("organisation_id", managed)
      .in("state", ["requested", "quoted"])
      .order("created_at")
      .limit(50)
      .overrideTypes<Quote[], { merge: false }>(),
    db
      .from("memberships")
      .select("id, organisation_id, user_id, role")
      .in("organisation_id", managed)
      .eq("status", "active")
      .overrideTypes<Member[], { merge: false }>(),
  ]);
  if (requests.error || upcoming.error || quotes.error || members.error)
    throwStatus(503, signedIn.headers);
  const ids = upcoming.data.map((b) => b.id);
  const assignments =
    ids.length === 0
      ? { data: [] as Assignment[], error: null }
      : await db
          .from("booking_assignments")
          .select("booking_id, membership_id")
          .in("booking_id", ids)
          .overrideTypes<Assignment[], { merge: false }>();
  if (assignments.error) throwStatus(503, signedIn.headers);
  const shape = (b: Booking) => ({ ...b, starts: parseRange(b.during).start });
  return data(
    {
      csrf: context.security.csrfToken,
      managed: true as const,
      requests: requests.data.map(shape),
      upcoming: upcoming.data.map(shape),
      quotes: quotes.data,
      members: members.data,
      assignments: assignments.data,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const form = await request.formData();
  const fail = (problem: BookingProblem) =>
    data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  const booking = field(form, "booking");
  if (!UUID.test(booking)) return fail("invalid_input");
  const db = signedIn.supabase;
  const intent = field(form, "intent");
  let error: { code?: string; message?: string } | null;
  if (intent === "accept") {
    ({ error } = await rpc(db, "accept_booking", { p_booking: booking }));
  } else if (intent === "decline") {
    ({ error } = await rpc(db, "decline_booking", { p_booking: booking }));
  } else if (intent === "travel") {
    const minutes = parseIntIn(form, "travel_minutes", 0, 240);
    const charge =
      field(form, "travel_charge").trim() === ""
        ? null
        : parseRandToMinor(form, "travel_charge");
    const chargeTyped = field(form, "travel_charge").trim() !== "";
    if (
      minutes === null ||
      minutes % 5 !== 0 ||
      (chargeTyped && charge === null)
    )
      return fail("invalid_input");
    ({ error } = await rpc(db, "set_travel_buffer", {
      p_booking: booking,
      p_travel_minutes: minutes,
      p_charge_minor: charge,
    }));
  } else if (intent === "assign" || intent === "unassign") {
    const membership = field(form, "membership");
    if (!UUID.test(membership)) return fail("invalid_input");
    ({ error } = await rpc(
      db,
      intent === "assign" ? "assign_staff" : "unassign_staff",
      {
        p_booking: booking,
        p_membership: membership,
      },
    ));
  } else if (intent === "complete") {
    ({ error } = await rpc(db, "complete_booking", { p_booking: booking }));
  } else if (intent === "cancel") {
    const reason = parseOptionalText(form, "reason", 200);
    if (reason === false) return fail("invalid_input");
    ({ error } = await rpc(db, "cancel_booking", {
      p_booking: booking,
      p_reason: reason ?? "cancelled_by_provider",
    }));
  } else if (intent === "change_quote") {
    const { data: quote, error: e } = await rpc(db, "start_change_quote", {
      p_booking: booking,
    });
    if (e !== null) return fail(bookingProblem(e));
    return throwRedirect(`/provider/quotes/${String(quote)}`, signedIn.headers);
  } else {
    return fail("invalid_input");
  }
  if (error !== null) return fail(bookingProblem(error));
  return throwRedirect("/provider/bookings", signedIn.headers);
}

function Hidden({
  csrf,
  booking,
  intent,
}: {
  csrf: string;
  booking: string;
  intent: string;
}) {
  return (
    <>
      <CsrfField token={csrf} />
      <input type="hidden" name="booking" value={booking} />
      <input type="hidden" name="intent" value={intent} />
    </>
  );
}

export default function ProviderBookings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, managed, requests, upcoming, quotes, members, assignments } =
    loaderData;
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[80ch] gap-6">
        <h1 className="type-title">Bookings</h1>
        <p className="flex flex-wrap gap-3">
          <ButtonLink href="/provider/resources" variant="outline">
            Bays, hours and prices
          </ButtonLink>
          <ButtonLink href="/provider/jobs" variant="outline">
            My jobs
          </ButtonLink>
        </p>
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {BOOKING_PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        ) : null}
        {!managed ? (
          <EmptyState title="Nothing to manage here">
            Only owners and managers answer booking requests. Your assigned jobs
            are under My jobs.
          </EmptyState>
        ) : (
          <>
            <section className="grid gap-3" aria-labelledby="req">
              <h2 id="req" className="type-label">
                New requests ({requests.length})
              </h2>
              {requests.length === 0 ? (
                <p className="type-body">No requests waiting.</p>
              ) : null}
              {requests.map((b) => (
                <article
                  key={b.id}
                  className="grid gap-2 rounded-2xl bg-[var(--surface)] p-4"
                  data-booking={b.id}
                >
                  <p className="type-body">
                    <b>{when(b.starts)}</b> · {rand(b.amount_minor)}
                    {b.mobile
                      ? ` · mobile, ${b.suburb ?? "suburb unknown"}, ${String(b.distance_km ?? "?")} km straight-line, travel ${String(b.travel_minutes)} min`
                      : ""}
                  </p>
                  {b.customer_note ? (
                    <p className="type-caption">“{b.customer_note}”</p>
                  ) : null}
                  <p className="type-caption">
                    Answer by {when(b.accept_by)}. Accepting holds the time for
                    the customer to pay within 15 minutes.
                  </p>
                  {b.mobile ? (
                    <Form
                      method="post"
                      className="flex flex-wrap items-end gap-3"
                    >
                      <Hidden csrf={csrf} booking={b.id} intent="travel" />
                      <TextField
                        label="Travel time (minutes, steps of 5)"
                        name="travel_minutes"
                        inputMode="numeric"
                        defaultValue={String(b.travel_minutes)}
                        required
                      />
                      <TextField
                        label="Travel charge (R, optional)"
                        name="travel_charge"
                        inputMode="decimal"
                      />
                      <Button type="submit" variant="outline">
                        Confirm travel
                      </Button>
                    </Form>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Form method="post">
                      <Hidden csrf={csrf} booking={b.id} intent="accept" />
                      <Button type="submit" variant="primary">
                        Accept
                      </Button>
                    </Form>
                    <Form method="post">
                      <Hidden csrf={csrf} booking={b.id} intent="decline" />
                      <Button type="submit" variant="outline">
                        Decline
                      </Button>
                    </Form>
                  </div>
                </article>
              ))}
            </section>

            <section className="grid gap-3" aria-labelledby="quo">
              <h2 id="quo" className="type-label">
                Quote requests ({quotes.length})
              </h2>
              {quotes.length === 0 ? (
                <p className="type-body">None waiting.</p>
              ) : null}
              <ul className="grid gap-2">
                {quotes.map((q) => (
                  <li key={q.id}>
                    <Link to={`/provider/quotes/${q.id}`} className="cx-tlink">
                      {q.parent_booking_id ? "Extra work" : "Quote"} asked{" "}
                      {when(q.created_at)} ·{" "}
                      {q.state === "quoted"
                        ? "sent, waiting for the customer"
                        : "needs a price"}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-3" aria-labelledby="up">
              <h2 id="up" className="type-label">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="type-body">Nothing booked yet.</p>
              ) : null}
              {upcoming.map((b) => {
                const assigned = assignments
                  .filter((a) => a.booking_id === b.id)
                  .map((a) => a.membership_id);
                const staff = members.filter(
                  (m) => m.organisation_id === b.organisation_id,
                );
                return (
                  <article
                    key={b.id}
                    className="grid gap-2 rounded-2xl bg-[var(--surface)] p-4"
                    data-booking={b.id}
                  >
                    <p className="type-body">
                      <b>{when(b.starts)}</b> · {rand(b.amount_minor)}{" "}
                      <StatusLabel tone={STATE_COPY[b.state].tone}>
                        {STATE_COPY[b.state].label}
                      </StatusLabel>
                      {b.parent_booking_id ? " · extra work" : ""}
                      {b.mobile ? ` · mobile, ${b.suburb ?? ""}` : ""}
                    </p>
                    {b.state === "confirmed" && !b.parent_booking_id ? (
                      <>
                        <Form
                          method="post"
                          className="flex flex-wrap items-end gap-3"
                        >
                          <Hidden csrf={csrf} booking={b.id} intent="assign" />
                          <div className="cx-field">
                            <label htmlFor={`m-${b.id}`}>Assign staff</label>
                            <select
                              id={`m-${b.id}`}
                              name="membership"
                              className="cx-input"
                              required
                            >
                              {staff.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.role} {m.user_id.slice(0, 8)}
                                  {assigned.includes(m.id) ? " (assigned)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Button type="submit" variant="outline">
                            Assign
                          </Button>
                        </Form>
                        <div className="flex flex-wrap gap-3">
                          <Form method="post">
                            <Hidden
                              csrf={csrf}
                              booking={b.id}
                              intent="complete"
                            />
                            <Button type="submit" variant="outline">
                              Mark done
                            </Button>
                          </Form>
                          <Form method="post">
                            <Hidden
                              csrf={csrf}
                              booking={b.id}
                              intent="change_quote"
                            />
                            <Button type="submit" variant="outline">
                              Quote extra work
                            </Button>
                          </Form>
                          <Form method="post">
                            <Hidden
                              csrf={csrf}
                              booking={b.id}
                              intent="cancel"
                            />
                            <Button type="submit" variant="outline">
                              Cancel (full refund)
                            </Button>
                          </Form>
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>
    </PublicShell>
  );
}
