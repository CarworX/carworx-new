/**
 * The final "your account has been deleted" email (finish-build PR 4b,
 * D-098). Built only when mail is fully configured (MAIL_DB, the envelope
 * key and the server settings); otherwise null, and the daily run deletes
 * due accounts without an email. The address is encrypted here and copied
 * into the outbox; the outbox drops it once the email is sent.
 */
import { readMailEnvelopeConfig } from "../mail/outbox.server";
import { createMailEnqueuer } from "../mail/outbox.server";
import { readServerConfig } from "../security/config";
import type { FinalEmail } from "./run";

/** Just under the outbox's 7-day limit for this template. */
const KEEP_MS = 7 * 86_400_000 - 3_600_000;

export async function finalEmailSender(
  env: unknown,
  now = Date.now,
): Promise<FinalEmail | null> {
  let security;
  try {
    security = readServerConfig(env);
  } catch {
    return null;
  }
  const config = readMailEnvelopeConfig(env, security);
  const connectionString = (
    env as { MAIL_DB?: { connectionString?: unknown } } | null
  )?.MAIL_DB?.connectionString;
  if (
    config === null ||
    typeof connectionString !== "string" ||
    connectionString === ""
  )
    return null;
  const { createMailDatabase } = await import("../mail/db.server");
  const enqueue = createMailEnqueuer(
    config,
    createMailDatabase(connectionString),
    now,
  );
  return (userId, email) =>
    enqueue(`account-deleted/${userId}`, {
      kind: "account_deleted",
      to: email,
      expiresAt: new Date(now() + KEEP_MS).toISOString(),
    });
}
