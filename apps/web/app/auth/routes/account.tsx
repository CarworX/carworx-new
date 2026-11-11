import { data, Form, Link } from "react-router";

import { throwStatus } from "../http.server";
import { requireSignedIn } from "../session.server";
import { AuthPage, CsrfField, Notice } from "../ui";
import type { Route } from "./+types/account";

export const meta: Route.MetaFunction = () => [
  { title: "Your account · CarworX" },
];

/**
 * /account: the signed-in person's own page. Organisations come from the
 * database through RLS (active memberships only), never from the token.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const { data: organisations, error } = await signedIn.supabase
    .from("organisations")
    .select("id, name")
    .order("name")
    .overrideTypes<{ id: string; name: string }[], { merge: false }>();
  if (error !== null) throwStatus(503, signedIn.headers);
  const url = new URL(request.url);
  return data(
    {
      csrf: context.security.csrfToken,
      email: signedIn.user.email ?? "",
      organisations,
      notice:
        url.searchParams.get("confirmed") === "1"
          ? "Your email is confirmed."
          : url.searchParams.get("password") === "updated"
            ? "Your new password is saved."
            : null,
    },
    { headers: signedIn.headers },
  );
}

export default function Account({ loaderData }: Route.ComponentProps) {
  return (
    <AuthPage title="Your account">
      {loaderData.notice !== null && (
        <Notice tone="info">{loaderData.notice}</Notice>
      )}
      <p>
        Signed in as <span data-account-email>{loaderData.email}</span>
      </p>
      <h2>Your organisations</h2>
      {loaderData.organisations.length === 0 ? (
        <p data-organisations="none">
          You're not a member of any organisation yet.
        </p>
      ) : (
        <ul data-organisations="list">
          {loaderData.organisations.map((org) => (
            <li key={org.id}>
              <Link to={`/org/${org.id}`}>{org.name}</Link>
            </li>
          ))}
        </ul>
      )}
      <h2>Your business listings</h2>
      <p>
        <Link to="/provider">See your listings, decisions and claims</Link> or{" "}
        <Link to="/provider/apply">apply to list a business</Link>.
      </p>
      <Form method="post" action="/auth/sign-out">
        <CsrfField token={loaderData.csrf} />
        <button type="submit">Sign out</button>
      </Form>
    </AuthPage>
  );
}
