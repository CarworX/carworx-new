import { data, Form, Link } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  BOOKING_PROBLEM_TEXT,
  bookingProblem,
  clock,
  dayLabel,
  nextDays,
  parseDay,
  parseInstant,
  rand,
  rpc,
  todayLocal,
  UUID,
  when,
  type BookingProblem,
} from "../server/bookings/shared";
import { Receipt } from "../ui/Booking";
import { Button } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/quotes.$id";

export const meta: Route.MetaFunction = () => [{ title: "Quote · CarworX" }];

interface Quote {
  id: string;
  state:
    "requested" | "quoted" | "approved" | "paid" | "withdrawn" | "declined";
  offer_id: string;
  parent_booking_id: string | null;
  customer_note: string | null;
  created_at: string;
}
interface Version {
  id: string;
  version: number;
  lines: { label: string; amount_minor: number }[];
  total_minor: number;
  duration_minutes: number;
  valid_until: string;
  note: string | null;
  state: "issued" | "superseded" | "approved" | "paid" | "expired";
  issued_at: string;
}
interface Slot {
  resource_id: string;
  starts_at: string;
  ends_at: string;
}

/**
 * /quotes/:id: the customer sees every version (old ones struck through),
 * approves the current one before it expires, and picks a time. Approving
 * starts the 15-minute payment hold at once (PLAN §6.4). A change quote
 * (extra work on a paid job) has no time to pick.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, signedIn.headers);
  const db = signedIn.supabase;
  const [q, v] = await Promise.all([
    db
      .from("quotes")
      .select(
        "id, state, offer_id, parent_booking_id, customer_note, created_at",
      )
      .eq("id", params.id)
      .eq("customer_id", signedIn.user.id)
      .maybeSingle<Quote>(),
    db
      .from("quote_versions")
      .select(
        "id, version, lines, total_minor, duration_minutes, valid_until, note, state, issued_at",
      )
      .eq("quote_id", params.id)
      .order("version", { ascending: false })
      .overrideTypes<Version[], { merge: false }>(),
  ]);
  if (q.error !== null || v.error !== null) throwStatus(503, signedIn.headers);
  if (q.data === null) throwStatus(404, signedIn.headers);
  const current = v.data.find((x) => x.state === "issued") ?? null;
  const url = new URL(request.url);
  const day = parseDay(url.searchParams.get("day")) ?? todayLocal();
  let slots: Slot[] = [];
  if (current !== null && q.data.parent_booking_id === null) {
    const res = await rpc(db, "available_slots", {
      p_offer: q.data.offer_id,
      p_day: day,
      p_minutes: current.duration_minutes,
    });
    if (res.error !== null) throwStatus(503, signedIn.headers);
    const seen = new Set<string>();
    slots = (res.data as Slot[]).filter(
      (s) => !seen.has(s.starts_at) && seen.add(s.starts_at),
    );
  }
  return data(
    {
      csrf: context.security.csrfToken,
      quote: q.data,
      versions: v.data,
      current,
      day,
      days: nextDays(14),
      slots,
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
  const db = signedIn.supabase;
  if (form.get("intent") === "decline") {
    const { error } = await rpc(db, "decline_quote", { p_quote: params.id });
    if (error !== null) return fail(bookingProblem(error));
    return throwRedirect(`/quotes/${params.id}`, signedIn.headers);
  }
  const version = field(form, "version");
  if (!UUID.test(version)) return fail("invalid_input");
  const raw = field(form, "starts_at");
  const startsAt = raw === "" ? null : parseInstant(form, "starts_at");
  if (raw !== "" && startsAt === null) return fail("invalid_input");
  const { data: booking, error } = await rpc(db, "approve_quote_version", {
    p_version: version,
    p_starts_at: startsAt,
  });
  if (error !== null) return fail(bookingProblem(error));
  return throwRedirect(`/bookings/${String(booking)}`, signedIn.headers);
}

export default function QuotePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { quote, versions, current, day, days, slots, csrf } = loaderData;
  const change = quote.parent_booking_id !== null;
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[70ch] gap-5" data-quote-state={quote.state}>
        <h1 className="type-title">
          {change ? "Extra work quote" : "Your quote"}
        </h1>
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {BOOKING_PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        ) : null}
        {versions.length === 0 ? (
          <StatusNote title="Waiting for the business.">
            They'll send a price. You approve it before anything is booked or
            paid.
          </StatusNote>
        ) : null}
        {versions.map((v) => (
          <div key={v.id} className="grid gap-2" data-version-state={v.state}>
            <Receipt
              title={`Quote v${String(v.version)}`}
              lines={v.lines.map((l) => ({
                label: l.label,
                amount: rand(l.amount_minor),
                old: v.state === "superseded" || v.state === "expired",
              }))}
              total={{
                label: "Total",
                amount: rand(v.total_minor),
                old: v.state === "superseded",
              }}
              stamp={
                v.state === "issued" ? (
                  <StatusLabel tone="warn">
                    Valid until {when(v.valid_until)}
                  </StatusLabel>
                ) : v.state === "paid" ? (
                  <StatusLabel>Paid</StatusLabel>
                ) : v.state === "superseded" ? (
                  <StatusLabel tone="info">
                    Replaced by a newer version
                  </StatusLabel>
                ) : (
                  <StatusLabel tone="info">{v.state}</StatusLabel>
                )
              }
            />
            {v.note ? <p className="type-body">{v.note}</p> : null}
          </div>
        ))}

        {current !== null ? (
          <section className="grid gap-3" aria-labelledby="approve">
            <h2 id="approve" className="type-label">
              Approve v{current.version} ({rand(current.total_minor)}, about{" "}
              {current.duration_minutes} min)
            </h2>
            {!change ? (
              <ul className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <li key={d}>
                    <Link
                      to={`/quotes/${quote.id}?day=${d}`}
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
              <input type="hidden" name="version" value={current.id} />
              {!change ? (
                slots.length === 0 ? (
                  <StatusNote title="No free times that day.">
                    Try another day.
                  </StatusNote>
                ) : (
                  <fieldset className="cx-slots">
                    <legend className="cx-vh">Start time</legend>
                    {slots.map((s) => (
                      <label key={s.starts_at} className="cx-slot">
                        <input
                          type="radio"
                          name="starts_at"
                          value={s.starts_at}
                          required
                        />
                        {clock(s.starts_at)}
                      </label>
                    ))}
                  </fieldset>
                )
              ) : null}
              <p className="type-caption">
                Approving holds the time for 15 minutes while you pay. This
                exact version is what you pay for.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!change && slots.length === 0}
                >
                  Approve and continue to payment
                </Button>
              </div>
            </Form>
            <Form method="post">
              <CsrfField token={csrf} />
              <input type="hidden" name="intent" value="decline" />
              <Button type="submit" variant="outline">
                No thanks
              </Button>
            </Form>
          </section>
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
