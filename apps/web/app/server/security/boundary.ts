import { COOKIE_PREFIX, isCompliantSetCookie, readCookies } from "./cookies";
import { ConfigError, readServerConfig, type ServerConfig } from "./config";
import { CSRF_FIELD, csrfTokenMatches, issueCsrfToken } from "./csrf";

/**
 * The request/response boundary every Worker request passes through (T5).
 *
 * Before the app runs, a state-changing request (anything but GET, HEAD or
 * OPTIONS) must:
 *   1. carry an Origin header exactly equal to APP_ORIGIN;
 *   2. be a form post (urlencoded or multipart) of at most MAX_FORM_BYTES;
 *   3. echo the CSRF cookie in its `csrf` field.
 * Otherwise it gets 403 and the app is never called.
 *
 * After the app runs, the response:
 *   - is `Cache-Control: private, no-store` whenever it could be personal:
 *     the request carried an app cookie, the response sets one, the path is
 *     personal, the method mutates, or the route set no Cache-Control;
 *   - may only set cookies with Secure; HttpOnly; SameSite=Lax; Path=/ and
 *     the __Host-cx- prefix, and may only redirect to this origin or to the
 *     Supabase authorize endpoint. Anything else fails closed with a 500;
 *   - gets the baseline security headers.
 */
export const PRIVATE_NO_STORE = "private, no-store";
export const MAX_FORM_BYTES = 64 * 1024;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PERSONAL_PATHS = /^\/(?:auth|account|admin|org|provider|join)(?:[/.]|$)/;

export interface SecurityContext {
  /**
   * Undefined when the Auth settings are missing (e.g. a local checkout with
   * no .dev.vars). Pages that don't need Auth still render; Auth routes call
   * `requireConfig` and fail with a 500; every mutation is refused.
   */
  config: ServerConfig | undefined;
  /** The CSRF token forms must render in a hidden `csrf` field. */
  csrfToken: string;
}

function plain(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": PRIVATE_NO_STORE,
    },
  });
}

export type MutationCheck =
  | { ok: true }
  | { ok: false; reason: "origin" | "content-type" | "too-large" | "csrf" };

/** Reads a request body up to `limit` bytes. Returns null (and cancels) on overflow. */
export async function readBounded(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<ArrayBuffer | null> {
  if (stream === null) return new ArrayBuffer(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      // Not awaited: the body is teed, and the tee's cancel only settles once
      // both branches are cancelled, so awaiting here would hang the request.
      reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

export async function checkMutation(
  request: Request,
  config: ServerConfig,
): Promise<MutationCheck> {
  if (SAFE_METHODS.has(request.method)) return { ok: true };
  if (request.headers.get("Origin") !== config.appOrigin) {
    return { ok: false, reason: "origin" };
  }
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null && site !== "same-origin") {
    return { ok: false, reason: "origin" };
  }
  // Keep the header as sent: a multipart boundary is case-sensitive. Only the
  // media type (before any ";") is compared, case-insensitively.
  const contentType = request.headers.get("Content-Type") ?? "";
  const mediaType = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  if (
    mediaType !== "application/x-www-form-urlencoded" &&
    mediaType !== "multipart/form-data"
  ) {
    return { ok: false, reason: "content-type" };
  }
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (!Number.isFinite(length) || length > MAX_FORM_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  // Read at most MAX_FORM_BYTES + 1, then stop: a body without Content-Length
  // (chunked) must not be buffered whole before the limit applies.
  const body = await readBounded(request.clone().body, MAX_FORM_BYTES);
  if (body === null) return { ok: false, reason: "too-large" };
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }).formData();
  } catch {
    return { ok: false, reason: "content-type" };
  }
  if (!csrfTokenMatches(request, form.get(CSRF_FIELD))) {
    return { ok: false, reason: "csrf" };
  }
  return { ok: true };
}

function isAllowedRedirect(
  location: string,
  appOrigin: string,
  config: ServerConfig | undefined,
): boolean {
  let url: URL;
  try {
    url = new URL(location, appOrigin);
  } catch {
    return false;
  }
  if (url.origin === appOrigin) return true;
  return (
    config !== undefined &&
    url.origin === config.supabaseUrl &&
    url.pathname === "/auth/v1/authorize"
  );
}

function isPersonal(request: Request, response: Response): boolean {
  if (!SAFE_METHODS.has(request.method)) return true;
  if (readCookies(request).some((c) => c.name.startsWith(COOKIE_PREFIX)))
    return true;
  if (response.headers.getSetCookie().length > 0) return true;
  if (PERSONAL_PATHS.test(new URL(request.url).pathname)) return true;
  return !response.headers.has("Cache-Control");
}

function wantsCsrfCookie(response: Response): boolean {
  const type = response.headers.get("Content-Type") ?? "";
  return type.startsWith("text/html") || type.startsWith("text/x-script");
}

export function finalizeResponse(
  request: Request,
  response: Response,
  config: ServerConfig | undefined,
  csrfSetCookie?: string,
): Response {
  const appOrigin = config?.appOrigin ?? new URL(request.url).origin;
  const headers = new Headers(response.headers);
  if (csrfSetCookie !== undefined && wantsCsrfCookie(response)) {
    headers.append("Set-Cookie", csrfSetCookie);
  }
  if (!headers.getSetCookie().every(isCompliantSetCookie)) {
    return plain(500, "Internal error");
  }
  const location = headers.get("Location");
  if (location !== null && !isAllowedRedirect(location, appOrigin, config)) {
    return plain(500, "Internal error");
  }
  const outgoing = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  if (isPersonal(request, outgoing)) {
    headers.set("Cache-Control", PRIVATE_NO_STORE);
    headers.delete("Expires");
    headers.delete("Pragma");
  }
  const path = new URL(request.url).pathname;
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Referrer-Policy",
    PERSONAL_PATHS.test(path)
      ? "no-referrer"
      : "strict-origin-when-cross-origin",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (!headers.has("Content-Security-Policy")) {
    headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    );
  }
  if (appOrigin.startsWith("https:")) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  return new Response(outgoing.body, {
    status: outgoing.status,
    statusText: outgoing.statusText,
    headers,
  });
}

/** For Auth routes: the settings, or a plain 500 thrown to React Router. */
export function requireConfig(security: SecurityContext): ServerConfig {
  if (security.config === undefined) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw plain(500, "Internal error");
  }
  return security.config;
}

export async function withSecurityBoundary(
  request: Request,
  env: unknown,
  handle: (request: Request, security: SecurityContext) => Promise<Response>,
): Promise<Response> {
  let config: ServerConfig | undefined;
  try {
    config = readServerConfig(env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    config = undefined;
  }
  if (config === undefined && !SAFE_METHODS.has(request.method)) {
    return plain(500, "Internal error");
  }
  if (config !== undefined) {
    const check = await checkMutation(request, config);
    if (!check.ok) return plain(403, "Forbidden");
  }
  const csrf = issueCsrfToken(request);
  const response = await handle(request, { config, csrfToken: csrf.token });
  return finalizeResponse(request, response, config, csrf.setCookie);
}
