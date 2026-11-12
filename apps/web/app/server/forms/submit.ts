/**
 * The one pipeline every visitor form runs (Claude 22 §1, §4):
 *   per-IP limit (every post counts) -> parse -> Turnstile -> forms_server.
 * The T5 boundary has already checked Origin and CSRF. Nothing here logs a
 * form body, an IP or a token; outcomes are fixed keys.
 */
import type { ServerConfig } from "../security/config";
import {
  checkFormLimit,
  type LimiterNamespace,
  type LimitResult,
} from "../search/limiter";
import type { DbOutcome, FormsDb } from "./db";
import type { Parsed } from "./parse";
import {
  readTurnstile,
  TOKEN_FIELD,
  verifyTurnstile,
  type FormAction,
  type TurnstileSettings,
  type Verdict,
} from "./turnstile";

export interface FormsEnv {
  FORMS_DB?: { connectionString?: unknown };
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export type Problem =
  | "invalid_input"
  | "consent_required"
  | "listing_not_available"
  | "check_failed"
  | "rate_limited"
  | "unavailable";

export const PROBLEM_TEXT: Record<Problem, string> = {
  invalid_input: "Some details are missing or out of range. Check the form.",
  consent_required: "Tick the box to say we may use your details for this.",
  listing_not_available: "This listing isn't taking enquiries right now.",
  check_failed:
    "We couldn't confirm you're a person. Complete the check and send again.",
  rate_limited: "Too many messages from your connection. Wait a few minutes.",
  unavailable: "This form isn't available right now. Please try again later.",
};

export const PROBLEM_STATUS: Record<Problem, number> = {
  invalid_input: 400,
  consent_required: 400,
  listing_not_available: 409,
  check_failed: 400,
  rate_limited: 429,
  unavailable: 503,
};

export type FormResult =
  | { kind: "sent" }
  | { kind: "problem"; problem: Problem; retryAfterSeconds?: number };

export interface FormDeps {
  limit: (ip: string) => Promise<LimitResult>;
  turnstile: TurnstileSettings | undefined;
  verify: (
    settings: TurnstileSettings,
    token: unknown,
    ip: string | null,
  ) => Promise<Verdict>;
  db: FormsDb | undefined;
}

/** The public sitekey for the page, or null when the form is closed. */
export function siteKeyFor(
  env: FormsEnv,
  config: ServerConfig | undefined,
): string | null {
  if (!config) return null;
  return readTurnstile(env, config.environment)?.siteKey ?? null;
}

export async function formDeps(
  env: FormsEnv,
  config: ServerConfig,
  action: FormAction,
): Promise<FormDeps> {
  const connection = env.FORMS_DB?.connectionString;
  const db =
    typeof connection === "string" && connection.length > 0
      ? (await import("./db")).createFormsDb(connection)
      : undefined;
  return {
    limit: (ip) =>
      checkFormLimit(env.SEARCH_LIMITER, env.SEARCH_LIMITER_SALT, ip, action),
    turnstile: readTurnstile(env, config.environment),
    verify: (settings, token, ip) =>
      verifyTurnstile(settings, token, {
        action,
        expectedHostname: new URL(config.appOrigin).hostname,
        remoteIp: ip,
      }),
    db,
  };
}

export async function runForm<T>(
  request: Request,
  form: FormData,
  deps: FormDeps,
  parse: (form: FormData) => Parsed<T>,
  write: (db: FormsDb, value: T) => Promise<DbOutcome>,
): Promise<FormResult> {
  const ip = request.headers.get("CF-Connecting-IP");
  const limit = await deps.limit(ip ?? "unknown");
  if (limit.kind === "unavailable")
    return { kind: "problem", problem: "unavailable" };
  if (limit.kind === "limited")
    return {
      kind: "problem",
      problem: "rate_limited",
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  if (!deps.turnstile || !deps.db)
    return { kind: "problem", problem: "unavailable" };
  const parsed = parse(form);
  if (!parsed.ok) return { kind: "problem", problem: parsed.problem };
  const verdict = await deps.verify(deps.turnstile, form.get(TOKEN_FIELD), ip);
  if (verdict === "unavailable")
    return { kind: "problem", problem: "unavailable" };
  if (verdict === "fail") return { kind: "problem", problem: "check_failed" };
  const outcome = await write(deps.db, parsed.value);
  if (outcome === "ok") return { kind: "sent" };
  return { kind: "problem", problem: outcome };
}
