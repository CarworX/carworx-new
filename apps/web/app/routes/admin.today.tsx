import { data } from "react-router";

import { throwStatus } from "../auth/http.server";
import { requireAdmin } from "../server/providers/admin.server";
import { sast } from "../server/providers/forms";
import { AdminShell } from "../ui/admin/AdminShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/admin.today";

export const meta: Route.MetaFunction = () => [
  { title: "Today · Admin · CarworX" },
];

interface Application {
  public_id: string;
  display_name: string;
  submitted_at: string | null;
  created_at: string;
}
interface Claim {
  id: string;
  listing_public_id: string;
  created_at: string;
}
interface Decision {
  id: string;
  listing_public_id: string;
  decision: string;
  decided_at: string;
}

/** User JWT only: requireAdmin and table RLS independently require native aal2. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const admin = await requireAdmin(request, context.security);
  const db = admin.supabase;
  const [applications, disputes, claims, support, businesses, decisions] =
    await Promise.all([
      db
        .from("listings")
        .select("public_id, display_name, submitted_at, created_at", {
          count: "exact",
        })
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true, nullsFirst: true })
        .order("public_id")
        .limit(5)
        .overrideTypes<Application[], { merge: false }>(),
      db
        .from("listing_claims")
        .select("id, listing_public_id, created_at", { count: "exact" })
        .eq("status", "disputed")
        .order("created_at")
        .order("id")
        .limit(5)
        .overrideTypes<Claim[], { merge: false }>(),
      db
        .from("listing_claims")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      db
        .from("support_cases")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      db
        .from("listings")
        .select("public_id", { count: "exact", head: true })
        .eq("status", "live"),
      db
        .from("listing_decisions")
        .select("id, listing_public_id, decision, decided_at")
        .eq("decided_by", admin.user.id)
        .order("decided_at", { ascending: false })
        .order("id")
        .limit(5)
        .overrideTypes<Decision[], { merge: false }>(),
    ]);
  if (
    [applications, disputes, claims, support, businesses, decisions].some(
      (result) => result.error !== null,
    )
  ) {
    throwStatus(503, admin.headers);
  }
  return data(
    {
      counts: {
        applications: applications.count ?? 0,
        disputes: disputes.count ?? 0,
        claims: claims.count ?? 0,
        support: support.count ?? 0,
        businesses: businesses.count ?? 0,
      },
      applications: applications.data ?? [],
      disputes: disputes.data ?? [],
      decisions: decisions.data ?? [],
    },
    { headers: admin.headers },
  );
}

export default function AdminToday({ loaderData }: Route.ComponentProps) {
  const { counts, disputes, applications, decisions } = loaderData;
  const metrics = [
    {
      title: "Open disputes",
      value: counts.disputes,
      href: "/admin/claims?status=disputed",
    },
    {
      title: "Applications waiting",
      value: counts.applications,
      href: "/admin/listings?status=submitted",
    },
    {
      title: "Claims waiting",
      value: counts.claims,
      href: "/admin/claims?status=submitted",
    },
    {
      title: "Open support cases",
      value: counts.support,
      href: "/admin/support?status=open",
    },
    {
      title: "Live businesses",
      value: counts.businesses,
      href: "/admin/listings?status=live",
    },
  ];
  return (
    <AdminShell title="Today">
      <p className="type-body mb-5">
        Start with disputes, then the oldest applications. Decisions use your
        signed-in admin account and are recorded in the audit log.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-admin-today>
        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="rounded-2xl bg-[var(--surface)] p-4"
          >
            <dt className="type-label">{metric.title}</dt>
            <dd className="type-display-lg mt-2">{metric.value}</dd>
            <dd className="mt-2">
              <a className="cx-tlink" href={metric.href}>
                Open queue
              </a>
            </dd>
          </div>
        ))}
      </dl>
      {disputes.length > 0 ? (
        <section className="mt-8" aria-labelledby="urgent-disputes">
          <h2 id="urgent-disputes" className="type-title">
            Disputes need attention
          </h2>
          <StatusNote
            tone="warn"
            title="Check who should control the business."
          >
            Resolve open disputes before approving another transfer.
          </StatusNote>
          <ul className="mt-3 grid gap-3">
            {disputes.map((claim) => (
              <li key={claim.id}>
                <a className="cx-tlink" href={`/admin/claims/${claim.id}`}>
                  Disputed claim on listing{" "}
                  {claim.listing_public_id.slice(0, 8)}
                </a>
                <p className="type-caption">{sast(claim.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-8" aria-labelledby="oldest-applications">
        <h2 id="oldest-applications" className="type-title">
          Oldest applications
        </h2>
        {applications.length === 0 ? (
          <StatusNote title="No applications waiting." />
        ) : (
          <ul className="mt-3 grid gap-3">
            {applications.map((application) => (
              <li key={application.public_id}>
                <a
                  className="cx-tlink"
                  href={`/admin/listings/${application.public_id}`}
                >
                  {application.display_name}
                </a>
                <p className="type-caption">
                  {sast(application.submitted_at ?? application.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-8" aria-labelledby="recent-decisions">
        <h2 id="recent-decisions" className="type-title">
          Your recent decisions
        </h2>
        {decisions.length === 0 ? (
          <p className="type-body mt-2">No decisions yet.</p>
        ) : (
          <ol className="mt-3 grid gap-3">
            {decisions.map((decision) => (
              <li key={decision.id}>
                <a
                  className="cx-tlink"
                  href={`/admin/listings/${decision.listing_public_id}`}
                >
                  {decision.decision} · {decision.listing_public_id.slice(0, 8)}
                </a>
                <p className="type-caption">{sast(decision.decided_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </AdminShell>
  );
}
