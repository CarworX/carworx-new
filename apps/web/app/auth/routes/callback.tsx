import { redirect } from "react-router";

import {
  GOOGLE_TERMS_COOKIE,
  recordAccountTerms,
} from "../account-terms.server";
import { signedInDestination } from "../after-sign-in.server";
import { authRequest } from "../session.server";
import {
  RETURN_COOKIE,
  readCookie,
  serializeAppCookie,
} from "../../server/security/cookies";
import {
  DEFAULT_AFTER_SIGN_IN,
  safeReturnTo,
} from "../../server/security/redirect";
import type { Route } from "./+types/callback";

/**
 * GET /auth/callback: where Supabase sends the browser after Google.
 *
 * Exchanges the one-time code for a session using the PKCE verifier cookie
 * set when sign-in started (so a code from another browser is useless).
 * Account linking is Supabase's verified identity linking only: the app
 * never looks up or merges accounts by email itself.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const auth = authRequest(request, context.security);
  // "" when no safe returnTo was asked for: decided after sign-in (B-14).
  const requested = safeReturnTo(
    readCookie(request, RETURN_COOKIE),
    auth.config.appOrigin,
    "",
  );
  auth.headers.append(
    "Set-Cookie",
    serializeAppCookie(RETURN_COOKIE, "", { maxAge: 0 }),
  );
  const termsVersion = readCookie(request, GOOGLE_TERMS_COOKIE);
  auth.headers.append(
    "Set-Cookie",
    serializeAppCookie(GOOGLE_TERMS_COOKIE, "", { maxAge: 0 }),
  );
  const signup = readCookie(request, "__Host-cx-google-signup") === "1";
  if (signup)
    auth.headers.append(
      "Set-Cookie",
      serializeAppCookie("__Host-cx-google-signup", "", { maxAge: 0 }),
    );
  const failure = (error: string) => {
    const query = new URLSearchParams({ error });
    if (requested !== "" && requested !== DEFAULT_AFTER_SIGN_IN)
      query.set("returnTo", requested);
    return redirect(`/auth/sign-${signup ? "up" : "in"}?${query}`, {
      headers: auth.headers,
    });
  };

  const providerError = url.searchParams.get("error");
  if (providerError !== null) {
    const problem =
      providerError === "access_denied" ? "oauth_denied" : "oauth_failed";
    return failure(problem);
  }
  const code = url.searchParams.get("code");
  if (code === null || code.length === 0 || code.length > 512) {
    return failure("oauth_failed");
  }
  const { error } = await auth.supabase.auth.exchangeCodeForSession(code);
  if (error !== null) {
    return failure("oauth_failed");
  }
  if (!(await recordAccountTerms(auth, termsVersion)))
    return new Response(null, { status: 503, headers: auth.headers });
  const destination = requested || (await signedInDestination(auth.supabase));
  return redirect(destination, { headers: auth.headers });
}
