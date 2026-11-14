import { readServerConfig } from "../security/config";
import { readMailConfig, createMailService } from "../mail/outbox.server";
import { createMailDatabase } from "../mail/db.server";
import { paymentRuntime } from "./runtime.server";
/** Producer only: all sends retain O5 approval, suppression, quota and retry rules. */
export async function produceBookingNotifications(env: unknown): Promise<void> {
  const ready = paymentRuntime(env);
  if (ready === null) return;
  const vars = (env ?? {}) as Record<string, unknown>,
    binding = vars["MAIL_DB"] as { connectionString?: unknown } | undefined;
  const config = readMailConfig(env, readServerConfig(env));
  if (config === null || typeof binding?.connectionString !== "string") return;
  await ready.db.prepareNotifications();
  const service = createMailService(
    config,
    createMailDatabase(binding.connectionString),
  );
  for (const row of await ready.db.notifications()) {
    const expiresAt =
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : row.expires_at;
    const result = await service.enqueue(row.logical_key, {
      kind: "booking_update",
      to: row.email,
      bookingId: row.booking_id,
      expiresAt,
    });
    if (result === "queued")
      await ready.db.finishNotification(row.logical_key, "queued");
    else if (result === "invalid")
      await ready.db.finishNotification(row.logical_key, "suppressed");
  }
}
