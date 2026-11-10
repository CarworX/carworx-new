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
  "category",
  "radius",
  "limit",
  "fixed_cursor",
  "mobile_cursor",
]);

export interface SearchArgs {
  lat: number;
  lng: number;
  service: string | null;
  category: string | null;
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
  /** A session already resolved by the caller (the /search page). */
  session?: { session: string; cookie: string | undefined };
  /** A limit decision already made for this request; skips a second count. */
  checked?: LimitResult;
  cursorKey: string | undefined;
  limits: (ip: string, session: string) => Promise<LimitResult>;
  search: ((args: SearchArgs) => Promise<SearchRow[]>) | undefined;
  now?: () => number;
}

interface Query {
  lat: number;
  lng: number;
  service: string | null;
  category: string | null;
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

function parse(params: URLSearchParams): Query | null {
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (!ALLOWED.has(key) || seen.has(key)) return null;
    seen.add(key);
  }
  const get = (k: string) => params.get(k);
  const latText = get("lat"),
    lngText = get("lng");
  if (!latText || !lngText || !DECIMAL.test(latText) || !DECIMAL.test(lngText))
    return null;
  const lat = Number(latText),
    lng = Number(lngText);
  if (!(lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33)) return null;
  const service = get("service");
  if (service !== null && !SLUG.test(service)) return null;
  const category = get("category");
  if (category !== null && (!SLUG.test(category) || service !== null))
    return null;
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
    category,
    radius,
    limit,
    fixedCursor: get("fixed_cursor"),
    mobileCursor: get("mobile_cursor"),
  };
}

/** Canonical form the cursors are bound to (same rounding as the fixed query). */
export function canonicalQuery(
  q: Pick<Query, "lat" | "lng" | "service" | "category" | "radius" | "limit">,
): string {
  return [
    q.lat.toFixed(3),
    q.lng.toFixed(3),
    q.service ?? "",
    q.category ?? "",
    String(q.radius),
    String(q.limit),
  ].join("|");
}

function baseItem(row: SearchRow) {
  return {
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
}
export type MobileItem = ReturnType<typeof baseItem> & {
  coverage: "approximate";
};
export type FixedItem = ReturnType<typeof baseItem> & {
  public_address: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  distance_km: number;
  distance_kind: "straight-line";
};
function fixedItem(row: SearchRow): FixedItem {
  return {
    ...baseItem(row),
    public_address: row.public_address,
    public_latitude: row.public_latitude,
    public_longitude: row.public_longitude,
    distance_km: (row.distance_bucket ?? 0) / 10,
    distance_kind: "straight-line",
  };
}
function mobileItem(row: SearchRow): MobileItem {
  return { ...baseItem(row), coverage: "approximate" };
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
    category: q.category,
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
          canonicalQuery(q),
          group === "fixed"
            ? { bucket: last.distance_bucket ?? 0, id: last.public_id }
            : { id: last.public_id },
          now,
        )
      : null;
  return { visible, next };
}

/** The opaque search-session cookie the limiter keys on (never stored raw). */
export function ensureSearchSession(request: Request): {
  session: string;
  cookie: string | undefined;
} {
  const existing = readCookie(request, SEARCH_COOKIE);
  if (existing && SESSION.test(existing))
    return { session: existing, cookie: undefined };
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const session = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    session,
    cookie: serializeAppCookie(SEARCH_COOKIE, session, { maxAge: 86_400 }),
  };
}

export interface SearchItemGroup<T> {
  items: T[];
  next: string | null;
}
export interface SearchBody {
  fixed: SearchItemGroup<FixedItem> | null;
  mobile: SearchItemGroup<MobileItem> | null;
  radius_km: number;
  widened: false;
}
export type SearchOutcome =
  | { status: 200; body: SearchBody; cookie?: string }
  | {
      status: 400 | 429 | 503;
      error:
        | "invalid_query"
        | "invalid_cursor"
        | "rate_limited"
        | "search_unavailable";
      retryAfterSeconds?: number;
      cookie?: string;
    };

/**
 * The search core, shared by GET /api/search and the /search page. Order:
 * rate limit (every request counts) -> parse -> cursors -> bounded wrapper.
 */
export async function runSearch(
  request: Request,
  params: URLSearchParams,
  deps: SearchDeps,
): Promise<SearchOutcome> {
  const now = (deps.now ?? Date.now)();
  const { session, cookie } = deps.session ?? ensureSearchSession(request);
  const limit =
    deps.checked ??
    (await deps.limits(
      request.headers.get("CF-Connecting-IP") ?? "unknown",
      session,
    ));
  if (limit.kind === "unavailable")
    return { status: 503, error: "search_unavailable", cookie };
  if (limit.kind === "limited")
    return {
      status: 429,
      error: "rate_limited",
      retryAfterSeconds: limit.retryAfterSeconds,
      cookie,
    };

  const q = parse(params);
  if (!q) return { status: 400, error: "invalid_query", cookie };
  const { search, cursorKey } = deps;
  if (!search || !cursorKey || cursorKey.length < 32)
    return { status: 503, error: "search_unavailable", cookie };

  const canonical = canonicalQuery(q);
  const fixedAfter = q.fixedCursor
    ? await readCursor(cursorKey, "fixed", canonical, q.fixedCursor, now)
    : null;
  const mobileAfter = q.mobileCursor
    ? await readCursor(cursorKey, "mobile", canonical, q.mobileCursor, now)
    : null;
  if ((q.fixedCursor && !fixedAfter) || (q.mobileCursor && !mobileAfter))
    return { status: 400, error: "invalid_cursor", cookie };

  // No cursor: first page of both groups. A cursor continues only its group.
  const wantFixed = q.fixedCursor !== null || q.mobileCursor === null;
  const wantMobile = q.mobileCursor !== null || q.fixedCursor === null;
  try {
    const ready = { ...deps, search, cursorKey };
    const [fixedPage, mobilePage] = await Promise.all([
      wantFixed ? page(ready, q, "fixed", fixedAfter, now) : null,
      wantMobile ? page(ready, q, "mobile", mobileAfter, now) : null,
    ]);
    const fixed = fixedPage
      ? { items: fixedPage.visible.map(fixedItem), next: fixedPage.next }
      : null;
    const mobile = mobilePage
      ? { items: mobilePage.visible.map(mobileItem), next: mobilePage.next }
      : null;
    return {
      status: 200,
      body: { fixed, mobile, radius_km: q.radius, widened: false },
      cookie,
    };
  } catch {
    console.error("search-db-unavailable");
    return { status: 503, error: "search_unavailable", cookie };
  }
}

export async function handleSearch(
  request: Request,
  deps: SearchDeps,
): Promise<Response> {
  const outcome = await runSearch(
    request,
    new URL(request.url).searchParams,
    deps,
  );
  if (outcome.status === 200)
    return json(200, outcome.body, {}, outcome.cookie);
  return json(
    outcome.status,
    { error: outcome.error },
    outcome.retryAfterSeconds === undefined
      ? {}
      : { "Retry-After": String(outcome.retryAfterSeconds) },
    outcome.cookie,
  );
}
