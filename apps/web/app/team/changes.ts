export interface TeamChange {
  id: number;
  occurred_at: string;
  action: "insert" | "update" | "delete";
  target_table: "memberships" | "invites" | "staff_profiles" | "organisations";
}

/** Treat an RPC response as untrusted and hydrate only the four public fields. */
export function readTeamChanges(value: unknown): TeamChange[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const result: TeamChange[] = [];
  for (const item of value) {
    const candidate: unknown = item;
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("id" in candidate) ||
      typeof candidate.id !== "number" ||
      !Number.isSafeInteger(candidate.id) ||
      candidate.id < 1 ||
      !("occurred_at" in candidate) ||
      typeof candidate.occurred_at !== "string" ||
      !Number.isFinite(Date.parse(candidate.occurred_at)) ||
      !("action" in candidate) ||
      (candidate.action !== "insert" &&
        candidate.action !== "update" &&
        candidate.action !== "delete") ||
      !("target_table" in candidate) ||
      (candidate.target_table !== "memberships" &&
        candidate.target_table !== "invites" &&
        candidate.target_table !== "staff_profiles" &&
        candidate.target_table !== "organisations")
    )
      return null;
    result.push({
      id: candidate.id,
      occurred_at: candidate.occurred_at,
      action: candidate.action,
      target_table: candidate.target_table,
    });
  }
  return result;
}
