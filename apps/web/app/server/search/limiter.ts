/**
 * Search rate limiting (Claude 19 §7, D-081).
 *
 * Two independent fixed windows: one keyed by a salted hash of the client IP,
 * one by a salted hash of an opaque search-session cookie. Each key lives in
 * its own SQLite-backed Durable Object, so counts are exact per key. Raw IPs
 * and cookie values are never stored or logged. Any missing binding, error or
 * slow answer fails closed: the caller turns it into 503, never an allow.
 */
export interface Window {
  limit: number;
  windowMs: number;
}
export const IP_WINDOW: Window = { limit: 30, windowMs: 60_000 };
export const SESSION_WINDOW: Window = { limit: 60, windowMs: 600_000 };
/**
 * Global daily quotas that keep Mapbox inside its free tier (D-082). Mapbox
 * has no spending cap and bills overages automatically, so these fail closed.
 * Free tiers read 2026-11-10 (https://www.mapbox.com/pricing): 100,000
 * temporary geocoding requests and 50,000 GL JS map loads per month.
 * 31 x 3,000 = 93,000 and 31 x 1,500 = 46,500 stay below them.
 */
export const GEOCODE_DAILY: Window = { limit: 3_000, windowMs: 86_400_000 };
export const MAP_DAILY: Window = { limit: 1_500, windowMs: 86_400_000 };
/**
 * Visitor forms (P2-5, Claude 22 §4): 5 posts per 10 minutes per IP, per form.
 * A person sends one or two; a script is stopped at once.
 */
export const FORM_WINDOW: Window = { limit: 5, windowMs: 600_000 };
export const LIMITER_TIMEOUT_MS = 300;

export interface Counter {
  start: number;
  count: number;
}
export type Decision =
  | { allowed: true; next: Counter }
  | { allowed: false; next: Counter; retryAfterSeconds: number };

/** Pure fixed-window decision, unit-tested without a runtime. */
export function decide(
  current: Counter | undefined,
  now: number,
  window: Window,
): Decision {
  const fresh = !current || now - current.start >= window.windowMs;
  const start = fresh ? now : current.start;
  const count = (fresh ? 0 : current.count) + 1;
  const next = { start, count };
  if (count <= window.limit) return { allowed: true, next };
  return {
    allowed: false,
    next,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((start + window.windowMs - now) / 1000),
    ),
  };
}

interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  transaction<T>(fn: (txn: Storage) => Promise<T>): Promise<T>;
}

/**
 * Durable Object class. Deliberately no `cloudflare:workers` import, so the
 * built Worker still loads in the Node integration harness.
 */
export class SearchLimiter {
  private readonly storage: Storage;
  constructor(state: { storage: Storage }) {
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const body = await request.json<Partial<Window>>();
      const window = [
        IP_WINDOW,
        SESSION_WINDOW,
        GEOCODE_DAILY,
        MAP_DAILY,
        FORM_WINDOW,
      ].find((w) => w.limit === body.limit && w.windowMs === body.windowMs);
      if (!window) return Response.json({}, { status: 400 });
      const result = await this.storage.transaction(async (txn) => {
        const outcome = decide(
          await txn.get<Counter>("window"),
          Date.now(),
          window,
        );
        await txn.put("window", outcome.next);
        return outcome;
      });
      return Response.json(
        result.allowed
          ? { allowed: true }
          : { allowed: false, retry_after: result.retryAfterSeconds },
      );
    } catch {
      return Response.json({}, { status: 500 });
    }
  }
}

export interface LimiterNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(url: string, init: RequestInit): Promise<Response>;
  };
}

export type LimitResult =
  | { kind: "allowed" }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "unavailable" };

async function keyHash(salt: string, purpose: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`carworx-search-limit-v1\n${purpose}\n${value}`),
  );
  return Array.from(new Uint8Array(mac), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function ask(
  namespace: LimiterNamespace,
  name: string,
  window: Window,
): Promise<LimitResult> {
  const response = await namespace
    .get(namespace.idFromName(name))
    .fetch("https://search-limiter.invalid/check", {
      method: "POST",
      body: JSON.stringify(window),
      signal: AbortSignal.timeout(LIMITER_TIMEOUT_MS),
    });
  if (!response.ok) return { kind: "unavailable" };
  const body = await response.json<{
    allowed?: unknown;
    retry_after?: unknown;
  }>();
  if (body.allowed === true) return { kind: "allowed" };
  if (body.allowed === false && Number.isInteger(body.retry_after))
    return { kind: "limited", retryAfterSeconds: body.retry_after as number };
  return { kind: "unavailable" };
}

/** Both checks must allow. Any failure is "unavailable" (fail closed). */
export async function checkSearchLimits(
  namespace: LimiterNamespace | undefined,
  salt: string | undefined,
  ip: string,
  session: string,
): Promise<LimitResult> {
  if (!namespace || typeof salt !== "string" || salt.length < 32)
    return { kind: "unavailable" };
  try {
    const [ipKey, sessionKey] = await Promise.all([
      keyHash(salt, "ip", ip),
      keyHash(salt, "session", session),
    ]);
    const results = await Promise.all([
      ask(namespace, `ip:${ipKey}`, IP_WINDOW),
      ask(namespace, `session:${sessionKey}`, SESSION_WINDOW),
    ]);
    if (results.some((r) => r.kind === "unavailable"))
      return { kind: "unavailable" };
    const limited = results.filter(
      (r): r is { kind: "limited"; retryAfterSeconds: number } =>
        r.kind === "limited",
    );
    if (limited.length > 0)
      return {
        kind: "limited",
        retryAfterSeconds: Math.max(...limited.map((r) => r.retryAfterSeconds)),
      };
    return { kind: "allowed" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** One global counter per quota name. Any failure is "unavailable". */
export async function checkQuota(
  namespace: LimiterNamespace | undefined,
  name: "geocode" | "map",
): Promise<LimitResult> {
  if (!namespace) return { kind: "unavailable" };
  try {
    return await ask(
      namespace,
      `quota:${name}`,
      name === "geocode" ? GEOCODE_DAILY : MAP_DAILY,
    );
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * One per-IP window per visitor form. Keyed by a salted hash of the IP with
 * its own purpose label, so form and search counters never share a key. Any
 * failure is "unavailable" (fail closed).
 */
export async function checkFormLimit(
  namespace: LimiterNamespace | undefined,
  salt: string | undefined,
  ip: string,
  form: "enquiry" | "demand" | "support",
): Promise<LimitResult> {
  if (!namespace || typeof salt !== "string" || salt.length < 32)
    return { kind: "unavailable" };
  try {
    const key = await keyHash(salt, `form-ip:${form}`, ip);
    return await ask(namespace, `form:${form}:ip:${key}`, FORM_WINDOW);
  } catch {
    return { kind: "unavailable" };
  }
}
