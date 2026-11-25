import { normaliseArea, suggestLocations } from "./geocode";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "../search/limiter";
import { ensureSearchSession } from "../search/handler";

export const privateLocationHeaders = { "Cache-Control": "private, no-store" };

export async function discoverLocations(
  request: Request,
  env: unknown,
  autocomplete: boolean,
) {
  const form = await request.formData();
  const value = form.get("location");
  const text = typeof value === "string" ? normaliseArea(value) : null;
  const headers = new Headers(privateLocationHeaders);
  if (!text || (autocomplete && text.length < 3)) {
    return { status: 400, headers, candidates: [] };
  }
  const settings = env as {
    SEARCH_LIMITER?: LimiterNamespace;
    SEARCH_LIMITER_SALT?: string;
    MAPBOX_SERVER_TOKEN?: string;
  };
  const session = ensureSearchSession(request);
  if (session.cookie) headers.append("Set-Cookie", session.cookie);
  if (!settings.MAPBOX_SERVER_TOKEN)
    return { status: 503, headers, candidates: [] };
  const limit = await checkSearchLimits(
    settings.SEARCH_LIMITER,
    settings.SEARCH_LIMITER_SALT,
    request.headers.get("CF-Connecting-IP") ?? "unknown",
    session.session,
  );
  if (limit.kind === "unavailable")
    return { status: 503, headers, candidates: [] };
  if (limit.kind === "limited") return { status: 429, headers, candidates: [] };
  const quota = await checkQuota(settings.SEARCH_LIMITER, "geocode");
  if (quota.kind !== "allowed") return { status: 503, headers, candidates: [] };
  const candidates = await suggestLocations(
    text,
    settings.MAPBOX_SERVER_TOKEN,
    autocomplete,
  );
  return {
    status: candidates === null ? 503 : 200,
    headers,
    candidates: candidates ?? [],
  };
}
