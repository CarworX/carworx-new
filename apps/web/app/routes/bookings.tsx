import { data, Link } from "react-router";

import { throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import {
  parseRange,
  rand,
  STATE_COPY,
  when,
  type BookingState,
} from "../server/bookings/shared";
import { StatusLabel } from "../ui/Chip";
import { EmptyState } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/bookings";

export const meta: Route.MetaFunction = () => [
  { title: "My bookings · CarworX" },
];

interface Row {
  id: string;
  state: BookingState;
  during: string;
  amount_minor: number | null;
  created_at: string;
}
interface QuoteRow {
  id: string;
  state: string;
  created_at: string;
}

/** /bookings: the signed-in customer's own bookings and quotes (RLS: customer_id = me). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const [bookings, quotes] = await Promise.all([
    signedIn.supabase
      .from("bookings")
      .select("id, state, during, amount_minor, created_at")
      .eq("customer_id", signedIn.user.id)
      .is("parent_booking_id", null)
      .order("created_at", { ascending: false })
      .limit(50)
      .overrideTypes<Row[], { merge: false }>(),
    signedIn.supabase
      .from("quotes")
      .select("id, state, created_at")
      .eq("customer_id", signedIn.user.id)
      .is("parent_booking_id", null)
      .in("state", ["requested", "quoted"])
      .order("created_at", { ascending: false })
      .limit(20)
      .overrideTypes<QuoteRow[], { merge: false }>(),
  ]);
  if (bookings.error !== null || quotes.error !== null)
    throwStatus(503, signedIn.headers);
  return data(
    {
      bookings: bookings.data.map((b) => ({
        ...b,
        starts: parseRange(b.during).start,
      })),
      quotes: quotes.data,
    },
    { headers: signedIn.headers },
  );
}

export default function Bookings({ loaderData }: Route.ComponentProps) {
  const { bookings, quotes } = loaderData;
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[70ch] gap-5">
        <h1 className="type-title">My bookings</h1>
        {quotes.length > 0 ? (
          <section className="grid gap-2" aria-labelledby="q">
            <h2 id="q" className="type-label">
              Open quotes
            </h2>
            <ul className="grid gap-2">
              {quotes.map((q) => (
                <li key={q.id}>
                  <Link to={`/quotes/${q.id}`} className="cx-tlink">
                    Quote asked {when(q.created_at)} ·{" "}
                    {q.state === "quoted"
                      ? "a price is ready"
                      : "waiting for the business"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {bookings.length === 0 ? (
          <EmptyState title="No bookings yet">
            Find a service and book a time.
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-2xl bg-[var(--surface)] p-3">
                <Link to={`/bookings/${b.id}`} className="cx-tlink">
                  {when(b.starts)}
                </Link>{" "}
                <StatusLabel tone={STATE_COPY[b.state].tone}>
                  {STATE_COPY[b.state].label}
                </StatusLabel>{" "}
                <span className="type-caption">{rand(b.amount_minor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicShell>
  );
}
