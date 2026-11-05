import { data } from "react-router";

import { throwStatus } from "../http.server";
import { requireSignedIn } from "../session.server";
import { AuthPage } from "../ui";
import type { Route } from "./+types/org";

export const meta: Route.MetaFunction = () => [
  { title: "Organisation · CarworX" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /org/:orgId: visible only while the user has an ACTIVE membership (or is
 * an aal2 admin), decided by RLS on every request. A revoked membership is a
 * 404 on the very next request; nothing is cached in the session.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!UUID.test(params.orgId)) throwStatus(404, signedIn.headers);
  const { data: org, error } = await signedIn.supabase
    .from("organisations")
    .select("id, name")
    .eq("id", params.orgId)
    .maybeSingle<{ id: string; name: string }>();
  if (error !== null) throwStatus(503, signedIn.headers);
  if (org === null) throwStatus(404, signedIn.headers);
  return data({ org }, { headers: signedIn.headers });
}

export default function Organisation({ loaderData }: Route.ComponentProps) {
  return (
    <AuthPage title={loaderData.org.name}>
      <p data-org-id={loaderData.org.id}>
        You're a member of this organisation.
      </p>
    </AuthPage>
  );
}
