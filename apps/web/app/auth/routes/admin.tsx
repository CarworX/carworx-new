import { data } from "react-router";

import { throwRedirect, throwStatus } from "../http.server";
import { isListedAdmin, requireSignedIn } from "../session.server";
import { AuthPage } from "../ui";
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
    { organisations: orgs.count ?? 0, auditEntries: audit.count ?? 0 },
    { headers: signedIn.headers },
  );
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  return (
    <AuthPage title="Admin">
      <dl>
        <dt>Organisations</dt>
        <dd data-admin-organisations={loaderData.organisations}>
          {loaderData.organisations}
        </dd>
        <dt>Audit log entries</dt>
        <dd data-admin-audit={loaderData.auditEntries}>
          {loaderData.auditEntries}
        </dd>
      </dl>
    </AuthPage>
  );
}
