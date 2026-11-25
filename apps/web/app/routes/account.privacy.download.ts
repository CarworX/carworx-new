/**
 * POST /account/privacy/download: spends the one-time export link (D-098).
 * The signed-in owner of the export, with the token from the link cookie,
 * before it expires: the database marks it used and queues the file for
 * deletion; the file is sent as an attachment and deleted from MEDIA now.
 * Unknown, used, expired and someone else's links all get the same answer.
 *
 * Order: check the link (peek), read the whole file, then spend the link
 * (consume). A storage error before the file is in hand leaves the link
 * usable for a retry (Codex review on #147).
 */
import { throwRedirect } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import {
  clearExportCookie,
  EXPORT_KEY,
  pendingExport,
  tokenHash,
} from "../account/export.server";
import { mediaBucket } from "../server/media/cover.server";
import type { Route } from "./+types/account.privacy.download";

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  signedIn.headers.set("Cache-Control", "private, no-store");
  // A used or invalid link: drop the cookie. A storage error: keep it, so
  // the same button works again (the link was not spent).
  const fail = () => {
    signedIn.headers.append("Set-Cookie", clearExportCookie());
    return throwRedirect(
      "/account/privacy?export=invalid#your-data",
      signedIn.headers,
    );
  };
  const retry = () =>
    throwRedirect("/account/privacy?export=retry#your-data", signedIn.headers);
  const token = pendingExport(request);
  if (token === null) return fail();
  const media = mediaBucket(context.cloudflare.env);
  if (media === null) return retry();
  const hash = await tokenHash(token);
  // 1. Check the link without spending it.
  const peeked = await signedIn.supabase.rpc("peek_data_export", {
    p_token_hash: hash,
  });
  const key: unknown = peeked.data;
  if (peeked.error !== null || typeof key !== "string" || !EXPORT_KEY.test(key))
    return fail();
  // 2. Read the whole file.
  let body: ArrayBuffer;
  try {
    const object = await media.get(key);
    if (object === null) return retry();
    body = await new Response(object.body).arrayBuffer();
  } catch {
    return retry();
  }
  // 3. Only now spend the link (one-time, atomic in the database).
  const consumed = await signedIn.supabase.rpc("consume_data_export", {
    p_token_hash: hash,
  });
  if (consumed.error !== null || consumed.data !== key) return fail();
  signedIn.headers.append("Set-Cookie", clearExportCookie());
  // Already queued for deletion by the database; delete now as well.
  await media.delete(key).catch(() => undefined);
  const headers = new Headers(signedIn.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set(
    "Content-Disposition",
    'attachment; filename="carworx-my-data.json"',
  );
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(body, { status: 200, headers });
}

export function loader() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}
