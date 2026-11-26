import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  requireConfig,
  type SecurityContext,
} from "../server/security/boundary";
import type { ServerConfig } from "../server/security/config";
import { readCookies, SESSION_COOKIE } from "../server/security/cookies";
import { safeReturnTo } from "../server/security/redirect";
import { throwRedirect } from "./http.server";
import {
  readTermsState,
  TERMS_PATH,
  termsGateAllows,
} from "./terms-gate.server";
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
  /**
   * When this closing account will be deleted (D-098), else null. Only
   * getSignedInClosing and requireSignedIn ever return a closing account.
   */
  closingUntil: string | null;
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
  const signedIn = await getSignedInIgnoringTerms(request, security);
  if (signedIn === null) return null;
  // Pending terms (account consent) count as signed out for every decision
  // here: no enquiries, joins or private covers until the terms are accepted.
  return (await readTermsState(signedIn.supabase)) === "pending"
    ? null
    : signedIn;
}

/**
 * As getSignedIn, without the terms check. Only for the password-recovery step,
 * which must work before consent: a recovery link signs the person in, and
 * consent comes after. Closing accounts are still signed out.
 */
export async function getSignedInIgnoringTerms(
  request: Request,
  security: SecurityContext,
): Promise<SignedIn | null> {
  const signedIn = await getSignedInClosing(request, security);
  // A closing account (D-098) is signed out everywhere but its own closing
  // page: it cannot send enquiries, join teams or see private covers.
  return signedIn?.closingUntil ? null : signedIn;
}

/**
 * A signed-in, non-closing person whose account terms are pending, or null.
 * Pages that must send such a person to consent (an invite) use this, so they
 * can redirect instead of treating them as signed out.
 */
export async function signedInWithPendingTerms(
  request: Request,
  security: SecurityContext,
): Promise<SignedIn | null> {
  const signedIn = await getSignedInClosing(request, security);
  if (signedIn === null || signedIn.closingUntil) return null;
  return (await readTermsState(signedIn.supabase)) === "pending"
    ? signedIn
    : null;
}

/** As getSignedIn, but also returns an account that is closing. */
export async function getSignedInClosing(
  request: Request,
  security: SecurityContext,
): Promise<SignedIn | null> {
  const auth = authRequest(request, security);
  const { data, error } = await auth.supabase.auth.getUser();
  if (error !== null) return null;
  // Read only after getUser validated this same session's access token.
  const level = await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level.error !== null) return null;
  // Fails closed: if the closure status can't be read, treat the account as
  // closing, so a closed account is never let back in by an outage.
  const closing: { data: unknown; error: unknown } = await auth.supabase.rpc(
    "account_closure_status",
  );
  const closingUntil =
    closing.error !== null
      ? "unknown"
      : typeof closing.data === "string"
        ? closing.data
        : null;
  return {
    ...auth,
    user: data.user,
    aal: level.data.currentLevel === "aal2" ? "aal2" : "aal1",
    nextAal: level.data.nextLevel === "aal2" ? "aal2" : "aal1",
    closingUntil,
  };
}

/** Pages a closing account may still open: its closing page and sign-out. */
const CLOSING_PATHS = /^\/(?:account\/closing|auth\/sign-out)$/;

/** Whether the request carries a session cookie at all (no network call). */
export function hasSessionCookie(request: Request): boolean {
  return readCookies(request).some((c) => SESSION_CHUNK.test(c.name));
}

export function signInUrl(request: Request, appOrigin: string): string {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(`${url.pathname}${url.search}`, appOrigin);
  return `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Where a person with pending terms is sent. A GET keeps its own address as
 * returnTo, so accepting brings them back; a POST has no page to return to,
 * unless the caller names one (an invite names /join).
 */
export function termsUrl(
  request: Request,
  appOrigin: string,
  returnTo?: string,
): string {
  const target =
    returnTo ??
    (request.method === "GET"
      ? (() => {
          const url = new URL(request.url);
          return `${url.pathname}${url.search}`;
        })()
      : null);
  if (target === null) return TERMS_PATH;
  const safe = safeReturnTo(target, appOrigin);
  return `${TERMS_PATH}?returnTo=${encodeURIComponent(safe)}`;
}

/** Signed-in user, or a redirect to sign in (clearing a dead session). */
export async function requireSignedIn(
  request: Request,
  security: SecurityContext,
): Promise<SignedIn> {
  const signedIn = await getSignedInClosing(request, security);
  if (signedIn !== null && signedIn.closingUntil === null) {
    const path = new URL(request.url).pathname;
    const state = await readTermsState(signedIn.supabase);
    if (termsGateAllows(path, state)) return signedIn;
    return throwRedirect(
      termsUrl(request, signedIn.config.appOrigin),
      signedIn.headers,
    );
  }
  if (signedIn !== null) {
    if (CLOSING_PATHS.test(new URL(request.url).pathname)) return signedIn;
    return throwRedirect("/account/closing", signedIn.headers);
  }
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
