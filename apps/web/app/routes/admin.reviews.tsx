/**
 * /admin/reviews: reviews that readers reported (A8 moderation). Oldest report
 * first. The queue only carries unresolved reports, so the page has no tabs.
 */
import { data, Link } from "react-router";

import { requireAdmin } from "../server/providers/admin.server";
import { adminReviewQueue } from "../server/reviews/reviews.server";
import { AdminShell } from "../ui/admin/AdminShell";
import type { Route } from "./+types/admin.reviews";

export const meta: Route.MetaFunction = () => [
  { title: "Reported reviews · Admin · CarworX" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const queue = await adminReviewQueue(admin.supabase);
  return data(
    { rows: queue.ok ? queue.value : [], unavailable: !queue.ok },
    { headers: admin.headers },
  );
}

export default function AdminReviews({ loaderData }: Route.ComponentProps) {
  const { rows, unavailable } = loaderData;
  return (
    <AdminShell title="Reported reviews">
      <h1>Reported reviews</h1>
      <p>
        Hide a review only when it breaks the rules. A low rating alone is never
        a reason.
      </p>
      {unavailable ? (
        <p role="alert">
          We couldn&apos;t load the reports. Try again in a moment.
        </p>
      ) : rows.length === 0 ? (
        <section className="cx-empty">
          <h2>No reported reviews.</h2>
          <p>Nothing is waiting for a decision.</p>
        </section>
      ) : (
        <table className="cx-qtable">
          <thead>
            <tr>
              <th scope="col">Review</th>
              <th scope="col">Stars</th>
              <th scope="col">Reports</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.author_display} → listing{" "}
                  {row.listing_public_id.slice(0, 8)}
                  <br />
                  <span className="type-caption">{row.body.slice(0, 120)}</span>
                </td>
                <td>{row.rating} / 5</td>
                <td>
                  {row.report_count} report{row.report_count === 1 ? "" : "s"}
                </td>
                <td>
                  <Link to={`/admin/reviews/${row.id}`}>Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
