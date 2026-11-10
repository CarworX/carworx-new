import { describe, expect, it } from "vitest";

import {
  fetchStaticMap,
  MAP_TTL_MS,
  readMapPins,
  signMapPins,
  STATIC_STYLE_URL,
  staticMapUrl,
} from "./staticMap";

const KEY = "synthetic-map-key-".repeat(3);
const TOKEN = "sk.synthetic-server-token-0123456789";
const PINS = [
  { lat: -33.9, lng: 18.4 },
  { lat: -33.95123456, lng: 18.47 },
];

describe("signed map pins", () => {
  it("round-trips South African pins and rejects tampering or expiry", async () => {
    const now = 1_700_000_000_000;
    const token = await signMapPins(KEY, PINS, now);
    if (!token) throw new Error("no token");
    expect(await readMapPins(KEY, token, now)).toEqual([
      { lat: -33.9, lng: 18.4 },
      { lat: -33.95123, lng: 18.47 },
    ]);
    expect(await readMapPins(KEY, token, now + MAP_TTL_MS)).toBeNull();
    expect(await readMapPins(`${KEY}x`, token, now)).toBeNull();
    const [body, mac] = token.split(".");
    expect(
      await readMapPins(KEY, `${body ?? ""}x.${mac ?? ""}`, now),
    ).toBeNull();
    expect(await readMapPins(KEY, "junk", now)).toBeNull();
  });

  it("drops points outside South Africa and caps the pin count", async () => {
    expect(await signMapPins(KEY, [{ lat: 51.5, lng: -0.1 }])).toBeNull();
    const many = Array.from({ length: 30 }, (_, i) => ({
      lat: -26 - i / 100,
      lng: 28,
    }));
    const token = await signMapPins(KEY, many);
    expect((await readMapPins(KEY, token ?? ""))?.length).toBe(20);
  });
});

describe("static map request", () => {
  it("draws only the given pins on a fixed-size image", () => {
    const url = staticMapUrl(PINS);
    expect(url.href.startsWith(STATIC_STYLE_URL)).toBe(true);
    expect(decodeURIComponent(url.pathname)).toContain(
      "pin-s+0b6e4f(18.4,-33.9),pin-s+0b6e4f(18.47,-33.95123456)/auto/640x360@2x",
    );
    expect(url.searchParams.has("access_token")).toBe(false);
  });

  it("fails closed without a token, on errors and on non-images", async () => {
    const never = () => Promise.reject(new Error("should not be called"));
    expect(
      await fetchStaticMap(PINS, undefined, never as typeof fetch),
    ).toEqual({ kind: "unavailable" });
    const html = () =>
      Promise.resolve(
        new Response("<html>", { headers: { "Content-Type": "text/html" } }),
      );
    expect(await fetchStaticMap(PINS, TOKEN, html as typeof fetch)).toEqual({
      kind: "unavailable",
    });
    const limited = () => Promise.resolve(new Response(null, { status: 429 }));
    expect(await fetchStaticMap(PINS, TOKEN, limited as typeof fetch)).toEqual({
      kind: "unavailable",
    });
    const urls: string[] = [];
    const ok: typeof fetch = (input) => {
      urls.push(input instanceof Request ? input.url : input.toString());
      return Promise.resolve(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { "Content-Type": "image/png" },
        }),
      );
    };
    const result = await fetchStaticMap(PINS, TOKEN, ok);
    expect(result.kind).toBe("ok");
    expect(new URL(urls[0] ?? "").searchParams.get("access_token")).toBe(TOKEN);
  });
});
