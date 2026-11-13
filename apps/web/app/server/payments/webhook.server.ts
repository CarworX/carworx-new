import type { MoneyEvent } from "./database.server";
async function validHmac(
  signature: string,
  secret: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  if (!/^[a-f0-9]{128}$/.test(signature)) return false;
  const decoded = Uint8Array.from(signature.match(/../g) ?? [], (s) =>
    parseInt(s, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, decoded, bytes);
}
/** No downgrade to legacy when a timestamped header is present but invalid. */
export async function authenticPaystack(
  raw: Uint8Array<ArrayBuffer>,
  headers: Headers,
  apiKey: string,
  signingSecret?: string,
): Promise<boolean> {
  try {
    const modern = headers.get("paystack-signature");
    if (modern !== null) {
      if (signingSecret === undefined || !signingSecret.startsWith("whsec_"))
        return false;
      const parts = modern.split(",").map((s) => s.trim()),
        timestamps = parts.filter((p) => p.startsWith("t="));
      if (timestamps.length !== 1) return false;
      const stamp = timestamps[0]?.slice(2);
      if (
        stamp === undefined ||
        !/^[0-9]{10}$/.test(stamp) ||
        Math.abs(Date.now() / 1000 - Number(stamp)) > 300
      )
        return false;
      const prefix = new TextEncoder().encode(stamp + "."),
        bytes = new Uint8Array(prefix.length + raw.length);
      bytes.set(prefix);
      bytes.set(raw, prefix.length);
      for (const part of parts) {
        const match = /^v1=whk_[A-Za-z0-9_-]+:([a-f0-9]{128})$/.exec(part);
        if (
          match?.[1] !== undefined &&
          (await validHmac(match[1], signingSecret, bytes))
        )
          return true;
      }
      return false;
    }
    return (
      /^sk_test_[A-Za-z0-9]{16,128}$/.test(apiKey) &&
      (await validHmac(headers.get("x-paystack-signature") ?? "", apiKey, raw))
    );
  } catch {
    return false;
  }
}
export async function rawPaystackBody(
  request: Request,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
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
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}

export async function stableEventKey(
  kind: string,
  provider: string,
  status: string,
): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(kind + "/" + provider + "/" + status),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function id(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    return String(value);
  return typeof value === "string" && /^[1-9][0-9]{0,29}$/.test(value)
    ? value
    : null;
}
export async function chargeEvent(
  raw: Uint8Array<ArrayBuffer>,
): Promise<MoneyEvent | "ignored" | null> {
  const unknown: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(raw),
  );
  if (typeof unknown !== "object" || unknown === null) return null;
  const event = unknown as Record<string, unknown>,
    kind = event["event"];
  if (typeof kind !== "string") return null;
  if (
    ![
      "charge.success",
      "refund.processed",
      "refund.failed",
      "charge.dispute.create",
      "charge.dispute.resolve",
    ].includes(kind)
  )
    return "ignored";
  const data = event["data"];
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>,
    tx = d["transaction"];
  const t =
    typeof tx === "object" && tx !== null
      ? (tx as Record<string, unknown>)
      : null;
  const provider = id(d["id"]),
    domain = d["domain"] ?? t?.["domain"];
  const reference =
    kind === "charge.success"
      ? d["reference"]
      : (t?.["reference"] ?? (id(tx) !== null ? "provider:" + id(tx) : null));
  const amount = kind.startsWith("charge.dispute.")
    ? t?.["amount"]
    : d["amount"];
  const currency = kind.startsWith("charge.dispute.")
    ? t?.["currency"]
    : d["currency"];
  const status =
    kind === "charge.success" ? "success" : kind.split(".").at(-1)!;
  if (
    (domain !== undefined && domain !== "test") ||
    (kind === "charge.success" &&
      (domain !== "test" || d["status"] !== "success")) ||
    currency !== "ZAR" ||
    provider === null ||
    typeof reference !== "string" ||
    !/^cx_[a-f0-9]{32}$|^provider:[1-9][0-9]{0,29}$/.test(reference) ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  )
    return null;
  return {
    event_key: await stableEventKey(kind, provider, status),
    reference,
    kind,
    provider_id: provider,
    amount_minor: amount,
    currency: "ZAR",
    status,
  };
}
