/**
 * /p/:publicId/review: write or edit your one review of a business (A8, B-23).
 * Signed out, the visitor goes to sign-in and comes back here. Only a customer
 * who has messaged the business can post; anyone else sees "Message them first".
 */
import { data, Form, Link } from "react-router";

import { throwRedirect, throwStatus } from "../auth/http.server";
import { getSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { PublicShell } from "../ui/public/PublicShell";
import { StatusNote } from "../ui/Note";
import { listingById } from "../server/catalogue/public";
import {
  canReview,
  deleteMyReview,
  myReview,
  reviewFailureText,
  saveReview,
} from "../server/reviews/reviews.server";
import type { Route } from "./+types/p.$publicId.review";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: `Review ${loaderData.business} · CarworX`,
  },
];

const WORDS = ["Poor", "Fair", "Okay", "Good", "Great"] as const;
const BODY_MIN = 20;
const BODY_MAX = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const config = context.security.config;
  if (!config) throwStatus(503);
  const listing = await listingById(config, params.publicId);
  if (!listing) throwStatus(404);
  const signedIn = await getSignedIn(request, context.security);
  const here = new URL(request.url).pathname;
  if (signedIn === null)
    throwRedirect(`/auth/sign-in?returnTo=${encodeURIComponent(here)}`);
  const headers = signedIn.headers;
  headers.set("Cache-Control", "private, no-store");

  const can = await canReview(signedIn.supabase, params.publicId);
  const mine = await myReview(signedIn.supabase, params.publicId);
  return data(
    {
      csrf: context.security.csrfToken,
      business: listing.display_name,
      listingId: listing.public_id,
      eligible: can.ok ? can.value : false,
      failed: !can.ok || !mine.ok,
      mine: mine.ok ? mine.value : null,
      services: listing.service_name
        ? [{ slug: listing.service_slug, name: listing.service_name }]
        : [],
    },
    { headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const config = context.security.config;
  if (!config) throwStatus(503);
  const signedIn = await getSignedIn(request, context.security);
  if (signedIn === null)
    throwRedirect(
      `/auth/sign-in?returnTo=${encodeURIComponent(`/p/${params.publicId}/review`)}`,
    );
  const headers = signedIn.headers;
  headers.set("Cache-Control", "private, no-store");
  const form = await request.formData();
  const intent = form.get("intent");
  const back = `/p/${params.publicId}#reviews`;

  if (intent === "delete") {
    const id = form.get("review");
    if (typeof id !== "string" || !UUID.test(id))
      return data(
        { problem: reviewFailureText("invalid") },
        { status: 400, headers },
      );
    const gone = await deleteMyReview(signedIn.supabase, id);
    if (!gone.ok)
      return data(
        { problem: reviewFailureText(gone.reason) },
        { status: 409, headers },
      );
    throwRedirect(back, headers);
  }

  if (intent !== "save")
    return data(
      { problem: reviewFailureText("invalid") },
      { status: 400, headers },
    );
  const rating = Number(form.get("rating"));
  const rawBody = form.get("body");
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  const service = form.get("service");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return data(
      { problem: "Choose a rating from 1 to 5.", field: "rating" },
      { status: 400, headers },
    );
  if (body.length < BODY_MIN || body.length > BODY_MAX)
    return data(
      {
        problem: `Your review should be ${String(BODY_MIN)} to ${String(BODY_MAX)} characters.`,
        field: "body",
      },
      { status: 400, headers },
    );
  const saved = await saveReview(signedIn.supabase, {
    listing: params.publicId,
    rating,
    body,
    service: typeof service === "string" && service !== "" ? service : null,
  });
  if (!saved.ok)
    return data(
      { problem: reviewFailureText(saved.reason) },
      { status: 409, headers },
    );
  throwRedirect(back, headers);
}

export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
  const headers = new Headers(loaderHeaders);
  for (const cookie of actionHeaders.getSetCookie())
    headers.append("Set-Cookie", cookie);
  headers.set("Cache-Control", "private, no-store");
  return headers;
}

export default function WriteReview({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, business, listingId, eligible, failed, mine, services } =
    loaderData;
  const back = `/p/${listingId}`;
  const problem = actionData?.problem;
  return (
    <PublicShell signedIn>
      <section className="cx-review-write card" aria-labelledby="review-h">
        <p>
          <Link to={back}>← Back to {business}</Link>
        </p>
        {failed ? (
          <StatusNote
            tone="warn"
            title="We couldn't load your review just now."
          >
            Try again in a moment.
          </StatusNote>
        ) : !eligible && mine === null ? (
          <div>
            <h1 id="review-h">Message them first.</h1>
            <p>
              Only customers who contacted {business} through CarworX can review
              it. That keeps reviews from real customers.
            </p>
            <p>
              <Link to={`${back}#enquiry`} className="pill">
                Send a message
              </Link>{" "}
              <Link to={back}>Back to {business}</Link>
            </p>
          </div>
        ) : (
          <>
            <h1 id="review-h">How was {business}?</h1>
            <p className="small muted">
              Your review shows your first name and initial. One review per
              business. You can edit it later; we show &ldquo;Edited&rdquo; and
              the date.
            </p>
            {problem ? (
              <StatusNote tone="err" title="That didn't save.">
                {problem}
              </StatusNote>
            ) : null}
            <Form method="post" className="cx-review-form">
              <CsrfField token={csrf} />
              <input type="hidden" name="intent" value="save" />
              <fieldset>
                <legend>Your rating</legend>
                {[5, 4, 3, 2, 1].map((stars) => (
                  <label key={stars} className="star-option">
                    <input
                      type="radio"
                      name="rating"
                      value={stars}
                      defaultChecked={mine?.rating === stars}
                      required
                    />{" "}
                    {stars} · {WORDS[stars - 1]}
                  </label>
                ))}
              </fieldset>
              {services.length > 0 ? (
                <label>
                  Which service? (optional)
                  <select
                    name="service"
                    defaultValue={mine?.service_slug ?? ""}
                  >
                    <option value="">Not sure</option>
                    {services.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Your review
                <textarea
                  name="body"
                  required
                  minLength={BODY_MIN}
                  maxLength={BODY_MAX}
                  rows={6}
                  defaultValue={mine?.body ?? ""}
                />
              </label>
              <p className="small muted">
                Say what happened, not who. {String(BODY_MIN)} to{" "}
                {String(BODY_MAX)} characters.
              </p>
              <button type="submit">
                {mine ? "Save changes" : "Post review"}
              </button>
            </Form>
            {mine ? (
              <Form method="post" className="cx-review-delete">
                <CsrfField token={csrf} />
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="review" value={mine.id} />
                <button type="submit" className="link-button">
                  Delete my review
                </button>
              </Form>
            ) : null}
          </>
        )}
      </section>
    </PublicShell>
  );
}
