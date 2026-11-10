import { describe, expect, it } from "vitest";

import {
  GEOCODE_URL,
  geocodeArea,
  normaliseArea,
  parseGeocode,
} from "./geocode";

const TOKEN = "pk.synthetic-geocoding-token-0123456789";

function feature(
  name: string,
  lat: number,
  lng: number,
  place = "Gauteng, South Africa",
) {
  return {
    type: "Feature",
    properties: {
      name,
      place_formatted: place,
      coordinates: { latitude: lat, longitude: lng },
      feature_type: "place",
    },
  };
}

describe("area text", () => {
  it("accepts suburbs, towns and postcodes; rejects junk", () => {
    expect(normaliseArea("  Rosebank  ")).toBe("Rosebank");
    expect(normaliseArea("2196")).toBe("2196");
    expect(normaliseArea("Mitchell’s Plain")).toBe("Mitchell’s Plain");
    for (const bad of ["", "a", "<script>", "x".repeat(81), "drop table;"])
      expect(normaliseArea(bad)).toBeNull();
  });
});

describe("geocode response parsing", () => {
  it("keeps up to five South African candidates and drops the rest", () => {
    const body = {
      features: [
        feature("Rosebank", -26.146, 28.042),
        feature("London", 51.5, -0.12, "United Kingdom"),
        feature("Rosebank", -33.95, 18.47, "Cape Town, South Africa"),
        { properties: { name: "broken" } },
      ],
    };
    expect(parseGeocode(body)).toEqual([
      { label: "Rosebank, Gauteng, South Africa", lat: -26.146, lng: 28.042 },
      { label: "Rosebank, Cape Town, South Africa", lat: -33.95, lng: 18.47 },
    ]);
    expect(parseGeocode({})).toBeNull();
  });
});

describe("geocodeArea", () => {
  it("makes one temporary, bounded South Africa request and never asks to store", async () => {
    const urls: URL[] = [];
    const send: typeof fetch = (input) => {
      urls.push(new URL(input instanceof Request ? input.url : input));
      return Promise.resolve(
        Response.json({ features: [feature("Sandton", -26.107, 28.056)] }),
      );
    };
    const result = await geocodeArea("Sandton", TOKEN, send);
    expect(result).toEqual({
      kind: "ok",
      candidates: [
        { label: "Sandton, Gauteng, South Africa", lat: -26.107, lng: 28.056 },
      ],
    });
    const url = urls[0];
    if (!url) throw new Error("no request");
    expect(`${url.origin}${url.pathname}`).toBe(GEOCODE_URL);
    expect(url.searchParams.get("country")).toBe("za");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("autocomplete")).toBe("false");
    expect(url.searchParams.has("permanent")).toBe(false);
  });

  it("fails closed without a token, on errors and on bad input", async () => {
    const never = () => Promise.reject(new Error("should not be called"));
    expect(
      await geocodeArea("Sandton", undefined, never as typeof fetch),
    ).toEqual({ kind: "unavailable" });
    expect(await geocodeArea("<x>", TOKEN, never as typeof fetch)).toEqual({
      kind: "invalid",
    });
    const failing = () => Promise.resolve(new Response("{}", { status: 429 }));
    expect(
      await geocodeArea("Sandton", TOKEN, failing as typeof fetch),
    ).toEqual({ kind: "unavailable" });
    const throwing = () => Promise.reject(new Error("network"));
    expect(
      await geocodeArea("Sandton", TOKEN, throwing as typeof fetch),
    ).toEqual({ kind: "unavailable" });
  });
});
