/**
 * /admin/id-checks/:id: one check that Didit sent for a second look. The admin
 * approves it, or declines it with a reason (K2: one of the decline reasons is
 * recorded, and each decision writes an audit row). The ID photo and selfie are
 * never here: they stay in Didit.
 */
import { data, Link } from "react-router";

import { throwRedirect } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import {
  APPROVE_NOTE,
  declineReason,
  DECLINE_REASONS,
  hoursWaiting,
  queueRows,
} from "../fines/identity-queue";
import { requireAdmin } from "../server/providers/admin.server";
import { AdminShell } from "../ui/admin/AdminShell";
import { Button } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.id-checks.$id";

export const meta: Route.MetaFunction = () => [
  { title: "ID check · Admin · CarworX" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loader({ request, context, params }: Route.LoaderArgs) {
  if (!UUID.test(params.id)) throwRedirect("/admin/id-checks");
  const admin = await requireAdmin(request, context.security);
  const result: { data: unknown; error: unknown } = await admin.supabase.rpc(
    "admin_identity_queue",
  );
  const row = queueRows(result)?.find((r) => r.id === params.id) ?? null;
  if (row === null) {
    // Decided already, or never in the queue: back to the list.
    throwRedirect("/admin/id-checks", admin.headers);
  }
  return data(
    {
      csrf: context.security.csrfToken,
      row: row,
      hours: hoursWaiting(row.created_at),
    },
    { headers: admin.headers },
  );
}

export async function action({ request, context, params }: Route.ActionArgs) {
  if (!UUID.test(params.id)) throwRedirect("/admin/id-checks");
  const admin = await requireAdmin(request, context.security);
  const form = await request.formData();
  const intent = form.get("intent");
  let decision: "approved" | "declined";
  let reason: string;
  if (intent === "approve") {
    decision = "approved";
    reason = APPROVE_NOTE;
  } else if (intent === "decline") {
    const picked = form.get("reason");
    const note = form.get("note");
    const chosen =
      typeof picked === "string"
        ? declineReason(picked, typeof note === "string" ? note : null)
        : null;
    if (chosen === null)
      return data(
        { problem: "reason" },
        { status: 400, headers: admin.headers },
      );
    decision = "declined";
    reason = chosen;
  } else {
    return data({ problem: "intent" }, { status: 400, headers: admin.headers });
  }
  const result: { data: unknown; error: unknown } = await admin.supabase.rpc(
    "admin_decide_identity",
    { p_id: params.id, p_decision: decision, p_reason: reason },
  );
  if (result.error !== null)
    return data({ problem: "decide" }, { status: 409, headers: admin.headers });
  throwRedirect("/admin/id-checks", admin.headers);
}

export default function IdCheck({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { row, hours, csrf } = loaderData;
  const problem = actionData?.problem;
  return (
    <AdminShell title="ID check">
      <p>
        <Link to="/admin/id-checks">← ID checks</Link>
      </p>
      <h1>ID check for account {row.user_id.slice(0, 8)}</h1>
      <p className="type-caption">
        Session {row.id.slice(0, 8)} · attempt {row.attempt} of 3 ·{" "}
        {hours < 1 ? "waiting under an hour" : `waiting ${String(hours)} h`}
      </p>
      <StatusNote tone="info" title="Photos and the selfie are only in Didit.">
        Opening the session in Didit&apos;s console is logged there with your
        name. This page does not show the photos.
      </StatusNote>
      <section aria-labelledby="read-h">
        <h2 id="read-h">What Didit read</h2>
        <dl>
          <dt>ID number</dt>
          <dd>••••••••• {row.id_last4 ?? "????"}</dd>
        </dl>
      </section>
      {problem === "reason" ? (
        <StatusNote tone="err" title="Choose a reason to decline.">
          Pick one of the reasons, or write a note for &ldquo;Other&rdquo;.
        </StatusNote>
      ) : null}
      {problem === "decide" ? (
        <StatusNote tone="err" title="That didn't save.">
          The decision was not recorded. Try again, or check the queue.
        </StatusNote>
      ) : null}
      <section aria-labelledby="decide-h">
        <h2 id="decide-h">Decision</h2>
        <form method="post">
          <CsrfField token={csrf} />
          <Button type="submit" name="intent" value="approve" variant="primary">
            Approve
          </Button>
        </form>
        <form method="post">
          <CsrfField token={csrf} />
          <fieldset>
            <legend>or decline with a reason</legend>
            {DECLINE_REASONS.map((label) => (
              <label key={label}>
                <input type="radio" name="reason" value={label} /> {label}
              </label>
            ))}
            <label>
              Note (only for &ldquo;Other&rdquo;)
              <textarea name="note" maxLength={240} />
            </label>
          </fieldset>
          <Button type="submit" name="intent" value="decline" variant="outline">
            Decline and tell them why
          </Button>
          <p className="type-caption">Declining uses one of their 3 tries.</p>
        </form>
      </section>
    </AdminShell>
  );
}
