import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

/**
 * Every cookie the app sets goes through `serializeAppCookie`, which forces
 * `Secure; HttpOnly; SameSite=Lax; Path=/` and no Domain. The `__Host-`
 * prefix makes browsers enforce the same rules, so a sibling subdomain can't
 * plant or overwrite our cookies. Browsers treat http://localhost as a
 * secure context, so this works on the local stack too.
 */
export const COOKIE_PREFIX = "__Host-cx-";
export const SESSION_COOKIE = `${COOKIE_PREFIX}auth`;
export const CSRF_COOKIE = `${COOKIE_PREFIX}csrf`;
/** Where to go after Google sign-in (a checked path, 10 minutes). */
export const RETURN_COOKIE = `${COOKIE_PREFIX}return`;

export interface AppCookieOptions {
  /** Seconds. 0 deletes the cookie. Omit for a browser-session cookie. */
  maxAge?: number;
}

export function serializeAppCookie(
  name: string,
  value: string,
  options: AppCookieOptions = {},
): string {
  if (!name.startsWith(COOKIE_PREFIX)) {
    throw new Error("App cookies must use the __Host-cx- prefix");
  }
  return serializeCookieHeader(name, value, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    ...(options.maxAge === undefined ? {} : { maxAge: options.maxAge }),
  });
}

export function readCookies(
  request: Request,
): { name: string; value: string }[] {
  return parseCookieHeader(request.headers.get("Cookie") ?? "");
}

export function readCookie(request: Request, name: string): string | undefined {
  // First match wins, matching browser and @supabase/ssr behaviour.
  return readCookies(request).find((c) => c.name === name)?.value;
}

export function hasSessionCookie(request: Request): boolean {
  return readCookies(request).some((c) => c.name.startsWith(SESSION_COOKIE));
}

/**
 * True if a Set-Cookie header value carries every required attribute and
 * nothing that widens it. Used by the response boundary to fail closed.
 */
export function isCompliantSetCookie(header: string): boolean {
  const [pair = "", ...attributes] = header.split(";").map((p) => p.trim());
  const name = pair.slice(0, pair.indexOf("="));
  if (!name.startsWith(COOKIE_PREFIX)) return false;
  const attrs = attributes.map((a) => a.toLowerCase());
  return (
    attrs.includes("secure") &&
    attrs.includes("httponly") &&
    attrs.includes("samesite=lax") &&
    attrs.includes("path=/") &&
    !attrs.some((a) => a.startsWith("domain="))
  );
}
