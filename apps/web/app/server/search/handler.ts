/**
 * GET /api/search handler (P2-2, Claude 19 §2–§4; D-097 keyword search).
 *
 * Order: rate limit (every request counts) -> strict input parsing -> cursor
 * verification -> bounded database wrapper. Fixed premises and mobile
 * providers are separate groups with separate cursors; they are never mixed.
 * With no location at all, one "all" group browses every live listing
 * (newest verified first) and carries no distance. `q` (business or service
 * name words) narrows any group.
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
/** Name words: letters, digits and a few marks; 2–60 characters. */
const WORDS = /^[\p{L}\p{N} .,'’&()/-]{2,60}$/u;
const ALLOWED = new Set([
  "q",
  "lat",
  "lng",
  "service",
  "category",
  "radius",
  "limit",
  "fixed_cursor",
  "mobile_cursor",
  "all_cursor",
  "comes_to_you",
  "sort",
]);

/** Trims and collapses spaces; null when empty or not allowed. */
export function normaliseWords(text: string | null): string | null {
  if (text === null) return null;
  const words = text.replace(/\s+/g, " ").trim();
  return WORDS.test(words) ? words : null;
}

export interface SearchArgs {
  comesToYou?: true;
  /** Null (with lng and radius) only for the "all" group. */
  lat: number | null;
  lng: number | null;
  service: string | null;
  category: string | null;
  radius: number | null;
  group: SearchGroup;
  afterBucket: number | null;
  afterId: string | null;
  limit: number;
  q: string | null;
}
export interface SearchRow {
  rating_avg?: string | number | null;
  rating_count?: number;
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
  /** "all" group only: whole day of the newest verification (0 = none). */
  browse_rank?: number | null;
}
export interface SearchDeps {
  /** A session already resolved by the caller (the /search page). */
  session?: { session: string; cookie: string | undefined };
  /** A limit decision already made for this request; skips a second count. */
  checked?: LimitResult;
  /**
   * Always return both groups, a group without a cursor from its first page.
   * The /search page uses this so a "more" link for one group keeps the
   * other on screen at its current position (alternating pagination).
   */
  bothGroups?: boolean;
  cursorKey: string | undefined;
  limits: (ip: string, session: string) => Promise<LimitResult>;
  search: ((args: SearchArgs) => Promise<SearchRow[]>) | undefined;
  now?: () => number;
}

interface Query {
  comesToYou: boolean;
  /** Both null: browse without a location (the "all" group). */
  lat: number | null;
  lng: number | null;
  q: string | null;
  service: string | null;
  category: string | null;
  radius: number;
  limit: number;
  fixedCursor: string | null;
  mobileCursor: string | null;
  allCursor: string | null;
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
  const qText = get("q");
  const q = normaliseWords(qText);
  if (qText !== null && (q === null || q !== qText)) return null;
  const latText = get("lat"),
    lngText = get("lng");
  let lat: number | null = null,
    lng: number | null = null;
  if (latText === null && lngText === null) {
    // Browsing: no location, so no radius and no located cursors.
    if (
      get("radius") !== null ||
      get("fixed_cursor") !== null ||
      get("mobile_cursor") !== null
    )
      return null;
  } else {
    if (
      !latText ||
      !lngText ||
      !DECIMAL.test(latText) ||
      !DECIMAL.test(lngText) ||
      get("all_cursor") !== null
    )
      return null;
    lat = Number(latText);
    lng = Number(lngText);
    if (!(lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33)) return null;
  }
  const travel = get("comes_to_you");
  if (travel !== null && (travel !== "1" || get("fixed_cursor") !== null))
    return null;
  const sort = get("sort");
  if (sort !== null && (sort !== "near-me" || lat === null || lng === null))
    return null;
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
    q,
    service,
    category,
    radius,
    limit,
    comesToYou: travel === "1",
    fixedCursor: get("fixed_cursor"),
    mobileCursor: get("mobile_cursor"),
    allCursor: get("all_cursor"),
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
  q: Pick<Query, "lat" | "lng" | "service" | "category" | "radius" | "limit"> &
    Partial<Pick<Query, "q" | "comesToYou">>,
  group: SearchGroup,
): string {
  const words = q.q ? q.q.toLowerCase() : "";
  const travelMarker = q.comesToYou ? "|comes_to_you" : "";
  if (group === "all" || q.lat === null || q.lng === null)
    return (
      ["all", q.service ?? "", q.category ?? "", String(q.limit), words].join(
        "|",
      ) + travelMarker
    );
  const dp = group === "fixed" ? 3 : 2;
  const parts = [
    group,
    pgRound(q.lat, dp),
    pgRound(q.lng, dp),
    q.service ?? "",
    q.category ?? "",
    String(q.radius),
    String(q.limit),
  ];
  // Name words are appended only when present, so a located cursor issued
  // before keyword search existed still reads the same.
  if (words) parts.push(words);
  return parts.join("|") + travelMarker;
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
    rating_avg: row.rating_avg == null ? null : Number(row.rating_avg),
    rating_count: row.rating_count ?? 0,
  };
}
export type MobileItem = ReturnType<typeof baseItem> & {
  coverage: "approximate";
  /** A both-business: it also has public premises (O2). Never a distance. */
  also_premises: boolean;
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
/** A browsed listing: no distance; a public address only for premises. */
export type BrowseItem = ReturnType<typeof baseItem> & {
  mode: "fixed" | "mobile" | "both";
  public_address: string | null;
};
function browseItem(row: SearchRow): BrowseItem {
  const mode =
    row.mode === "mobile" || row.mode === "both" ? row.mode : "fixed";
  return {
    ...baseItem(row),
    mode,
    public_address: mode === "mobile" ? null : row.public_address,
  };
}
function mobileItem(row: SearchRow): MobileItem {
  return {
    ...baseItem(row),
    coverage: "approximate",
    also_premises: row.mode === "both",
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
  const located = group !== "all";
  const rows = await deps.search({
    lat: located ? q.lat : null,
    lng: located ? q.lng : null,
    service: q.service,
    category: q.category,
    radius: located ? q.radius : null,
    group,
    afterBucket: after && "bucket" in after ? after.bucket : null,
    afterId: after ? after.id : null,
    limit: q.limit + 1,
    q: q.q,
    ...(q.comesToYou ? { comesToYou: true as const } : {}),
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
            : group === "all"
              ? { bucket: last.browse_rank ?? 0, id: last.public_id }
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
  /** Browsing without a location: every live listing, no distance. */
  all?: SearchItemGroup<BrowseItem> | null;
  /** Null when browsing without a location. */
  radius_km: number | null;
  q?: string | null;
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

  if (q.lat === null || q.lng === null) {
    const allAfter = q.allCursor
      ? await readCursor(
          cursorKey,
          "all",
          canonicalQuery(q, "all"),
          q.allCursor,
          now,
        )
      : null;
    if (q.allCursor && !allAfter)
      return { status: 400, error: "invalid_cursor", cookie };
    try {
      const ready = { ...deps, search, cursorKey };
      const allPage = await page(ready, q, "all", allAfter, now);
      return {
        status: 200,
        body: {
          fixed: null,
          mobile: null,
          all: { items: allPage.visible.map(browseItem), next: allPage.next },
          radius_km: null,
          q: q.q,
          widened: false,
        },
        cookie,
      };
    } catch {
      console.error("search-db-unavailable");
      return { status: 503, error: "search_unavailable", cookie };
    }
  }

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
    return { status: 400, error: "invalid_cursor", cookie };

  // No cursor: first page of both groups. A cursor continues only its group,
  // unless the caller asks for both (the page keeps both on screen).
  const both = deps.bothGroups === true;
  const wantFixed =
    !q.comesToYou &&
    (both || q.fixedCursor !== null || q.mobileCursor === null);
  const wantMobile = both || q.mobileCursor !== null || q.fixedCursor === null;
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
      body: { fixed, mobile, radius_km: q.radius, q: q.q, widened: false },
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
