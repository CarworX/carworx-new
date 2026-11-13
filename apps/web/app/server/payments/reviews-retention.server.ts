import type { RetentionClient } from "../retention/run";
export async function purgeReviewData(
  binding: { connectionString?: unknown } | undefined,
  makeClient: (s: string) => Promise<RetentionClient>,
): Promise<number> {
  if (
    typeof binding?.connectionString !== "string" ||
    binding.connectionString === ""
  )
    throw new Error("review_retention_unavailable");
  const c = await makeClient(binding.connectionString);
  try {
    await c.connect();
    const rows = await c.query("select private.purge_review_raw() as count");
    const r = rows.rows[0] as { count?: unknown } | undefined;
    if (
      typeof r?.count !== "number" ||
      !Number.isInteger(r.count) ||
      r.count < 0
    )
      throw new Error("review_retention_unavailable");
    return r.count;
  } catch {
    throw new Error("review_retention_unavailable");
  } finally {
    await c.end().catch(() => undefined);
  }
}
