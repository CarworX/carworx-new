import { redirect } from "react-router";

import { authRequest } from "../session.server";
import {
  RETURN_COOKIE,
  readCookie,
  serializeAppCookie,
} from "../../server/security/cookies";
import { safeReturnTo } from "../../server/security/redirect";
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
  const returnTo = safeReturnTo(
    readCookie(request, RETURN_COOKIE),
    auth.config.appOrigin,
  );
  auth.headers.append(
    "Set-Cookie",
    serializeAppCookie(RETURN_COOKIE, "", { maxAge: 0 }),
  );

  const providerError = url.searchParams.get("error");
  if (providerError !== null) {
    const problem =
      providerError === "access_denied" ? "oauth_denied" : "oauth_failed";
    return redirect(`/auth/sign-in?error=${problem}`, {
      headers: auth.headers,
    });
  }
  const code = url.searchParams.get("code");
  if (code === null || code.length === 0 || code.length > 512) {
    return redirect("/auth/sign-in?error=oauth_failed", {
      headers: auth.headers,
    });
  }
  const { error } = await auth.supabase.auth.exchangeCodeForSession(code);
  if (error !== null) {
    return redirect("/auth/sign-in?error=oauth_failed", {
      headers: auth.headers,
    });
  }
  return redirect(returnTo, { headers: auth.headers });
}
