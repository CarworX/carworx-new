/**
 * GET /api/search — P2-2 server search (Claude 19). The handler does all
 * validation; this route only wires the Worker bindings:
 *   CATALOGUE_DB        Hyperdrive config for the scoped catalogue_server login
 *   SEARCH_LIMITER      SQLite Durable Object namespace (SearchLimiter)
 *   SEARCH_LIMITER_SALT secret, >= 32 chars
 *   SEARCH_CURSOR_KEY   secret, >= 32 chars
 * Any missing binding fails closed with 503.
 */
import { handleSearch } from "../server/search/handler";
import {
  checkSearchLimits,
  type LimiterNamespace,
} from "../server/search/limiter";
import type { Route } from "./+types/api.search";

interface SearchEnv {
  CATALOGUE_DB?: { connectionString?: unknown };
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
  SEARCH_CURSOR_KEY?: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as unknown as SearchEnv;
  const connection = env.CATALOGUE_DB?.connectionString;
  const search =
    typeof connection === "string" && connection.length > 0
      ? (await import("../server/search/db")).createCatalogueSearch(connection)
      : undefined;
  return handleSearch(request, {
    cursorKey: env.SEARCH_CURSOR_KEY,
    limits: (ip, session) =>
      checkSearchLimits(
        env.SEARCH_LIMITER,
        env.SEARCH_LIMITER_SALT,
        ip,
        session,
      ),
    search,
  });
}
