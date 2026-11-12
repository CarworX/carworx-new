import { data } from "react-router";

import { throwStatus } from "../auth/http.server";
import { TOPICS } from "../server/forms/parse";
import { requireAdmin } from "../server/providers/admin.server";
import { PAGE_SIZE, parsePage, sast } from "../server/providers/forms";
import { AdminShell, Pager } from "../ui/admin/AdminShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.support";

export const meta: Route.MetaFunction = () => [
  { title: "Support · Admin · CarworX" },
];

interface Row {
  id: string;
  topic: string;
  status: string;
  created_at: string;
}

/** /admin/support?status=open|closed: support cases, oldest open first. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page"));
  const status = url.searchParams.get("status") ?? "open";
  if (page === null || (status !== "open" && status !== "closed"))
    throwStatus(404, admin.headers);
  const { data: rows, error } = await admin.supabase
    .from("support_cases")
    .select("id, topic, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: status === "open" })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .overrideTypes<Row[], { merge: false }>();
  if (error !== null) throwStatus(503, admin.headers);
  return data(
    {
      rows: rows.slice(0, PAGE_SIZE),
      page,
      more: rows.length > PAGE_SIZE,
      status,
    },
    { headers: admin.headers },
  );
}

export default function AdminSupport({ loaderData }: Route.ComponentProps) {
  const { rows, page, more, status } = loaderData;
  return (
    <AdminShell title="Support cases">
      <nav aria-label="Case status" className="mb-4 flex gap-2">
        {(["open", "closed"] as const).map((s) => (
          <a
            key={s}
            href={`/admin/support?status=${s}`}
            className="cx-chip"
            aria-current={s === status ? "true" : undefined}
          >
            {s === "open" ? "Open" : "Closed"}
          </a>
        ))}
      </nav>
      {rows.length === 0 ? (
        <StatusNote title={`No ${status} cases.`} />
      ) : (
        <ul className="grid gap-3" data-admin-list="support">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl bg-[var(--surface)] p-4"
              data-row={r.id}
            >
              <a className="cx-tlink" href={`/admin/support/${r.id}`}>
                {TOPICS.find((t) => t.value === r.topic)?.label ?? r.topic}
              </a>
              <p className="type-caption">{sast(r.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      <Pager base={`/admin/support?status=${status}`} page={page} more={more} />
    </AdminShell>
  );
}
