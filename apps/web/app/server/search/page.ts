/**
 * The /search page model (P2-3). One rate-limit decision per request, then:
 * area text -> daily geocode quota -> temporary geocode (never stored) ->
 * the shared P2-2 core. "More" links carry only rounded coordinates, the
 * visitor's own area label and the signed cursor; they never re-geocode.
 */
import { findCategory } from "../../catalogue/taxonomy";
import type { AreaCandidate, GeocodeResult } from "../geo/geocode";
import { normaliseArea } from "../geo/geocode";
import {
  pgRound,
  ensureSearchSession,
  runSearch,
  RADII,
  DEFAULT_RADIUS,
  type SearchBody,
  type SearchDeps,
} from "./handler";
import type { LimitResult } from "./limiter";

export interface PageDeps extends SearchDeps {
  quota: () => Promise<LimitResult>;
  geocode: (area: string) => Promise<GeocodeResult>;
}

export interface Choice {
  label: string;
  href: string;
}

export type PageModel =
  | { kind: "start"; category: string; radius: number }
  | { kind: "invalid_area"; area: string; category: string; radius: number }
  | { kind: "no_area"; area: string; category: string; radius: number }
  | {
      kind: "area_unavailable";
      area: string;
      category: string;
      radius: number;
    }
  | { kind: "choose"; area: string; choices: Choice[] }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "unavailable" }
  | { kind: "bad_request" }
  | {
      kind: "results";
      near: string;
      category: string;
      radius: number;
      body: SearchBody;
      radiusLinks: { radius: number; href: string; current: boolean }[];
      moreFixed: string | null;
      moreMobile: string | null;
    };

export interface PageResult {
  model: PageModel;
  /** A new search-session cookie to set, if one was issued. */
  cookie?: string;
}

const round3 = (n: number) => pgRound(n, 3);
const NEAR = /^[\p{L}\p{N} .,'’()-]{1,120}$/u;

function searchHref(p: {
  lat: string;
  lng: string;
  near: string;
  category: string;
  radius: number;
  fixed_cursor?: string;
  mobile_cursor?: string;
}): string {
  const q = new URLSearchParams({ lat: p.lat, lng: p.lng });
  if (p.near) q.set("near", p.near);
  if (p.category) q.set("category", p.category);
  q.set("radius", String(p.radius));
  if (p.fixed_cursor) q.set("fixed_cursor", p.fixed_cursor);
  if (p.mobile_cursor) q.set("mobile_cursor", p.mobile_cursor);
  return `/search?${q.toString()}`;
}

export async function buildSearchPage(
  request: Request,
  deps: PageDeps,
): Promise<PageResult> {
  const url = new URL(request.url);
  const get = (k: string) => url.searchParams.get(k);
  const categoryParam = get("category") ?? "";
  const category = findCategory(categoryParam) ? categoryParam : "";
  const radiusParam = Number(get("radius") ?? DEFAULT_RADIUS);
  const radius = (RADII as readonly number[]).includes(radiusParam)
    ? radiusParam
    : DEFAULT_RADIUS;
  const areaText = (get("area") ?? "").trim();
  const latText = get("lat") ?? "";
  const lngText = get("lng") ?? "";
  const hasPoint = latText !== "" && lngText !== "";
  if (!hasPoint && areaText === "")
    return { model: { kind: "start", category, radius } };

  const resolved = ensureSearchSession(request);
  const cookie = resolved.cookie;
  const checked = await deps.limits(
    request.headers.get("CF-Connecting-IP") ?? "unknown",
    resolved.session,
  );
  const withCookie = (model: PageModel): PageResult =>
    cookie === undefined ? { model } : { model, cookie };
  if (checked.kind === "unavailable")
    return withCookie({ kind: "unavailable" });
  if (checked.kind === "limited")
    return withCookie({
      kind: "rate_limited",
      retryAfterSeconds: checked.retryAfterSeconds,
    });

  let lat = latText;
  let lng = lngText;
  let near = NEAR.test(get("near") ?? "") ? (get("near") ?? "") : "";
  if (!hasPoint) {
    const area = normaliseArea(areaText);
    if (!area)
      return withCookie({
        kind: "invalid_area",
        area: areaText.slice(0, 80),
        category,
        radius,
      });
    const quota = await deps.quota();
    if (quota.kind !== "allowed")
      return withCookie({
        kind: "area_unavailable",
        area,
        category,
        radius,
      });
    const found = await deps.geocode(area);
    if (found.kind === "unavailable" || found.kind === "invalid")
      return withCookie({
        kind: "area_unavailable",
        area,
        category,
        radius,
      });
    const candidates: AreaCandidate[] = found.candidates;
    if (candidates.length === 0)
      return withCookie({ kind: "no_area", area, category, radius });
    if (candidates.length > 1)
      return withCookie({
        kind: "choose",
        area,
        choices: candidates.map((c) => ({
          label: c.label,
          href: searchHref({
            lat: round3(c.lat),
            lng: round3(c.lng),
            near: c.label,
            category,
            radius,
          }),
        })),
      });
    const only = candidates[0];
    if (!only) return withCookie({ kind: "unavailable" });
    lat = round3(only.lat);
    lng = round3(only.lng);
    near = only.label;
  }

  const params = new URLSearchParams({ lat, lng, radius: String(radius) });
  if (category) params.set("category", category);
  for (const key of ["fixed_cursor", "mobile_cursor"]) {
    const v = get(key);
    if (v) params.set(key, v);
  }
  const outcome = await runSearch(request, params, {
    ...deps,
    session: resolved,
    checked,
  });
  if (outcome.status !== 200)
    return withCookie(
      outcome.status === 400
        ? { kind: "bad_request" }
        : { kind: "unavailable" },
    );
  const base = { lat, lng, near, category };
  return withCookie({
    kind: "results",
    near,
    category,
    radius,
    body: outcome.body,
    radiusLinks: RADII.map((r) => ({
      radius: r,
      href: searchHref({ ...base, radius: r }),
      current: r === radius,
    })),
    moreFixed: outcome.body.fixed?.next
      ? searchHref({ ...base, radius, fixed_cursor: outcome.body.fixed.next })
      : null,
    moreMobile: outcome.body.mobile?.next
      ? searchHref({ ...base, radius, mobile_cursor: outcome.body.mobile.next })
      : null,
  });
}
