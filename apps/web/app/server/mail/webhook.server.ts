import type { MailDatabase } from "./outbox.server";

/**
 * Resend/Svix: HMAC-SHA256 over id.timestamp.RAW_BODY; WebCrypto performs the
 * constant-time verification. Reject stale/future timestamps and oversized
 * bodies before JSON parsing. Route integration must not log request bodies.
 */
export async function receiveMailWebhook(
  request: Request,
  secret: string,
  db: MailDatabase,
  now = Date.now(),
): Promise<"accepted" | "invalid" | "unavailable"> {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signatures = request.headers.get("svix-signature");
  if (
    request.method !== "POST" ||
    id === null ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(id) ||
    timestamp === null ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp) * 1000) > 300_000 ||
    signatures === null ||
    signatures.length > 2048 ||
    !/^whsec_[A-Za-z0-9+/=_-]{16,256}$/.test(secret) ||
    request.body === null
  )
    return "invalid";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 65_536) {
        await reader.cancel();
        return "invalid";
      }
      chunks.push(next.value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    const bytes = (value: string): Uint8Array<ArrayBuffer> =>
      Uint8Array.from(
        atob(value.replaceAll("-", "+").replaceAll("_", "/")),
        (c) => c.charCodeAt(0),
      );
    const key = await crypto.subtle.importKey(
      "raw",
      bytes(secret.slice(6)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const prefix = new TextEncoder().encode(`${id}.${timestamp}.`);
    const signed = new Uint8Array(prefix.length + body.length);
    signed.set(prefix);
    signed.set(body, prefix.length);
    let valid = false;
    for (const signature of signatures.split(" ")) {
      if (!signature.startsWith("v1,")) continue;
      try {
        valid =
          (await crypto.subtle.verify(
            "HMAC",
            key,
            bytes(signature.slice(3)),
            signed,
          )) || valid;
      } catch {
        /* malformed signature does not mask a valid rotating key */
      }
    }
    if (!valid) return "invalid";
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return "invalid";
    const event = parsed as Record<string, unknown>;
    if (
      event["type"] !== "email.bounced" &&
      event["type"] !== "email.complained"
    )
      return "accepted";
    const data = event["data"];
    if (typeof data !== "object" || data === null) return "invalid";
    const providerId = (data as Record<string, unknown>)["email_id"];
    if (
      typeof providerId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        providerId,
      )
    )
      return "invalid";
    try {
      await db.delivery(providerId, event["type"]);
      return "accepted";
    } catch {
      return "unavailable";
    }
  } catch {
    return "invalid";
  } finally {
    reader.releaseLock();
  }
}
