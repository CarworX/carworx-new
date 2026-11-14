import { data, Form, Link } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { geocodeArea, normaliseArea } from "../server/geo/geocode";
import {
  BOOKING_PROBLEM_TEXT,
  bookingProblem,
  clock,
  dayLabel,
  nextDays,
  parseDay,
  parseInstant,
  parseOptionalText,
  parseText,
  rand,
  rpc,
  todayLocal,
  UUID,
  type BookingProblem,
} from "../server/bookings/shared";
import { Button, ButtonLink } from "../ui/Button";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/book.$listingId";

export const meta: Route.MetaFunction = () => [{ title: "Book · CarworX" }];

interface Offer {
  listing_name: string;
  listing_mode: "fixed" | "mobile" | "both";
  offer_id: string;
  name: string;
  pricing: "fixed" | "quote";
  price_minor: number | null;
  duration_minutes: number;
}
interface Slot {
  resource_id: string;
  starts_at: string;
  ends_at: string;
}

/**
 * /book/:listingId: pick a service, a day and a free time, then send a
 * booking request (fixed price) or a quote request (quoted work). A request
 * doesn't promise the slot: the business accepts within 2 business hours,
 * then a 15-minute hold starts for payment (PLAN §6.3). Works without
 * JavaScript: every choice is a link or a form post.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!UUID.test(params.listingId)) throwStatus(404, signedIn.headers);
  const url = new URL(request.url);
  const offers = await rpc<Offer[]>(signedIn.supabase, "bookable_offers", {
    p_listing: params.listingId,
  });
  if (offers.error !== null) throwStatus(503, signedIn.headers);
  const first = offers.data?.[0];
  if (offers.data === null || first === undefined)
    throwStatus(404, signedIn.headers);
  const offerId = url.searchParams.get("offer");
  const offer =
    offers.data.find((o) => o.offer_id === offerId) ??
    (offers.data.length === 1 ? offers.data[0] : undefined);
  const day = parseDay(url.searchParams.get("day")) ?? todayLocal();
  let slots: Slot[] = [];
  if (offer?.pricing === "fixed") {
    const res = await rpc<Slot[]>(signedIn.supabase, "available_slots", {
      p_offer: offer.offer_id,
      p_day: day,
    });
    if (res.error !== null) throwStatus(503, signedIn.headers);
    // One button per start time, whichever bay has room.
    const seen = new Set<string>();
    slots = (res.data ?? []).filter((s) => {
      if (seen.has(s.starts_at)) return false;
      seen.add(s.starts_at);
      return true;
    });
  }
  return data(
    {
      csrf: context.security.csrfToken,
      listingId: params.listingId,
      offers: offers.data,
      listingName: first.listing_name,
      mobile: first.listing_mode !== "fixed",
      offer: offer ?? null,
      day,
      days: nextDays(14),
      slots,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!UUID.test(params.listingId)) throwStatus(404, signedIn.headers);
  const form = await request.formData();
  const fail = (problem: BookingProblem) =>
    data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  const offer = field(form, "offer");
  if (!UUID.test(offer)) return fail("invalid_input");
  const note = parseOptionalText(form, "note", 500);
  if (note === false) return fail("invalid_input");

  if (form.get("intent") === "quote") {
    const quoteNote = parseText(form, "note", 10, 1000);
    if (quoteNote === null) return fail("invalid_input");
    const { data: id, error } = await rpc(signedIn.supabase, "request_quote", {
      p_offer: offer,
      p_note: quoteNote,
    });
    if (error !== null) return fail(bookingProblem(error));
    return throwRedirect(`/quotes/${String(id)}`, signedIn.headers);
  }

  const startsAt = parseInstant(form, "starts_at");
  if (startsAt === null) return fail("invalid_input");

  if (form.get("intent") === "mobile") {
    const suburb = normaliseArea(parseText(form, "suburb", 2, 80));
    const address = parseText(form, "address", 5, 300);
    const notes = parseOptionalText(form, "access_notes", 300);
    if (suburb === null || address === null || notes === false)
      return fail("invalid_input");
    // Temporary geocoding of the suburb, used once for the distance and
    // dropped (A17, D-082). The typed address is never geocoded or stored
    // as coordinates.
    const env = context.cloudflare.env as unknown as Record<string, unknown>;
    const token = env["MAPBOX_SERVER_TOKEN"];
    const geo = await geocodeArea(
      suburb,
      typeof token === "string" ? token : undefined,
    );
    const point = geo.kind === "ok" ? geo.candidates[0] : undefined;
    if (point === undefined)
      return fail(geo.kind === "invalid" ? "invalid_input" : "unavailable");
    const { data: id, error } = await rpc(
      signedIn.supabase,
      "request_mobile_booking",
      {
        p_offer: offer,
        p_starts_at: startsAt,
        p_suburb: suburb,
        p_address: address,
        p_latitude: point.lat,
        p_longitude: point.lng,
        p_access_notes: notes,
        p_note: note,
      },
    );
    if (error !== null) return fail(bookingProblem(error));
    return throwRedirect(`/bookings/${String(id)}`, signedIn.headers);
  }

  const { data: id, error } = await rpc(signedIn.supabase, "request_booking", {
    p_offer: offer,
    p_starts_at: startsAt,
    p_note: note,
  });
  if (error !== null) return fail(bookingProblem(error));
  return throwRedirect(`/bookings/${String(id)}`, signedIn.headers);
}

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const { offers, offer, day, days, slots, listingId, csrf, mobile } =
    loaderData;
  const name = loaderData.listingName;
  const base = `/book/${listingId}`;
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[70ch] gap-5">
        <h1 className="type-title">Book with {name}</h1>
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {BOOKING_PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        ) : null}

        <section aria-labelledby="svc" className="grid gap-2">
          <h2 id="svc" className="type-label">
            1. Choose a service
          </h2>
          <ul className="grid gap-2">
            {offers.map((o) => (
              <li key={o.offer_id}>
                <Link
                  to={`${base}?offer=${o.offer_id}&day=${day}`}
                  aria-current={
                    offer?.offer_id === o.offer_id ? "true" : undefined
                  }
                  className={`block rounded-2xl p-3 ${offer?.offer_id === o.offer_id ? "bg-[var(--ink)] text-[var(--white)]" : "bg-[var(--surface)]"}`}
                >
                  <b>{o.name}</b>{" "}
                  <span className="type-caption">
                    {o.pricing === "fixed"
                      ? `${rand(o.price_minor)} · about ${String(o.duration_minutes)} min`
                      : "Price after a quote"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {offer?.pricing === "quote" ? (
          <Form method="post" className="grid gap-3">
            <h2 className="type-label">2. Describe the work</h2>
            <CsrfField token={csrf} />
            <input type="hidden" name="offer" value={offer.offer_id} />
            <input type="hidden" name="intent" value="quote" />
            <div className="cx-field">
              <label htmlFor="note">
                What do you need? (10 to 1000 characters)
              </label>
              <textarea
                id="note"
                name="note"
                className="cx-input"
                required
                minLength={10}
                maxLength={1000}
                rows={4}
              />
            </div>
            <p className="type-caption">
              The business sends a quote with a price. You approve that exact
              quote before anything is booked or paid.
            </p>
            <div>
              <Button type="submit" variant="primary">
                Ask for a quote
              </Button>
            </div>
          </Form>
        ) : null}

        {offer?.pricing === "fixed" ? (
          <>
            <section aria-labelledby="day" className="grid gap-2">
              <h2 id="day" className="type-label">
                2. Choose a day
              </h2>
              <ul className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <li key={d}>
                    <Link
                      to={`${base}?offer=${offer.offer_id}&day=${d}`}
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
            </section>
            <Form method="post" className="grid gap-3">
              <h2 className="type-label">
                3. Choose a time on {dayLabel(day)}
              </h2>
              <CsrfField token={csrf} />
              <input type="hidden" name="offer" value={offer.offer_id} />
              <input
                type="hidden"
                name="intent"
                value={mobile ? "mobile" : "fixed"}
              />
              {slots.length === 0 ? (
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
              )}
              {mobile ? (
                <>
                  <TextField
                    label="Suburb"
                    name="suburb"
                    required
                    maxLength={80}
                    hint="Shown to the business before they accept."
                  />
                  <TextField
                    label="Street address"
                    name="address"
                    required
                    minLength={5}
                    maxLength={300}
                    hint="Shown only to the staff doing the job, once it's confirmed."
                  />
                  <TextField
                    label="Access notes (optional)"
                    name="access_notes"
                    maxLength={300}
                  />
                </>
              ) : null}
              <TextField
                label="Note for the business (optional)"
                name="note"
                maxLength={500}
              />
              <p className="type-caption">
                The business has 2 business hours to accept. Then you have 15
                minutes to pay, and the time is yours.
              </p>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={slots.length === 0}
                >
                  Send booking request
                </Button>
              </div>
            </Form>
          </>
        ) : null}
        <p>
          <ButtonLink href={`/p/${listingId}`} variant="outline">
            Back to the listing
          </ButtonLink>
        </p>
      </div>
    </PublicShell>
  );
}
