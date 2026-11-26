/**
 * The admin ID-review queue's data (A7, B-21): the rows of
 * public.admin_identity_queue() (in review only, per K2), and the reasons an
 * admin may decline with. Pure, so the routes stay component-only.
 */

/** One row of public.admin_identity_queue(). */
export interface QueueRow {
  id: string;
  user_id: string;
  status: string;
  id_last4: string | null;
  attempt: number;
  created_at: string;
}

/** Target from the spec: a second look within one business day. */
export const TARGET_HOURS = 24;

/** Reasons an admin may decline with (the reason is written to the audit row). */
export const DECLINE_REASONS = [
  "Face doesn't match the ID photo",
  "Document looks altered or not genuine",
  "Name doesn't match the account",
  "Other (write a note)",
] as const;

export const OTHER_REASON = "Other (write a note)";

/** Approval has no reason field on the form; the audit row still needs a note. */
export const APPROVE_NOTE = "Approved by the team after a second look.";

/** The queue's rows from the RPC reply, or null if the reply is unusable. */
export function queueRows(result: {
  data: unknown;
  error: unknown;
}): QueueRow[] | null {
  if (result.error !== null || !Array.isArray(result.data)) return null;
  return (result.data as Partial<QueueRow>[]).filter(
    (r): r is QueueRow =>
      typeof r.id === "string" &&
      typeof r.user_id === "string" &&
      typeof r.created_at === "string" &&
      typeof r.attempt === "number",
  );
}

/** How long a check has waited, in whole hours. */
export function hoursWaiting(createdAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(createdAt)) / 3_600_000));
}

/**
 * The reason to record for a decline: the chosen reason, or the person's own
 * words under "Other" when they are long enough (three characters or more).
 */
export function declineReason(
  picked: string,
  note: string | null,
): string | null {
  if (!(DECLINE_REASONS as readonly string[]).includes(picked)) return null;
  if (picked === OTHER_REASON) {
    const words = (note ?? "").trim();
    return words.length >= 3 ? words : null;
  }
  return picked;
}
