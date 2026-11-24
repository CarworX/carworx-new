/**
 * GET /media/covers/:file: a listing's cover photo (finish-build PR 3, D-098).
 *
 * Served only while the key is the current cover of a live listing, so a
 * take-down or a replacement stops it at once for new requests. Members of
 * the business may also see their own non-live listing's cover (the setup
 * preview), never cached. The Content-Type comes from the type detected at
 * upload (the key's extension), with nosniff, so the browser never guesses.
 */
import { getSignedIn } from "../auth/session.server";
import { isPublicCover } from "../server/catalogue/public";
import {
  COVER_FILE,
  mediaBucket,
  TYPE_BY_EXTENSION,
} from "../server/media/cover.server";
import type { Route } from "./+types/media.covers.$file";

/**
 * A day, not a year: the key is random and never reused, but a taken-down
 * photo should leave shared caches within a day (D-098, admin take-down).
 */
const PUBLIC_CACHE = "public, max-age=86400, immutable";

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const file = params.file;
  if (!COVER_FILE.test(file)) return notFound();
  const key = `covers/${file}`;
  const config = context.security.config;
  const media = mediaBucket(context.cloudflare.env);
  if (!config || media === null)
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });

  let cache: string | null = null;
  try {
    if (await isPublicCover(config, key)) cache = PUBLIC_CACHE;
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (cache === null) {
    // Not public: only a member of the listing's business may preview it.
    const signedIn = await getSignedIn(request, context.security);
    if (signedIn === null) return notFound();
    const own = await signedIn.supabase
      .from("listing_covers")
      .select("object_key")
      .eq("object_key", key)
      .maybeSingle();
    if (own.error !== null || own.data === null) return notFound();
    cache = "private, no-store";
  }

  const object = await media.get(key);
  if (object === null) return notFound();
  const extension = file.slice(file.lastIndexOf(".") + 1);
  return new Response(object.body, {
    headers: {
      "Content-Type":
        TYPE_BY_EXTENSION[extension] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      "Cache-Control": cache,
    },
  });
}
