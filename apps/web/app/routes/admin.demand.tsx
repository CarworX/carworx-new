import { data, Form } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import { findCategory } from "../catalogue/taxonomy";
import { PROVINCES } from "../server/forms/parse";
import { requireAdmin } from "../server/providers/admin.server";
import {
  PAGE_SIZE,
  parsePage,
  PROBLEM_TEXT,
  problemFrom,
  sast,
  UUID,
  type Problem,
} from "../server/providers/forms";
import { AdminShell, Pager } from "../ui/admin/AdminShell";
import { Button } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.demand";

export const meta: Route.MetaFunction = () => [
  { title: "Demand requests · Admin · CarworX" },
];

interface Row {
  id: string;
  email: string;
  category_slug: string;
  province: string;
  last_activity_at: string;
  expires_at: string;
}

/**
 * /admin/demand (P2-5, A13): the only place demand capture is read. Listed
 * admin at aal2 only (requireAdmin, then RLS checks aal2 again and hides
 * expired rows). Newest first, 50 a page.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page"));
  if (page === null) throwStatus(404, admin.headers);
  const { data: rows, error } = await admin.supabase
    .from("demand_requests")
    .select("id, email, category_slug, province, last_activity_at, expires_at")
    .order("last_activity_at", { ascending: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .overrideTypes<Row[], { merge: false }>();
  if (error !== null) throwStatus(503, admin.headers);
  return data(
    {
      csrf: context.security.csrfToken,
      rows: rows.slice(0, PAGE_SIZE),
      page,
      more: rows.length > PAGE_SIZE,
      withdrawn: url.searchParams.has("withdrawn"),
    },
    { headers: admin.headers },
  );
}

/** Withdraw one request on the person's ask: the row goes, consent is kept as proof. */
export async function action({ request, context }: Route.ActionArgs) {
  const admin = await requireAdmin(request, context.security);
  const id = field(await request.formData(), "id");
  const fail = (problem: Problem) =>
    data(
      { problem },
      { status: problem === "unavailable" ? 503 : 400, headers: admin.headers },
    );
  if (!UUID.test(id)) return fail("invalid_input");
  const { error } = await admin.supabase.rpc("admin_withdraw_demand", {
    p_request: id,
  });
  if (error !== null) return fail(problemFrom(error));
  return throwRedirect("/admin/demand?withdrawn=1", admin.headers);
}

export default function AdminDemand({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { rows, page, more } = loaderData;
  return (
    <AdminShell title="Demand requests">
      <p className="type-body-sm text-quiet mb-4 max-w-[65ch]">
        Private. People asked to hear when a provider joins. Never share or
        export these; each one expires 12 months after its last activity.
      </p>
      {loaderData.withdrawn ? (
        <div className="mb-4">
          <StatusNote tone="ok" title="Request withdrawn." />
        </div>
      ) : null}
      {actionData?.problem ? (
        <div className="mb-4" data-problem={actionData.problem}>
          <StatusNote tone="err" title="That didn't work.">
            {PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <StatusNote title="No demand requests." />
      ) : (
        <ul className="grid gap-3" data-admin-list="demand">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl bg-[var(--surface)] p-4"
              data-row={r.id}
            >
              <p className="type-body">
                <b>{findCategory(r.category_slug)?.label ?? r.category_slug}</b>{" "}
                ·{" "}
                {PROVINCES.find((p) => p.value === r.province)?.label ??
                  r.province}
              </p>
              <p className="type-body-sm">{r.email}</p>
              <p className="type-caption">
                Last asked {sast(r.last_activity_at)} · expires{" "}
                {sast(r.expires_at)}
              </p>
              <Form method="post" className="mt-2">
                <CsrfField token={loaderData.csrf} />
                <input type="hidden" name="id" value={r.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Withdraw (person asked)
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      )}
      <Pager base="/admin/demand?" page={page} more={more} />
    </AdminShell>
  );
}
