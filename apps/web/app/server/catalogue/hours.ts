/**
 * Public opening hours (Claude 26 §5) through the scoped `catalogue_server`
 * login (Hyperdrive `CATALOGUE_DB`, D-081). The role can execute
 * `api.listing_hours`, which returns rows for live listings only; anon still
 * has no access to `listing_hours`. One bound-parameter call per page view.
 * Imported lazily, like search/db.ts.
 */
import { Client } from "pg";

import { readHours, type HoursRow } from "../../catalogue/hours";

export const HOURS_SQL = "select day, opens, closes from api.listing_hours($1)";

export function createHoursReader(connectionString: string) {
  return async (listing: string): Promise<HoursRow[] | null> => {
    const client = new Client({
      connectionString,
      application_name: "carworx-hours",
      connectionTimeoutMillis: 3_000,
      statement_timeout: 2_000,
      query_timeout: 2_500,
    });
    await client.connect();
    try {
      const result = await client.query(HOURS_SQL, [listing]);
      return readHours(result.rows);
    } finally {
      await client.end().catch(() => undefined);
    }
  };
}
