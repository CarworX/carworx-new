import { CSRF_COOKIE, readCookie, serializeAppCookie } from "./cookies";

/**
 * CSRF tokens: a random value in a `__Host-` cookie that every form echoes
 * back in a hidden `csrf` field (double submit). The `__Host-` prefix means
 * no other origin or subdomain can plant the cookie, and the boundary also
 * requires an exact Origin match, so a cross-site form post fails twice.
 */
export const CSRF_FIELD = "csrf";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface CsrfIssue {
  token: string;
  /** Set-Cookie value when the token is new, else undefined. */
  setCookie: string | undefined;
}

export function issueCsrfToken(request: Request): CsrfIssue {
  const existing = readCookie(request, CSRF_COOKIE);
  if (existing !== undefined && TOKEN.test(existing)) {
    return { token: existing, setCookie: undefined };
  }
  const token = newToken();
  return { token, setCookie: serializeAppCookie(CSRF_COOKIE, token) };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function csrfTokenMatches(
  request: Request,
  submitted: unknown,
): boolean {
  const cookie = readCookie(request, CSRF_COOKIE);
  if (cookie === undefined || !TOKEN.test(cookie)) return false;
  if (typeof submitted !== "string" || !TOKEN.test(submitted)) return false;
  return constantTimeEqual(cookie, submitted);
}
