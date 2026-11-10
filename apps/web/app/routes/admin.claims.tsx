import { data } from "react-router";

import { throwStatus } from "../auth/http.server";
import { requireAdmin } from "../server/providers/admin.server";
import { sast } from "../server/providers/forms";
import { AdminShell } from "../ui/admin/AdminShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.claims";

export const meta: Route.MetaFunction = () => [
  { title: "Claims · Admin · CarworX" },
];

interface Row {
  id: string;
  listing_public_id: string;
  status: string;
  evidence_kind: string;
  created_at: string;
}

/** /admin/claims: claims waiting for a decision and claims under dispute. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const { data: rows, error } = await admin.supabase
    .from("listing_claims")
    .select("id, listing_public_id, status, evidence_kind, created_at")
    .in("status", ["submitted", "disputed"])
    .order("created_at")
    .limit(50)
    .overrideTypes<Row[], { merge: false }>();
  if (error !== null) throwStatus(503, admin.headers);
  return data({ rows }, { headers: admin.headers });
}

export default function AdminClaims({ loaderData }: Route.ComponentProps) {
  const { rows } = loaderData;
  return (
    <AdminShell title="Claims">
      {rows.length === 0 ? (
        <StatusNote title="No open claims." />
      ) : (
        <ul className="grid gap-3" data-admin-list="claims">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl bg-[var(--surface)] p-4"
              data-row={r.id}
              data-claim-status={r.status}
            >
              <a className="cx-tlink" href={`/admin/claims/${r.id}`}>
                {r.status === "disputed" ? "Disputed claim" : "Claim"} on
                listing {r.listing_public_id.slice(0, 8)}
              </a>
              <p className="type-body mt-1">
                {r.evidence_kind === "business_email"
                  ? "Business email"
                  : "Document"}{" "}
                · {sast(r.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
