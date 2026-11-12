import { data, Form } from "react-router";

import { ApplicationReview } from "../admin-onboarding/ApplicationReview";
import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import { requireAdmin } from "../server/providers/admin.server";
import {
  parseDecision,
  parseId,
  parseReason,
  PROBLEM_TEXT,
  problemFrom,
  sast,
  SERVICE_OPTIONS,
  UUID,
  type Problem,
} from "../server/providers/forms";
import { AdminShell } from "../ui/admin/AdminShell";
import { Button } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.listings.$publicId";

export const meta: Route.MetaFunction = () => [
  { title: "Listing · Admin · CarworX" },
];

interface Listing {
  public_id: string;
  organisation_id: string;
  display_name: string;
  description: string;
  metro: string;
  mode: "fixed" | "mobile" | "both";
  status: "draft" | "submitted" | "live" | "suspended";
  provenance_kind: string;
  service_slug: string;
  branch_public_id: string | null;
}

/**
 * /admin/listings/:publicId: review, suspend or reinstate a listing and
 * remove an organisation's members. Never reads service_areas, so a mobile
 * base or radius can't reach the page (A10).
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  if (!UUID.test(params.publicId)) throwStatus(404, admin.headers);
  const db = admin.supabase;
  const listing = await db
    .from("listings")
    .select(
      "public_id, organisation_id, display_name, description, metro, mode, status, provenance_kind, service_slug, branch_public_id",
    )
    .eq("public_id", params.publicId)
    .maybeSingle<Listing>();
  if (listing.error !== null) throwStatus(503, admin.headers);
  if (listing.data === null) throwStatus(404, admin.headers);
  const l = listing.data;
  const [org, branch, decisions, members] = await Promise.all([
    db
      .from("organisations")
      .select("name")
      .eq("id", l.organisation_id)
      .single<{ name: string }>(),
    l.branch_public_id === null
      ? Promise.resolve({ data: null, error: null })
      : db
          .from("branches")
          .select("public_address")
          .eq("public_id", l.branch_public_id)
          .single<{ public_address: string }>(),
    db
      .from("listing_decisions")
      .select("id, decision, review_method, labels, reason, decided_at")
      .eq("listing_public_id", l.public_id)
      .order("decided_at", { ascending: false })
      .overrideTypes<
        {
          id: string;
          decision: string;
          review_method: string | null;
          labels: string[];
          reason: string | null;
          decided_at: string;
        }[],
        { merge: false }
      >(),
    db
      .from("memberships")
      .select("id, user_id, role, status")
      .eq("organisation_id", l.organisation_id)
      .order("created_at")
      .overrideTypes<
        { id: string; user_id: string; role: string; status: string }[],
        { merge: false }
      >(),
  ]);
  if (
    org.error !== null ||
    branch.error !== null ||
    decisions.error !== null ||
    members.error !== null
  )
    throwStatus(503, admin.headers);
  const names = await db
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      members.data.map((m) => m.user_id),
    )
    .overrideTypes<{ id: string; display_name: string }[], { merge: false }>();
  if (names.error !== null) throwStatus(503, admin.headers);
  const nameOf = new Map(names.data.map((p) => [p.id, p.display_name]));
  return data(
    {
      csrf: context.security.csrfToken,
      done: new URL(request.url).searchParams.has("done"),
      listing: {
        ...l,
        organisation: org.data.name,
        address: branch.data?.public_address ?? null,
      },
      decisions: decisions.data,
      members: members.data.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        name: nameOf.get(m.user_id) ?? "No profile name",
      })),
    },
    { headers: admin.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const admin = await requireAdmin(request, context.security);
  if (!UUID.test(params.publicId)) throwStatus(404, admin.headers);
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
  let error: { code?: string; message?: string } | null;
  if (intent === "decide") {
    const decision = parseDecision(form);
    if (decision === null) return fail("invalid_input");
    ({ error } = await admin.supabase.rpc("admin_decide_application", {
      p_listing: params.publicId,
      ...decision,
    }));
  } else if (intent === "suspend" || intent === "reinstate") {
    const reason = parseReason(form, "reason", 5, 500);
    if (reason === null) return fail("invalid_input");
    ({ error } = await admin.supabase.rpc("admin_set_suspension", {
      p_listing: params.publicId,
      p_suspend: intent === "suspend",
      p_reason: reason,
    }));
  } else if (intent === "revoke") {
    // Former staff: admin membership RLS (aal2 inline), audited by trigger.
    const membership = parseId(form, "membership");
    if (membership === null) return fail("invalid_input");
    const update = await admin.supabase
      .from("memberships")
      .update({ status: "revoked" })
      .eq("id", membership)
      .select("id");
    error =
      update.error ?? (update.data.length === 1 ? null : { code: "42501" });
  } else {
    return fail("invalid_input");
  }
  if (error !== null) return fail(problemFrom(error));
  return throwRedirect(
    `/admin/listings/${params.publicId}?done=1`,
    admin.headers,
  );
}

const STATUS_COPY = {
  draft: "Returned to the provider",
  submitted: "Waiting for review",
  live: "Live",
  suspended: "Suspended",
} as const;

export default function AdminListing({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { listing: l, decisions, members, csrf, done } = loaderData;
  return (
    <AdminShell title={l.display_name}>
      <div data-listing-status={l.status}>
        <StatusLabel
          tone={
            l.status === "live"
              ? "ok"
              : l.status === "suspended"
                ? "err"
                : "warn"
          }
        >
          {STATUS_COPY[l.status]}
        </StatusLabel>
      </div>
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
        <dt className="type-label">Organisation</dt>
        <dd>{l.organisation}</dd>
        <dt className="type-label">Service</dt>
        <dd>
          {SERVICE_OPTIONS.find((o) => o.slug === l.service_slug)?.label ??
            l.service_slug}
        </dd>
        <dt className="type-label">Where</dt>
        <dd>
          {l.mode === "fixed"
            ? `Workshop: ${l.address ?? ""} · ${l.metro}`
            : l.mode === "both"
              ? `Workshop: ${l.address ?? ""} · ${l.metro}, and comes to customers (service area kept private)`
              : `Comes to customers in ${l.metro} (service area kept private)`}
        </dd>
        <dt className="type-label">Source</dt>
        <dd>
          {l.provenance_kind === "provider_application"
            ? "Provider application"
            : "Admin import"}
        </dd>
        <dt className="type-label">Description</dt>
        <dd>{l.description}</dd>
      </dl>

      {l.status === "submitted" ? (
        <ApplicationReview csrf={csrf} business={l} />
      ) : null}

      {l.status === "live" || l.status === "suspended" ? (
        <Form
          method="post"
          className="mt-8 grid max-w-[65ch] gap-4"
          data-form={l.status === "live" ? "suspend" : "reinstate"}
        >
          <h2 className="type-title">
            {l.status === "live" ? "Suspend" : "Reinstate"}
          </h2>
          <CsrfField token={csrf} />
          <input
            type="hidden"
            name="intent"
            value={l.status === "live" ? "suspend" : "reinstate"}
          />
          <TextField
            label="Reason (kept in the decision record)"
            name="reason"
            required
            minLength={5}
            maxLength={500}
          />
          <div>
            <Button type="submit">
              {l.status === "live" ? "Suspend listing" : "Reinstate listing"}
            </Button>
          </div>
        </Form>
      ) : null}

      <section className="mt-10 max-w-[65ch]">
        <h2 className="type-title">People with access</h2>
        <ul className="mt-2 grid gap-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3"
              data-member={m.id}
              data-member-status={m.status}
            >
              <span>
                {m.name} · {m.role} · {m.status}
              </span>
              {m.status === "active" ? (
                <Form method="post">
                  <CsrfField token={csrf} />
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="membership" value={m.id} />
                  <Button type="submit" size="sm">
                    Remove access
                  </Button>
                </Form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 max-w-[65ch]">
        <h2 className="type-title">Decisions</h2>
        {decisions.length === 0 ? (
          <p className="type-body mt-2">None yet.</p>
        ) : (
          <ol className="mt-2 grid gap-2">
            {decisions.map((d) => (
              <li key={d.id} data-decision={d.decision}>
                {sast(d.decided_at)} · {d.decision}
                {d.review_method ? ` · ${d.review_method}` : ""}
                {d.labels.length > 0 ? ` · ${d.labels.join(", ")}` : ""}
                {d.reason ? ` · ${d.reason}` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>
    </AdminShell>
  );
}
