import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalEmail } from "../server/security/recipient-policy";
import type { ServerConfig } from "../server/security/config";
import {
  prepareMailEnvelope,
  readMailEnvelopeConfig,
  type MailEnvelopeConfig,
} from "../server/mail/outbox.server";
import { isListedAdmin, type SignedIn } from "./session.server";
import type { EmailStepupDatabase } from "./email-stepup-db.server";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
interface EmailStepupConfig {
  mail: MailEnvelopeConfig;
  pepper: string;
  connectionString: string;
}
export function readEmailStepupConfig(
  env: unknown,
  security: ServerConfig,
): EmailStepupConfig | null {
  const vars = (env ?? {}) as Record<string, unknown>;
  const mail = readMailEnvelopeConfig(env, security);
  const pepper = vars["AUTH_CODE_PEPPER"];
  const binding = vars["AUTH_SECURITY_DB"] as
    { connectionString?: unknown } | undefined;
  if (
    vars["AUTH_SECURITY_ENABLED"] !== "1" ||
    mail === null ||
    typeof pepper !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(pepper) ||
    pepper === mail.encryptionKey ||
    typeof binding?.connectionString !== "string" ||
    binding.connectionString.length === 0
  )
    return null;
  return { mail, pepper, connectionString: binding.connectionString };
}

function code() {
  const sample = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  for (;;) {
    crypto.getRandomValues(sample);
    const value = sample[0];
    if (value !== undefined && value < limit)
      return (value % 1000000).toString().padStart(6, "0");
  }
}
async function codeDigest(
  pepper: string,
  user: string,
  session: string,
  challenge: string,
  digits: string,
): Promise<string> {
  const bytes = Uint8Array.from(
    atob(pepper.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
  if (bytes.length !== 32) throw new Error("auth_security_unavailable");
  const key = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `v1\n${user}\n${session}\n${challenge}\n${digits}`,
    ),
  );
  return Array.from(new Uint8Array(signed), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
async function identity(
  supabase: SupabaseClient,
  expectedUser: string,
  freshPassword: boolean,
  token?: string,
): Promise<{ user: string; session: string } | null> {
  // getClaims verifies the JWT; cookie contents or token iat are never proof.
  const verified = await supabase.auth.getClaims(token);
  if (verified.error !== null || verified.data === null) return null;
  const claims = verified.data.claims as unknown as Record<string, unknown>;
  const user = claims["sub"],
    session = claims["session_id"];
  if (
    typeof user !== "string" ||
    !UUID.test(user) ||
    user.toLowerCase() !== expectedUser.toLowerCase() ||
    typeof session !== "string" ||
    !UUID.test(session)
  )
    return null;
  const amr = claims["amr"];
  if (freshPassword && amr !== undefined) {
    const now = Date.now() / 1000;
    if (
      !Array.isArray(amr) ||
      !amr.some((entry: unknown) => {
        if (typeof entry !== "object" || entry === null) return false;
        const item = entry as Record<string, unknown>,
          timestamp = item["timestamp"];
        return (
          item["method"] === "password" &&
          typeof timestamp === "number" &&
          Number.isFinite(timestamp) &&
          timestamp <= now + 30 &&
          timestamp >= now - 300
        );
      })
    )
      return null;
  }
  return { user: user.toLowerCase(), session: session.toLowerCase() };
}

/**
 * Backend service only; routes must use the existing CSRF boundary and return
 * auth.headers on EVERY outcome (a password recheck creates a fresh session).
 * A successful code grants only the canonical org predicate's temporary proof.
 */
export function createEmailStepupService(
  config: EmailStepupConfig,
  db: EmailStepupDatabase,
) {
  return {
    async request(
      auth: SignedIn,
      password: string,
    ): Promise<
      | { status: "queued"; challenge: string; expiresAt: string }
      | { status: "invalid" | "unavailable" }
    > {
      const to = canonicalEmail(auth.user.email);
      if (to === null || password.length === 0 || password.length > 4096)
        return { status: "invalid" };
      if (
        config.mail.origin !== auth.config.appOrigin ||
        !config.mail.approvedRecipients.has(to)
      )
        return { status: "unavailable" };
      try {
        if (await isListedAdmin(auth.supabase)) return { status: "invalid" };
        const primary = await auth.supabase.auth.signInWithPassword({
          email: to,
          password,
        });
        if (primary.error !== null || primary.data.user?.id !== auth.user.id)
          return { status: "invalid" };
        const token = primary.data.session?.access_token;
        if (typeof token !== "string") return { status: "invalid" };
        const current = await identity(
          auth.supabase,
          auth.user.id,
          true,
          token,
        );
        if (current === null) return { status: "invalid" };
        await db.recordReceipt(current.user, current.session);
        const challenge = crypto.randomUUID(),
          digits = code();
        const expiresAt = new Date(Date.now() + 600000).toISOString();
        const mail = await prepareMailEnvelope(
          config.mail,
          "mfa/" + challenge,
          { kind: "security_code", to, code: digits, expiresAt },
        );
        if (mail === null) return { status: "unavailable" };
        const issued = await db.issue(
          current.user,
          current.session,
          challenge,
          await codeDigest(
            config.pepper,
            current.user,
            current.session,
            challenge,
            digits,
          ),
          mail,
        );
        return issued
          ? { status: "queued", challenge, expiresAt }
          : { status: "invalid" };
      } catch {
        return { status: "unavailable" };
      }
    },
    async verify(
      auth: SignedIn,
      challenge: string,
      digits: string,
    ): Promise<"team_access" | "invalid" | "unavailable"> {
      if (!UUID.test(challenge) || !/^\d{6}$/.test(digits)) return "invalid";
      const to = canonicalEmail(auth.user.email);
      if (to === null || config.mail.origin !== auth.config.appOrigin)
        return "invalid";
      try {
        const current = await identity(auth.supabase, auth.user.id, false);
        if (current === null) return "invalid";
        const normalizedChallenge = challenge.toLowerCase();
        const alert = await prepareMailEnvelope(
          config.mail,
          "mfa-alert/" + normalizedChallenge,
          {
            kind: "security_alert",
            to,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        );
        if (alert === null) return "unavailable";
        return (await db.verify(
          current.user,
          current.session,
          normalizedChallenge,
          await codeDigest(
            config.pepper,
            current.user,
            current.session,
            normalizedChallenge,
            digits,
          ),
          alert,
        ))
          ? "team_access"
          : "invalid";
      } catch {
        return "unavailable";
      }
    },
  };
}
