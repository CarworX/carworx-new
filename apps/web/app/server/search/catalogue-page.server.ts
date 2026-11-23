import { geocodeArea } from "../geo/geocode";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "./limiter";
import { buildSearchPage } from "./page";

interface SearchEnv {
  CATALOGUE_DB?: { connectionString?: unknown };
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
  SEARCH_CURSOR_KEY?: string;
  MAPBOX_SERVER_TOKEN?: string;
}

export async function cataloguePage(request: Request, bindings: unknown) {
  const env = bindings as SearchEnv;
  const connection = env.CATALOGUE_DB?.connectionString;
  const search =
    typeof connection === "string" && connection.length > 0
      ? (await import("./db")).createCatalogueSearch(connection)
      : undefined;
  return buildSearchPage(request, {
    cursorKey: env.SEARCH_CURSOR_KEY,
    limits: (ip, session) =>
      checkSearchLimits(
        env.SEARCH_LIMITER,
        env.SEARCH_LIMITER_SALT,
        ip,
        session,
      ),
    search,
    quota: () => checkQuota(env.SEARCH_LIMITER, "geocode"),
    geocode: (area) => geocodeArea(area, env.MAPBOX_SERVER_TOKEN),
    mapEnabled:
      typeof env.MAPBOX_SERVER_TOKEN === "string" &&
      env.MAPBOX_SERVER_TOKEN.length >= 20,
  });
}
