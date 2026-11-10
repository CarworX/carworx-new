/**
 * GET /search/map?m=<signed pins> — the optional map of FIXED premises
 * (D-084). The Worker fetches a Mapbox Static Images PNG with the server
 * token after the visitor rate limit and the global daily map quota, so the
 * browser never holds a Mapbox token and every image is counted. Mapbox has
 * no spending cap: anything missing or exhausted fails closed with no image.
 */
import { readCookie } from "../server/security/cookies";
import { fetchStaticMap, readMapPins } from "../server/geo/staticMap";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "../server/search/limiter";
import { SEARCH_COOKIE } from "../server/search/handler";
import type { Route } from "./+types/search.map";

interface MapEnv {
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
  SEARCH_CURSOR_KEY?: string;
  MAPBOX_SERVER_TOKEN?: string;
}

const NO_STORE = { "Cache-Control": "private, no-store" };
const refuse = (status: number) =>
  new Response(null, { status, headers: NO_STORE });

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as unknown as MapEnv;
  const key = env.SEARCH_CURSOR_KEY;
  const token = env.MAPBOX_SERVER_TOKEN;
  if (typeof key !== "string" || key.length < 32 || typeof token !== "string")
    return refuse(503);
  const pins = await readMapPins(
    key,
    new URL(request.url).searchParams.get("m") ?? "",
  );
  if (!pins) return refuse(404);
  const limit = await checkSearchLimits(
    env.SEARCH_LIMITER,
    env.SEARCH_LIMITER_SALT,
    request.headers.get("CF-Connecting-IP") ?? "unknown",
    readCookie(request, SEARCH_COOKIE) ?? "none",
  );
  if (limit.kind === "limited") return refuse(429);
  if (limit.kind !== "allowed") return refuse(503);
  if ((await checkQuota(env.SEARCH_LIMITER, "map")).kind !== "allowed")
    return refuse(503);
  const map = await fetchStaticMap(pins, token);
  if (map.kind !== "ok") return refuse(503);
  return new Response(map.image, {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": map.type,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
