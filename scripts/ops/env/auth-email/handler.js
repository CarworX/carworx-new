import { Webhook } from "standardwebhooks";
import {
  approvedRecipients,
  canonicalEmail,
  loopbackOrigin,
} from "../../../../apps/web/app/server/security/recipient-policy.ts";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};
const failure = (status) =>
  Response.json(
    { error: { http_code: status, message: "Email delivery unavailable" } },
    { status, headers: HEADERS },
  );

async function boundedText(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 64 * 1024) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// Injection is used only by the local test entry. Production supplies fixed Resend transport.
export function createAuthEmailHandler(
  deliver,
  { allowLocalOrigin = false } = {},
) {
  return async (request, env) => {
    if (request.method !== "POST") return failure(405);
    let payload;
    try {
      const body = await boundedText(request);
      if (body === null) return failure(413);
      const secret = env.SEND_EMAIL_HOOK_SECRET;
      if (typeof secret !== "string" || secret.length === 0)
        return failure(503);
      const verifier = new Webhook(secret.replace(/^v1,whsec_/, ""));
      payload = verifier.verify(body, Object.fromEntries(request.headers));
    } catch {
      return failure(401);
    }
    try {
      const recipients = approvedRecipients(
        env.STAGING_APPROVED_RECIPIENTS_JSON,
      );
      if (recipients === null) return failure(503);
      const recipient = canonicalEmail(payload?.user?.email);
      if (recipient === null || !recipients.has(recipient)) return failure(403);
      const action = payload?.email_data?.email_action_type;
      if (action !== "signup" && action !== "recovery") return failure(403);
      const hash = payload?.email_data?.token_hash;
      if (typeof hash !== "string" || !/^[A-Za-z0-9_-]{8,256}$/.test(hash))
        return failure(400);
      const origin = new URL(env.APP_ORIGIN);
      if (
        origin.origin !== env.APP_ORIGIN ||
        (origin.protocol !== "https:" &&
          !(
            allowLocalOrigin &&
            origin.protocol === "http:" &&
            loopbackOrigin(origin.origin)
          ))
      )
        return failure(503);
      const from = canonicalEmail(env.STAGING_AUTH_EMAIL_FROM);
      if (from === null) return failure(503);
      const link = new URL("/auth/confirm", origin);
      link.searchParams.set("token_hash", hash);
      link.searchParams.set("type", action === "signup" ? "email" : "recovery");
      const title =
        action === "signup"
          ? "Confirm your CarworX email"
          : "Reset your CarworX password";
      const id = request.headers.get("webhook-id");
      if (id === null || !/^[A-Za-z0-9_-]{1,200}$/.test(id))
        return failure(400);
      await deliver(
        {
          from,
          to: [recipient],
          subject: title,
          text: `${title}\n\n${link.href}`,
          html: `<p>${title}</p><p><a href="${link.href.replaceAll("&", "&amp;")}">Continue</a></p>`,
        },
        env,
        `cx-auth/${id}`,
      );
      return Response.json({}, { headers: HEADERS });
    } catch {
      return failure(503);
    }
  };
}
