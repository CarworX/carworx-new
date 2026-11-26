import { Client } from "pg";

import type { SignedIn } from "../../auth/session.server";
import type { Fine, FinesAdapter, PaymentCallback } from "./adapter";

export const FINES_CALLBACK_PATH = "/api/fines/callback";
export const PAYMENT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Scenario = "sample" | "empty" | "unavailable";

type Settings = {
  CARWORX_ENV?: string;
  FINES_PROVIDER?: string;
  SEARCH_CURSOR_KEY?: string;
  FORMS_DB?: { connectionString?: string };
};

const issuer = "Highveld Metro Traffic";
const fines: readonly Fine[] = [
  {
    id: "GP-2026-118452",
    issuer,
    offence: "Speeding notice",
    issuedAt: "2026-11-15",
    cents: 45000,
    payable: true,
  },
  {
    id: "GP-2026-123817",
    issuer,
    offence: "Parking notice",
    issuedAt: "2026-11-18",
    cents: 25000,
    payable: false,
    reasonNotPayable: "Contact the issuing authority.",
  },
];

export function parseScenario(value: string | null): Scenario {
  return value === "empty" || value === "unavailable" ? value : "sample";
}

export function paymentStatus(
  status: unknown,
): status is PaymentCallback["status"] {
  return (
    status === "paid" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "pending_issuer"
  );
}

export function sandboxEnabled(env: unknown) {
  const config = env as Settings;
  return (
    config.CARWORX_ENV === "staging" && config.FINES_PROVIDER === "sandbox"
  );
}

export async function hasApprovedIdentity(auth: SignedIn) {
  const result: { data: unknown; error: unknown } =
    await auth.supabase.rpc("my_identity_status");
  if (result.error || !Array.isArray(result.data)) return false;
  const [row] = result.data as { state?: unknown }[];
  return row?.state === "approved";
}

function dbClient(env: unknown) {
  const connectionString = (env as Settings).FORMS_DB?.connectionString;
  if (!connectionString) throw new Error("fines_unavailable");
  return new Client({
    connectionString,
    application_name: "carworx-fines",
    connectionTimeoutMillis: 3000,
    statement_timeout: 2000,
    query_timeout: 2500,
  });
}

async function callbackKey(env: unknown) {
  const secret = (env as Settings).SEARCH_CURSOR_KEY;
  if (!secret || secret.length < 32) throw new Error("fines_unavailable");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function signatureInput(body: string) {
  return new TextEncoder().encode("carworx-fines-sandbox-callback-v1\n" + body);
}

async function callbackBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  try {
    const body = new Uint8Array(512);
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done)
        return new TextDecoder("utf-8", { fatal: true }).decode(
          body.subarray(0, size),
        );
      if (size + chunk.value.length > body.length) return null;
      body.set(chunk.value, size);
      size += chunk.value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function verifySandboxCallback(
  env: unknown,
  request: Request,
): Promise<PaymentCallback | null> {
  const signature = request.headers.get("X-CarworX-Fines-Signature");
  if (
    !sandboxEnabled(env) ||
    request.method !== "POST" ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return null;
  const body = await callbackBody(request);
  if (body === null) return null;
  const bytes = Uint8Array.from(signature.match(/../g) ?? [], (octet) =>
    Number.parseInt(octet, 16),
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      await callbackKey(env),
      bytes,
      signatureInput(body),
    ))
  )
    return null;
  const payload = JSON.parse(body) as {
    paymentId?: unknown;
    status?: unknown;
    expires?: unknown;
  } | null;
  const now = Math.floor(Date.now() / 1000);
  if (
    !payload ||
    typeof payload.paymentId !== "string" ||
    !PAYMENT_ID.test(payload.paymentId) ||
    !paymentStatus(payload.status) ||
    typeof payload.expires !== "number" ||
    !Number.isInteger(payload.expires) ||
    payload.expires <= now ||
    payload.expires > now + 300
  )
    return null;
  return { paymentId: payload.paymentId, status: payload.status };
}

export function sandboxAdapter(
  env: unknown,
  auth: SignedIn,
  scenario: Scenario = "sample",
): FinesAdapter {
  async function approved(userId: string) {
    return (
      sandboxEnabled(env) &&
      auth.user.id === userId &&
      (await hasApprovedIdentity(auth))
    );
  }
  return {
    async lookup(userId) {
      if (!(await approved(userId)) || scenario === "unavailable")
        return "unavailable";
      return {
        checkedAt: new Date().toISOString(),
        coverage: [issuer],
        fines: scenario === "empty" ? [] : [...fines],
      };
    },
    async startCheckout(userId, noticeIds) {
      if (!(await approved(userId))) throw new Error("identity_required");
      const requested = [...new Set(noticeIds)].sort();
      const payable = fines.filter(
        (fine) => fine.payable && requested.includes(fine.id),
      );
      if (payable.length === 0 || requested.length !== payable.length)
        throw new Error("invalid_fines_checkout");
      const cents = payable.reduce((total, fine) => total + fine.cents, 0);
      const db = dbClient(env);
      try {
        await db.connect();
        const { rows } = await db.query<{ id: string }>(
          "select private.start_fines_payment($1, $2, $3) as id",
          [userId, requested, cents],
        );
        const paymentId = rows[0]?.id;
        if (!paymentId) throw new Error("fines_unavailable");
        return { url: "/fines/mine?payment=" + paymentId, paymentId };
      } finally {
        await db.end().catch(() => undefined);
      }
    },
    verifyCallback: (request) => verifySandboxCallback(env, request),
  };
}

// The staging provider uses the same signed callback path as external providers.
export async function sandboxCallbackRequest(
  env: unknown,
  origin: string,
  payment: PaymentCallback,
) {
  if (!sandboxEnabled(env)) throw new Error("fines_unavailable");
  const body = JSON.stringify({
    ...payment,
    expires: Math.floor(Date.now() / 1000) + 300,
  });
  const mac = await crypto.subtle.sign(
    "HMAC",
    await callbackKey(env),
    signatureInput(body),
  );
  const signature = Array.from(new Uint8Array(mac), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return new Request(new URL(FINES_CALLBACK_PATH, origin), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CarworX-Fines-Signature": signature,
    },
    body,
  });
}

export async function applySandboxCallback(
  request: Request,
  env: unknown,
): Promise<number> {
  if (!sandboxEnabled(env)) return 404;
  let callback: PaymentCallback | null;
  try {
    callback = await verifySandboxCallback(env, request);
  } catch {
    return 503;
  }
  if (!callback) return 401;
  try {
    const db = dbClient(env);
    try {
      await db.connect();
      await db.query("select private.apply_fines_callback($1, $2)", [
        callback.paymentId,
        callback.status,
      ]);
    } finally {
      await db.end().catch(() => undefined);
    }
    return 200;
  } catch {
    return 503;
  }
}
