import { describe, expect, it, vi } from "vitest";
import { suggestLocations } from "./geocode";

describe("South African location suggestions", () => {
  it("asks Mapbox for temporary addresses and towns and rounds selected coordinates", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        features: [
          {
            properties: {
              name: "1 St Georges Mall",
              place_formatted: "Cape Town, Western Cape",
              coordinates: { latitude: -33.922215, longitude: 18.422239 },
              context: {
                place: { name: "Cape Town" },
                region: { name: "Western Cape" },
              },
            },
          },
        ],
      }),
    );
    const result = await suggestLocations(
      "1 St Georges Mall",
      "test-only-mapbox-setting-abcdef",
      true,
      send,
    );
    expect(result).toEqual([
      {
        label: "1 St Georges Mall, Cape Town, Western Cape",
        locality: "Cape Town, Western Cape",
        lat: -33.922,
        lng: 18.422,
      },
    ]);
    const url = send.mock.calls[0]?.[0];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).searchParams.get("country")).toBe("za");
    expect((url as URL).searchParams.get("autocomplete")).toBe("true");
    expect((url as URL).searchParams.get("types")).toContain("address");
    expect((url as URL).searchParams.has("permanent")).toBe(false);
  });

  it("makes no request without a setting and reports upstream errors separately from no results", async () => {
    const send = vi.fn<typeof fetch>();
    expect(
      await suggestLocations("Pretoria", undefined, false, send),
    ).toBeNull();
    expect(send).not.toHaveBeenCalled();
    send.mockResolvedValueOnce(new Response(null, { status: 429 }));
    send.mockResolvedValueOnce(Response.json({ features: [] }));
    const client = "test-only-mapbox-setting-abcdef";
    expect(await suggestLocations("Pretoria", client, false, send)).toBeNull();
    expect(await suggestLocations("Pretoria", client, false, send)).toEqual([]);
  });
});
