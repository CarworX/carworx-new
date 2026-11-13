/** Server-only Paystack adapter. No live keys, arbitrary endpoints or body logging. */
import type { ServerConfig } from "../security/config";

export interface PaystackConfig {
  secret: string;
  origin: string;
  feeBearer: "account" | "subaccount";
}
export function readPaystackConfig(
  env: unknown,
  security: ServerConfig,
): PaystackConfig | null {
  const vars = (env ?? {}) as Record<string, unknown>,
    key = vars["PAYSTACK_SECRET_KEY"],
    bearer = vars["PAYSTACK_FEE_BEARER"];
  if (
    (security.environment !== "local" && security.environment !== "staging") ||
    vars["PAYSTACK_MODE"] !== "test" ||
    vars["PAYSTACK_ENABLED"] !== "1" ||
    typeof key !== "string" ||
    !/^sk_test_[A-Za-z0-9]{16,128}$/.test(key) ||
    (bearer !== "account" && bearer !== "subaccount")
  )
    return null;
  return { secret: key, origin: security.appOrigin, feeBearer: bearer };
}
export interface PayableHold {
  holdId: string;
  bookingId: string;
  organisationId: string;
  quoteVersionId: string | null;
  amountMinor: number;
  currency: "ZAR";
  expiresAt: string;
}
export interface VerifiedPayment {
  reference: string;
  amountMinor: number;
  currency: "ZAR";
  status:
    "success" | "failed" | "pending" | "abandoned" | "ongoing" | "reversed";
  providerId: string;
}
const REF = /^cx_[a-f0-9]{32}$/;
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("payment_provider_unavailable");
  return value as Record<string, unknown>;
}
function providerId(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    return value.toString();
  if (typeof value === "string" && /^[1-9][0-9]{0,29}$/.test(value))
    return value;
  throw new Error("payment_provider_unavailable");
}
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("payment_provider_unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 65536) {
      void reader.cancel().catch(() => undefined);
      throw new Error("payment_provider_unavailable");
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as unknown;
}
export function createPaystack(
  config: PaystackConfig,
  fetcher: typeof fetch = fetch,
) {
  if (!/^sk_test_[A-Za-z0-9]{16,128}$/.test(config.secret))
    throw new Error("payment_test_mode_required");
  const origin = new URL(config.origin);
  if (
    origin.origin !== config.origin ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(origin.hostname)
      ))
  )
    throw new Error("payment_input_invalid");
  async function call(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await fetcher("https://api.paystack.co" + path, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        headers: {
          Authorization: "Bearer " + config.secret,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error("payment_provider_unavailable");
      }
      const result = object(await boundedJson(response));
      if (result["status"] !== true)
        throw new Error("payment_provider_unavailable");
      return object(result["data"]);
    } catch {
      throw new Error("payment_provider_unavailable");
    }
  }
  return {
    /** reference and subaccount MUST come from the durable money ledger. */
    async initialise(
      hold: PayableHold,
      email: string,
      reference: string,
      subaccount: string,
    ): Promise<{ url: string; accessCode: string }> {
      if (
        !REF.test(reference) ||
        !/^ACCT_[A-Za-z0-9]{3,80}$/.test(subaccount) ||
        !Number.isSafeInteger(hold.amountMinor) ||
        hold.amountMinor <= 0 ||
        hold.currency !== "ZAR" ||
        Date.parse(hold.expiresAt) <= Date.now() ||
        !Number.isFinite(Date.parse(hold.expiresAt)) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      )
        throw new Error("payment_input_invalid");
      const callback = new URL("/payments/result", config.origin);
      callback.searchParams.set("reference", reference);
      const data = await call("/transaction/initialize", {
        amount: hold.amountMinor,
        currency: hold.currency,
        email,
        reference,
        subaccount,
        transaction_charge: 0,
        bearer: config.feeBearer,
        callback_url: callback.href,
      });
      const url = data["authorization_url"],
        accessCode = data["access_code"];
      if (
        data["reference"] !== reference ||
        typeof url !== "string" ||
        typeof accessCode !== "string" ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(accessCode)
      )
        throw new Error("payment_provider_unavailable");
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        parsed.hostname !== "checkout.paystack.com" ||
        parsed.username ||
        parsed.password ||
        parsed.port
      )
        throw new Error("payment_provider_unavailable");
      return { url: parsed.href, accessCode };
    },
    async verify(reference: string): Promise<VerifiedPayment> {
      if (!REF.test(reference)) throw new Error("payment_input_invalid");
      const d = await call(
        "/transaction/verify/" + encodeURIComponent(reference),
      );
      const amount = d["amount"],
        status = d["status"];
      if (
        d["domain"] !== "test" ||
        d["reference"] !== reference ||
        d["currency"] !== "ZAR" ||
        typeof amount !== "number" ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        ![
          "success",
          "failed",
          "pending",
          "abandoned",
          "ongoing",
          "reversed",
        ].includes(String(status))
      )
        throw new Error("payment_verification_invalid");
      return {
        reference,
        amountMinor: amount,
        currency: "ZAR",
        status: status as VerifiedPayment["status"],
        providerId: providerId(d["id"]),
      };
    },
    /** A timeout is ambiguous: callers reconcile this durable refund ID before retrying. */
    async refund(
      reference: string,
      amountMinor: number,
      refundId: string,
    ): Promise<{ providerId: string; status: string }> {
      if (
        !REF.test(reference) ||
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0 ||
        !/^[a-f0-9-]{36}$/.test(refundId)
      )
        throw new Error("payment_input_invalid");
      const d = await call("/refund", {
        transaction: reference,
        amount: amountMinor,
        currency: "ZAR",
        merchant_note: "carworx/" + refundId,
      });
      if (
        typeof d["status"] !== "string" ||
        ![
          "pending",
          "processing",
          "processed",
          "failed",
          "needs-attention",
        ].includes(d["status"])
      )
        throw new Error("payment_provider_unavailable");
      return { providerId: providerId(d["id"]), status: d["status"] };
    },
  };
}
