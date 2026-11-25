/**
 * "Download my data" (finish-build PR 4a, D-098). The database builds the
 * document; this stores it in the private exports/ part of MEDIA and hands
 * out a one-time link. Only a SHA-256 of the link token is stored.
 *
 * The link, /account/data/<token>, never downloads by itself (link previews
 * and prefetchers would spend it). It only moves the token into a short-lived
 * cookie and redirects to /account/privacy, where a button POSTs to
 * /account/privacy/download: the same pattern as team invites (/join).
 */
import { readCookie, serializeAppCookie } from "../server/security/cookies";

export const EXPORT_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const EXPORT_KEY = /^exports\/[0-9a-f]{32}\.json$/;
export const EXPORT_COOKIE = "__Host-cx-export";

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** A fresh random file key and link token (never derived from the user). */
export function newExport() {
  return {
    key: `exports/${crypto.randomUUID().replaceAll("-", "")}.json`,
    token: base64url(crypto.getRandomValues(new Uint8Array(32))),
  };
}

/** The SHA-256 of a token as PostgREST's bytea hex text ("\x…"). */
export async function tokenHash(token: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  );
  return `\\x${[...digest].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function exportLink(token: string) {
  return `/account/data/${token}`;
}

export function exportCookie(token: string) {
  if (!EXPORT_TOKEN.test(token)) throw new Error("Invalid export token");
  return serializeAppCookie(EXPORT_COOKIE, token, { maxAge: 600 });
}
export function clearExportCookie() {
  return serializeAppCookie(EXPORT_COOKIE, "", { maxAge: 0 });
}
export function pendingExport(request: Request) {
  const token = readCookie(request, EXPORT_COOKIE);
  return token !== undefined && EXPORT_TOKEN.test(token) ? token : null;
}
