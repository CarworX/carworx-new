import { data, Form, Link, redirect } from "react-router";

import {
  classifyAuthError,
  FAILURE_MESSAGES,
  type AuthFailure,
} from "../errors";
import { field, parsePassword } from "../forms";
import { getSignedIn } from "../session.server";
import { AuthPage, CsrfField, Notice, PasswordField } from "../ui";
import type { Route } from "./+types/reset-password";

export const meta: Route.MetaFunction = () => [
  { title: "Choose a new password · CarworX" },
];

type Problem = AuthFailure | "invalid_password" | "mismatch";

const MESSAGES: Record<Problem, string> = {
  ...FAILURE_MESSAGES,
  invalid_password: "Use a password of 12 to 128 characters.",
  mismatch: "The two passwords don't match.",
};

/** Reached from a recovery link (/auth/confirm), which signs the user in. */
function fail(problem: Problem, init: { status: number; headers?: Headers }) {
  return data({ problem }, init);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await getSignedIn(request, context.security);
  return data(
    { csrf: context.security.csrfToken, hasSession: signedIn !== null },
    { headers: signedIn?.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await getSignedIn(request, context.security);
  if (signedIn === null) {
    return fail("link_invalid", { status: 401 });
  }
  const form = await request.formData();
  const password = parsePassword(form);
  if (password === null) {
    return fail("invalid_password", { status: 400 });
  }
  if (field(form, "confirm") !== password) {
    return fail("mismatch", { status: 400 });
  }
  const { error } = await signedIn.supabase.auth.updateUser({ password });
  if (error !== null) {
    return fail(classifyAuthError(error), {
      status: 400,
      headers: signedIn.headers,
    });
  }
  return redirect("/account?password=updated", { headers: signedIn.headers });
}

export default function ResetPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const problem = actionData?.problem;
  if (!loaderData.hasSession || problem === "link_invalid") {
    return (
      <AuthPage title="This link didn't work">
        <Notice tone="error">
          <span data-problem="link_invalid">
            {FAILURE_MESSAGES.link_invalid}
          </span>
        </Notice>
        <p>
          <Link to="/auth/forgot-password">Send a new password reset link</Link>
        </p>
      </AuthPage>
    );
  }
  return (
    <AuthPage title="Choose a new password">
      {problem !== undefined && (
        <Notice tone="error">
          <span data-problem={problem}>{MESSAGES[problem]}</span>
        </Notice>
      )}
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <PasswordField autoComplete="new-password" label="New password" />
        <PasswordField
          name="confirm"
          autoComplete="new-password"
          label="New password again"
        />
        <button type="submit">Save new password</button>
      </Form>
    </AuthPage>
  );
}
