import { data, Form, Link, redirect } from "react-router";

import {
  classifyAuthError,
  FAILURE_MESSAGES,
  type AuthFailure,
} from "../errors";
import { useState, useSyncExternalStore } from "react";
import { signedInDestination } from "../after-sign-in.server";
import { field, isTicked, parseEmail } from "../forms";
import { throwRedirect } from "../http.server";
import { authRequest, getSignedIn } from "../session.server";
import { safeReturnTo } from "../../server/security/redirect";
import { GoogleButton } from "../GoogleButton";
import { exchangeGoogle, googleButton, startGoogle } from "../google.server";
import { ConsentCheckbox } from "../../ui/Field";
import { AuthPage, CsrfField, EmailField, Notice, PasswordField } from "../ui";
import type { Route } from "./+types/sign-in";

export const meta: Route.MetaFunction = () => [{ title: "Sign in · CarworX" }];

type Problem =
  AuthFailure | "oauth_denied" | "oauth_failed" | "consent_required";

const subscribe = () => () => undefined;

const MESSAGES: Record<Problem, string> = {
  ...FAILURE_MESSAGES,
  oauth_denied:
    "Google sign-in was cancelled. You can try again, or use your email and password.",
  oauth_failed:
    "We couldn't finish signing you in with Google. Try again, or use your email and password.",
  consent_required:
    "Tick the box to agree to the terms and privacy notice before signing in with Google.",
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
  const headers = new Headers();
  const google = await googleButton(context.cloudflare.env, headers);
  return data(
    {
      csrf: context.security.csrfToken,
      returnTo: url.searchParams.get("returnTo") ?? "",
      problem: queryProblem(url),
      google,
    },
    { headers },
  );
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) =>
  loaderHeaders;

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const auth = authRequest(request, context.security);
  // "" when nothing safe was asked for: the destination is then decided by
  // who the person is, after sign-in (signedInDestination).
  const requested = safeReturnTo(
    field(form, "returnTo"),
    auth.config.appOrigin,
    "",
  );

  const intent = field(form, "intent");
  if (intent === "google" || intent === "google-id") {
    // Same rule as sign-up, server side for no-JS: the terms box must be ticked.
    if (!isTicked(form, "consent"))
      return fail("consent_required", { status: 400 });
    const response =
      intent === "google"
        ? await startGoogle(auth, requested)
        : await exchangeGoogle(
            request,
            context.cloudflare.env,
            auth,
            form.get("googleCredential"),
            requested,
          );
    return (
      response ?? fail("oauth_failed", { status: 502, headers: auth.headers })
    );
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
  const destination = requested || (await signedInDestination(auth.supabase));
  return redirect(destination, { headers: auth.headers });
}

export default function SignIn({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const problem = actionData?.problem ?? loaderData.problem;
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [agreed, setAgreed] = useState(false);
  // Off until the page loads in the browser, so no-JS users still reach the
  // server check (B-10).
  const gated = hydrated && !agreed;
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
      <Form id="google-sign-in" method="post" reloadDocument>
        <CsrfField token={loaderData.csrf} />
        <input type="hidden" name="returnTo" value={loaderData.returnTo} />
        <ConsentCheckbox
          name="consent"
          onChange={(checked) => {
            setAgreed(checked);
          }}
        >
          I agree to the CarworX terms of use and privacy notice.
        </ConsentCheckbox>
        <GoogleButton
          formId="google-sign-in"
          options={loaderData.google}
          requireConsent
          disabled={gated}
        />
      </Form>
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <input type="hidden" name="returnTo" value={loaderData.returnTo} />
        <input type="hidden" name="intent" value="password" />
        <EmailField />
        <PasswordField autoComplete="current-password" />
        <button className="cx-btn primary wide" type="submit">
          Sign in
        </button>
      </Form>
      <p>
        <Link to="/auth/forgot-password">Forgot your password?</Link>
      </p>
      <p>
        New to CarworX?{" "}
        <Link
          to={
            loaderData.returnTo
              ? `/auth/sign-up?returnTo=${encodeURIComponent(loaderData.returnTo)}`
              : "/auth/sign-up"
          }
        >
          Create an account
        </Link>
      </p>
    </AuthPage>
  );
}
