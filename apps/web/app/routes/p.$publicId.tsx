import { data, redirect } from "react-router";

import {
  dayName,
  localClock,
  openStatus,
  statusText,
  timeLabel,
  type HoursRow,
} from "../catalogue/hours";
import { topCategoryOf } from "../catalogue/taxonomy";
import { CsrfField } from "../auth/ui";
import { CatalogueUnavailable, listingById } from "../server/catalogue/public";
import { NOTICE_VERSION, parseEnquiry } from "../server/forms/parse";
import { formAction, formHeaders } from "../server/forms/route.server";
import {
  PROBLEM_TEXT,
  siteKeyFor,
  type FormsEnv,
  type Problem,
} from "../server/forms/submit";
import { UUID } from "../server/providers/forms";
import { SITES_LINKS, SitesShell } from "../sites/SitesShell";
import { HumanCheck } from "../ui/public/HumanCheck";
import type { Route } from "./+types/p.$publicId";

function unavailable(): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw data(null, { status: 503, headers: { "Cache-Control": "no-store" } });
}

interface HoursEnv {
  CATALOGUE_DB?: { connectionString?: unknown };
}

/**
 * Opening hours through the scoped catalogue_server login. Never fails the
 * page: no binding, a slow database or odd rows all mean "not available
 * right now" (null), which is different from "not provided" ([]).
 */
async function hoursFor(env: HoursEnv, id: string): Promise<HoursRow[] | null> {
  const connection = env.CATALOGUE_DB?.connectionString;
  if (typeof connection !== "string" || !connection || !UUID.test(id))
    return null;
  try {
    const { createHoursReader } = await import("../server/catalogue/hours");
    return await createHoursReader(connection)(id);
  } catch {
    return null;
  }
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const config = context.security.config;
  if (!config) unavailable();
  let listing;
  const hours = hoursFor(context.cloudflare.env, params.publicId);
  try {
    listing = await listingById(config, params.publicId);
  } catch (error) {
    if (error instanceof CatalogueUnavailable) unavailable();
    throw error;
  }
  if (!listing) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw data(null, { status: 404 });
  }
  // The page carries a CSRF token in its enquiry form, so it is never cached,
  // and the open-now line is worked out fresh, in South African time.
  const now = new Date();
  const opening = await hours;
  return data(
    {
      listing,
      hours: opening,
      today: localClock(now).day,
      status: openStatus(opening ?? [], now),
      csrf: context.security.csrfToken,
      siteKey: siteKeyFor(context.cloudflare.env as FormsEnv, config),
      sent: new URL(request.url).searchParams.get("sent") === "1",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Enquiry (P2-5): limiter -> parse -> Turnstile -> forms_server. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const problem = await formAction(
    request,
    context,
    "enquiry",
    parseEnquiry,
    (db, enquiry) => db.enquiry(params.publicId, enquiry, NOTICE_VERSION),
  );
  if (problem) return problem;
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw redirect(`/p/${params.publicId}?sent=1#enquiry`);
}

export const headers: Route.HeadersFunction = formHeaders;

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData.listing.display_name} · CarworX`,
    },
  ];
}

export const links: Route.LinksFunction = () => [...SITES_LINKS];

/** The preview's listing view (app.js `listing()`), with the real listing. */
export default function ListingPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { listing, hours, today, status } = loaderData;
  const category = topCategoryOf(listing.category_slug);
  const mode =
    listing.mode === "fixed"
      ? "Workshop you visit"
      : listing.mode === "both"
        ? "Workshop · also comes to you"
        : "Comes to you";
  const now = statusText(status);
  return (
    <SitesShell>
      <a className="back" href={category ? `/c/${category.slug}` : "/search"}>
        ← {category ? category.label : "Find a service"}
      </a>
      <div className="eyebrow">
        {category ? `${category.label} · ` : ""}
        {listing.metro}
      </div>
      <h1 className="title">{listing.display_name}</h1>
      <p className="lead">{listing.description}</p>
      <div className="bar">
        {listing.verification_labels.map((label) => (
          <span key={label} className="tag green">
            {label}
          </span>
        ))}
        <span className="tag gray">{mode}</span>
        {now ? <span className="tag gray">{now}</span> : null}
      </div>
      <div className="layout">
        <div className="stack">
          <article className="card">
            <h2>Services</h2>
            <p className="muted">
              Ask the business for a price. You agree it with them directly.
            </p>
            <hr className="rule" />
            <div className="between">
              <div>
                <h3>{listing.service_name}</h3>
                <p className="muted small">
                  {category ? category.label : "Car service"}
                </p>
              </div>
              <strong>Ask for a price</strong>
            </div>
          </article>
          <article className="card">
            <h2>Where</h2>
            {listing.mode === "fixed" ? (
              <p>
                <strong>Visit the workshop.</strong> {listing.public_address} ·{" "}
                {listing.metro}
              </p>
            ) : listing.mode === "both" ? (
              <p>
                <strong>Visit the workshop, or it comes to you.</strong>{" "}
                {listing.public_address} · {listing.metro}. It also serves an
                area nearby; the provider confirms your exact address before any
                booking.
              </p>
            ) : (
              <p>
                <strong>Comes to you.</strong> Serves an area in {listing.metro}
                . Coverage is approximate; the provider confirms your exact
                address before any booking.
              </p>
            )}
          </article>
          <article
            className="card summary"
            id="hours"
            aria-labelledby="hours-h"
          >
            <h2 id="hours-h">Opening hours</h2>
            {hours === null ? (
              <p>Opening hours aren't available right now.</p>
            ) : hours.length === 0 ? (
              <p>Hours not provided.</p>
            ) : (
              <>
                {now ? (
                  <p data-open-status={status.kind}>
                    <strong>{now}</strong>
                  </p>
                ) : null}
                <table className="hours-table">
                  <caption className="cx-vh">Opening hours by day</caption>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const row = hours.find((h) => h.day === day);
                      const isToday = day === today;
                      return (
                        <tr
                          key={day}
                          {...(isToday
                            ? { "aria-current": "date" as const }
                            : {})}
                        >
                          <th scope="row">
                            {dayName(day)}
                            {isToday ? (
                              <>
                                {" "}
                                <span className="tag">Today</span>
                              </>
                            ) : null}
                          </th>
                          <td>
                            {row
                              ? `${row.opens} – ${timeLabel(row.closes)}`
                              : "Closed"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <hr className="rule" />
                <p className="muted small">
                  Times are South African time. Public holiday hours may differ;
                  check with the business before you travel.
                </p>
              </>
            )}
          </article>
          <article className="card">
            <h2>What CarworX checked</h2>
            {listing.verification_labels.length > 0 ? (
              <div className="bar">
                {listing.verification_labels.map((label) => (
                  <span key={label} className="tag green">
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p>No checks are recorded for this listing yet.</p>
            )}
            <p className="muted small">
              We only show a label for a check we actually did.
            </p>
          </article>
          <article className="card">
            <h2>What happens next?</h2>
            <p>
              Send a message. The business replies to the email you give.
              Nothing is booked or paid through CarworX.
            </p>
          </article>
          <p className="small">
            <a href={`/provider/claim/${listing.public_id}`}>
              Is this your business? Claim this listing
            </a>
          </p>
        </div>
        <aside className="card" id="enquiry" aria-labelledby="enquiry-h">
          <span className="eyebrow">Send a message</span>
          <h2 id="enquiry-h">Send {listing.display_name} a message</h2>
          {loaderData.sent ? (
            <div className="notice green" role="status">
              <strong>Message sent.</strong> We've passed it to{" "}
              {listing.display_name}. They'll reply to the email you gave.
            </div>
          ) : loaderData.siteKey === null ? (
            <div className="notice" role="status">
              <strong>Messages aren't available right now.</strong> Please try
              again later.
            </div>
          ) : (
            <EnquiryForm
              csrf={loaderData.csrf}
              siteKey={loaderData.siteKey}
              provider={listing.display_name}
              problem={actionData?.problem}
            />
          )}
        </aside>
      </div>
    </SitesShell>
  );
}

function EnquiryForm({
  csrf,
  siteKey,
  provider,
  problem,
}: {
  csrf: string;
  siteKey: string;
  provider: string;
  problem: Problem | undefined;
}) {
  return (
    <form method="post" data-form="enquiry">
      <CsrfField token={csrf} />
      {problem ? (
        <div className="notice" data-problem={problem} role="alert">
          <strong>We couldn't send your message.</strong>{" "}
          {PROBLEM_TEXT[problem]}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="enquiry-name">Your name</label>
        <input
          id="enquiry-name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="field">
        <label htmlFor="enquiry-email">Your email</label>
        <input
          id="enquiry-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          aria-describedby="enquiry-email-hint"
        />
        <span id="enquiry-email-hint" className="small muted">
          The provider replies to this address.
        </span>
      </div>
      <div className="field">
        <label htmlFor="enquiry-message">Your message</label>
        <textarea
          id="enquiry-message"
          name="message"
          required
          minLength={10}
          maxLength={1000}
          rows={5}
          aria-describedby="enquiry-message-hint"
        />
        <span id="enquiry-message-hint" className="small muted">
          Say what you need. Don't include ID numbers or bank details.
        </span>
      </div>
      <label className="row small" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" name="consent" required />
        <span>
          Share my name, email and message with {provider} so they can reply.
          CarworX keeps a copy for 12 months, on servers outside South Africa.
        </span>
      </label>
      <div style={{ margin: "16px 0" }}>
        <HumanCheck siteKey={siteKey} action="enquiry" />
      </div>
      <button className="btn" type="submit">
        Send message →
      </button>
    </form>
  );
}
