import { data, Form, Link, redirect } from "react-router";

import {
  classifyAuthError,
  FAILURE_MESSAGES,
  type AuthFailure,
} from "../errors";
import { field, isTicked, parseEmail, parsePassword } from "../forms";
import { authRequest } from "../session.server";
import { emailDecision } from "../email-policy.server";
import { observeEmailProbe } from "../email-probe.server";
import {
  RETURN_COOKIE,
  serializeAppCookie,
} from "../../server/security/cookies";
import {
  appUrl,
  DEFAULT_AFTER_SIGN_IN,
  safeReturnTo,
} from "../../server/security/redirect";
import { useState, useSyncExternalStore } from "react";
import { AuthPage, CsrfField, EmailField, Notice, PasswordField } from "../ui";
import { GoogleButton } from "../GoogleButton";
import { ACCOUNT_TERMS_VERSION } from "../account-terms.server";
import { exchangeGoogle, googleButton, startGoogle } from "../google.server";
import type { Route } from "./+types/sign-up";

export const meta: Route.MetaFunction = () => [
  { title: "Create an account · CarworX" },
];

type Problem =
  | AuthFailure
  | "invalid_email"
  | "invalid_password"
  | "consent_required"
  | "oauth_failed"
  | "oauth_denied";

const MESSAGES: Record<Problem, string> = {
  ...FAILURE_MESSAGES,
  invalid_email: "Enter a valid email address.",
  invalid_password: "Use a password of 12 to 128 characters.",
  consent_required: "Tick the box to agree to the terms and privacy notice.",
  oauth_failed:
    "We couldn't finish signing up with Google. Try again, or use email and password.",
  oauth_denied: "Google sign-up was cancelled.",
};

function fail(problem: Problem, init: { status: number; headers?: Headers }) {
  return data({ problem }, init);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const headers = new Headers();
  const google = await googleButton(context.cloudflare.env, headers);
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const problem: Problem | undefined =
    error === "oauth_failed" || error === "oauth_denied" ? error : undefined;
  return data(
    {
      csrf: context.security.csrfToken,
      returnTo: url.searchParams.get("returnTo") ?? "",
      problem,
      google,
    },
    { headers },
  );
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) =>
  loaderHeaders;

/**
 * Where to go after the confirmation link (D-097: back to the business page
 * the enquiry was for). It rides in a short-lived cookie, like the Google
 * flow, so it only applies when the link is opened in this same browser.
 */
function rememberReturn(headers: Headers, returnTo: string) {
  if (returnTo === DEFAULT_AFTER_SIGN_IN) return;
  headers.append(
    "Set-Cookie",
    serializeAppCookie(RETURN_COOKIE, returnTo, { maxAge: 3600 }),
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = field(form, "intent");
  if (intent === "google" || intent === "google-id") {
    if (!isTicked(form, "consent"))
      return fail("consent_required", { status: 400 });
    const auth = authRequest(request, context.security);
    const returnTo = safeReturnTo(
      field(form, "returnTo"),
      auth.config.appOrigin,
    );
    const response =
      intent === "google"
        ? await startGoogle(auth, returnTo, true)
        : await exchangeGoogle(
            request,
            context.cloudflare.env,
            auth,
            form.get("googleCredential"),
            returnTo,
          );
    return (
      response ?? fail("oauth_failed", { status: 502, headers: auth.headers })
    );
  }
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
  const returnTo = safeReturnTo(field(form, "returnTo"), auth.config.appOrigin);
  const decision = emailDecision(request, auth.config, email);
  if (decision === "unavailable") return fail("email_failed", { status: 503 });
  if (decision === "acknowledge") {
    await observeEmailProbe(request, context, email, "signup", "app_terminal");
    return redirect("/auth/check-email?sent=signup");
  }
  await observeEmailProbe(request, context, email, "signup", "auth_attempt");
  const { error } = await auth.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        terms_version: ACCOUNT_TERMS_VERSION,
        terms_ticked_at: new Date().toISOString(),
      },
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
  rememberReturn(auth.headers, returnTo);
  return redirect("/auth/check-email?sent=signup", { headers: auth.headers });
}

// Off until the page has loaded in the browser, so no-JS users still reach the
// server check, which refuses an unticked box (B-10).
const subscribe = () => () => undefined;

export default function SignUp({
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
  const gated = hydrated && !agreed;
  return (
    <AuthPage title="Create an account">
      {problem !== undefined && (
        <Notice tone="error">
          <span data-problem={problem}>{MESSAGES[problem]}</span>
        </Notice>
      )}
      <Form id="google-sign-up" method="post" reloadDocument>
        <CsrfField token={loaderData.csrf} />
        <input type="hidden" name="returnTo" value={loaderData.returnTo} />
        <EmailField />
        <PasswordField autoComplete="new-password" />
        <p>
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            checked={agreed}
            onChange={(event) => {
              setAgreed(event.currentTarget.checked);
            }}
          />
          <label htmlFor="consent">
            I agree to the CarworX terms of use and privacy notice.
          </label>
        </p>
        <button className="cx-btn primary wide" type="submit" disabled={gated}>
          Create account
        </button>
        <GoogleButton
          formId="google-sign-up"
          options={loaderData.google}
          signup
          disabled={gated}
        />
      </Form>
      <p>
        Already have an account?{" "}
        <Link
          to={
            loaderData.returnTo
              ? `/auth/sign-in?returnTo=${encodeURIComponent(loaderData.returnTo)}`
              : "/auth/sign-in"
          }
        >
          Sign in
        </Link>
      </p>
    </AuthPage>
  );
}
