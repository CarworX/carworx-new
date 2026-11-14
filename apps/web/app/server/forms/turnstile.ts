/**
 * Cloudflare Turnstile server-side check for the visitor forms (Claude 22 §4).
 *
 * Source: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 * (updated 2026-11-10) and .../troubleshooting/testing/ (updated 2026-11-05),
 * both read 2026-11-11 SAST.
 *
 * Everything fails closed: a missing key, a network error, a timeout or an
 * odd answer is "unavailable", never a pass. The secret and the token are
 * never logged or returned.
 */
import type { Environment } from "../security/config";

export const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TOKEN_FIELD = "cf-turnstile-response";
export const MAX_TOKEN_LENGTH = 2048;
export const VERIFY_TIMEOUT_MS = 3_000;

/**
 * Cloudflare's published test keys (not secrets). A test secret only accepts
 * the dummy token and always answers hostname "example.com" with no action.
 */
export const TEST_SITE_KEY_PASS = "1x00000000000000000000AA";
export const TEST_SECRET_PASS = "1x0000000000000000000000000000000AA";
export const TEST_SECRET_FAIL = "2x0000000000000000000000000000000AA";
export const TEST_SECRET_SPENT = "3x0000000000000000000000000000000AA";
export const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const TEST_SECRET = /^[123]x0{31}AA$/;

export type FormAction = "enquiry" | "demand" | "support";

export interface TurnstileSettings {
  siteKey: string;
  secretKey: string;
  /** True only for Cloudflare test secrets in the local environment. */
  testMode: boolean;
}

/**
 * The keys, or undefined when the forms must stay closed. A test secret is
 * refused anywhere but local, so test keys can't reach staging by mistake.
 */
export function readTurnstile(
  env: { TURNSTILE_SITE_KEY?: unknown; TURNSTILE_SECRET_KEY?: unknown },
  environment: Environment | null,
): TurnstileSettings | undefined {
  const siteKey = env.TURNSTILE_SITE_KEY;
  const secretKey = env.TURNSTILE_SECRET_KEY;
  if (typeof siteKey !== "string" || !/^[0-9A-Za-z_-]{10,100}$/.test(siteKey))
    return undefined;
  if (typeof secretKey !== "string" || secretKey.length < 20) return undefined;
  const testMode = TEST_SECRET.test(secretKey);
  if (testMode && environment !== "local") return undefined;
  return { siteKey, secretKey, testMode };
}

export type Verdict = "pass" | "fail" | "unavailable";

export async function verifyTurnstile(
  settings: TurnstileSettings,
  token: unknown,
  options: {
    action: FormAction;
    expectedHostname: string;
    remoteIp: string | null;
    send?: typeof fetch;
  },
): Promise<Verdict> {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  )
    return "fail";
  const body = new URLSearchParams({
    secret: settings.secretKey,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);
  let answer: unknown;
  try {
    const response = await (options.send ?? fetch)(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "manual", // Workers reject "error"; a 3xx is !ok and fails closed below.
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return "unavailable";
    }
    answer = await response.json();
  } catch {
    return "unavailable";
  }
  if (typeof answer !== "object" || answer === null) return "unavailable";
  const result = answer as {
    success?: unknown;
    hostname?: unknown;
    action?: unknown;
    "error-codes"?: unknown;
  };
  if (result.success === false) {
    const codes = Array.isArray(result["error-codes"])
      ? result["error-codes"]
      : [];
    // Our own key or request is wrong, or Cloudflare had a fault: not the
    // visitor's doing, so the form is unavailable rather than "try again".
    return codes.some(
      (c) =>
        c === "missing-input-secret" ||
        c === "invalid-input-secret" ||
        c === "bad-request" ||
        c === "internal-error",
    )
      ? "unavailable"
      : "fail";
  }
  if (result.success !== true) return "unavailable";
  if (settings.testMode) return "pass";
  if (result.hostname !== options.expectedHostname) return "fail";
  if (result.action !== options.action) return "fail";
  return "pass";
}
