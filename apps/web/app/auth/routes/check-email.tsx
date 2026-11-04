import { data, Form, Link } from "react-router";

import { classifyAuthError, FAILURE_MESSAGES } from "../errors";
import { parseEmail } from "../forms";
import { authRequest } from "../session.server";
import { appUrl } from "../../server/security/redirect";
import { AuthPage, CsrfField, EmailField, Notice } from "../ui";
import type { Route } from "./+types/check-email";

export const meta: Route.MetaFunction = () => [
  { title: "Check your email · CarworX" },
];

/**
 * After sign-up, and the place to ask for a new confirmation link. Answers
 * are the same whether or not an account exists; only a failed send (Auth
 * refused or couldn't deliver the email) is reported, as a recoverable state.
 */
export function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return {
    csrf: context.security.csrfToken,
    justSignedUp: url.searchParams.get("sent") === "signup",
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const email = parseEmail(form);
  if (email === null)
    return data({ outcome: "invalid_email" as const }, { status: 400 });
  const auth = authRequest(request, context.security);
  const { error } = await auth.supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: appUrl(auth.config.appOrigin, "/auth/confirm"),
    },
  });
  if (error !== null && classifyAuthError(error) === "email_failed") {
    return data(
      { outcome: "email_failed" as const },
      { status: 503, headers: auth.headers },
    );
  }
  return data({ outcome: "sent" as const }, { headers: auth.headers });
}

export default function CheckEmail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const outcome = actionData?.outcome;
  return (
    <AuthPage title="Check your email">
      {loaderData.justSignedUp && outcome === undefined && (
        <Notice tone="info">
          <span data-outcome="signup">
            If that address can be used, we've sent a link to confirm it. Open
            it to finish creating your account.
          </span>
        </Notice>
      )}
      {outcome === "sent" && (
        <Notice tone="info">
          <span data-outcome="sent">
            If that address has an account waiting for confirmation, we've sent
            a new link.
          </span>
        </Notice>
      )}
      {outcome === "email_failed" && (
        <Notice tone="error">
          <span data-problem="email_failed">
            {FAILURE_MESSAGES.email_failed}
          </span>
        </Notice>
      )}
      {outcome === "invalid_email" && (
        <Notice tone="error">
          <span data-problem="invalid_email">Enter a valid email address.</span>
        </Notice>
      )}
      <h2>Didn't get it?</h2>
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <EmailField />
        <button type="submit">Send a new link</button>
      </Form>
      <p>
        <Link to="/auth/sign-in">Back to sign in</Link>
      </p>
    </AuthPage>
  );
}
