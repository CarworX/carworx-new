import { data, Form, Link, redirect } from "react-router";

import {
  classifyAuthError,
  FAILURE_MESSAGES,
  type AuthFailure,
} from "../errors";
import { field, parseEmail } from "../forms";
import { throwRedirect } from "../http.server";
import { authRequest, getSignedIn } from "../session.server";
import {
  RETURN_COOKIE,
  serializeAppCookie,
} from "../../server/security/cookies";
import { appUrl, safeReturnTo } from "../../server/security/redirect";
import { AuthPage, CsrfField, EmailField, Notice, PasswordField } from "../ui";
import type { Route } from "./+types/sign-in";

export const meta: Route.MetaFunction = () => [{ title: "Sign in · CarworX" }];

/** Google: basic scopes only (D-042, PLAN §9.1). */
export const GOOGLE_SCOPES = "openid email profile";

type Problem = AuthFailure | "oauth_denied" | "oauth_failed";

const MESSAGES: Record<Problem, string> = {
  ...FAILURE_MESSAGES,
  oauth_denied:
    "Google sign-in was cancelled. You can try again, or use your email and password.",
  oauth_failed:
    "We couldn't finish signing you in with Google. Try again, or use your email and password.",
};

const QUERY_PROBLEMS = new Set<Problem>([
  "oauth_denied",
  "oauth_failed",
  "link_invalid",
]);

function queryProblem(url: URL): Problem | undefined {
  const value = url.searchParams.get("error") as Problem | null;
  return value !== null && QUERY_PROBLEMS.has(value) ? value : undefined;
}

function fail(problem: Problem, init: { status: number; headers?: Headers }) {
  return data({ problem }, init);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const signedIn = await getSignedIn(request, context.security);
  if (signedIn !== null) {
    throwRedirect(
      safeReturnTo(url.searchParams.get("returnTo"), signedIn.config.appOrigin),
      signedIn.headers,
    );
  }
  return {
    csrf: context.security.csrfToken,
    returnTo: url.searchParams.get("returnTo") ?? "",
    problem: queryProblem(url),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const auth = authRequest(request, context.security);
  const returnTo = safeReturnTo(field(form, "returnTo"), auth.config.appOrigin);

  if (field(form, "intent") === "google") {
    const { data: oauth, error } = await auth.supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Exact allowlisted URL; the return path rides in a cookie instead of
        // a query string so Supabase's redirect allowlist can stay exact.
        redirectTo: appUrl(auth.config.appOrigin, "/auth/callback"),
        scopes: GOOGLE_SCOPES,
        skipBrowserRedirect: true,
      },
    });
    if (error !== null) {
      return fail("oauth_failed", { status: 502, headers: auth.headers });
    }
    auth.headers.append(
      "Set-Cookie",
      serializeAppCookie(RETURN_COOKIE, returnTo, { maxAge: 600 }),
    );
    // The boundary only lets this through to Supabase's /auth/v1/authorize.
    return redirect(oauth.url, { headers: auth.headers });
  }

  const email = parseEmail(form);
  const password = field(form, "password");
  if (email === null || password.length === 0 || password.length > 128) {
    return fail("invalid_credentials", { status: 400 });
  }
  const { error } = await auth.supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error !== null) {
    const problem = classifyAuthError(error);
    return fail(problem === "unexpected" ? "invalid_credentials" : problem, {
      status: problem === "rate_limited" ? 429 : 400,
      headers: auth.headers,
    });
  }
  // Admin pages ask for the TOTP step-up themselves (aal2), wherever the
  // user lands first.
  return redirect(returnTo, { headers: auth.headers });
}

export default function SignIn({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const problem = actionData?.problem ?? loaderData.problem;
  return (
    <AuthPage title="Sign in">
      {problem !== undefined && (
        <Notice tone="error">
          <span data-problem={problem}>{MESSAGES[problem]}</span>
        </Notice>
      )}
      {problem === "email_not_confirmed" && (
        <p>
          <Link to="/auth/check-email?resend=signup">
            Send a new confirmation link
          </Link>
        </p>
      )}
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <input type="hidden" name="returnTo" value={loaderData.returnTo} />
        <input type="hidden" name="intent" value="google" />
        <button type="submit">Continue with Google</button>
      </Form>
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <input type="hidden" name="returnTo" value={loaderData.returnTo} />
        <input type="hidden" name="intent" value="password" />
        <EmailField />
        <PasswordField autoComplete="current-password" />
        <button type="submit">Sign in</button>
      </Form>
      <p>
        <Link to="/auth/forgot-password">Forgot your password?</Link>
      </p>
      <p>
        New to CarworX? <Link to="/auth/sign-up">Create an account</Link>
      </p>
    </AuthPage>
  );
}
