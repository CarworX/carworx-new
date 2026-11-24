/**
 * D-097 "Your message is kept", without JavaScript: when a signed-out visitor
 * sends an enquiry, the server keeps their message in a short-lived HttpOnly
 * cookie in their own browser, so it is back in the box after they sign in or
 * sign up and return to the business page. It is never stored on a server,
 * holds one listing's draft only, lasts an hour, and is removed once the
 * enquiry is sent. (With JavaScript the page also keeps it in localStorage.)
 */
import { b64url, fromB64url } from "../search/cursor";
import {
  COOKIE_PREFIX,
  readCookie,
  serializeAppCookie,
} from "../security/cookies";

export const DRAFT_COOKIE = `${COOKIE_PREFIX}draft`;
export const DRAFT_MAX_AGE = 3600;
/** Small enough for one cookie; a longer (non-ASCII) draft stays in localStorage only. */
const MAX_ENCODED = 2048; // fromB64url reads at most 2048 characters
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const encoder = new TextEncoder();

/** The Set-Cookie value keeping this draft, or null if there is nothing to keep. */
export function keepDraft(listing: string, message: string): string | null {
  const text = message.slice(0, 1000);
  if (!UUID.test(listing) || text.trim() === "") return null;
  const value = b64url(encoder.encode(JSON.stringify({ l: listing, m: text })));
  if (value.length > MAX_ENCODED) return null;
  return serializeAppCookie(DRAFT_COOKIE, value, { maxAge: DRAFT_MAX_AGE });
}

/** The kept message for this listing, or "" (another listing's draft is ignored). */
export function readDraft(request: Request, listing: string): string {
  const raw = readCookie(request, DRAFT_COOKIE);
  if (!raw) return "";
  const bytes = fromB64url(raw);
  if (!bytes) return "";
  try {
    const draft = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as { l?: unknown; m?: unknown };
    return draft.l === listing && typeof draft.m === "string"
      ? draft.m.slice(0, 1000)
      : "";
  } catch {
    return "";
  }
}

export function forgetDraft(): string {
  return serializeAppCookie(DRAFT_COOKIE, "", { maxAge: 0 });
}
