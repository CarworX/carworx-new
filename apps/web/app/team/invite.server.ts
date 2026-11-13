import { readCookie, serializeAppCookie } from "../server/security/cookies";
import { INVITE_TOKEN } from "./forms";

/** Ephemeral transport across sign-in; never written to localStorage or the DB. */
export const INVITE_COOKIE = "__Host-cx-invite";
export function inviteCookie(token: string) {
  if (!INVITE_TOKEN.test(token)) throw new Error("Invalid invite format");
  return serializeAppCookie(INVITE_COOKIE, token, { maxAge: 600 });
}
export function clearInviteCookie() {
  return serializeAppCookie(INVITE_COOKIE, "", { maxAge: 0 });
}
export function pendingInvite(request: Request) {
  const token = readCookie(request, INVITE_COOKIE);
  return token !== undefined && INVITE_TOKEN.test(token) ? token : null;
}
