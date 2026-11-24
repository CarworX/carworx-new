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
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
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

// ---------------------------------------------------------------------------
// Cover photo files (finish-build PR 3, D-098). Replaced, removed and orphaned
// covers are queued in the database; this step claims a batch of their R2
// keys, deletes them from MEDIA and confirms. Keys are random: no personal
// data. A run that dies between delete and confirm is retried an hour later
// (deleting a missing key is a no-op).
// ---------------------------------------------------------------------------
export const MEDIA_BATCH = 500;
const MEDIA_KEY = /^covers\/[0-9a-f]{32}\.(?:jpg|png|webp)$/;

export interface MediaDeleter {
  delete(keys: string[]): Promise<void>;
}
/** The same scoped client as the counts run (one retention_server login). */
export type MediaClient = RetentionClient;

export async function purgeMedia(
  binding: { connectionString?: unknown } | undefined,
  makeClient: (connectionString: string) => Promise<MediaClient>,
  media: MediaDeleter | null,
): Promise<{ deleted: number }> {
  const connectionString = binding?.connectionString;
  if (typeof connectionString !== "string" || connectionString === "")
    throw new RetentionError("binding_missing");
  if (media === null) throw new RetentionError("binding_missing");
  const client = await makeClient(connectionString);
  try {
    await client.connect();
    const claimed = await client.query(
      "select k from public.claim_media_deletions($1) as k",
      [MEDIA_BATCH],
    );
    const keys = claimed.rows.map((r) => (r as { k?: unknown }).k);
    if (
      !keys.every(
        (k): k is string => typeof k === "string" && MEDIA_KEY.test(k),
      )
    )
      throw new RetentionError("bad_result");
    if (keys.length === 0) return { deleted: 0 };
    await media.delete(keys);
    const confirmed = await client.query(
      "select public.confirm_media_deletions($1) as n",
      [keys],
    );
    const n = (confirmed.rows[0] as { n?: unknown } | undefined)?.n;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0)
      throw new RetentionError("bad_result");
    return { deleted: n };
  } catch (error) {
    if (error instanceof RetentionError) throw error;
    throw new RetentionError("query_failed");
  } finally {
    await client.end().catch(() => undefined);
  }
}
