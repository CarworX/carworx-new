/**
 * Optional map of FIXED premises (D-084): a Mapbox Static Images PNG fetched
 * by the Worker with the server token, so the browser never holds a Mapbox
 * token and every image counts against the daily map quota. The page signs
 * the pin list; the image route draws only signed pins, so it is not an open
 * map proxy. Mobile providers never get a pin (A10).
 */
import { b64url, fromB64url, hmacKey } from "../search/cursor";

export interface Pin {
  lat: number;
  lng: number;
}

export const STATIC_STYLE_URL =
  "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static";
export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 360;
export const MAX_PINS = 20;
export const MAP_TTL_MS = 15 * 60 * 1000;
const MAP_TIMEOUT_MS = 3_000;
const CONTEXT = "carworx-static-map-v1.";
const encoder = new TextEncoder();

const inSouthAfrica = (p: Pin) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  p.lat >= -35 &&
  p.lat <= -22 &&
  p.lng >= 16 &&
  p.lng <= 33;

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Signed, expiring list of public premise points. Null when nothing to draw. */
export async function signMapPins(
  secret: string,
  pins: readonly Pin[],
  now = Date.now(),
): Promise<string | null> {
  const p = pins
    .filter(inSouthAfrica)
    .slice(0, MAX_PINS)
    .map((x) => [r5(x.lng), r5(x.lat)]);
  if (p.length === 0) return null;
  const body = b64url(
    encoder.encode(JSON.stringify({ v: 1, p, e: now + MAP_TTL_MS })),
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(CONTEXT + body),
  );
  return `${body}.${b64url(new Uint8Array(mac))}`;
}

export async function readMapPins(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<Pin[] | null> {
  if (token.length > 2048) return null;
  const [body, mac, extra] = token.split(".");
  if (body === undefined || mac === undefined || extra !== undefined)
    return null;
  const signature = fromB64url(mac);
  const bytes = fromB64url(body);
  if (!signature || !bytes) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signature,
    encoder.encode(CONTEXT + body),
  );
  if (!valid) return null;
  let payload: { v?: unknown; p?: unknown; e?: unknown };
  try {
    payload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as typeof payload;
  } catch {
    return null;
  }
  if (
    payload.v !== 1 ||
    typeof payload.e !== "number" ||
    now >= payload.e ||
    payload.e - now > MAP_TTL_MS ||
    !Array.isArray(payload.p) ||
    payload.p.length === 0 ||
    payload.p.length > MAX_PINS
  )
    return null;
  const pins: Pin[] = [];
  for (const item of payload.p as unknown[]) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const [lng, lat] = item as unknown[];
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    const pin = { lat, lng };
    if (!inSouthAfrica(pin)) return null;
    pins.push(pin);
  }
  return pins;
}

/** The Static Images request for these pins (token added by the caller). */
export function staticMapUrl(pins: readonly Pin[]): URL {
  const overlay = pins
    .map((p) => `pin-s+0b6e4f(${String(p.lng)},${String(p.lat)})`)
    .join(",");
  const url = new URL(
    `${STATIC_STYLE_URL}/${overlay}/auto/${String(MAP_WIDTH)}x${String(MAP_HEIGHT)}@2x`,
  );
  url.searchParams.set("padding", "48");
  url.searchParams.set("logo", "true");
  url.searchParams.set("attribution", "true");
  return url;
}

export type StaticMapResult =
  { kind: "ok"; image: ArrayBuffer; type: string } | { kind: "unavailable" };

/** One bounded Static Images request. Fails closed on any error. */
export async function fetchStaticMap(
  pins: readonly Pin[],
  token: string | undefined,
  send: typeof fetch = fetch,
): Promise<StaticMapResult> {
  if (typeof token !== "string" || token.length < 20)
    return { kind: "unavailable" };
  const url = staticMapUrl(pins);
  url.searchParams.set("access_token", token);
  try {
    const response = await send(url, {
      headers: { Accept: "image/png" },
      redirect: "manual", // Workers reject "error"; a 3xx is !ok and fails closed below.
      signal: AbortSignal.timeout(MAP_TIMEOUT_MS),
    });
    const type = response.headers.get("Content-Type") ?? "";
    if (!response.ok || !/^image\/(png|jpeg)$/.test(type.split(";")[0] ?? "")) {
      await response.body?.cancel();
      return { kind: "unavailable" };
    }
    return { kind: "ok", image: await response.arrayBuffer(), type };
  } catch {
    return { kind: "unavailable" };
  }
}
