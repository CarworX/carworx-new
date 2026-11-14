import type { ServerConfig } from "../security/config";
import { canonicalEmail } from "../security/recipient-policy";

/** Server only. No method returns a recipient, token, body or provider error. */
export interface MailConfig {
  origin: string;
  from: string;
  apiKey: string;
  encryptionKey: string;
  approvedRecipients: ReadonlySet<string>;
  dailyLimit: number;
}
export type MailMessage =
  | { kind: "invite"; to: string; token: string; expiresAt: string }
  | { kind: "security_code"; to: string; code: string; expiresAt: string }
  | {
      kind: "booking_update";
      to: string;
      bookingId: string;
      expiresAt: string;
    };

export interface ClaimedMail {
  id: string;
  logical_key: string;
  template: MailMessage["kind"];
  encrypted_payload: string;
  expires_at: string;
  lease_token: string;
  attempts: number;
}
export interface MailDatabase {
  enqueue(
    key: string,
    template: string,
    recipientHash: string,
    envelope: string,
    expiresAt: string,
  ): Promise<string>;
  claim(dailyLimit: number): Promise<ClaimedMail | null>;
  purge(): Promise<number>;
  finish(
    id: string,
    lease: string,
    result: "sent" | "retry" | "failed" | "reconcile",
    providerId?: string,
  ): Promise<boolean>;
  current?(id: string, lease: string): Promise<boolean>;
  delivery(
    providerId: string,
    event: "email.bounced" | "email.complained",
  ): Promise<boolean>;
}

/** Deliberately staging-only until production mail has its own launch evidence. */
export function readMailConfig(
  env: unknown,
  security: ServerConfig,
): MailConfig | null {
  const value = (env ?? {}) as Record<string, unknown>;
  const from = canonicalEmail(value["MAIL_FROM"]);
  const key = value["MAIL_ENCRYPTION_KEY"];
  const apiKey = value["RESEND_API_KEY"];
  const domain = value["MAIL_SENDING_DOMAIN"];
  const limit = Number(value["MAIL_DAILY_LIMIT"] ?? 100);
  if (
    security.environment !== "staging" ||
    !security.appOrigin.startsWith("https:") ||
    security.approvedRecipients === null ||
    security.approvedRecipients.size === 0 ||
    value["MAIL_ENABLED"] !== "1" ||
    value["MAIL_DOMAIN_VERIFIED"] !== "1" ||
    from === null ||
    typeof domain !== "string" ||
    from.split("@")[1] !== domain ||
    typeof key !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(key) ||
    typeof apiKey !== "string" ||
    !/^re_[A-Za-z0-9_-]{10,}$/.test(apiKey) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    return null;
  return {
    origin: security.appOrigin,
    from,
    apiKey,
    encryptionKey: key,
    approvedRecipients: security.approvedRecipients,
    dailyLimit: limit,
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const KEY = /^[a-z0-9_/-]{1,160}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function unb64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
}
async function cipherKey(value: string) {
  const bytes = unb64(value);
  if (bytes.length !== 32) throw new Error("mail_configuration");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
function message(
  value: unknown,
  now: number,
  config: MailConfig,
): MailMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  const to = canonicalEmail(m["to"]);
  const kind = m["kind"];
  if (
    to === null ||
    !config.approvedRecipients.has(to) ||
    (kind !== "invite" && kind !== "security_code" && kind !== "booking_update")
  )
    return null;
  const expiresAt = m["expiresAt"];
  const expiry = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
  if (
    !Number.isFinite(expiry) ||
    expiry <= now ||
    expiry >
      now +
        (kind === "invite"
          ? 7 * 86400_000
          : kind === "booking_update"
            ? 86400_000
            : 600_000)
  )
    return null;
  if (
    kind === "booking_update" &&
    typeof m["bookingId"] === "string" &&
    UUID.test(m["bookingId"])
  )
    return {
      kind,
      to,
      bookingId: m["bookingId"],
      expiresAt: expiresAt as string,
    };
  if (
    kind === "invite" &&
    typeof m["token"] === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(m["token"])
  )
    return { kind, to, expiresAt: expiresAt as string, token: m["token"] };
  if (
    kind === "security_code" &&
    typeof m["code"] === "string" &&
    /^\d{6}$/.test(m["code"])
  )
    return { kind, to, expiresAt: expiresAt as string, code: m["code"] };
  return null;
}
async function seal(
  key: string,
  logicalKey: string,
  m: MailMessage,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(`${logicalKey}:${m.kind}`),
    },
    await cipherKey(key),
    encoder.encode(JSON.stringify(m)),
  );
  return `v1.${b64(iv)}.${b64(new Uint8Array(bytes))}`;
}
async function open(
  config: MailConfig,
  job: ClaimedMail,
  now: number,
): Promise<MailMessage | null> {
  const parts = /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{24,})$/.exec(
    job.encrypted_payload,
  );
  if (parts === null || !KEY.test(job.logical_key)) return null;
  const iv = parts[1];
  const ciphertext = parts[2];
  if (iv === undefined || ciphertext === undefined) return null;
  const bytes = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: unb64(iv),
      additionalData: encoder.encode(`${job.logical_key}:${job.template}`),
    },
    await cipherKey(config.encryptionKey),
    unb64(ciphertext),
  );
  const m = message(JSON.parse(decoder.decode(bytes)) as unknown, now, config);
  return m?.kind === job.template &&
    Date.parse(m.expiresAt) === Date.parse(job.expires_at)
    ? m
    : null;
}
function rendered(config: MailConfig, m: MailMessage) {
  if (m.kind === "booking_update")
    return {
      from: config.from,
      to: [m.to],
      subject: "Your CarworX booking has an update",
      text: `Your booking has an update. Sign in to see its current status and available actions:\n${config.origin}/bookings/${m.bookingId}\n\nA payment redirect alone does not confirm a booking.`,
    };
  // Plain-text templates do not interpolate untrusted HTML or arbitrary URLs.
  return {
    from: config.from,
    to: [m.to],
    subject:
      m.kind === "invite"
        ? "Your CarworX team invitation"
        : "Your CarworX sign-in code",
    text:
      m.kind === "invite"
        ? `You've been invited to a CarworX team. Sign in with your own account to join:\n${config.origin}/join/${m.token}\n\nThis link expires at ${m.expiresAt}. If you did not expect this invitation, ignore it.`
        : `Your CarworX sign-in code is ${m.code}. It expires at ${m.expiresAt}.\n\nNever share this code. CarworX support will never ask for it. If you did not request it, ignore this message.`,
  };
}

export function createMailService(
  config: MailConfig,
  db: MailDatabase,
  fetcher: typeof fetch = fetch,
  now = Date.now,
) {
  return {
    async enqueue(
      logicalKey: string,
      input: MailMessage,
    ): Promise<"queued" | "invalid" | "unavailable"> {
      const m = message(input, now(), config);
      if (!KEY.test(logicalKey) || m === null) return "invalid";
      try {
        const envelope = await seal(config.encryptionKey, logicalKey, m);
        const hash = new Uint8Array(
          await crypto.subtle.digest("SHA-256", encoder.encode(m.to)),
        );
        const recipientHash = Array.from(hash, (v) =>
          v.toString(16).padStart(2, "0"),
        ).join("");
        await db.enqueue(
          logicalKey,
          m.kind,
          recipientHash,
          envelope,
          m.expiresAt,
        );
        return "queued";
      } catch {
        return "unavailable";
      }
    },
    async drainOne(): Promise<
      "idle" | "sent" | "retry" | "failed" | "unavailable"
    > {
      let job: ClaimedMail | null;
      try {
        job = await db.claim(config.dailyLimit);
      } catch {
        return "unavailable";
      }
      if (job === null) return "idle";
      let m: MailMessage | null;
      try {
        m = await open(config, job, now());
      } catch {
        m = null;
      }
      let result: "sent" | "retry" | "failed" = m === null ? "failed" : "retry";
      let providerId: string | undefined;
      if (m?.kind === "booking_update") {
        try {
          if (
            db.current === undefined ||
            !(await db.current(job.id, job.lease_token))
          ) {
            m = null;
            result = "failed";
          }
        } catch {
          m = null;
          result = "retry";
        }
      }
      if (m !== null) {
        try {
          const response = await fetcher("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `carworx/${job.logical_key}`,
            },
            body: JSON.stringify(rendered(config, m)),
            signal: AbortSignal.timeout(8_000),
          });
          if (response.ok) {
            const raw: unknown = await response.json();
            const id =
              typeof raw === "object" && raw !== null
                ? (raw as Record<string, unknown>)["id"]
                : null;
            if (typeof id === "string" && UUID.test(id)) {
              providerId = id;
              result = "sent";
            }
          } else if (
            response.status !== 429 &&
            response.status !== 409 &&
            response.status < 500
          )
            result = "failed";
          // Discard provider bodies. An ambiguous response retries the SAME key.
        } catch {
          /* timeout/network: DB retains the encrypted original and key */
        }
      }
      try {
        return (await db.finish(job.id, job.lease_token, result, providerId))
          ? result
          : "unavailable";
      } catch {
        return "unavailable";
      }
    },
  };
}
