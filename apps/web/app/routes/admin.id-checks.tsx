/**
 * /admin/id-checks: the ID checks Didit sent to us for a second look (A7, B-21).
 * Oldest first. Listed admins at aal2 only, through requireAdmin.
 */
import { data, Link } from "react-router";

import { hoursWaiting, queueRows, TARGET_HOURS } from "../fines/identity-queue";
import { requireAdmin } from "../server/providers/admin.server";
import { AdminShell } from "../ui/admin/AdminShell";
import type { Route } from "./+types/admin.id-checks";

export const meta: Route.MetaFunction = () => [
  { title: "ID checks · Admin · CarworX" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const result: { data: unknown; error: unknown } = await admin.supabase.rpc(
    "admin_identity_queue",
  );
  const rows = queueRows(result);
  if (rows === null) {
    return data({ rows: [], unavailable: true }, { headers: admin.headers });
  }
  return data({ rows, unavailable: false }, { headers: admin.headers });
}

export default function IdChecks({ loaderData }: Route.ComponentProps) {
  const { rows, unavailable } = loaderData;
  return (
    <AdminShell title="ID checks">
      <h1>ID checks</h1>
      <p>
        Didit approves or declines most people automatically. These are the ones
        it sent to us for a second look. Oldest first.
      </p>
      <p className="type-caption">Target: within 1 business day.</p>
      {unavailable ? (
        <p role="alert">
          We couldn&apos;t load the queue. Try again in a moment.
        </p>
      ) : rows.length === 0 ? (
        <section className="cx-empty">
          <h2>Nothing waiting for review.</h2>
          <p>
            Didit is handling everyone automatically right now. Cases it sends
            for a second look appear here; we email the team if one waits more
            than 4 hours.
          </p>
        </section>
      ) : (
        <table className="cx-qtable">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Didit result</th>
              <th scope="col">Attempt</th>
              <th scope="col">Waiting</th>
              <th scope="col">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hours = hoursWaiting(row.created_at);
              return (
                <tr key={row.id}>
                  <td>
                    ID ••••{row.id_last4 ?? "????"}
                    <br />
                    <span className="type-caption">
                      Account {row.user_id.slice(0, 8)}
                    </span>
                  </td>
                  <td>
                    <span className="cx-badge warn">In review</span>
                  </td>
                  <td>{row.attempt} of 3</td>
                  <td
                    className={hours >= TARGET_HOURS ? "cx-age late" : "cx-age"}
                  >
                    {hours < 1 ? "Under an hour" : `${String(hours)} h`}
                  </td>
                  <td>
                    <Link to={`/admin/id-checks/${row.id}`}>Review</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="type-caption">
        CarworX never holds the ID photo or selfie. Those stay with Didit.
      </p>
    </AdminShell>
  );
}
