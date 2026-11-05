import { data, Form, Link, redirect } from "react-router";

import {
  classifyAuthError,
  FAILURE_MESSAGES,
  type AuthFailure,
} from "../errors";
import { isTicked, parseEmail, parsePassword } from "../forms";
import { authRequest } from "../session.server";
import { emailDecision } from "../email-policy.server";
import { observeEmailProbe } from "../email-probe.server";
import { appUrl } from "../../server/security/redirect";
import { AuthPage, CsrfField, EmailField, Notice, PasswordField } from "../ui";
import type { Route } from "./+types/sign-up";

export const meta: Route.MetaFunction = () => [
  { title: "Create an account · CarworX" },
];

type Problem =
  AuthFailure | "invalid_email" | "invalid_password" | "consent_required";

const MESSAGES: Record<Problem, string> = {
  ...FAILURE_MESSAGES,
  invalid_email: "Enter a valid email address.",
  invalid_password: "Use a password of 12 to 128 characters.",
  consent_required: "Tick the box to agree to the terms and privacy notice.",
};

function fail(problem: Problem, init: { status: number; headers?: Headers }) {
  return data({ problem }, init);
}

export function loader({ context }: Route.LoaderArgs) {
  return { csrf: context.security.csrfToken };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const email = parseEmail(form);
  const password = parsePassword(form);
  let problem: Problem | null = null;
  if (email === null) problem = "invalid_email";
  else if (password === null) problem = "invalid_password";
  // POPIA (C5 G8): consent is opt-in. The box starts unticked and the server
  // refuses the sign-up unless the browser actually sent it.
  else if (!isTicked(form, "consent")) problem = "consent_required";
  if (problem !== null || email === null || password === null) {
    return fail(problem ?? "unexpected", { status: 400 });
  }
  const auth = authRequest(request, context.security);
  const decision = emailDecision(request, auth.config, email);
  if (decision === "unavailable") return fail("email_failed", { status: 503 });
  if (decision === "acknowledge") {
    await observeEmailProbe(
      request,
      context.cloudflare?.env,
      email,
      "signup",
      "app_terminal",
    );
    return redirect("/auth/check-email?sent=signup");
  }
  await observeEmailProbe(
    request,
    context.cloudflare?.env,
    email,
    "signup",
    "auth_attempt",
  );
  const { error } = await auth.supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appUrl(auth.config.appOrigin, "/auth/confirm"),
    },
  });
  if (error !== null) {
    const failure = classifyAuthError(error);
    return fail(failure, {
      status: failure === "email_failed" ? 503 : 400,
      headers: auth.headers,
    });
  }
  // Same answer whether or not the email already has an account.
  return redirect("/auth/check-email?sent=signup", { headers: auth.headers });
}

export default function SignUp({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const problem = actionData?.problem;
  return (
    <AuthPage title="Create an account">
      {problem !== undefined && (
        <Notice tone="error">
          <span data-problem={problem}>{MESSAGES[problem]}</span>
        </Notice>
      )}
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <EmailField />
        <PasswordField autoComplete="new-password" />
        <p>
          <input id="consent" name="consent" type="checkbox" required />
          <label htmlFor="consent">
            I agree to the CarworX terms of use and privacy notice.
          </label>
        </p>
        <button type="submit">Create account</button>
      </Form>
      <p>
        Already have an account? <Link to="/auth/sign-in">Sign in</Link>
      </p>
    </AuthPage>
  );
}
