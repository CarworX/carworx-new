/**
 * R-2 scheduled retention (retention schedule section 3). A Worker cron calls
 * `public.run_retention()` once a day through the Hyperdrive binding
 * `RETENTION_DB`, as the scoped `retention_server` login. That login can run
 * nothing else and read no table. The database returns counts only, so the
 * log line below can never carry personal data.
 */
export const RETENTION_SQL = "select job, deleted from public.run_retention()";

export const JOBS = [
  "demand_requests",
  "enquiries",
  "support_cases",
  "consents",
  "listing_claims",
  "verifications",
] as const;
export type Job = (typeof JOBS)[number];
export type RetentionCounts = Record<Job, number>;

export interface RetentionClient {
  connect(): Promise<unknown>;
  query(sql: string): Promise<{ rows: unknown[] }>;
  end(): Promise<unknown>;
}

export class RetentionError extends Error {
  constructor(reason: "binding_missing" | "query_failed" | "bad_result") {
    // A fixed reason only: a database message is never logged.
    super(`retention run failed: ${reason}`);
    this.name = "RetentionError";
  }
}

/** Every job exactly once, each a non-negative integer, nothing else. */
export function parseCounts(rows: unknown[]): RetentionCounts {
  const counts: Partial<RetentionCounts> = {};
  for (const row of rows) {
    const { job, deleted } = (row ?? {}) as {
      job?: unknown;
      deleted?: unknown;
    };
    if (
      typeof job !== "string" ||
      !(JOBS as readonly string[]).includes(job) ||
      job in counts ||
      typeof deleted !== "number" ||
      !Number.isInteger(deleted) ||
      deleted < 0
    )
      throw new RetentionError("bad_result");
    counts[job as Job] = deleted;
  }
  if (Object.keys(counts).length !== JOBS.length)
    throw new RetentionError("bad_result");
  return counts as RetentionCounts;
}

export async function runRetention(
  binding: { connectionString?: unknown } | undefined,
  makeClient: (connectionString: string) => Promise<RetentionClient>,
): Promise<RetentionCounts> {
  const connectionString = binding?.connectionString;
  if (typeof connectionString !== "string" || connectionString === "")
    throw new RetentionError("binding_missing");
  let rows: unknown[];
  const client = await makeClient(connectionString);
  try {
    await client.connect();
    rows = (await client.query(RETENTION_SQL)).rows;
  } catch {
    throw new RetentionError("query_failed");
  } finally {
    await client.end().catch(() => undefined);
  }
  return parseCounts(rows);
}

/** The pg client, imported lazily like the search and forms clients. */
export async function pgClient(
  connectionString: string,
): Promise<RetentionClient> {
  const { Client } = await import("pg");
  return new Client({
    connectionString,
    application_name: "carworx-retention",
    connectionTimeoutMillis: 5_000,
    statement_timeout: 60_000,
    query_timeout: 65_000,
  });
}
