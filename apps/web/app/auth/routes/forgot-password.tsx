import { data, Form, Link } from "react-router";

import { classifyAuthError, FAILURE_MESSAGES } from "../errors";
import { parseEmail } from "../forms";
import { authRequest } from "../session.server";
import { appUrl } from "../../server/security/redirect";
import { AuthPage, CsrfField, EmailField, Notice } from "../ui";
import type { Route } from "./+types/forgot-password";

export const meta: Route.MetaFunction = () => [
  { title: "Reset your password · CarworX" },
];

export function loader({ context }: Route.LoaderArgs) {
  return { csrf: context.security.csrfToken };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const email = parseEmail(form);
  if (email === null)
    return data({ outcome: "invalid_email" as const }, { status: 400 });
  const auth = authRequest(request, context.security);
  const { error } = await auth.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl(auth.config.appOrigin, "/auth/confirm"),
  });
  if (error !== null && classifyAuthError(error) === "email_failed") {
    return data(
      { outcome: "email_failed" as const },
      { status: 503, headers: auth.headers },
    );
  }
  // Same answer whether or not the email has an account.
  return data({ outcome: "sent" as const }, { headers: auth.headers });
}

export default function ForgotPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const outcome = actionData?.outcome;
  return (
    <AuthPage title="Reset your password">
      {outcome === "sent" && (
        <Notice tone="info">
          <span data-outcome="sent">
            If that address has an account, we've sent a link to choose a new
            password.
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
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <EmailField />
        <button type="submit">Send reset link</button>
      </Form>
      <p>
        <Link to="/auth/sign-in">Back to sign in</Link>
      </p>
    </AuthPage>
  );
}
