/**
 * Server-only area lookup with the Mapbox Geocoding API v6 (D-082).
 *
 * Temporary geocoding only: `permanent` is never set, and Mapbox's terms say
 * temporary results may not be cached. The result is used once, to pick a
 * point for this request, then dropped. It is never written to the database,
 * a log, a cursor or a cache (A17). Area text from the visitor is bounded,
 * and only South African places, localities, neighbourhoods and postcodes
 * are requested.
 * Docs: https://docs.mapbox.com/api/search/geocoding/ (read 2026-11-10).
 */
export interface AreaCandidate {
  label: string;
  lat: number;
  lng: number;
}

export interface LocationCandidate extends AreaCandidate {
  locality: string;
}

export type GeocodeResult =
  | { kind: "ok"; candidates: AreaCandidate[] }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export const GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward";
export const GEOCODE_TIMEOUT_MS = 2_500;
const AREA = /^[\p{L}\p{N} .,'’()-]{2,80}$/u;

export function normaliseArea(text: string | null): string | null {
  if (text === null) return null;
  const area = text.replace(/\s+/g, " ").trim();
  return AREA.test(area) ? area : null;
}

function inSouthAfrica(lat: number, lng: number) {
  return lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33;
}

/** Parses a v6 forward response into at most five bounded candidates. */
export function parseGeocode(body: unknown): AreaCandidate[] | null {
  const features = (body as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return null;
  const out: AreaCandidate[] = [];
  for (const feature of features.slice(0, 5)) {
    const props = (feature as { properties?: Record<string, unknown> })
      .properties;
    const coords = props?.["coordinates"] as
      { latitude?: unknown; longitude?: unknown } | undefined;
    const lat = coords?.latitude;
    const lng = coords?.longitude;
    const name = props?.["name"];
    const place = props?.["place_formatted"];
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !inSouthAfrica(lat, lng) ||
      typeof name !== "string"
    )
      continue;
    const label = [name, typeof place === "string" ? place : ""]
      .filter(Boolean)
      .join(", ")
      .slice(0, 120);
    out.push({ label, lat, lng });
  }
  return out;
}

export async function geocodeArea(
  area: string,
  token: string | undefined,
  send: typeof fetch = fetch,
): Promise<GeocodeResult> {
  const query = normaliseArea(area);
  if (!query) return { kind: "invalid" };
  if (typeof token !== "string" || token.length < 20)
    return { kind: "unavailable" };
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("country", "za");
  url.searchParams.set("types", "place,locality,neighborhood,postcode");
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("autocomplete", "false");
  url.searchParams.set("access_token", token);
  try {
    const response = await send(url, {
      headers: { Accept: "application/json" },
      redirect: "manual", // Workers reject "error"; a 3xx is !ok and fails closed below.
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { kind: "unavailable" };
    }
    const candidates = parseGeocode(await response.json());
    return candidates ? { kind: "ok", candidates } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function suggestLocations(
  text: string,
  token: string | undefined,
  autocomplete: boolean,
  send: typeof fetch = fetch,
): Promise<LocationCandidate[] | null> {
  const query = normaliseArea(text);
  if (!query || !token || token.length < 20) return null;
  const url = new URL(GEOCODE_URL);
  url.search = new URLSearchParams({
    q: query,
    country: "za",
    types: "address,place,locality,neighborhood,postcode",
    limit: "5",
    language: "en",
    autocomplete: String(autocomplete),
    access_token: token,
  }).toString();
  try {
    const response = await send(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn("location-provider-response:", response.status);
      await response.body?.cancel();
      return null;
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return null;
    const features = (body as { features?: unknown }).features;
    if (!Array.isArray(features)) return null;
    return features.slice(0, 5).flatMap((feature: unknown) => {
      const candidate = parseGeocode({ features: [feature] })?.[0];
      if (!candidate) return [];
      const context = (
        feature as {
          properties?: {
            context?: {
              place?: { name?: unknown };
              region?: { name?: unknown };
            };
          };
        }
      ).properties?.context;
      const locality = [context?.place?.name, context?.region?.name]
        .filter((name): name is string => typeof name === "string")
        .join(", ")
        .replace(/[^\p{L}\p{N} .,'’()-]/gu, "")
        .slice(0, 80);
      return [
        {
          ...candidate,
          locality,
          lat: +candidate.lat.toFixed(3),
          lng: +candidate.lng.toFixed(3),
        },
      ];
    });
  } catch {
    return null;
  }
}
