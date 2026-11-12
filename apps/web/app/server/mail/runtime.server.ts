import { readServerConfig, type ServerConfig } from "../security/config";
import {
  createMailService,
  readMailConfig,
  type MailDatabase,
} from "./outbox.server";
import { receiveMailWebhook } from "./webhook.server";

export const MAIL_WEBHOOK_PATH = "/api/mail/events";
interface MailRuntimeEnv {
  MAIL_DB?: { connectionString?: unknown };
  RESEND_WEBHOOK_SECRET?: unknown;
}
export interface MailRuntimeDependencies {
  database?: (connectionString: string) => MailDatabase;
  fetcher?: typeof fetch;
  now?: () => number;
}

function settings(
  env: unknown,
): {
  vars: MailRuntimeEnv;
  security: ServerConfig;
  connectionString: string;
} | null {
  try {
    const security = readServerConfig(env);
    const vars = (env ?? {}) as MailRuntimeEnv;
    const connectionString = vars.MAIL_DB?.connectionString;
    if (
      security.environment !== "staging" ||
      !security.appOrigin.startsWith("https:") ||
      typeof connectionString !== "string" ||
      connectionString.length === 0
    )
      return null;
    return { vars, security, connectionString };
  } catch {
    return null;
  }
}
async function database(
  connectionString: string,
  dependencies: MailRuntimeDependencies,
): Promise<MailDatabase> {
  if (dependencies.database !== undefined)
    return dependencies.database(connectionString);
  const { createMailDatabase } = await import("./db.server");
  return createMailDatabase(connectionString);
}

/** One bounded send per invocation. No credentials/config means no network call. */
export async function drainScheduledMail(
  env: unknown,
  dependencies: MailRuntimeDependencies = {},
): Promise<void> {
  const ready = settings(env);
  if (ready === null) return;
  try {
    const db = await database(ready.connectionString, dependencies);
    // Never retain usable invite/code ciphertext beyond its own expiry, including
    // during a sending pause. Do not delete suppression or audit metadata here.
    await db.purge();
    const config = readMailConfig(env, ready.security);
    if (config === null) return;
    await createMailService(
      config,
      db,
      dependencies.fetcher,
      dependencies.now,
    ).drainOne();
  } catch {
    /* Fixed no-op on outage; queue state/leases remain durable. No body logging. */
  }
}

function response(status: number): Response {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  });
  if (status === 405) headers.set("Allow", "POST");
  return new Response(null, { status, headers });
}

/** Signature authentication replaces CSRF ONLY at MAIL_WEBHOOK_PATH. */
export async function dispatchMailWebhook(
  request: Request,
  env: unknown,
  dependencies: MailRuntimeDependencies = {},
): Promise<Response> {
  if (new URL(request.url).pathname !== MAIL_WEBHOOK_PATH) return response(404);
  if (request.method !== "POST") return response(405);
  const ready = settings(env);
  if (ready === null || readMailConfig(env, ready.security) === null)
    return response(503);
  if (new URL(request.url).origin !== ready.security.appOrigin)
    return response(404);
  const secret = ready.vars.RESEND_WEBHOOK_SECRET;
  if (typeof secret !== "string" || !secret.startsWith("whsec_"))
    return response(503);
  try {
    const db = await database(ready.connectionString, dependencies);
    const outcome = await receiveMailWebhook(
      request,
      secret,
      db,
      dependencies.now?.(),
    );
    return response(
      outcome === "accepted" ? 204 : outcome === "invalid" ? 400 : 503,
    );
  } catch {
    return response(503);
  }
}
