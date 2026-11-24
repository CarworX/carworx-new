/**
 * POST /account/privacy/download: spends the one-time export link (D-098).
 * The signed-in owner of the export, with the token from the link cookie,
 * before it expires: the database marks it used and queues the file for
 * deletion; the file is sent as an attachment and deleted from MEDIA now.
 * Unknown, used, expired and someone else's links all get the same answer.
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
  signedIn.headers.append("Set-Cookie", clearExportCookie());
  const fail = () =>
    throwRedirect(
      "/account/privacy?export=invalid#your-data",
      signedIn.headers,
    );
  const token = pendingExport(request);
  const media = mediaBucket(context.cloudflare.env);
  if (token === null || media === null) return fail();
  const consumed = await signedIn.supabase.rpc("consume_data_export", {
    p_token_hash: await tokenHash(token),
  });
  const key: unknown = consumed.data;
  if (
    consumed.error !== null ||
    typeof key !== "string" ||
    !EXPORT_KEY.test(key)
  )
    return fail();
  const object = await media.get(key);
  if (object === null) return fail();
  const body = await new Response(object.body).arrayBuffer();
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
