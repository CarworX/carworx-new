import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  requireConfig,
  type SecurityContext,
} from "../server/security/boundary";
import type { ServerConfig } from "../server/security/config";
import { readCookies, SESSION_COOKIE } from "../server/security/cookies";
import { safeReturnTo } from "../server/security/redirect";
import { throwRedirect } from "./http.server";
import { createRequestSupabase } from "./supabase.server";

const SESSION_CHUNK = new RegExp(`^${SESSION_COOKIE}(?:\\.\\d+)?$`);

export interface AuthRequest {
  config: ServerConfig;
  supabase: SupabaseClient;
  /** Set-Cookie headers to send back (refreshed or cleared session). */
  headers: Headers;
}

export interface SignedIn extends AuthRequest {
  user: User;
  /** From the session that the Auth server just validated. */
  aal: "aal1" | "aal2";
  /** "aal2" if the user has a verified factor, so a step-up is possible. */
  nextAal: "aal1" | "aal2";
}

export function authRequest(
  request: Request,
  security: SecurityContext,
): AuthRequest {
  const config = requireConfig(security);
  return { config, ...createRequestSupabase(request, config) };
}

/**
 * Validates the session cookie with the Supabase Auth server on every call
 * (`getUser` is a round trip; a cookie alone is never trusted). A signed-out
 * session, deleted user, forged or expired token all come back as null.
 */
export async function getSignedIn(
  request: Request,
  security: SecurityContext,
): Promise<SignedIn | null> {
  const auth = authRequest(request, security);
  const { data, error } = await auth.supabase.auth.getUser();
  if (error !== null) return null;
  // Read only after getUser validated this same session's access token.
  const level = await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level.error !== null) return null;
  return {
    ...auth,
    user: data.user,
    aal: level.data.currentLevel === "aal2" ? "aal2" : "aal1",
    nextAal: level.data.nextLevel === "aal2" ? "aal2" : "aal1",
  };
}

export function signInUrl(request: Request, appOrigin: string): string {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(`${url.pathname}${url.search}`, appOrigin);
  return `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Signed-in user, or a redirect to sign in (clearing a dead session). */
export async function requireSignedIn(
  request: Request,
  security: SecurityContext,
): Promise<SignedIn> {
  const signedIn = await getSignedIn(request, security);
  if (signedIn !== null) return signedIn;
  const auth = authRequest(request, security);
  // Clear a dead session's cookies (and end it at the Auth server if it
  // somehow still exists there). Only when there is one: an in-flight Google
  // sign-in's PKCE verifier cookies must survive a visit to another page.
  if (readCookies(request).some((c) => SESSION_CHUNK.test(c.name))) {
    await auth.supabase.auth.signOut({ scope: "local" });
  }
  return throwRedirect(signInUrl(request, auth.config.appOrigin), auth.headers);
}

/**
 * Whether the caller is on the server-controlled admin list
 * (private.platform_admins, via a narrow RPC). Being listed grants nothing
 * by itself: admin pages also need aal2, and so does every admin RLS policy.
 */
export async function isListedAdmin(
  supabase: SupabaseClient,
): Promise<boolean> {
  const result: { data: unknown; error: unknown } = await supabase.rpc(
    "caller_is_listed_admin",
  );
  return result.error === null && result.data === true;
}
