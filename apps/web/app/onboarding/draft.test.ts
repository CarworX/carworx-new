import { describe, expect, it } from "vitest";
import { incompleteStep, parseStep, type Draft } from "./draft";
import { DEFAULT_CENTRE, pixelPin } from "./map";

function form(values: Record<string, string | string[]>) {
  const out = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value])
      out.append(name, item);
  }
  return out;
}
const services = ["wash", "service"];

describe("provider draft allowlist", () => {
  it("saves only typed business answers, never a geocoder field", () => {
    expect(
      parseStep(
        form({
          businessName: "Sample Business",
          role: "owner",
          place_name: "Mapbox address",
          latitude: "-26",
        }),
        "business",
        services,
      ),
    ).toEqual({
      business_name: "Sample Business",
      applicant_role: "owner",
      step: 2,
    });
  });
  it("supports both modes while retaining a single ordered main service", () => {
    expect(
      parseStep(
        form({
          services: ["service", "wash"],
          work: ["fixed", "mobile"],
          team: "2-5",
        }),
        "service",
        services,
      ),
    ).toEqual({
      service_slugs: ["service", "wash"],
      mode: "both",
      team_size_band: "2-5",
      step: 3,
    });
  });
  it.each([
    { services: ["wash", "wash"], work: "fixed", team: "solo" },
    { services: "unknown", work: "fixed", team: "solo" },
    { services: "wash", work: ["fixed", "fixed"], team: "solo" },
    { services: "wash", work: "unknown", team: "solo" },
  ])("refuses malformed or duplicate service choices", (input) => {
    expect(parseStep(form(input), "service", services)).toBeNull();
  });
  it("clears fields incompatible with a changed mode", () => {
    expect(
      parseStep(
        form({ services: "wash", work: "mobile", team: "solo" }),
        "service",
        services,
      ),
    ).toMatchObject({ public_address: null });
    expect(
      parseStep(
        form({ services: "wash", work: "fixed", team: "solo" }),
        "service",
        services,
      ),
    ).toMatchObject({ radius_km: null });
  });
  it("requires an explicit tapped or device pin, never geocoder provenance", () => {
    const input = {
      metro: "Johannesburg",
      pinLat: "-26.2041",
      pinLng: "28.0473",
      pinSource: "tap",
      mode: "both",
      address: "12 Sample Street",
      radiusKm: "25",
      place_name: "Never save this",
    };
    expect(parseStep(form(input), "location", services)).toEqual({
      metro: "Johannesburg",
      pin: { lat: -26.2041, lng: 28.0473, source: "tap" },
      public_address: "12 Sample Street",
      radius_km: 25,
      step: 4,
    });
    expect(
      parseStep(
        form({ ...input, pinSource: "geocoder" }),
        "location",
        services,
      ),
    ).toBeNull();
    expect(
      parseStep(
        form({ ...input, pinSource: "", pinLat: "", pinLng: "" }),
        "location",
        services,
      ),
    ).toBeNull();
    expect(
      parseStep(form({ ...input, pinLat: "0" }), "location", services),
    ).toBeNull();
    expect(
      parseStep(form({ ...input, radiusKm: "25.5" }), "location", services),
    ).toBeNull();
  });
  it("keeps a mobile business's address null", () => {
    expect(
      parseStep(
        form({
          metro: "Johannesburg",
          pinLat: "-26.2",
          pinLng: "28",
          pinSource: "device",
          mode: "mobile",
          address: "Injected public address",
          radiusKm: "25",
        }),
        "location",
        services,
      ),
    ).toMatchObject({ public_address: null });
  });
  it("saves each day's own hours and preserves a multiline description", () => {
    const input = {
      description: "Friendly local service\r\nAll makes welcome",
      "open-1": "on",
      "opens-1": "08:00",
      "closes-1": "17:00",
      "open-6": "on",
      "opens-6": "08:00",
      "closes-6": "13:00",
      // Sunday is closed: its times are ignored.
      "opens-7": "09:00",
      "closes-7": "08:00",
    };
    expect(parseStep(form(input), "about", services)).toEqual({
      description: "Friendly local service\nAll makes welcome",
      hours: [
        { day: 1, opens: "08:00", closes: "17:00" },
        { day: 6, opens: "08:00", closes: "13:00" },
      ],
      step: 5,
    });
    expect(
      parseStep(form({ ...input, "closes-6": "07:00" }), "about", services),
    ).toBeNull();
    expect(
      parseStep(
        form({ description: input.description }),
        "about",
        services,
      ),
    ).toBeNull();
  });
  it("does not skip missing prerequisites", () => {
    expect(incompleteStep(null)).toBe("business");
    expect(
      incompleteStep({
        business_name: "Sample",
        applicant_role: "owner",
        service_slugs: [],
      } as unknown as Draft),
    ).toBe("service");
  });
});

describe("selected coordinate precision", () => {
  it("accepts actual map-tap coordinates without truncating a user selection", () => {
    const point = pixelPin(DEFAULT_CENTRE, 321, 180);
    expect(point).not.toBeNull();
    expect(
      parseStep(
        form({
          metro: "Johannesburg",
          mode: "fixed",
          address: "12 Sample Street",
          pinLat: String(point?.lat),
          pinLng: String(point?.lng),
          pinSource: "tap",
        }),
        "location",
        services,
      ),
    ).toMatchObject({ pin: point });
  });
  it("accepts full-precision coordinates returned by the browser's device API", () => {
    expect(
      parseStep(
        form({
          metro: "Johannesburg",
          mode: "mobile",
          radiusKm: "25",
          pinLat: "-26.204100123456789",
          pinLng: "28.047300123456789",
          pinSource: "device",
        }),
        "location",
        services,
      ),
    ).toMatchObject({
      pin: {
        source: "device",
        lat: Number("-26.204100123456789"),
        lng: Number("28.047300123456789"),
      },
    });
  });
});

describe("static-map tap geometry", () => {
  it("maps the image centre to its known coordinate", () => {
    const point = pixelPin(DEFAULT_CENTRE, 320, 180);
    expect(point?.lat).toBeCloseTo(DEFAULT_CENTRE.lat, 8);
    expect(point?.lng).toBeCloseTo(DEFAULT_CENTRE.lng, 8);
    expect(point?.source).toBe("tap");
  });
  it("moves north/east in the correct directions and refuses invalid input", () => {
    expect(pixelPin(DEFAULT_CENTRE, 640, 0)?.lat).toBeGreaterThan(
      DEFAULT_CENTRE.lat,
    );
    expect(pixelPin(DEFAULT_CENTRE, 640, 0)?.lng).toBeGreaterThan(
      DEFAULT_CENTRE.lng,
    );
    expect(pixelPin(DEFAULT_CENTRE, -1, 180)).toBeNull();
    expect(pixelPin(DEFAULT_CENTRE, NaN, 180)).toBeNull();
    expect(pixelPin({ lat: 0, lng: 0 }, 320, 180)).toBeNull();
  });
});
