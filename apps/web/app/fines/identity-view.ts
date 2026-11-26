/**
 * The ID check's screen, decided from my_identity_status (K2). Pure: the route
 * reads the row, this says which screen to show and what it says. The webhook
 * decides the state; a redirect back to the page never does.
 */

/** One row of public.my_identity_status(). */
export interface IdentityRow {
  state: string;
  reason: string | null;
  attempt: number;
  tries_left: number;
  decided_at: string | null;
}

/** Tries a person may use per cycle (K2: three attempts). */
export const MAX_TRIES = 3;

export type IdentityView =
  | { kind: "intro" }
  | { kind: "checking" }
  | { kind: "approved" }
  | { kind: "in_review" }
  | { kind: "declined"; reason: string; used: number; left: number }
  | { kind: "locked"; reason: string };

/** Didit's decline reasons in plain words (keep this table in step with K2's check). */
export const REASON_COPY: Record<string, string> = {
  document_expired: "The ID document in the photo looks expired.",
  face_mismatch: "The selfie didn't match the photo on your ID.",
  liveness_failed: "The selfie check didn't confirm a live person.",
  document_unreadable: "The ID photo was too blurry or dark to read.",
  verification_declined: "The check couldn't be confirmed this time.",
};

const FALLBACK_REASON = "We couldn't confirm it this time.";

/** Plain words for a decline reason; anything unknown gets the general line. */
export function reasonCopy(reason: string | null): string {
  return (reason !== null && REASON_COPY[reason]) || FALLBACK_REASON;
}

/**
 * Which screen to show. No row (no check yet, or the status could not be read)
 * is the intro. Tries are counted from the server's tries_left, never from the
 * number of rows.
 */
export function identityView(row: IdentityRow | null): IdentityView {
  if (row === null) return { kind: "intro" };
  const left = Math.max(0, Math.min(MAX_TRIES, row.tries_left));
  const used = MAX_TRIES - left;
  switch (row.state) {
    case "approved":
      return { kind: "approved" };
    case "checking":
      return { kind: "checking" };
    case "in_review":
      return { kind: "in_review" };
    case "locked":
      return { kind: "locked", reason: reasonCopy(row.reason) };
    case "declined":
      return left === 0
        ? { kind: "locked", reason: reasonCopy(row.reason) }
        : {
            kind: "declined",
            reason: reasonCopy(row.reason),
            used,
            left,
          };
    default:
      return { kind: "intro" };
  }
}

/** The one row of my_identity_status() as a typed row, or null if the reply is unusable. */
export function parseIdentityRow(result: {
  data: unknown;
  error: unknown;
}): IdentityRow | null {
  if (result.error !== null || !Array.isArray(result.data)) return null;
  const [row] = result.data as Partial<IdentityRow>[];
  if (row === undefined || typeof row.state !== "string") return null;
  return {
    state: row.state,
    reason: typeof row.reason === "string" ? row.reason : null,
    attempt: typeof row.attempt === "number" ? row.attempt : 0,
    tries_left: typeof row.tries_left === "number" ? row.tries_left : MAX_TRIES,
    decided_at: typeof row.decided_at === "string" ? row.decided_at : null,
  };
}
