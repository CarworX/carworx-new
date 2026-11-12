/**
 * Database access for the visitor forms through the scoped `forms_server`
 * login (Claude 22 §3). Hosted: the connection string comes from the
 * Hyperdrive binding `FORMS_DB`, so the Worker holds no static password. The
 * role can only execute the three submit wrappers; each call is one bound
 * statement. Imported lazily, like the search client.
 */
import { Client } from "pg";

import type { Demand, Enquiry, Support } from "./parse";

export const SQL = {
  enquiry: "select public.submit_enquiry($1, $2, $3, $4, true, $5)",
  demand: "select public.capture_demand($1, $2, $3, true, $4)",
  support: "select public.open_support_case($1, $2, $3)",
} as const;

export type DbOutcome =
  | "ok"
  | "invalid_input"
  | "consent_required"
  | "listing_not_available"
  | "unavailable";

const KEYS = new Set(["consent_required", "listing_not_available"]);

/** Fixed keys only; a database message is never shown or logged. */
export function outcomeFrom(error: unknown): DbOutcome {
  const e = error as { code?: unknown; message?: unknown } | null;
  if (e?.code === "22023") return "invalid_input";
  if (
    e?.code === "P0001" &&
    typeof e.message === "string" &&
    KEYS.has(e.message)
  )
    return e.message as DbOutcome;
  return "unavailable";
}

export function createFormsDb(connectionString: string) {
  async function run(sql: string, params: unknown[]): Promise<DbOutcome> {
    const client = new Client({
      connectionString,
      application_name: "carworx-forms",
      connectionTimeoutMillis: 3_000,
      statement_timeout: 2_000,
      query_timeout: 2_500,
    });
    try {
      await client.connect();
      await client.query(sql, params);
      return "ok";
    } catch (error) {
      return outcomeFrom(error);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  return {
    enquiry: (listing: string, e: Enquiry, notice: string) =>
      run(SQL.enquiry, [listing, e.name, e.email, e.message, notice]),
    demand: (d: Demand, notice: string) =>
      run(SQL.demand, [d.email, d.category, d.province, notice]),
    support: (s: Support) => run(SQL.support, [s.email, s.topic, s.message]),
  };
}
export type FormsDb = ReturnType<typeof createFormsDb>;
