import { data } from "react-router";

import { QueueFilters } from "../admin-onboarding/QueueFilters";
import { throwStatus } from "../auth/http.server";
import { requireAdmin } from "../server/providers/admin.server";
import { PAGE_SIZE, parsePage } from "../server/providers/forms";
import { AdminShell, Pager } from "../ui/admin/AdminShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.listings";

export const meta: Route.MetaFunction = () => [
  { title: "Listings · Admin · CarworX" },
];

const STATUSES = ["submitted", "live", "suspended", "draft", "all"] as const;
type Status = (typeof STATUSES)[number];
const TITLES: Record<Status, string> = {
  submitted: "Applications",
  live: "Businesses",
  suspended: "Suspended listings",
  draft: "Returned to the provider",
  all: "All applications and businesses",
};

interface Row {
  public_id: string;
  display_name: string;
  metro: string;
  mode: "fixed" | "mobile" | "both";
  status: Exclude<Status, "all">;
  submitted_at: string | null;
  created_at: string;
}

/** /admin/listings?status=…&page=…: oldest first, 50 a page. Admin at aal2 only. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const url = new URL(request.url);
  const asked = url.searchParams.get("status") ?? "submitted";
  const status = STATUSES.find((s) => s === asked);
  const page = parsePage(url.searchParams.get("page"));
  if (status === undefined || page === null) throwStatus(404, admin.headers);
  let query = admin.supabase
    .from("listings")
    .select(
      "public_id, display_name, metro, mode, status, submitted_at, created_at",
    )
    .order(status === "submitted" ? "submitted_at" : "created_at", {
      ascending: true,
      nullsFirst: true,
    })
    .order("public_id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (status !== "all") query = query.eq("status", status);
  const { data: rows, error } = await query.overrideTypes<
    Row[],
    { merge: false }
  >();
  if (error !== null) throwStatus(503, admin.headers);
  return data(
    {
      status,
      page,
      rows: rows.slice(0, PAGE_SIZE),
      more: rows.length > PAGE_SIZE,
    },
    { headers: admin.headers },
  );
}

export default function AdminListings({ loaderData }: Route.ComponentProps) {
  const { status, rows, page, more } = loaderData;
  return (
    <AdminShell title={TITLES[status]}>
      <QueueFilters
        label="Application and business status"
        base="/admin/listings"
        value={status}
        options={[
          { value: "submitted", label: "Waiting" },
          { value: "draft", label: "Sent back" },
          { value: "live", label: "Approved" },
          { value: "suspended", label: "Suspended" },
          { value: "all", label: "All" },
        ]}
      />
      {rows.length === 0 ? (
        <StatusNote title="Nothing here.">
          No listings in this state.
        </StatusNote>
      ) : (
        <ul className="grid gap-3" data-admin-list={status}>
          {rows.map((r) => (
            <li
              key={r.public_id}
              className="rounded-2xl bg-[var(--surface)] p-4"
              data-row={r.public_id}
            >
              <a className="cx-tlink" href={`/admin/listings/${r.public_id}`}>
                {r.display_name}
              </a>
              <p className="type-body mt-1">
                {r.mode === "fixed"
                  ? "Workshop"
                  : r.mode === "both"
                    ? "Workshop + mobile"
                    : "Mobile"}{" "}
                · {r.metro} · {status === "submitted" ? "sent" : "created"}{" "}
                {(r.submitted_at ?? r.created_at).slice(0, 10)}
                {status === "all" ? ` · ${r.status}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pager
        base={`/admin/listings?status=${status}`}
        page={page}
        more={more}
      />
    </AdminShell>
  );
}
