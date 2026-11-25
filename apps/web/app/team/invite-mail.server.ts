/**
 * Email delivery for team invites (finish-build PR 8, D-098). The invite
 * link is still made and shown on the page; when the inviter typed an email
 * address, the same link is also queued through the mail outbox.
 *
 * Built only when mail is fully configured (MAIL_DB, the envelope key and
 * the server settings); otherwise null and nothing is sent. The outbox's
 * recipient policy stays in force: an address outside the approved list is
 * refused ("not_sent"), never queued. The token is encrypted into the
 * outbox row, which drops it once sent or expired; the logical key holds
 * only a hash of it.
 */
import {
  createMailEnqueuer,
  readMailEnvelopeConfig,
} from "../server/mail/outbox.server";
import { readServerConfig } from "../server/security/config";

/** The invite lives seven days; the email never outlives it. */
const KEEP_MS = 7 * 86_400_000 - 3_600_000;

export type InviteMailResult = "queued" | "not_sent" | "unavailable";
export type InviteMailSender = (
  token: string,
  to: string,
) => Promise<InviteMailResult>;

function settings(env: unknown) {
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
  return { config, connectionString };
}

/** Whether invites can be emailed at all here (no network, no database). */
export function inviteMailConfigured(env: unknown): boolean {
  return settings(env) !== null;
}

export async function inviteMailSender(
  env: unknown,
  now = Date.now,
): Promise<InviteMailSender | null> {
  const ready = settings(env);
  if (ready === null) return null;
  const { createMailDatabase } = await import("../server/mail/db.server");
  const enqueue = createMailEnqueuer(
    ready.config,
    createMailDatabase(ready.connectionString),
    now,
  );
  return async (token, to) => {
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    );
    const key = `invite/${Array.from(digest, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")}`;
    const result = await enqueue(key, {
      kind: "invite",
      to,
      token,
      expiresAt: new Date(now() + KEEP_MS).toISOString(),
    });
    return result === "queued"
      ? "queued"
      : result === "invalid"
        ? "not_sent"
        : "unavailable";
  };
}
