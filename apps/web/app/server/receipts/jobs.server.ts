/**
 * Daily jobs for provider invoices (D-096). Both are safe to run every day:
 * - issue: last month's invoices, once (idempotent per business and month),
 *   and only when the G-PAY / D-054 gate is on in the database. Runs as the
 *   scoped money_server login (MONEY_DB).
 * - purge: invoices older than 5 years from their date (OQ-E4). Runs as the
 *   scoped retention_server login (RETENTION_DB).
 * Each returns a count only, so a log line can never carry personal data.
 */
import type { RetentionClient } from "../retention/run";

type Binding = { connectionString?: unknown } | undefined;
type MakeClient = (s: string) => Promise<RetentionClient>;

async function count(
  binding: Binding,
  makeClient: MakeClient,
  sql: string,
  failure: string,
): Promise<number> {
  if (
    typeof binding?.connectionString !== "string" ||
    binding.connectionString === ""
  )
    throw new Error(failure);
  const c = await makeClient(binding.connectionString);
  try {
    await c.connect();
    const r = (await c.query(sql)).rows[0] as { count?: unknown } | undefined;
    if (
      typeof r?.count !== "number" ||
      !Number.isInteger(r.count) ||
      r.count < 0
    )
      throw new Error(failure);
    return r.count;
  } catch {
    throw new Error(failure);
  } finally {
    await c.end().catch(() => undefined);
  }
}

export const ISSUE_SQL = "select private.issue_monthly_invoices() as count";
export const PURGE_SQL = "select private.purge_old_invoices() as count";

export function issueMonthlyInvoices(binding: Binding, makeClient: MakeClient) {
  return count(binding, makeClient, ISSUE_SQL, "invoice_issue_unavailable");
}

export function purgeOldInvoices(binding: Binding, makeClient: MakeClient) {
  return count(binding, makeClient, PURGE_SQL, "invoice_retention_unavailable");
}
