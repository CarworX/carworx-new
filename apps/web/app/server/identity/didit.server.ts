import { Client } from "pg";

import { isHostedDiditSession } from "./hosted-url";

type IdentityEnv = {
  APP_ORIGIN?: string;
  CARWORX_ENV?: string;
  DIDIT_API_KEY?: string;
  DIDIT_WEBHOOK_SECRET?: string;
  DIDIT_WORKFLOW_ID?: string;
  FORMS_DB?: { connectionString?: string };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = {
  "In Progress": "in_progress",
  Approved: "approved",
  Declined: "declined",
  "In Review": "in_review",
  Expired: "expired",
  "Kyc Expired": "expired",
  Abandoned: "abandoned",
} as const;
const maxWebhookBytes = 256 * 1024;

function identityClient(connectionString: string) {
  return new Client({
    connectionString,
    application_name: "carworx-identity",
    connectionTimeoutMillis: 3000,
    statement_timeout: 2000,
    idle_in_transaction_session_timeout: 15000,
  });
}

function record(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export async function createIdentitySession(
  env: unknown,
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const config = env as IdentityEnv;
  if (
    config.CARWORX_ENV !== "staging" ||
    !config.DIDIT_API_KEY ||
    !config.DIDIT_WORKFLOW_ID ||
    !config.FORMS_DB?.connectionString ||
    !UUID.test(userId) ||
    !config.APP_ORIGIN
  )
    throw new Error("identity_unavailable");
  const callback = new URL(returnUrl, config.APP_ORIGIN);
  if (
    callback.origin !== new URL(config.APP_ORIGIN).origin ||
    callback.username ||
    callback.password
  )
    throw new Error("invalid_identity_return");

  const db = identityClient(config.FORMS_DB.connectionString);
  try {
    await db.connect();
    await db.query("begin");
    // The per-user transaction lock prevents duplicate external sessions from
    // concurrent starts and checks the limit before contacting Didit.
    const { rows } = await db.query<{ attempt: number }>(
      "select private.identity_next_attempt($1) as attempt",
      [userId],
    );
    const response = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "x-api-key": config.DIDIT_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: config.DIDIT_WORKFLOW_ID,
        vendor_data: userId,
        callback: callback.href,
        callback_method: "initiator",
        metadata: {},
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("identity_unavailable");
    }
    const result = record(await response.json());
    const session = result["session_id"];
    const url = new URL(typeof result["url"] === "string" ? result["url"] : "");
    if (
      typeof session !== "string" ||
      !UUID.test(session) ||
      !isHostedDiditSession(url)
    )
      throw new Error("identity_unavailable");
    await db.query("select private.identity_start($1, $2, $3::smallint)", [
      userId,
      session,
      rows[0]?.attempt,
    ]);
    await db.query("commit");
    return { url: url.href };
  } catch {
    throw new Error("identity_unavailable");
  } finally {
    await db.end().catch(() => undefined);
  }
}

function canonical(input: unknown): string {
  if (Array.isArray(input)) return "[" + input.map(canonical).join(",") + "]";
  if (input !== null && typeof input === "object") {
    const values = record(input);
    return (
      "{" +
      Object.keys(values)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(values[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(input);
}

async function readLimitedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      length += value.byteLength;
      if (length > maxWebhookBytes) return null;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function verifyDiditWebhook(request: Request, secret: string) {
  const timestamp = request.headers.get("X-Timestamp");
  const signature = request.headers.get("X-Signature-V2");
  if (
    !secret ||
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !signature ||
    !/^[0-9a-fA-F]{64}$/.test(signature)
  )
    return null;
  try {
    const raw = await readLimitedBody(request);
    if (!raw) return null;
    const data = record(JSON.parse(raw));
    if (data["timestamp"] !== Number(timestamp)) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const expected = Uint8Array.from(signature.match(/../g) ?? [], (hex) =>
      Number.parseInt(hex, 16),
    );
    return (await crypto.subtle.verify(
      "HMAC",
      key,
      expected,
      encoder.encode(canonical(data)),
    ))
      ? data
      : null;
  } catch {
    return null;
  }
}

const reasons = {
  DOCUMENT_EXPIRED: "document_expired",
  FACE_MISMATCH: "face_mismatch",
  LIVENESS_FAILED: "liveness_failed",
  DOCUMENT_UNREADABLE: "document_unreadable",
} as const;

function nationalIdLast4(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{13}$/.test(value)) return null;
  let checksum = 0;
  for (let index = 0; index < value.length; index++) {
    const digit = Number(value.charAt(index));
    const weighted = index % 2 === 0 ? digit : digit * 2;
    checksum += weighted > 9 ? weighted - 9 : weighted;
  }
  return checksum % 10 === 0 ? value.slice(-4) : null;
}

function items(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

export async function applyDiditWebhook(
  env: unknown,
  request: Request,
): Promise<number> {
  const config = env as IdentityEnv;
  if (
    config.CARWORX_ENV !== "staging" ||
    !config.DIDIT_WEBHOOK_SECRET ||
    !config.DIDIT_WORKFLOW_ID
  )
    return 404;
  const payload = await verifyDiditWebhook(
    request,
    config.DIDIT_WEBHOOK_SECRET,
  );
  if (!payload) return 401;
  const session = payload["session_id"];
  const status = payload["status"];
  if (
    payload["webhook_type"] !== "status.updated" ||
    payload["workflow_id"] !== config.DIDIT_WORKFLOW_ID ||
    typeof session !== "string" ||
    !UUID.test(session) ||
    typeof status !== "string" ||
    !Object.hasOwn(statuses, status)
  )
    return 200;
  const state = statuses[status as keyof typeof statuses];
  const decision = record(payload["decision"]);
  const idChecks = items(decision["id_verifications"]);
  const last4 =
    idChecks
      .filter((check) => check["status"] === "Approved")
      .map((check) => nationalIdLast4(check["personal_number"]))
      .find((suffix) => suffix !== null) ?? null;
  const warnings = [
    ...idChecks,
    ...items(decision["face_matches"]),
    ...items(decision["liveness_checks"]),
  ].flatMap((item) => items(item["warnings"]));
  const risk = warnings
    .map((item) => item["risk"])
    .find(
      (value): value is keyof typeof reasons =>
        typeof value === "string" && Object.hasOwn(reasons, value),
    );
  const reason =
    state === "declined"
      ? risk === undefined
        ? "verification_declined"
        : reasons[risk]
      : null;
  if (!config.FORMS_DB?.connectionString) return 503;
  const db = identityClient(config.FORMS_DB.connectionString);
  try {
    await db.connect();
    await db.query("select private.identity_apply_webhook($1, $2, $3, $4)", [
      session,
      state,
      reason,
      last4,
    ]);
    return 200;
  } catch {
    return 503;
  } finally {
    await db.end().catch(() => undefined);
  }
}
