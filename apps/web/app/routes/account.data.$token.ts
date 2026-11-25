/**
 * GET /account/data/:token: the one-time "Download my data" link (D-098).
 * It never downloads by itself, so link previews and prefetchers cannot
 * spend it: it moves the token into a short-lived secure cookie, drops it
 * from the URL and sends the person to /account/privacy, where a button
 * POSTs the download. Sent with no referrer (TOKEN_PATHS in the boundary).
 */
import { throwRedirect } from "../auth/http.server";
import {
  clearExportCookie,
  EXPORT_TOKEN,
  exportCookie,
} from "../account/export.server";
import type { Route } from "./+types/account.data.$token";

export function loader({ params }: Route.LoaderArgs) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  headers.append(
    "Set-Cookie",
    EXPORT_TOKEN.test(params.token)
      ? exportCookie(params.token)
      : clearExportCookie(),
  );
  return throwRedirect("/account/privacy#your-data", headers);
}
