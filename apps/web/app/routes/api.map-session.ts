/**
 * GET /api/map-session — hands the browser the URL-restricted public Mapbox
 * token for one map load, after the visitor rate limit and the global daily
 * map quota (D-082). Mapbox has no spending cap, so this fails closed:
 * missing token, binding or quota means 503 and the page keeps its list.
 */
import { readCookie } from "../server/security/cookies";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "../server/search/limiter";
import { SEARCH_COOKIE } from "../server/search/handler";
import type { Route } from "./+types/api.map-session";

interface MapEnv {
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
  MAPBOX_PUBLIC_TOKEN?: string;
}

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as unknown as MapEnv;
  const token = env.MAPBOX_PUBLIC_TOKEN;
  const session = readCookie(request, SEARCH_COOKIE) ?? "none";
  const limit = await checkSearchLimits(
    env.SEARCH_LIMITER,
    env.SEARCH_LIMITER_SALT,
    request.headers.get("CF-Connecting-IP") ?? "unknown",
    session,
  );
  if (
    typeof token !== "string" ||
    !token.startsWith("pk.") ||
    limit.kind !== "allowed"
  )
    return new Response(JSON.stringify({ error: "map_unavailable" }), {
      status: limit.kind === "limited" ? 429 : 503,
      headers,
    });
  const quota = await checkQuota(env.SEARCH_LIMITER, "map");
  if (quota.kind !== "allowed")
    return new Response(JSON.stringify({ error: "map_unavailable" }), {
      status: 503,
      headers,
    });
  return new Response(JSON.stringify({ token }), { status: 200, headers });
}
