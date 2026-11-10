/**
 * GET /api/search handler (P2-2, Claude 19 §2–§4).
 *
 * Order: rate limit (every request counts) -> strict input parsing -> cursor
 * verification -> bounded database wrapper. Fixed premises and mobile
 * providers are separate groups with separate cursors; they are never mixed.
 * Responses are always `private, no-store`. Failures carry fixed error codes
 * and no detail; logs carry fixed labels only.
 */
import {
  readCookie,
  serializeAppCookie,
  COOKIE_PREFIX,
} from "../security/cookies";
import {
  readCursor,
  signCursor,
  type FixedAfter,
  type MobileAfter,
  type SearchGroup,
} from "./cursor";
import type { LimitResult } from "./limiter";

export const SEARCH_COOKIE = `${COOKIE_PREFIX}search`;
export const RADII = [5, 10, 25, 50] as const;
export const DEFAULT_RADIUS = 25;
export const MAX_LIMIT = 20;
const SLUG = /^[a-z][a-z0-9-]{0,79}$/;
const DECIMAL = /^-?\d{1,3}(?:\.\d{1,8})?$/;
const SESSION = /^[0-9a-f]{32}$/;
const ALLOWED = new Set([
  "lat",
  "lng",
  "service",
  "radius",
  "limit",
  "fixed_cursor",
  "mobile_cursor",
]);

export interface SearchArgs {
  lat: number;
  lng: number;
  service: string | null;
  radius: number;
  group: SearchGroup;
  afterBucket: number | null;
  afterId: string | null;
  limit: number;
}
export interface SearchRow {
  public_id: string;
  display_name: string;
  description: string;
  metro: string;
  mode: string;
  service_slug: string;
  service_name: string;
  category_slug: string;
  category_name: string;
  public_address: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  verification_labels: string[];
  distance_bucket: number | null;
}
export interface SearchDeps {
  cursorKey: string | undefined;
  limits: (ip: string, session: string) => Promise<LimitResult>;
  search: ((args: SearchArgs) => Promise<SearchRow[]>) | undefined;
  now?: () => number;
}

interface Query {
  lat: number;
  lng: number;
  service: string | null;
  radius: number;
  limit: number;
  fixedCursor: string | null;
  mobileCursor: string | null;
}

function json(
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
  cookie?: string,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    ...extra,
  });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function parse(url: URL): Query | null {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (!ALLOWED.has(key) || seen.has(key)) return null;
    seen.add(key);
  }
  const get = (k: string) => url.searchParams.get(k);
  const latText = get("lat"),
    lngText = get("lng");
  if (!latText || !lngText || !DECIMAL.test(latText) || !DECIMAL.test(lngText))
    return null;
  const lat = Number(latText),
    lng = Number(lngText);
  if (!(lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33)) return null;
  const service = get("service");
  if (service !== null && !SLUG.test(service)) return null;
  const radiusText = get("radius");
  const radius = radiusText === null ? DEFAULT_RADIUS : Number(radiusText);
  if (
    !(RADII as readonly number[]).includes(radius) ||
    (radiusText !== null && String(radius) !== radiusText)
  )
    return null;
  const limitText = get("limit");
  const limit = limitText === null ? MAX_LIMIT : Number(limitText);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT ||
    (limitText !== null && String(limit) !== limitText)
  )
    return null;
  return {
    lat,
    lng,
    service,
    radius,
    limit,
    fixedCursor: get("fixed_cursor"),
    mobileCursor: get("mobile_cursor"),
  };
}

/**
 * Round like Postgres `round(float8::numeric, dp)`: the float is first read as
 * 15 significant digits, then rounded half away from zero in decimal. Inputs
 * are bounded to South Africa, so no exponent form appears.
 */
export function pgRound(x: number, dp: number): string {
  const [int = "0", frac = ""] = Math.abs(x).toPrecision(15).split(".");
  const digits = (frac + "0".repeat(dp + 1)).slice(0, dp + 1);
  let n = BigInt(int + digits.slice(0, dp));
  if (Number(digits[dp]) >= 5) n += 1n;
  const text = n.toString().padStart(dp + 1, "0");
  const out = dp ? `${text.slice(0, -dp)}.${text.slice(-dp)}` : text;
  return x < 0 && n !== 0n ? `-${out}` : out;
}

/**
 * Canonical form a group's cursors are bound to: the point exactly as the
 * database rounds it for that group (fixed 3 dp, mobile discovery grid 2 dp),
 * so a cursor never carries over to a different rounded search point.
 */
export function canonicalQuery(
  q: Pick<Query, "lat" | "lng" | "service" | "radius" | "limit">,
  group: SearchGroup,
): string {
  const dp = group === "fixed" ? 3 : 2;
  return [
    group,
    pgRound(q.lat, dp),
    pgRound(q.lng, dp),
    q.service ?? "",
    String(q.radius),
    String(q.limit),
  ].join("|");
}

function publicItem(row: SearchRow, group: SearchGroup) {
  const base = {
    public_id: row.public_id,
    display_name: row.display_name,
    description: row.description,
    metro: row.metro,
    service_slug: row.service_slug,
    service_name: row.service_name,
    category_slug: row.category_slug,
    category_name: row.category_name,
    verification_labels: row.verification_labels,
  };
  if (group === "mobile") return { ...base, coverage: "approximate" as const };
  return {
    ...base,
    public_address: row.public_address,
    public_latitude: row.public_latitude,
    public_longitude: row.public_longitude,
    distance_km: (row.distance_bucket ?? 0) / 10,
    distance_kind: "straight-line" as const,
  };
}

async function page(
  deps: SearchDeps & {
    search: NonNullable<SearchDeps["search"]>;
    cursorKey: string;
  },
  q: Query,
  group: SearchGroup,
  after: FixedAfter | MobileAfter | null,
  now: number,
) {
  const rows = await deps.search({
    lat: q.lat,
    lng: q.lng,
    service: q.service,
    radius: q.radius,
    group,
    afterBucket: after && "bucket" in after ? after.bucket : null,
    afterId: after ? after.id : null,
    limit: q.limit + 1,
  });
  const visible = rows.slice(0, q.limit);
  const last = visible.at(-1);
  const next =
    rows.length > q.limit && last
      ? await signCursor(
          deps.cursorKey,
          group,
          canonicalQuery(q, group),
          group === "fixed"
            ? { bucket: last.distance_bucket ?? 0, id: last.public_id }
            : { id: last.public_id },
          now,
        )
      : null;
  return { items: visible.map((r) => publicItem(r, group)), next };
}

export async function handleSearch(
  request: Request,
  deps: SearchDeps,
): Promise<Response> {
  const now = (deps.now ?? Date.now)();
  const existing = readCookie(request, SEARCH_COOKIE);
  let session = existing;
  let cookie: string | undefined;
  if (!session || !SESSION.test(session)) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    session = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    cookie = serializeAppCookie(SEARCH_COOKIE, session, { maxAge: 86_400 });
  }
  const limit = await deps.limits(
    request.headers.get("CF-Connecting-IP") ?? "unknown",
    session,
  );
  if (limit.kind === "unavailable")
    return json(503, { error: "search_unavailable" }, {}, cookie);
  if (limit.kind === "limited")
    return json(
      429,
      { error: "rate_limited" },
      { "Retry-After": String(limit.retryAfterSeconds) },
      cookie,
    );

  const q = parse(new URL(request.url));
  if (!q) return json(400, { error: "invalid_query" }, {}, cookie);
  const { search, cursorKey } = deps;
  if (!search || !cursorKey || cursorKey.length < 32)
    return json(503, { error: "search_unavailable" }, {}, cookie);

  const fixedAfter = q.fixedCursor
    ? await readCursor(
        cursorKey,
        "fixed",
        canonicalQuery(q, "fixed"),
        q.fixedCursor,
        now,
      )
    : null;
  const mobileAfter = q.mobileCursor
    ? await readCursor(
        cursorKey,
        "mobile",
        canonicalQuery(q, "mobile"),
        q.mobileCursor,
        now,
      )
    : null;
  if ((q.fixedCursor && !fixedAfter) || (q.mobileCursor && !mobileAfter))
    return json(400, { error: "invalid_cursor" }, {}, cookie);

  // No cursor: first page of both groups. A cursor continues only its group.
  const wantFixed = q.fixedCursor !== null || q.mobileCursor === null;
  const wantMobile = q.mobileCursor !== null || q.fixedCursor === null;
  try {
    const ready = { ...deps, search, cursorKey };
    const [fixed, mobile] = await Promise.all([
      wantFixed ? page(ready, q, "fixed", fixedAfter, now) : null,
      wantMobile ? page(ready, q, "mobile", mobileAfter, now) : null,
    ]);
    return json(
      200,
      { fixed, mobile, radius_km: q.radius, widened: false },
      {},
      cookie,
    );
  } catch {
    console.error("search-db-unavailable");
    return json(503, { error: "search_unavailable" }, {}, cookie);
  }
}
