import { GEOCODE_URL, parseGeocode } from "../server/geo/geocode";
import { STATIC_STYLE_URL } from "../server/geo/staticMap";
import {
  inSouthAfrica,
  PICKER_HEIGHT,
  PICKER_WIDTH,
  PICKER_ZOOM,
  type Centre,
} from "./map";

/** Temporary lookup, only to recenter this request's map. Never save or log its result. */
export async function lookupPlace(
  query: string,
  token: string,
  send: typeof fetch = fetch,
) {
  const area = query.replace(/\s+/g, " ").trim();
  if (area.length < 2 || area.length > 120) return null;
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("q", area);
  url.searchParams.set("country", "za");
  url.searchParams.set(
    "types",
    "address,street,place,locality,neighborhood,postcode",
  );
  url.searchParams.set("limit", "5");
  url.searchParams.set("autocomplete", "false");
  url.searchParams.set("access_token", token);
  try {
    const response = await send(url, {
      redirect: "error",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    return parseGeocode(await response.json());
  } catch {
    return null;
  }
}

/** Fixed bounds/zoom make a user's image tap reversible without a mapping SDK. */
export async function pickerImage(
  centre: Centre,
  token: string,
  send: typeof fetch = fetch,
): Promise<string | null> {
  if (!inSouthAfrica(centre)) return null;
  const url = new URL(
    `${STATIC_STYLE_URL}/${String(centre.lng)},${String(centre.lat)},${String(PICKER_ZOOM)}/${String(PICKER_WIDTH)}x${String(PICKER_HEIGHT)}@2x`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("logo", "true");
  url.searchParams.set("attribution", "true");
  try {
    const response = await send(url, {
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (
      !response.ok ||
      response.headers.get("Content-Type")?.split(";")[0] !== "image/png"
    ) {
      await response.body?.cancel();
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 1_048_576) return null;
    let raw = "";
    for (const byte of bytes) raw += String.fromCharCode(byte);
    // Private action data; neither location nor geocoder results go in an image URL.
    return `data:image/png;base64,${btoa(raw)}`;
  } catch {
    return null;
  }
}
