import { useEffect, useRef, useState } from "react";
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
import { getSignedIn, hasSessionCookie } from "../auth/session.server";
import { CatalogueUnavailable, listingById } from "../server/catalogue/public";
import { forgetDraft, keepDraft, readDraft } from "../server/forms/draft";
import { NOTICE_VERSION, parseEnquiry } from "../server/forms/parse";
import { formAction, formHeaders } from "../server/forms/route.server";
import {
  PROBLEM_TEXT,
  siteKeyFor,
  type FormsEnv,
  type Problem,
} from "../server/forms/submit";
import { UUID } from "../server/providers/forms";
import { EnquiryGate, useEnquiryDraft } from "../sites/EnquiryGate";
import gateCss from "../sites/gate.css?url";
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
  // D-097: enquiries need an account. Only a request with a session cookie
  // costs an Auth round trip; the account is shown as "Sending as".
  const signedIn = hasSessionCookie(request)
    ? await getSignedIn(request, context.security)
    : null;
  const sender = signedIn?.user.email ? { email: signedIn.user.email } : null;
  return data(
    {
      listing,
      hours: opening,
      today: localClock(now).day,
      status: openStatus(opening ?? [], now),
      csrf: context.security.csrfToken,
      siteKey: siteKeyFor(context.cloudflare.env as FormsEnv, config),
      sent: new URL(request.url).searchParams.get("sent") === "1",
      sender,
      // A message kept through sign-in without JavaScript (server/forms/draft).
      draft: readDraft(request, params.publicId),
    },
    {
      headers: (() => {
        const h = new Headers(signedIn?.headers);
        h.set("Cache-Control", "private, no-store");
        return h;
      })(),
    },
  );
}

/**
 * Enquiry (P2-5, D-097): account -> limiter -> parse -> Turnstile ->
 * forms_server. The sender is the account the Auth server just validated;
 * its id goes to the database explicitly (forms_server has no auth.uid()).
 * Signed out, nothing is written and the page shows the sign-in step with
 * the message still in the box.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await getSignedIn(request, context.security);
  if (signedIn === null) {
    const form = await request.clone().formData();
    const field = form.get("message");
    const message = typeof field === "string" ? field.slice(0, 1000) : "";
    const problem: Problem = "account_required";
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    const kept = keepDraft(params.publicId, message);
    if (kept) headers.append("Set-Cookie", kept);
    return data({ problem, message }, { status: 401, headers });
  }
  const userId = signedIn.user.id;
  const problem = await formAction(
    request,
    context,
    "enquiry",
    parseEnquiry,
    (db, enquiry) =>
      db.enquiry(params.publicId, userId, enquiry, NOTICE_VERSION),
  );
  // Keep any session cookies the Auth check refreshed.
  const refreshed = signedIn.headers.getSetCookie();
  if (problem) {
    const headers = problem.init?.headers;
    if (headers instanceof Headers)
      for (const cookie of refreshed) headers.append("Set-Cookie", cookie);
    return problem;
  }
  // Sent: the kept draft is no longer needed.
  signedIn.headers.append("Set-Cookie", forgetDraft());
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw redirect(`/p/${params.publicId}?sent=1#enquiry`, {
    headers: signedIn.headers,
  });
}

export const headers: Route.HeadersFunction = formHeaders;

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData.listing.display_name} · CarworX`,
    },
  ];
}

export const links: Route.LinksFunction = () => [
  ...SITES_LINKS,
  { rel: "stylesheet", href: gateCss },
];

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
              Send a message from your free account. The business replies to
              your account email. Nothing is booked or paid through CarworX.
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
            <Sent
              listingId={listing.public_id}
              provider={listing.display_name}
            />
          ) : loaderData.siteKey === null ? (
            <div className="notice" role="status">
              <strong>Messages aren't available right now.</strong> Please try
              again later.
            </div>
          ) : loaderData.sender ? (
            <EnquiryForm
              csrf={loaderData.csrf}
              siteKey={loaderData.siteKey}
              provider={listing.display_name}
              listingId={listing.public_id}
              sender={loaderData.sender.email}
              problem={actionData?.problem}
              keptDraft={loaderData.draft}
            />
          ) : (
            <SignedOutEnquiry
              csrf={loaderData.csrf}
              provider={listing.display_name}
              listingId={listing.public_id}
              asked={actionData?.problem === "account_required"}
              message={
                actionData &&
                "message" in actionData &&
                typeof actionData.message === "string"
                  ? actionData.message
                  : loaderData.draft
              }
            />
          )}
        </aside>
      </div>
    </SitesShell>
  );
}

/** Sent: the kept draft is no longer needed. */
function Sent({
  listingId,
  provider,
}: {
  listingId: string;
  provider: string;
}) {
  const draft = useEnquiryDraft(listingId);
  useEffect(() => {
    draft.clear();
  }, [draft]);
  return (
    <div className="notice green" role="status">
      <strong>Message sent.</strong> We've passed it to {provider}. They'll
      reply to your account email.
    </div>
  );
}

/**
 * D-097: signed out, the visitor can still write their message. "Send
 * enquiry" keeps it in this browser and opens the sign-in step; without
 * JavaScript the post comes back with the step open and the message kept.
 */
function SignedOutEnquiry({
  csrf,
  provider,
  listingId,
  asked,
  message,
}: {
  csrf: string;
  provider: string;
  listingId: string;
  asked: boolean;
  message: string;
}) {
  const [open, setOpen] = useState(asked);
  const draft = useEnquiryDraft(listingId);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!box.current) return;
    // Just answered a post: that text is the newest, so keep it here too.
    if (asked) {
      draft.save(box.current.value);
      return;
    }
    // Otherwise this browser's draft (saved on every send) is the newest; it
    // wins over text the server kept from an earlier post.
    const kept = draft.restore();
    if (kept) box.current.value = kept;
  }, [draft, asked]);
  return (
    <>
      <form
        method="post"
        data-form="enquiry"
        onSubmit={(event) => {
          event.preventDefault();
          draft.save(box.current?.value ?? "");
          setOpen(true);
        }}
      >
        <CsrfField token={csrf} />
        <div className="field">
          <label htmlFor="enquiry-message">Your message</label>
          <textarea
            ref={box}
            id="enquiry-message"
            name="message"
            maxLength={1000}
            rows={5}
            defaultValue={message}
            placeholder="Your message…"
            aria-describedby="enquiry-message-hint"
          />
          <span id="enquiry-message-hint" className="small muted">
            Say what you need. Don't include ID numbers or bank details.
          </span>
        </div>
        <button className="btn" type="submit">
          Send enquiry →
        </button>
        <p className="small muted">
          Free to browse. A free account is needed to send an enquiry.
        </p>
      </form>
      <EnquiryGate
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        provider={provider}
        returnTo={`/p/${listingId}#enquiry`}
      />
    </>
  );
}

function EnquiryForm({
  csrf,
  siteKey,
  provider,
  listingId,
  sender,
  problem,
  keptDraft,
}: {
  csrf: string;
  siteKey: string;
  provider: string;
  listingId: string;
  sender: string;
  problem: Problem | undefined;
  /** The message kept through sign-in by the server ("" for none). */
  keptDraft: string;
}) {
  const draft = useEnquiryDraft(listingId);
  const box = useRef<HTMLTextAreaElement>(null);
  const [kept, setKept] = useState(keptDraft !== "");
  useEffect(() => {
    // This browser's draft (saved on every send) is newer than any text the
    // server kept from an earlier post without JavaScript, so it wins.
    const message = draft.restore();
    if (box.current && message) {
      if (box.current.value !== message) box.current.value = message;
      setKept(true);
    }
  }, [draft]);
  return (
    <form
      method="post"
      data-form="enquiry"
      onSubmit={() => {
        draft.save(box.current?.value ?? "");
      }}
    >
      <CsrfField token={csrf} />
      {problem ? (
        <div className="notice" data-problem={problem} role="alert">
          <strong>We couldn't send your message.</strong>{" "}
          {PROBLEM_TEXT[problem]}
        </div>
      ) : null}
      {kept ? (
        <div className="notice blue" role="status">
          Your message is kept. Check it and send.
        </div>
      ) : null}
      <p className="small muted">
        Sending as <strong>{sender}</strong>. {provider} replies to this
        address.
      </p>
      <div className="field">
        <label htmlFor="enquiry-message">Your message</label>
        <textarea
          ref={box}
          id="enquiry-message"
          name="message"
          defaultValue={keptDraft}
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
        Send enquiry →
      </button>
    </form>
  );
}
