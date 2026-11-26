/**
 * /provider/reviews: owners and managers answer reviews with one public reply
 * each (A8). The reply RPC checks the role and org MFA; this page only shows
 * the reviews of the listings the signed-in member controls.
 */
import { data, Form } from "react-router";

import { throwRedirect } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  replyToReview,
  reviewFailureText,
  reviewsForListings,
  type Review,
} from "../server/reviews/reviews.server";
import { Button } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.reviews";

export const meta: Route.MetaFunction = () => [
  { title: "Reviews · CarworX" },
  { name: "robots", content: "noindex" },
];

const REPLY_MIN = 10;
const REPLY_MAX = 1000;

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const db = signedIn.supabase;
  const memberships = await db
    .from("memberships")
    .select("organisation_id, role")
    .eq("user_id", signedIn.user.id)
    .eq("status", "active");
  if (memberships.error !== null)
    return data(
      {
        listings: [],
        reviews: [],
        csrf: context.security.csrfToken,
        tab: "needs",
        failed: true,
      },
      { headers: signedIn.headers },
    );
  const orgs = (memberships.data as { organisation_id: string; role: string }[])
    .filter((m) => m.role !== "staff")
    .map((m) => m.organisation_id);
  const listings =
    orgs.length === 0
      ? { data: [], error: null }
      : await db
          .from("listings")
          .select("public_id, display_name")
          .in("organisation_id", orgs);
  if (listings.error !== null)
    return data(
      {
        listings: [],
        reviews: [],
        csrf: context.security.csrfToken,
        tab: "needs",
        failed: true,
      },
      { headers: signedIn.headers },
    );
  const names = new Map(
    (listings.data as { public_id: string; display_name: string }[]).map(
      (l) => [l.public_id, l.display_name],
    ),
  );
  const reviews = await reviewsForListings(db, [...names.keys()]);
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") === "all" ? "all" : "needs";
  if (!reviews.ok)
    return data(
      {
        listings: [],
        reviews: [],
        csrf: context.security.csrfToken,
        tab,
        failed: true,
      },
      { headers: signedIn.headers },
    );
  const shown = reviews.value
    .filter((r) => tab === "all" || r.reply === null)
    .map((r) => ({ ...r, listing_name: names.get(r.listing_public_id) ?? "" }));
  return data(
    {
      listings: [...names.values()],
      reviews: shown,
      csrf: context.security.csrfToken,
      tab,
      failed: false,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const form = await request.formData();
  const id = form.get("review");
  const rawBody = form.get("body");
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (
    typeof id !== "string" ||
    body.length < REPLY_MIN ||
    body.length > REPLY_MAX
  )
    return data(
      {
        problem: `Your reply should be ${String(REPLY_MIN)} to ${String(REPLY_MAX)} characters.`,
      },
      { status: 400, headers: signedIn.headers },
    );
  const saved = await replyToReview(signedIn.supabase, id, body);
  if (!saved.ok)
    return data(
      { problem: reviewFailureText(saved.reason) },
      { status: 409, headers: signedIn.headers },
    );
  throwRedirect("/provider/reviews", signedIn.headers);
}

export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
  const headers = new Headers(loaderHeaders);
  for (const cookie of actionHeaders.getSetCookie())
    headers.append("Set-Cookie", cookie);
  headers.set("Cache-Control", "private, no-store");
  return headers;
}

function ReplyBox({
  review,
  csrf,
}: {
  review: Review & { listing_name: string };
  csrf: string;
}) {
  const editing = review.reply !== null;
  return (
    <Form method="post" className="cx-review-reply-form">
      <CsrfField token={csrf} />
      <input type="hidden" name="review" value={review.id} />
      <label>
        Your public reply
        <textarea
          name="body"
          required
          minLength={REPLY_MIN}
          maxLength={REPLY_MAX}
          rows={4}
          defaultValue={review.reply?.body ?? ""}
        />
      </label>
      <p className="type-caption">
        Shows as &ldquo;Reply from {review.listing_name}&rdquo;. You can edit
        it, not add a second one.
      </p>
      <Button type="submit" variant="primary">
        {editing ? "Edit reply" : "Post reply"}
      </Button>
    </Form>
  );
}

export default function ProviderReviews({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { reviews, csrf, tab, failed } = loaderData;
  return (
    <PublicShell signedIn>
      <section className="cx-provider-reviews" aria-labelledby="reviews-h">
        <h1 id="reviews-h">Reviews</h1>
        <p>
          One public reply per review. Keep it short and polite; customers read
          replies as much as reviews.
        </p>
        <nav aria-label="Reviews tabs">
          <a
            href="/provider/reviews"
            aria-current={tab === "needs" ? "true" : undefined}
          >
            Needs a reply
          </a>{" "}
          <a
            href="/provider/reviews?tab=all"
            aria-current={tab === "all" ? "true" : undefined}
          >
            All
          </a>
        </nav>
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't save.">
            {actionData.problem}
          </StatusNote>
        ) : null}
        {failed ? (
          <p role="alert">
            We couldn&apos;t load your reviews. Try again in a moment.
          </p>
        ) : reviews.length === 0 ? (
          <p>
            {tab === "needs"
              ? "Nothing needs a reply right now."
              : "No reviews yet."}
          </p>
        ) : (
          reviews.map((review) => (
            <article
              key={review.id}
              className="review-item"
              aria-labelledby={`r-${review.id}`}
            >
              <h2 id={`r-${review.id}`}>
                {review.author_display} · {review.rating} / 5 ·{" "}
                {review.listing_name}
              </h2>
              <p>{review.body}</p>
              {review.reply ? (
                <p className="small muted">Your reply: {review.reply.body}</p>
              ) : null}
              <ReplyBox review={review} csrf={csrf} />
            </article>
          ))
        )}
      </section>
    </PublicShell>
  );
}
