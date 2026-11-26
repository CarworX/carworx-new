import { RetentionError, type RetentionClient } from "./run";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 10;

type DiditEraser = (
  sessionId: string,
  instructionId: string,
) => Promise<"erased" | null>;

export function makeDiditEraser(
  env: unknown,
  send: typeof fetch = fetch,
): DiditEraser | null {
  const key = (env as { DIDIT_API_KEY?: string }).DIDIT_API_KEY;
  if (!key) return null;
  return async (sessionId, instructionId) => {
    try {
      const response = await send(
        "https://verification.didit.me/v3/session/" +
          encodeURIComponent(sessionId) +
          "/delete/",
        {
          method: "DELETE",
          redirect: "manual",
          signal: AbortSignal.timeout(5_000),
          headers: { "x-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            deletion_instruction: "privacy_erasure",
            retain_face_embeddings: false,
            instruction_id: instructionId,
          }),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        // Didit also returns 404 when the key cannot access the session's workflow.
        return null;
      }
      const body = await response.json<{
        session_id?: string;
        face_retention_outcome?: string;
      }>();
      return body.session_id?.toLowerCase() === sessionId.toLowerCase() &&
        (body.face_retention_outcome === "deleted" ||
          body.face_retention_outcome === "none")
        ? "erased"
        : null;
    } catch {
      return null;
    }
  };
}

export async function purgeDiditSessions(
  binding: { connectionString?: unknown } | undefined,
  makeClient: (connectionString: string) => Promise<RetentionClient>,
  erase: DiditEraser | null,
) {
  const counts = { erased: 0, retry: 0 };
  if (erase === null) return { ...counts, configured: false };
  const connectionString = binding?.connectionString;
  if (typeof connectionString !== "string" || connectionString === "")
    throw new RetentionError("binding_missing");
  const client = await makeClient(connectionString);
  try {
    await client.connect();
    const { rows } = await client.query(
      "select id, provider_session_id, claim_id from public.claim_didit_deletions($1)",
      [BATCH],
    );
    const outcomes = await Promise.all(
      rows.map(async (row) => {
        const { id, provider_session_id, claim_id } = (row ?? {}) as {
          id?: unknown;
          provider_session_id?: unknown;
          claim_id?: unknown;
        };
        if (
          typeof id !== "string" ||
          !UUID.test(id) ||
          typeof provider_session_id !== "string" ||
          !UUID.test(provider_session_id) ||
          typeof claim_id !== "string" ||
          !UUID.test(claim_id)
        )
          throw new RetentionError("bad_result");
        return { id, claim_id, outcome: await erase(provider_session_id, id) };
      }),
    );
    for (const { id, claim_id, outcome } of outcomes) {
      if (outcome === null) {
        counts.retry++;
        continue;
      }
      const done = await client.query(
        "select public.complete_didit_deletion($1, $2) as done",
        [id, claim_id],
      );
      if ((done.rows[0] as { done?: unknown } | undefined)?.done === true) {
        counts.erased++;
      }
    }
    return { ...counts, configured: true };
  } catch (error) {
    if (error instanceof RetentionError) throw error;
    throw new RetentionError("query_failed");
  } finally {
    await client.end().catch(() => undefined);
  }
}
