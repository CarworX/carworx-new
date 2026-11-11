import { data } from "react-router";

import { throwStatus } from "../auth/http.server";
import { requireAdmin } from "../server/providers/admin.server";
import { sast } from "../server/providers/forms";
import { AdminShell } from "../ui/admin/AdminShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.audit";

export const meta: Route.MetaFunction = () => [
  { title: "Audit log · Admin · CarworX" },
];

const TABLES = [
  "listing_decisions",
  "listing_claims",
  "claim_disputes",
  "listings",
  "memberships",
  "organisations",
  "verifications",
] as const;
const PAGE = 50;

interface Entry {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown>;
}

/**
 * /admin/audit: the append-only audit log, newest first, keyset paged on id.
 * Read with the admin's JWT, so audit_log's RLS (admin at aal2) decides.
 * Details hold states and decisions only, never reasons or coordinates.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const url = new URL(request.url);
  const table = url.searchParams.get("table");
  const before = url.searchParams.get("before");
  if (table !== null && !TABLES.some((t) => t === table))
    throwStatus(404, admin.headers);
  if (before !== null && !/^[1-9]\d{0,15}$/.test(before))
    throwStatus(404, admin.headers);
  let query = admin.supabase
    .from("audit_log")
    .select(
      "id, occurred_at, actor_id, action, target_table, target_id, details",
    )
    .order("id", { ascending: false })
    .limit(PAGE + 1);
  if (table !== null) query = query.eq("target_table", table);
  if (before !== null) query = query.lt("id", Number(before));
  const { data: rows, error } = await query.overrideTypes<
    Entry[],
    { merge: false }
  >();
  if (error !== null) throwStatus(503, admin.headers);
  const page = rows.slice(0, PAGE);
  const next = rows.length > PAGE ? page.at(-1)?.id : undefined;
  return data(
    {
      table,
      entries: page.map((e) => ({
        id: e.id,
        when: sast(e.occurred_at),
        actor: e.actor_id === null ? "system" : e.actor_id.slice(0, 8),
        what: `${e.action} ${e.target_table}`,
        target: e.target_id.slice(0, 8),
        details: Object.entries(e.details)
          .filter(
            ([, v]) => v !== null && !(Array.isArray(v) && v.length === 0),
          )
          .map(
            ([k, v]) =>
              `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : JSON.stringify(v)}`,
          )
          .join(" · "),
      })),
      next:
        next === undefined
          ? null
          : `/admin/audit?${new URLSearchParams({
              ...(table !== null ? { table } : {}),
              before: String(next),
            }).toString()}`,
    },
    { headers: admin.headers },
  );
}

export default function AdminAudit({ loaderData }: Route.ComponentProps) {
  const { entries, next, table } = loaderData;
  return (
    <AdminShell title="Audit log">
      <nav
        aria-label="Filter by table"
        className="flex flex-wrap gap-x-3 gap-y-1"
      >
        <a
          className="cx-tlink"
          href="/admin/audit"
          aria-current={table === null ? "page" : undefined}
        >
          All
        </a>
        {TABLES.map((t) => (
          <a
            key={t}
            className="cx-tlink"
            href={`/admin/audit?table=${t}`}
            aria-current={table === t ? "page" : undefined}
          >
            {t.replace("_", " ")}
          </a>
        ))}
      </nav>
      {entries.length === 0 ? (
        <div className="mt-4">
          <StatusNote title="No entries." />
        </div>
      ) : (
        <ol className="mt-4 grid gap-2" data-admin-list="audit">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl bg-[var(--surface)] p-3"
              data-audit={e.what}
            >
              <p className="type-body">
                <b>{e.what}</b> · {e.when}
              </p>
              <p className="type-body">
                by {e.actor} · row {e.target}
                {e.details ? ` · ${e.details}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
      {next ? (
        <p className="mt-4">
          <a className="cx-tlink" href={next} data-next>
            Older entries
          </a>
        </p>
      ) : null}
    </AdminShell>
  );
}
