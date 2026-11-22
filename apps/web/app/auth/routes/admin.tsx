import { data } from "react-router";

import { throwRedirect, throwStatus } from "../http.server";
import { isListedAdmin, requireSignedIn } from "../session.server";
import { AdminShell } from "../../ui/admin/AdminShell";
import type { Route } from "./+types/admin";

export const meta: Route.MetaFunction = () => [{ title: "Admin · CarworX" }];

/**
 * /admin: platform admins only, and only with an aal2 (TOTP-verified)
 * session.
 *   - not listed in private.platform_admins → 404 (nothing to discover);
 *   - listed but aal1 → sent to /auth/mfa, no admin data is read;
 *   - aal2 → counts read with the user's JWT, so RLS checks aal2 again.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!(await isListedAdmin(signedIn.supabase))) {
    throwStatus(404, signedIn.headers);
  }
  if (signedIn.aal !== "aal2") {
    throwRedirect("/auth/mfa?returnTo=%2Fadmin", signedIn.headers);
  }
  const [orgs, audit] = await Promise.all([
    signedIn.supabase
      .from("organisations")
      .select("id", { count: "exact", head: true }),
    signedIn.supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true }),
  ]);
  if (orgs.error !== null || audit.error !== null) {
    throwStatus(503, signedIn.headers);
  }
  return data(
    {
      csrf: context.security.csrfToken,
      organisations: orgs.count ?? 0,
      auditEntries: audit.count ?? 0,
    },
    { headers: signedIn.headers },
  );
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  return (
    <AdminShell title="Admin overview">
      <dl className="cx-admin-kpis">
        <div className="cx-admin-kpi">
          <dt>Organisations</dt>
          <dd data-admin-organisations={loaderData.organisations}>
            <strong>{loaderData.organisations}</strong>
          </dd>
        </div>
        <div className="cx-admin-kpi">
          <dt>Audit log entries</dt>
          <dd data-admin-audit={loaderData.auditEntries}>
            <strong>{loaderData.auditEntries}</strong>
          </dd>
        </div>
      </dl>
      <nav aria-label="Admin tools">
        <ul>
          <li>
            <a href="/admin/today">Today</a>
          </li>
          <li>
            <a href="/admin/listings?status=submitted">Review queue</a>
          </li>
          <li>
            <a href="/admin/claims">Claims and disputes</a>
          </li>
          <li>
            <a href="/admin/audit">Audit log</a>
          </li>
        </ul>
      </nav>
    </AdminShell>
  );
}
