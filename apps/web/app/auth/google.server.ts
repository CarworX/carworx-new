import {
  ACCOUNT_TERMS_VERSION,
  GOOGLE_TERMS_COOKIE,
  recordAccountTerms,
} from "./account-terms.server";
import { signedInDestination } from "./after-sign-in.server";
import { redirect } from "react-router";
import type { AuthRequest } from "./session.server";
import {
  readCookie,
  RETURN_COOKIE,
  serializeAppCookie,
} from "../server/security/cookies";
import { appUrl } from "../server/security/redirect";
import {
  consumeGoogleNonce,
  type LimiterNamespace,
} from "../server/search/limiter";

export const GOOGLE_SCOPES = "openid email profile";
const NONCE_COOKIE = "__Host-cx-google-nonce";
const NONCE_AGE = 300;

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function googleButton(env: unknown, headers: Headers) {
  const { GOOGLE_WEB_CLIENT_ID: clientId } = env as {
    GOOGLE_WEB_CLIENT_ID?: unknown;
  };
  if (
    typeof clientId !== "string" ||
    !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId)
  )
    return null;
  const nonce = base64(crypto.getRandomValues(new Uint8Array(32)));
  const expires = Math.floor(Date.now() / 1000) + NONCE_AGE;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nonce),
  );
  headers.append(
    "Set-Cookie",
    serializeAppCookie(NONCE_COOKIE, `${nonce}.${String(expires)}`, {
      maxAge: NONCE_AGE,
    }),
  );
  headers.set(
    "Content-Security-Policy",
    [
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
      "frame-src https://accounts.google.com/gsi/",
      "connect-src 'self' https://accounts.google.com/gsi/",
    ].join("; "),
  );
  return {
    clientId,
    nonce: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
  };
}

export async function startGoogle(
  auth: AuthRequest,
  returnTo: string,
  signup = false,
) {
  const { data, error } = await auth.supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: appUrl(auth.config.appOrigin, "/auth/callback"),
      scopes: GOOGLE_SCOPES,
      skipBrowserRedirect: true,
    },
  });
  if (error !== null) return null;
  auth.headers.append(
    "Set-Cookie",
    serializeAppCookie(RETURN_COOKIE, returnTo, { maxAge: 600 }),
  );
  auth.headers.append(
    "Set-Cookie",
    serializeAppCookie(GOOGLE_TERMS_COOKIE, ACCOUNT_TERMS_VERSION, {
      maxAge: 600,
    }),
  );
  if (signup)
    auth.headers.append(
      "Set-Cookie",
      serializeAppCookie("__Host-cx-google-signup", "1", { maxAge: 600 }),
    );
  return redirect(data.url, { headers: auth.headers });
}

export async function exchangeGoogle(
  request: Request,
  env: unknown,
  auth: AuthRequest,
  credential: FormDataEntryValue | null,
  returnTo: string,
) {
  const modal = readCookie(request, NONCE_COOKIE);
  auth.headers.append(
    "Set-Cookie",
    serializeAppCookie(NONCE_COOKIE, "", { maxAge: 0 }),
  );
  const match = modal?.match(/^([A-Za-z0-9_-]{43})\.(\d{10})$/);
  if (
    !match?.[1] ||
    Number(match[2]) <= Math.floor(Date.now() / 1000) ||
    typeof credential !== "string" ||
    credential.length > 4096 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(credential)
  )
    return null;
  const { SEARCH_LIMITER } = env as { SEARCH_LIMITER?: LimiterNamespace };
  if (!(await consumeGoogleNonce(SEARCH_LIMITER, match[1]))) return null;
  const { error } = await auth.supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
    nonce: match[1],
  });
  if (error !== null) return null;
  if (!(await recordAccountTerms(auth, ACCOUNT_TERMS_VERSION)))
    return new Response(null, { status: 503, headers: auth.headers });
  const destination = returnTo || (await signedInDestination(auth.supabase));
  return redirect(destination, { headers: auth.headers });
}
