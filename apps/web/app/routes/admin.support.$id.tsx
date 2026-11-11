import { data, Form } from "react-router";

import { throwRedirect, throwStatus } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import { TOPICS } from "../server/forms/parse";
import { requireAdmin } from "../server/providers/admin.server";
import {
  parseReason,
  PROBLEM_TEXT,
  problemFrom,
  sast,
  UUID,
  type Problem,
} from "../server/providers/forms";
import { AdminShell } from "../ui/admin/AdminShell";
import { Button } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.support.$id";

export const meta: Route.MetaFunction = () => [
  { title: "Support case · Admin · CarworX" },
];

interface Case {
  id: string;
  email: string;
  topic: string;
  message: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  close_note: string | null;
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, admin.headers);
  const { data: row, error } = await admin.supabase
    .from("support_cases")
    .select(
      "id, email, topic, message, status, created_at, closed_at, close_note",
    )
    .eq("id", params.id)
    .maybeSingle<Case>();
  if (error !== null) throwStatus(503, admin.headers);
  if (row === null) throwStatus(404, admin.headers);
  return data(
    { csrf: context.security.csrfToken, row },
    { headers: admin.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const admin = await requireAdmin(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, admin.headers);
  const fail = (problem: Problem) =>
    data(
      { problem },
      { status: problem === "unavailable" ? 503 : 400, headers: admin.headers },
    );
  const note = parseReason(await request.formData(), "note", 5, 500);
  if (note === null) return fail("invalid_input");
  const { error } = await admin.supabase.rpc("admin_close_support_case", {
    p_case: params.id,
    p_note: note,
  });
  if (error !== null) return fail(problemFrom(error));
  return throwRedirect(`/admin/support/${params.id}`, admin.headers);
}

export default function AdminSupportCase({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { row } = loaderData;
  return (
    <AdminShell title="Support case">
      <div className="grid max-w-[65ch] gap-3" data-case-status={row.status}>
        <p className="type-body">
          <b>{TOPICS.find((t) => t.value === row.topic)?.label ?? row.topic}</b>{" "}
          · {sast(row.created_at)}
        </p>
        <p className="type-body-sm">
          Reply to{" "}
          <a className="cx-tlink" href={`mailto:${row.email}`}>
            {row.email}
          </a>
        </p>
        <p className="type-body whitespace-pre-line rounded-2xl bg-[var(--surface)] p-4">
          {row.message}
        </p>
        {row.topic === "privacy_request" ? (
          <StatusNote title="Privacy request.">
            Answer within a reasonable time. To withdraw a demand request, use
            Demand requests; consent records are kept as proof for 3 years.
          </StatusNote>
        ) : null}
        {actionData?.problem ? (
          <div data-problem={actionData.problem}>
            <StatusNote tone="err" title="That didn't work.">
              {PROBLEM_TEXT[actionData.problem]}
            </StatusNote>
          </div>
        ) : null}
        {row.status === "open" ? (
          <Form method="post" className="grid gap-3">
            <CsrfField token={loaderData.csrf} />
            <div className="cx-field">
              <label htmlFor="note">What was done</label>
              <textarea
                id="note"
                name="note"
                className="cx-input"
                required
                minLength={5}
                maxLength={500}
                rows={3}
              />
            </div>
            <div>
              <Button type="submit" variant="primary">
                Close case
              </Button>
            </div>
          </Form>
        ) : (
          <StatusNote tone="ok" title="Closed.">
            {row.closed_at ? sast(row.closed_at) : null} · {row.close_note}
          </StatusNote>
        )}
      </div>
    </AdminShell>
  );
}
