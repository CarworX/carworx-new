import { data } from "react-router";

import { QueueFilters } from "../admin-onboarding/QueueFilters";
import { throwStatus } from "../auth/http.server";
import { requireAdmin } from "../server/providers/admin.server";
import { PAGE_SIZE, parsePage, sast } from "../server/providers/forms";
import { AdminShell, Pager } from "../ui/admin/AdminShell";
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

const FILTERS = [
  { value: "open", label: "Open", statuses: ["submitted", "disputed"] },
  { value: "submitted", label: "Waiting", statuses: ["submitted"] },
  { value: "disputed", label: "Disputed", statuses: ["disputed"] },
  {
    value: "decided",
    label: "Decided",
    statuses: ["approved", "rejected", "reversed"],
  },
  { value: "all", label: "All", statuses: [] },
] as const;

/** /admin/claims?page=…: claims waiting for a decision or under dispute, 50 a page. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page"));
  const filter = FILTERS.find(
    (item) => item.value === (url.searchParams.get("status") ?? "open"),
  );
  if (page === null || filter === undefined) throwStatus(404, admin.headers);
  let query = admin.supabase
    .from("listing_claims")
    .select("id, listing_public_id, status, evidence_kind, created_at");
  if (filter.statuses.length > 0) query = query.in("status", filter.statuses);
  // In the open queue, disputed sorts before submitted, then oldest first.
  if (filter.value === "open") query = query.order("status");
  const { data: rows, error } = await query
    .order("created_at")
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .overrideTypes<Row[], { merge: false }>();
  if (error !== null) throwStatus(503, admin.headers);
  return data(
    {
      rows: rows.slice(0, PAGE_SIZE),
      page,
      more: rows.length > PAGE_SIZE,
      status: filter.value,
    },
    { headers: admin.headers },
  );
}

export default function AdminClaims({ loaderData }: Route.ComponentProps) {
  const { rows, page, more, status } = loaderData;
  return (
    <AdminShell title="Claims">
      <QueueFilters
        label="Claim status"
        options={FILTERS}
        base="/admin/claims"
        value={status}
      />
      {rows.length === 0 ? (
        <StatusNote title="No claims in this view." />
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
                · {sast(r.created_at)} · {r.status}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pager base={`/admin/claims?status=${status}`} page={page} more={more} />
    </AdminShell>
  );
}
