import { data, Form } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import { requireAdmin } from "../server/providers/admin.server";
import {
  parseId,
  parseReason,
  PROBLEM_TEXT,
  problemFrom,
  REVIEW_METHODS,
  sast,
  UUID,
  type Problem,
} from "../server/providers/forms";
import { AdminShell } from "../ui/admin/AdminShell";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.claims.$id";

export const meta: Route.MetaFunction = () => [
  { title: "Claim · Admin · CarworX" },
];

interface Claim {
  id: string;
  listing_public_id: string;
  organisation_id: string;
  claimant_id: string;
  evidence_kind: "business_email" | "document";
  email_domain: string | null;
  document_reference: string | null;
  status: string;
  approved_at: string | null;
  created_at: string;
}
interface Dispute {
  id: string;
  raised_by: string;
  reason: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
}

/**
 * /admin/claims/:id: approve (transfers control) or reject a claim; uphold
 * or dismiss a dispute. Every decision runs in private.admin_* at aal2.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, admin.headers);
  const db = admin.supabase;
  const claim = await db
    .from("listing_claims")
    .select(
      "id, listing_public_id, organisation_id, claimant_id, evidence_kind, email_domain, document_reference, status, approved_at, created_at",
    )
    .eq("id", params.id)
    .maybeSingle<Claim>();
  if (claim.error !== null) throwStatus(503, admin.headers);
  if (claim.data === null) throwStatus(404, admin.headers);
  const c = claim.data;
  const [listing, org, disputes, members] = await Promise.all([
    db
      .from("listings")
      .select("display_name, status")
      .eq("public_id", c.listing_public_id)
      .single<{ display_name: string; status: string }>(),
    db
      .from("organisations")
      .select("name")
      .eq("id", c.organisation_id)
      .single<{ name: string }>(),
    db
      .from("claim_disputes")
      .select("id, raised_by, reason, status, resolution_note, created_at")
      .eq("claim_id", c.id)
      .order("created_at")
      .overrideTypes<Dispute[], { merge: false }>(),
    db
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", c.organisation_id)
      .eq("status", "active"),
  ]);
  if (
    listing.error !== null ||
    org.error !== null ||
    disputes.error !== null ||
    members.error !== null
  )
    throwStatus(503, admin.headers);
  const people = [c.claimant_id, ...disputes.data.map((d) => d.raised_by)];
  const names = await db
    .from("profiles")
    .select("id, display_name")
    .in("id", people)
    .overrideTypes<{ id: string; display_name: string }[], { merge: false }>();
  if (names.error !== null) throwStatus(503, admin.headers);
  const nameOf = (id: string) =>
    names.data.find((p) => p.id === id)?.display_name ?? "No profile name";
  return data(
    {
      csrf: context.security.csrfToken,
      done: new URL(request.url).searchParams.has("done"),
      claim: {
        id: c.id,
        status: c.status,
        evidence_kind: c.evidence_kind,
        email_domain: c.email_domain,
        document_reference: c.document_reference,
        approved: c.approved_at !== null,
        created: sast(c.created_at),
        claimant: nameOf(c.claimant_id),
        listing: listing.data.display_name,
        listing_public_id: c.listing_public_id,
        organisation: org.data.name,
        activeMembers: members.count ?? 0,
      },
      disputes: disputes.data.map((d) => ({
        id: d.id,
        status: d.status,
        reason: d.reason,
        note: d.resolution_note,
        by: nameOf(d.raised_by),
        created: sast(d.created_at),
      })),
    },
    { headers: admin.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const admin = await requireAdmin(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, admin.headers);
  const form = await request.formData();
  const intent = field(form, "intent");
  const fail = (problem: Problem) =>
    data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: admin.headers,
      },
    );
  let result: { error: { code?: string; message?: string } | null };
  if (intent === "approve" || intent === "reject") {
    const method = field(form, "method");
    const note = field(form, "note").trim();
    if (intent === "approve" && !REVIEW_METHODS.some((m) => m.value === method))
      return fail("invalid_input");
    const parsedNote =
      note === "" && intent === "approve"
        ? null
        : parseReason(form, "note", 5, 500);
    if (note !== "" && parsedNote === null) return fail("invalid_input");
    if (intent === "reject" && parsedNote === null)
      return fail("invalid_input");
    result = await admin.supabase.rpc("admin_decide_claim", {
      p_claim: params.id,
      p_decision: intent,
      p_method: intent === "approve" ? method : null,
      p_note: parsedNote,
    });
  } else if (intent === "uphold" || intent === "dismiss") {
    const dispute = parseId(form, "dispute");
    const note = parseReason(form, "note", 5, 500);
    if (dispute === null || note === null) return fail("invalid_input");
    result = await admin.supabase.rpc("admin_resolve_dispute", {
      p_dispute: dispute,
      p_outcome: intent,
      p_note: note,
    });
  } else {
    return fail("invalid_input");
  }
  if (result.error !== null) return fail(problemFrom(result.error));
  return throwRedirect(`/admin/claims/${params.id}?done=1`, admin.headers);
}

export default function AdminClaim({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { claim: c, disputes, csrf, done } = loaderData;
  const open = disputes.find((d) => d.status === "open");
  return (
    <AdminShell title={`Claim on ${c.listing}`}>
      <p data-claim-status={c.status} className="type-body">
        Status: <b>{c.status}</b>
      </p>
      {done ? (
        <div className="mt-4" data-notice="done">
          <StatusNote tone="ok" title="Saved." />
        </div>
      ) : null}
      {actionData?.problem ? (
        <div className="mt-4" data-problem={actionData.problem}>
          <StatusNote tone="err" title="That didn't work.">
            {PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        </div>
      ) : null}
      <dl className="mt-4 grid max-w-[65ch] gap-1 type-body">
        <dt className="type-label">Claimant</dt>
        <dd>{c.claimant}</dd>
        <dt className="type-label">Evidence</dt>
        <dd>
          {c.evidence_kind === "business_email"
            ? `Confirmed sign-in email at ${c.email_domain ?? ""}. Check that this domain belongs to the business.`
            : `Document reference: ${c.document_reference ?? ""}. Review the document itself outside CarworX.`}
        </dd>
        <dt className="type-label">Business</dt>
        <dd>
          {c.organisation} ·{" "}
          <a
            className="cx-tlink"
            href={`/admin/listings/${c.listing_public_id}`}
          >
            listing
          </a>{" "}
          · {c.activeMembers} people with access now
        </dd>
        <dt className="type-label">Sent</dt>
        <dd>{c.created}</dd>
      </dl>

      {c.status === "submitted" ? (
        <div className="mt-8 grid max-w-[65ch] gap-8">
          <Form method="post" className="grid gap-4" data-form="approve-claim">
            <h2 className="type-title">Approve: transfer control</h2>
            <p className="type-body">
              The claimant becomes the owner. Everyone else with access to{" "}
              {c.organisation} loses it. A displaced owner can still dispute.
            </p>
            <CsrfField token={csrf} />
            <input type="hidden" name="intent" value="approve" />
            <div className="cx-field">
              <label htmlFor="method">How did you check it?</label>
              <select id="method" name="method" className="cx-input" required>
                {REVIEW_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <TextField label="Note (optional)" name="note" maxLength={500} />
            <div>
              <Button type="submit" variant="primary">
                Approve claim
              </Button>
            </div>
          </Form>
          <Form method="post" className="grid gap-4" data-form="reject-claim">
            <h2 className="type-title">Reject</h2>
            <CsrfField token={csrf} />
            <input type="hidden" name="intent" value="reject" />
            <TextField
              label="Why"
              name="note"
              required
              minLength={5}
              maxLength={500}
            />
            <div>
              <Button type="submit">Reject claim</Button>
            </div>
          </Form>
        </div>
      ) : null}

      {open ? (
        <section className="mt-8 max-w-[65ch]" data-dispute={open.id}>
          <h2 className="type-title">Open dispute</h2>
          <p className="type-body mt-2">
            {open.by}, {open.created}: “{open.reason}”
          </p>
          <p className="type-body mt-2">
            {c.approved
              ? "Upholding reverses the transfer: the people it removed get access back, and everyone else loses it."
              : "Upholding rejects the claim. Dismissing sends it back for a decision."}
          </p>
          {(["uphold", "dismiss"] as const).map((outcome) => (
            <Form
              key={outcome}
              method="post"
              className="mt-4 grid gap-3"
              data-form={`${outcome}-dispute`}
            >
              <CsrfField token={csrf} />
              <input type="hidden" name="intent" value={outcome} />
              <input type="hidden" name="dispute" value={open.id} />
              <TextField
                label={
                  outcome === "uphold"
                    ? "Why you uphold it"
                    : "Why you dismiss it"
                }
                name="note"
                required
                minLength={5}
                maxLength={500}
              />
              <div>
                <Button
                  type="submit"
                  variant={outcome === "uphold" ? "primary" : "secondary"}
                >
                  {outcome === "uphold" ? "Uphold dispute" : "Dismiss dispute"}
                </Button>
              </div>
            </Form>
          ))}
        </section>
      ) : null}

      {disputes.length > 0 ? (
        <section className="mt-10 max-w-[65ch]">
          <h2 className="type-title">Dispute history</h2>
          <ol className="mt-2 grid gap-2">
            {disputes.map((d) => (
              <li key={d.id} data-dispute-status={d.status}>
                {d.created} · {d.by} · {d.status}
                {d.note ? ` · ${d.note}` : ""}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </AdminShell>
  );
}
