/**
 * /admin/reviews/:id: one reported review and the decision. Hiding needs a
 * reason from the admin; both sides get an email with it (the RPC records it).
 */
import { data, Link } from "react-router";

import { throwRedirect } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import { requireAdmin } from "../server/providers/admin.server";
import {
  adminModerateReview,
  adminReviewQueue,
  type ModerationDecision,
} from "../server/reviews/reviews.server";
import { AdminShell } from "../ui/admin/AdminShell";
import { Button } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.reviews.$id";

export const meta: Route.MetaFunction = () => [
  { title: "Reported review · Admin · CarworX" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS: readonly ModerationDecision[] = ["hide", "dismiss"];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  if (!UUID.test(params.id)) throwRedirect("/admin/reviews");
  const admin = await requireAdmin(request, context.security);
  const queue = await adminReviewQueue(admin.supabase);
  const row = queue.ok
    ? (queue.value.find((r) => r.id === params.id) ?? null)
    : null;
  if (row === null) throwRedirect("/admin/reviews", admin.headers);
  return data(
    { csrf: context.security.csrfToken, row },
    { headers: admin.headers },
  );
}

export async function action({ request, context, params }: Route.ActionArgs) {
  if (!UUID.test(params.id)) throwRedirect("/admin/reviews");
  const admin = await requireAdmin(request, context.security);
  const form = await request.formData();
  const intent = form.get("intent");
  const rawReason = form.get("reason");
  const reason = typeof rawReason === "string" ? rawReason.trim() : "";
  const decision = DECISIONS.find((d) => d === intent);
  if (decision === undefined)
    return data(
      { problem: "That decision isn't available." },
      { status: 400, headers: admin.headers },
    );
  if (reason.length < 10 || reason.length > 500)
    return data(
      {
        problem:
          "Give a reason of 10 to 500 characters. Both sides are told it.",
      },
      { status: 400, headers: admin.headers },
    );
  const saved = await adminModerateReview(
    admin.supabase,
    params.id,
    decision,
    reason,
  );
  if (!saved.ok)
    return data(
      { problem: "That didn't save. The decision was not recorded." },
      { status: 409, headers: admin.headers },
    );
  throwRedirect("/admin/reviews", admin.headers);
}

export default function ReportedReview({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, row } = loaderData;
  return (
    <AdminShell title="Reported review">
      <p>
        <Link to="/admin/reviews">← Reported reviews</Link>
      </p>
      <h1>Reported review</h1>
      <section aria-labelledby="review-h">
        <h2 id="review-h">The review</h2>
        <p>
          {row.author_display} · {row.rating} / 5 · {row.report_count} report
          {row.report_count === 1 ? "" : "s"}
        </p>
        <blockquote>{row.body}</blockquote>
      </section>
      <p className="type-caption">
        Hidden reviews don&apos;t count in the rating.
      </p>
      {actionData?.problem ? (
        <StatusNote tone="err" title="That didn't save.">
          {actionData.problem}
        </StatusNote>
      ) : null}
      <section aria-labelledby="decide-h">
        <h2 id="decide-h">Your decision</h2>
        <form method="post">
          <CsrfField token={csrf} />
          <label>
            Reason for your decision
            <textarea name="reason" required minLength={10} maxLength={500} />
          </label>
          <Button type="submit" name="intent" value="dismiss" variant="outline">
            Keep review
          </Button>{" "}
          <Button type="submit" name="intent" value="hide" variant="primary">
            Hide review
          </Button>
        </form>
        <p className="type-caption">
          Both sides get an email with your reason. A low rating alone is never
          a reason to hide.
        </p>
      </section>
    </AdminShell>
  );
}
