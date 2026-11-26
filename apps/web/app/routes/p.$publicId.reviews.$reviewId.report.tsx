/**
 * /p/:publicId/reviews/:reviewId/report: report a review (A8). The reviewer is
 * never told who reported it. Signed out, the visitor goes to sign-in first.
 */
import { data, Link } from "react-router";

import { throwRedirect } from "../auth/http.server";
import { getSignedIn } from "../auth/session.server";
import {
  reportReview,
  reviewFailureText,
} from "../server/reviews/reviews.server";
import { reportText } from "../reviews/report";
import { PublicShell } from "../ui/public/PublicShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/p.$publicId.reviews.$reviewId.report";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loader({ params }: Route.LoaderArgs) {
  throwRedirect(`/p/${params.publicId}#reviews`);
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const here = `/p/${params.publicId}/reviews/${params.reviewId}/report`;
  const signedIn = await getSignedIn(request, context.security);
  if (signedIn === null)
    throwRedirect(`/auth/sign-in?returnTo=${encodeURIComponent(here)}`);
  const form = await request.formData();
  const choice = form.get("reason");
  const note = form.get("note");
  const reason = reportText(
    typeof choice === "string" ? choice : "",
    typeof note === "string" ? note : null,
  );
  if (!UUID.test(params.reviewId) || reason === null)
    return data(
      { problem: "Choose a reason. For “Something else”, say what is wrong." },
      { status: 400, headers: signedIn.headers },
    );
  const saved = await reportReview(signedIn.supabase, params.reviewId, reason);
  if (!saved.ok)
    return data(
      { problem: reviewFailureText(saved.reason) },
      { status: 409, headers: signedIn.headers },
    );
  throwRedirect(`/p/${params.publicId}?reported=1#reviews`, signedIn.headers);
}

/** A failed report comes back here: say why, and let the visitor go back and correct it. */
export default function ReportProblem({
  actionData,
  params,
}: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <section className="card" aria-labelledby="report-h">
        <h1 id="report-h">Report this review</h1>
        <StatusNote tone="err" title="That report didn't send.">
          {actionData?.problem ?? "Try again in a moment."}
        </StatusNote>
        <p>
          <Link to={`/p/${params.publicId}#reviews`}>Back to the reviews</Link>
        </p>
      </section>
    </PublicShell>
  );
}
