/**
 * GET /account/photo: the signed-in person's own profile photo (finish-build
 * PR 6, D-098). Never public and never cached: the key is read from the
 * person's own profile_photos row (RLS: self only), so there is no URL that
 * reaches someone else's photo. Content-Type comes from the type detected at
 * upload, with nosniff and a sandbox CSP.
 */
import { requireSignedIn } from "../auth/session.server";
import { AVATAR_KEY } from "../server/media/avatar.server";
import { mediaBucket, TYPE_BY_EXTENSION } from "../server/media/cover.server";
import type { Route } from "./+types/account.photo";

const PRIVATE = "private, no-store";

function status(code: number): Response {
  return new Response(null, {
    status: code,
    headers: { "Cache-Control": PRIVATE },
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const media = mediaBucket(context.cloudflare.env);
  if (media === null) return status(503);
  const row = await signedIn.supabase
    .from("profile_photos")
    .select("object_key")
    .eq("user_id", signedIn.user.id)
    .maybeSingle()
    .overrideTypes<{ object_key: string } | null, { merge: false }>();
  if (row.error !== null) return status(503);
  const key = row.data?.object_key;
  if (typeof key !== "string" || !AVATAR_KEY.test(key)) return status(404);
  const object = await media.get(key);
  if (object === null) return status(404);
  const extension = key.slice(key.lastIndexOf(".") + 1);
  const headers = new Headers(signedIn.headers);
  headers.set(
    "Content-Type",
    TYPE_BY_EXTENSION[extension] ?? "application/octet-stream",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", PRIVATE);
  return new Response(object.body, { headers });
}
