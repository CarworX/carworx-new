import { approvedRecipients, loopbackOrigin } from "./recipient-policy";

/**
 * Server configuration for Auth and the security boundary (T3/T5).
 *
 * Values come from Worker bindings: `.dev.vars` locally (git-ignored),
 * Wrangler vars/secrets on staging (K2). Only names are listed in
 * `.env.example`. Nothing here is ever logged or rendered.
 */
export interface ServerConfig {
  /** The one origin the app is served from, e.g. "http://localhost:5173". */
  appOrigin: string;
  /** Supabase API origin, e.g. "http://127.0.0.1:54321". */
  supabaseUrl: string;
  /** Supabase publishable (anon) key. Public by design; RLS protects data. */
  supabasePublishableKey: string;
  environment: "local" | "staging" | null;
  /** Server-only. Never return configuration from a loader/action. */
  approvedRecipients: ReadonlySet<string> | null;
}

// App-side checks do not replace the separately deployed direct Auth hook.

export class ConfigError extends Error {
  constructor(name: string) {
    super(`Missing or invalid server setting: ${name}`);
    this.name = "ConfigError";
  }
}

function origin(value: unknown, name: string): string {
  if (typeof value !== "string" || value === "") throw new ConfigError(name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(name);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    // Plain http is allowed only for the local stack.
    throw new ConfigError(name);
  }
  if (url.origin !== value.replace(/\/$/, "")) throw new ConfigError(name);
  return url.origin;
}

export function readServerConfig(env: unknown): ServerConfig {
  const vars = (env ?? {}) as Record<string, unknown>;
  const key = vars["SUPABASE_PUBLISHABLE_KEY"];
  if (typeof key !== "string" || key.length < 20) {
    throw new ConfigError("SUPABASE_PUBLISHABLE_KEY");
  }
  const appOrigin = origin(vars["APP_ORIGIN"], "APP_ORIGIN");
  const supabaseUrl = origin(vars["SUPABASE_URL"], "SUPABASE_URL");
  const mode = vars["CARWORX_ENV"];
  const environment =
    mode === "staging"
      ? "staging"
      : mode === "local" ||
          (mode === undefined &&
            loopbackOrigin(appOrigin) &&
            loopbackOrigin(supabaseUrl))
        ? "local"
        : null;
  return {
    appOrigin,
    supabaseUrl,
    supabasePublishableKey: key,
    environment,
    approvedRecipients: approvedRecipients(
      vars["STAGING_APPROVED_RECIPIENTS_JSON"],
    ),
  };
}
