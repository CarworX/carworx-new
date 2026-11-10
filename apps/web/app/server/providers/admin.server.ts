import { throwRedirect, throwStatus } from "../../auth/http.server";
import {
  isListedAdmin,
  requireSignedIn,
  type SignedIn,
} from "../../auth/session.server";
import type { SecurityContext } from "../security/boundary";

/**
 * The admin guard for every /admin/* loader and action (P2-7, Claude 21 §4),
 * the same as /admin:
 *   - not on the server-controlled admin list → 404 (nothing to discover);
 *   - listed but aal1 → to /auth/mfa, before any admin data is read;
 *   - aal2 → the caller's own JWT, so RLS and the private.admin_* functions
 *     check aal2 again in the database.
 */
export async function requireAdmin(
  request: Request,
  security: SecurityContext,
): Promise<SignedIn> {
  const signedIn = await requireSignedIn(request, security);
  if (!(await isListedAdmin(signedIn.supabase)))
    throwStatus(404, signedIn.headers);
  if (signedIn.aal !== "aal2") {
    const url = new URL(request.url);
    // Only ever a same-site path: /auth/mfa re-validates returnTo as well.
    const back = url.pathname.startsWith("/admin") ? url.pathname : "/admin";
    throwRedirect(
      `/auth/mfa?returnTo=${encodeURIComponent(back)}`,
      signedIn.headers,
    );
  }
  return signedIn;
}
