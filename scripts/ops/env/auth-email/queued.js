import { Webhook } from "standardwebhooks";
import { readServerConfig } from "../../../../apps/web/app/server/security/config.ts";
import { canonicalEmail } from "../../../../apps/web/app/server/security/recipient-policy.ts";
import {
  createMailEnqueuer,
  readMailEnvelopeConfig,
} from "../../../../apps/web/app/server/mail/outbox.server.ts";
import { createMailDatabase } from "../../../../apps/web/app/server/mail/db.server.ts";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(status) {
  return Response.json(
    { error: { http_code: status, message: "Email delivery unavailable" } },
    { status, headers: HEADERS },
  );
}
async function boundedText(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/auth-email") return failure(404);
    if (request.method !== "POST") return failure(405);
    if (
      request.headers.get("content-type")?.split(";")[0]?.trim() !==
      "application/json"
    )
      return failure(415);
    let config;
    let connectionString;
    try {
      if (env.AUTH_MAIL_QUEUE_ENABLED !== "1") return failure(503);
      config = readMailEnvelopeConfig(env, readServerConfig(env));
      connectionString = env.MAIL_PRODUCER_DB?.connectionString;
      if (
        config === null ||
        typeof connectionString !== "string" ||
        !connectionString
      )
        return failure(503);
    } catch {
      return failure(503);
    }
    let payload;
    try {
      const body = await boundedText(request);
      if (body === null) return failure(413);
      const secret = env.SEND_EMAIL_HOOK_SECRET;
      if (typeof secret !== "string" || !secret) return failure(503);
      payload = new Webhook(secret.replace(/^v1,whsec_/, "")).verify(
        body,
        Object.fromEntries(request.headers),
      );
    } catch {
      return failure(401);
    }
    try {
      const id = request.headers.get("webhook-id");
      const recipient = canonicalEmail(payload?.user?.email);
      const action = payload?.email_data?.email_action_type;
      const tokenHash = payload?.email_data?.token_hash;
      if (
        id === null ||
        !/^[A-Za-z0-9_-]{1,200}$/.test(id) ||
        recipient === null
      )
        return failure(400);
      if (action !== "signup" && action !== "recovery") return failure(403);
      if (
        typeof tokenHash !== "string" ||
        !/^[A-Za-z0-9_-]{8,256}$/.test(tokenHash)
      )
        return failure(400);
      // Preserve K2's direct Auth recipient boundary. No unapproved send/queue.
      if (!config.approvedRecipients.has(recipient))
        return Response.json({}, { headers: HEADERS });
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id)),
      );
      const key =
        "auth/" +
        Array.from(digest, (v) => v.toString(16).padStart(2, "0")).join("");
      // Duplicate hook requests cannot extend the first queued envelope's expiry.
      const result = await createMailEnqueuer(
        config,
        createMailDatabase(connectionString),
      )(key, {
        kind: action === "signup" ? "auth_signup" : "auth_recovery",
        to: recipient,
        tokenHash,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });
      return result === "queued"
        ? Response.json({}, { headers: HEADERS })
        : failure(503);
    } catch {
      return failure(503);
    }
  },
};
