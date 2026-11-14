import { data, Form, Link } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  BOOKING_PROBLEM_TEXT,
  bookingProblem,
  parseInstant,
  parseIntIn,
  parseOptionalText,
  parseRandToMinor,
  parseText,
  rand,
  rpc,
  UUID,
  type BookingProblem,
} from "../server/bookings/shared";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { EmptyState, StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.resources";

export const meta: Route.MetaFunction = () => [
  { title: "Bays, hours and prices · CarworX" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const KINDS = ["bay", "team", "calendar"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Resource {
  id: string;
  kind: (typeof KINDS)[number];
  name: string;
  capacity: number;
  mobile: boolean;
  active: boolean;
}
interface Hours {
  resource_id: string;
  weekday: number;
  opens: string;
  closes: string;
}
interface Offer {
  id: string;
  listing_public_id: string;
  name: string;
  pricing: "fixed" | "quote";
  price_minor: number | null;
  duration_minutes: number;
  buffer_minutes: number;
  resource_kind: (typeof KINDS)[number];
  active: boolean;
}
interface Listing {
  public_id: string;
  display_name: string;
  mode: string;
}
interface Band {
  id: string;
  listing_public_id: string;
  up_to_km: number;
  travel_minutes: number;
  charge_minor: number;
}

/**
 * /provider/resources: a manager sets up what can be booked: bays/teams
 * with capacity (D-057), weekly hours, closures, the priced or quoted
 * services on each listing, and travel bands for mobile listings.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const db = signedIn.supabase;
  const mine = await db
    .from("memberships")
    .select("organisation_id, role")
    .eq("user_id", signedIn.user.id)
    .eq("status", "active")
    .neq("role", "staff")
    .overrideTypes<
      { organisation_id: string; role: string }[],
      { merge: false }
    >();
  if (mine.error !== null) throwStatus(503, signedIn.headers);
  const orgIds = mine.data.map((m) => m.organisation_id);
  const wanted = new URL(request.url).searchParams.get("org");
  const org = orgIds.find((o) => o === wanted) ?? orgIds[0] ?? null;
  if (org === null) {
    return data(
      {
        csrf: context.security.csrfToken,
        org: null,
        orgIds,
        resources: [],
        hours: [],
        offers: [],
        listings: [],
        bands: [],
      },
      { headers: signedIn.headers },
    );
  }
  const [resources, hours, offers, listings, bands] = await Promise.all([
    db
      .from("resources")
      .select("id, kind, name, capacity, mobile, active")
      .eq("organisation_id", org)
      .order("created_at")
      .overrideTypes<Resource[], { merge: false }>(),
    db
      .from("resource_hours")
      .select("resource_id, weekday, opens, closes")
      .eq("organisation_id", org)
      .overrideTypes<Hours[], { merge: false }>(),
    db
      .from("service_offers")
      .select(
        "id, listing_public_id, name, pricing, price_minor, duration_minutes, buffer_minutes, resource_kind, active",
      )
      .eq("organisation_id", org)
      .order("created_at")
      .overrideTypes<Offer[], { merge: false }>(),
    db
      .from("listings")
      .select("public_id, display_name, mode")
      .eq("organisation_id", org)
      .overrideTypes<Listing[], { merge: false }>(),
    db
      .from("travel_bands")
      .select("id, listing_public_id, up_to_km, travel_minutes, charge_minor")
      .eq("organisation_id", org)
      .order("up_to_km")
      .overrideTypes<Band[], { merge: false }>(),
  ]);
  if (
    resources.error ||
    hours.error ||
    offers.error ||
    listings.error ||
    bands.error
  )
    throwStatus(503, signedIn.headers);
  return data(
    {
      csrf: context.security.csrfToken,
      org,
      orgIds,
      resources: resources.data,
      hours: hours.data,
      offers: offers.data,
      listings: listings.data,
      bands: bands.data,
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
  const org = field(form, "org");
  if (!UUID.test(org)) return fail("invalid_input");
  const optionalId = (name: string) => {
    const v = field(form, name);
    return v === "" ? null : UUID.test(v) ? v : false;
  };
  const db = signedIn.supabase;
  const intent = field(form, "intent");
  let error: { code?: string; message?: string } | null;

  if (intent === "resource") {
    const id = optionalId("resource");
    const name = parseText(form, "name", 1, 80);
    const kind = field(form, "kind");
    const capacity = parseIntIn(form, "capacity", 1, 50);
    if (
      id === false ||
      name === null ||
      !KINDS.includes(kind as Resource["kind"]) ||
      capacity === null
    )
      return fail("invalid_input");
    ({ error } = await rpc(db, "save_resource", {
      p_org: org,
      p_resource: id,
      p_kind: kind,
      p_name: name,
      p_capacity: capacity,
      p_mobile: form.get("mobile") === "on",
      p_active: form.get("active") !== "off",
    }));
  } else if (intent === "hours") {
    const id = field(form, "resource");
    if (!UUID.test(id)) return fail("invalid_input");
    const set: { weekday: number; opens: string; closes: string }[] = [];
    for (let d = 1; d <= 7; d++) {
      const opens = field(form, `opens_${String(d)}`).trim();
      const closes = field(form, `closes_${String(d)}`).trim();
      if (opens === "" && closes === "") continue;
      if (!TIME.test(opens) || !TIME.test(closes) || closes <= opens)
        return fail("invalid_input");
      set.push({ weekday: d, opens, closes });
    }
    ({ error } = await rpc(db, "set_resource_hours", {
      p_org: org,
      p_resource: id,
      p_hours: set,
    }));
  } else if (intent === "closure") {
    const id = field(form, "resource");
    const from = parseInstant(form, "from");
    const to = parseInstant(form, "to");
    const reason = parseOptionalText(form, "reason", 200);
    if (
      !UUID.test(id) ||
      from === null ||
      to === null ||
      to <= from ||
      reason === false
    )
      return fail("invalid_input");
    ({ error } = await rpc(db, "add_resource_closure", {
      p_org: org,
      p_resource: id,
      p_from: from,
      p_to: to,
      p_reason: reason ?? "",
    }));
  } else if (intent === "offer") {
    const id = optionalId("offer");
    const listing = field(form, "listing");
    const name = parseText(form, "name", 2, 80);
    const pricing = field(form, "pricing");
    const price = pricing === "fixed" ? parseRandToMinor(form, "price") : null;
    const duration = parseIntIn(form, "duration", 15, 1440);
    const buffer = parseIntIn(form, "buffer", 0, 240);
    const kind = field(form, "resource_kind");
    if (
      id === false ||
      !UUID.test(listing) ||
      name === null ||
      (pricing !== "fixed" && pricing !== "quote") ||
      (pricing === "fixed" && price === null) ||
      duration === null ||
      duration % 15 !== 0 ||
      buffer === null ||
      buffer % 5 !== 0 ||
      !KINDS.includes(kind as Resource["kind"])
    )
      return fail("invalid_input");
    ({ error } = await rpc(db, "save_service_offer", {
      p_org: org,
      p_offer: id,
      p_listing: listing,
      p_name: name,
      p_pricing: pricing,
      p_price_minor: price,
      p_duration: duration,
      p_buffer: buffer,
      p_resource_kind: kind,
      p_active: form.get("active") !== "off",
    }));
  } else if (intent === "band") {
    const listing = field(form, "listing");
    const km = Number(field(form, "up_to_km").replace(",", "."));
    const minutes = parseIntIn(form, "minutes", 0, 240);
    const charge =
      field(form, "charge").trim() === ""
        ? 0
        : parseRandToMinor(form, "charge");
    if (
      !UUID.test(listing) ||
      !(km > 0 && km <= 250) ||
      minutes === null ||
      minutes % 5 !== 0 ||
      charge === null
    )
      return fail("invalid_input");
    ({ error } = await rpc(db, "save_travel_band", {
      p_org: org,
      p_listing: listing,
      p_up_to_km: km,
      p_minutes: minutes,
      p_charge_minor: charge,
    }));
  } else {
    return fail("invalid_input");
  }
  if (error !== null) return fail(bookingProblem(error));
  return throwRedirect(`/provider/resources?org=${org}`, signedIn.headers);
}

function Base({
  csrf,
  org,
  intent,
}: {
  csrf: string;
  org: string;
  intent: string;
}) {
  return (
    <>
      <CsrfField token={csrf} />
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="intent" value={intent} />
    </>
  );
}

function KindSelect({
  id,
  name,
  value,
}: {
  id: string;
  name: string;
  value?: string;
}) {
  return (
    <div className="cx-field">
      <label htmlFor={id}>Kind</label>
      <select
        id={id}
        name={name}
        defaultValue={value ?? "bay"}
        className="cx-input"
      >
        <option value="bay">Bay (at the workshop)</option>
        <option value="team">Team (people)</option>
        <option value="calendar">Calendar (one person)</option>
      </select>
    </div>
  );
}

export default function Resources({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, org, orgIds, resources, hours, offers, listings, bands } =
    loaderData;
  if (org === null) {
    return (
      <PublicShell signedIn>
        <EmptyState title="Nothing to set up">
          Only owners and managers set up bookings.
        </EmptyState>
      </PublicShell>
    );
  }
  const mobileListings = listings.filter((l) => l.mode !== "fixed");
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[80ch] gap-6">
        <h1 className="type-title">Bays, hours and prices</h1>
        {orgIds.length > 1 ? (
          <ul className="flex flex-wrap gap-2">
            {orgIds.map((o, i) => (
              <li key={o}>
                <Link
                  to={`/provider/resources?org=${o}`}
                  aria-current={o === org ? "page" : undefined}
                  className="cx-chip"
                >
                  Business {i + 1}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't save.">
            {BOOKING_PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        ) : null}

        <section className="grid gap-3" aria-labelledby="res">
          <h2 id="res" className="type-label">
            Bays and teams
          </h2>
          {resources.map((r) => {
            const mine = hours.filter((h) => h.resource_id === r.id);
            return (
              <article
                key={r.id}
                className="grid gap-3 rounded-2xl bg-[var(--surface)] p-4"
              >
                <Form method="post" className="flex flex-wrap items-end gap-3">
                  <Base csrf={csrf} org={org} intent="resource" />
                  <input type="hidden" name="resource" value={r.id} />
                  <TextField
                    label="Name"
                    name="name"
                    defaultValue={r.name}
                    maxLength={80}
                    required
                  />
                  <KindSelect id={`k-${r.id}`} name="kind" value={r.kind} />
                  <TextField
                    label="Cars at once"
                    name="capacity"
                    inputMode="numeric"
                    defaultValue={String(r.capacity)}
                    required
                  />
                  <label className="type-body">
                    <input
                      type="checkbox"
                      name="mobile"
                      defaultChecked={r.mobile}
                    />{" "}
                    Travels to customers
                  </label>
                  <Button type="submit" variant="outline">
                    Save
                  </Button>
                </Form>
                <Form method="post" className="grid gap-2">
                  <Base csrf={csrf} org={org} intent="hours" />
                  <input type="hidden" name="resource" value={r.id} />
                  <p className="type-caption">
                    Weekly hours (leave a day blank when closed; public holidays
                    are closed automatically)
                  </p>
                  <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                    {WEEKDAYS.map((label, i) => {
                      const h = mine.find((x) => x.weekday === i + 1);
                      return [
                        <span key={`l${String(i)}`} className="type-body">
                          {label}
                        </span>,
                        <input
                          key={`o${String(i)}`}
                          aria-label={`${label} opens`}
                          name={`opens_${String(i + 1)}`}
                          type="time"
                          defaultValue={h?.opens.slice(0, 5) ?? ""}
                          className="cx-input"
                        />,
                        <input
                          key={`c${String(i)}`}
                          aria-label={`${label} closes`}
                          name={`closes_${String(i + 1)}`}
                          type="time"
                          defaultValue={h?.closes.slice(0, 5) ?? ""}
                          className="cx-input"
                        />,
                      ];
                    })}
                  </div>
                  <div>
                    <Button type="submit" variant="outline">
                      Save hours
                    </Button>
                  </div>
                </Form>
                <Form method="post" className="flex flex-wrap items-end gap-3">
                  <Base csrf={csrf} org={org} intent="closure" />
                  <input type="hidden" name="resource" value={r.id} />
                  <TextField
                    label="Closed from (e.g. 2026-12-24T12:00+02:00)"
                    name="from"
                    required
                  />
                  <TextField label="Until" name="to" required />
                  <TextField
                    label="Reason (optional)"
                    name="reason"
                    maxLength={200}
                  />
                  <Button type="submit" variant="outline">
                    Add closure
                  </Button>
                </Form>
              </article>
            );
          })}
          <Form
            method="post"
            className="flex flex-wrap items-end gap-3 rounded-2xl bg-[var(--surface)] p-4"
          >
            <Base csrf={csrf} org={org} intent="resource" />
            <TextField
              label="New bay or team"
              name="name"
              maxLength={80}
              required
            />
            <KindSelect id="k-new" name="kind" />
            <TextField
              label="Cars at once"
              name="capacity"
              inputMode="numeric"
              defaultValue="1"
              required
            />
            <label className="type-body">
              <input type="checkbox" name="mobile" /> Travels to customers
            </label>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </Form>
        </section>

        <section className="grid gap-3" aria-labelledby="off">
          <h2 id="off" className="type-label">
            Services you take bookings for
          </h2>
          {listings.length === 0 ? (
            <p className="type-body">Publish a listing first.</p>
          ) : null}
          {[...offers, null].map((o) => (
            <Form
              key={o?.id ?? "new"}
              method="post"
              className="flex flex-wrap items-end gap-3 rounded-2xl bg-[var(--surface)] p-4"
            >
              <Base csrf={csrf} org={org} intent="offer" />
              {o ? <input type="hidden" name="offer" value={o.id} /> : null}
              <div className="cx-field">
                <label htmlFor={`l-${o?.id ?? "new"}`}>Listing</label>
                <select
                  id={`l-${o?.id ?? "new"}`}
                  name="listing"
                  defaultValue={o?.listing_public_id}
                  className="cx-input"
                >
                  {listings.map((l) => (
                    <option key={l.public_id} value={l.public_id}>
                      {l.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                label={o ? "Service" : "New service"}
                name="name"
                defaultValue={o?.name ?? ""}
                maxLength={80}
                required
              />
              <div className="cx-field">
                <label htmlFor={`p-${o?.id ?? "new"}`}>Price</label>
                <select
                  id={`p-${o?.id ?? "new"}`}
                  name="pricing"
                  defaultValue={o?.pricing ?? "fixed"}
                  className="cx-input"
                >
                  <option value="fixed">Fixed price</option>
                  <option value="quote">Quote first</option>
                </select>
              </div>
              <TextField
                label="Price (R, fixed only)"
                name="price"
                inputMode="decimal"
                defaultValue={
                  o?.price_minor ? (o.price_minor / 100).toFixed(2) : ""
                }
              />
              <TextField
                label="Minutes (steps of 15)"
                name="duration"
                inputMode="numeric"
                defaultValue={String(o?.duration_minutes ?? 60)}
                required
              />
              <TextField
                label="Clean-up minutes"
                name="buffer"
                inputMode="numeric"
                defaultValue={String(o?.buffer_minutes ?? 0)}
                required
              />
              <KindSelect
                id={`rk-${o?.id ?? "new"}`}
                name="resource_kind"
                value={o?.resource_kind}
              />
              <Button
                type="submit"
                variant={o ? "outline" : "primary"}
                disabled={listings.length === 0}
              >
                {o ? "Save" : "Add"}
              </Button>
              {o ? (
                <span className="type-caption">
                  {o.pricing === "fixed" ? rand(o.price_minor) : "quote"}
                </span>
              ) : null}
            </Form>
          ))}
        </section>

        {mobileListings.length > 0 ? (
          <section className="grid gap-3" aria-labelledby="band">
            <h2 id="band" className="type-label">
              Travel (mobile listings)
            </h2>
            <ul className="grid gap-1">
              {bands.map((b) => (
                <li key={b.id} className="type-body">
                  Up to {b.up_to_km} km: {b.travel_minutes} min each way,{" "}
                  {rand(b.charge_minor)}
                </li>
              ))}
            </ul>
            <Form
              method="post"
              className="flex flex-wrap items-end gap-3 rounded-2xl bg-[var(--surface)] p-4"
            >
              <Base csrf={csrf} org={org} intent="band" />
              <div className="cx-field">
                <label htmlFor="band-l">Listing</label>
                <select id="band-l" name="listing" className="cx-input">
                  {mobileListings.map((l) => (
                    <option key={l.public_id} value={l.public_id}>
                      {l.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                label="Up to (km, straight line)"
                name="up_to_km"
                inputMode="decimal"
                required
              />
              <TextField
                label="Travel minutes (steps of 5)"
                name="minutes"
                inputMode="numeric"
                required
              />
              <TextField label="Charge (R)" name="charge" inputMode="decimal" />
              <Button type="submit" variant="primary">
                Save band
              </Button>
            </Form>
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}
