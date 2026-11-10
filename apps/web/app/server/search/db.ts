/**
 * Database access for P2-2 search through the scoped `catalogue_server` login
 * (D-081). Hosted: the connection string comes from the Hyperdrive binding
 * `CATALOGUE_DB`, so the Worker never holds a static password. The role can
 * only execute `api.search_listings`; every query is that one call with bound
 * parameters. Imported lazily, so the Worker loads without a database driver
 * path when the binding is absent.
 */
import { Client } from "pg";

import type { SearchArgs, SearchRow } from "./handler";

export const SEARCH_SQL =
  "select * from api.search_listings($1, $2, $3, $4, $5, $6, $7, $8)";

export function createCatalogueSearch(connectionString: string) {
  return async (args: SearchArgs): Promise<SearchRow[]> => {
    const client = new Client({
      connectionString,
      application_name: "carworx-search",
      connectionTimeoutMillis: 3_000,
      statement_timeout: 2_000,
      query_timeout: 2_500,
    });
    await client.connect();
    try {
      const result = await client.query<SearchRow>(SEARCH_SQL, [
        args.lat,
        args.lng,
        args.service,
        args.radius,
        args.group,
        args.afterBucket,
        args.afterId,
        args.limit,
      ]);
      return result.rows;
    } finally {
      await client.end().catch(() => undefined);
    }
  };
}
