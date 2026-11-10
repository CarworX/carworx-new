import { describe, expect, it } from "vitest";

import type { GeocodeResult } from "../geo/geocode";
import type { SearchArgs, SearchRow } from "./handler";
import type { LimitResult } from "./limiter";
import { buildSearchPage, type PageDeps } from "./page";

const KEY = "synthetic-cursor-key-".repeat(3);
const allow = (): Promise<LimitResult> => Promise.resolve({ kind: "allowed" });

function row(i: number, mode: "fixed" | "mobile"): SearchRow {
  return {
    public_id: `5ea0${mode === "fixed" ? "1" : "2"}000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    display_name: `Synthetic ${mode} ${String(i)}`,
    description: "Synthetic",
    metro: "Synthetic Cape",
    mode,
    service_slug: "service",
    service_name: "Service",
    category_slug: "mechanical-service",
    category_name: "Mechanical service",
    public_address: mode === "fixed" ? "1 Road" : null,
    public_latitude: mode === "fixed" ? -33.9 : null,
    public_longitude: mode === "fixed" ? 18.4 : null,
    verification_labels: [],
    distance_bucket: mode === "fixed" ? i : null,
  };
}

function deps(
  over: Partial<PageDeps> = {},
  calls: SearchArgs[] = [],
  geocodes: string[] = [],
): PageDeps {
  return {
    cursorKey: KEY,
    limits: allow,
    quota: allow,
    geocode: (area: string): Promise<GeocodeResult> => {
      geocodes.push(area);
      return Promise.resolve({
        kind: "ok",
        candidates: [
          { label: "Sandton, Gauteng", lat: -26.1071, lng: 28.0567 },
        ],
      });
    },
    search: (args) => {
      calls.push(args);
      const rows = Array.from({ length: 25 }, (_, i) => row(i + 1, args.group));
      return Promise.resolve(rows.slice(0, args.limit));
    },
    ...over,
  };
}

const req = (q: string) => new Request(`http://localhost:5173/search${q}`);

describe("search page model", () => {
  it("shows the start state without touching limits, quota or Mapbox", async () => {
    let touched = false;
    const touch = () => {
      touched = true;
      return Promise.resolve({ kind: "allowed" as const });
    };
    const { model } = await buildSearchPage(
      req(""),
      deps({ limits: touch, quota: touch }),
    );
    expect(model.kind).toBe("start");
    expect(touched).toBe(false);
  });

  it("geocodes an area once, rounds the point and runs both groups", async () => {
    const calls: SearchArgs[] = [];
    const geocodes: string[] = [];
    const { model, cookie } = await buildSearchPage(
      req("?area=Sandton&category=repairs-and-maintenance&radius=10"),
      deps({}, calls, geocodes),
    );
    expect(geocodes).toEqual(["Sandton"]);
    expect(cookie).toMatch(/^__Host-cx-search=/);
    if (model.kind !== "results") throw new Error(model.kind);
    expect(model.near).toBe("Sandton, Gauteng");
    expect(
      calls.map((c) => [c.group, c.lat, c.lng, c.category, c.radius]),
    ).toEqual([
      ["fixed", -26.107, 28.057, "repairs-and-maintenance", 10],
      ["mobile", -26.107, 28.057, "repairs-and-maintenance", 10],
    ]);
    expect(model.moreFixed).toMatch(
      /^\/search\?lat=-26\.107&lng=28\.057&near=.*&fixed_cursor=/,
    );
    expect(model.moreFixed).not.toContain("area=");
    expect(model.radiusLinks.map((r) => r.radius)).toEqual([5, 10, 25, 50]);
  });

  it("a 'more' link continues without geocoding again", async () => {
    const geocodes: string[] = [];
    const first = await buildSearchPage(
      req("?area=Sandton"),
      deps({}, [], geocodes),
    );
    if (first.model.kind !== "results" || !first.model.moreFixed)
      throw new Error("no more link");
    const next = await buildSearchPage(
      req(first.model.moreFixed.slice("/search".length)),
      deps({}, [], geocodes),
    );
    expect(next.model.kind).toBe("results");
    expect(geocodes).toEqual(["Sandton"]);
  });

  it("offers choices for an ambiguous area and never searches yet", async () => {
    const calls: SearchArgs[] = [];
    const { model } = await buildSearchPage(
      req("?area=Rosebank"),
      deps(
        {
          geocode: () =>
            Promise.resolve({
              kind: "ok",
              candidates: [
                { label: "Rosebank, Johannesburg", lat: -26.146, lng: 28.042 },
                { label: "Rosebank, Cape Town", lat: -33.95, lng: 18.47 },
              ],
            }),
        },
        calls,
      ),
    );
    if (model.kind !== "choose") throw new Error(model.kind);
    expect(model.choices.map((c) => c.href)).toEqual([
      "/search?lat=-26.146&lng=28.042&near=Rosebank%2C+Johannesburg&radius=25",
      "/search?lat=-33.950&lng=18.470&near=Rosebank%2C+Cape+Town&radius=25",
    ]);
    expect(calls).toHaveLength(0);
  });

  it("fails closed: quota exhausted, Mapbox down, limiter down or rate limited", async () => {
    const no = () => Promise.resolve({ kind: "unavailable" as const });
    expect(
      (await buildSearchPage(req("?area=Sandton"), deps({ quota: no }))).model
        .kind,
    ).toBe("area_unavailable");
    expect(
      (
        await buildSearchPage(
          req("?area=Sandton"),
          deps({ geocode: () => Promise.resolve({ kind: "unavailable" }) }),
        )
      ).model.kind,
    ).toBe("area_unavailable");
    expect(
      (await buildSearchPage(req("?area=Sandton"), deps({ limits: no }))).model
        .kind,
    ).toBe("unavailable");
    const limited = () =>
      Promise.resolve({ kind: "limited" as const, retryAfterSeconds: 9 });
    expect(
      (
        await buildSearchPage(
          req("?lat=-26.1&lng=28.0"),
          deps({ limits: limited }),
        )
      ).model,
    ).toEqual({ kind: "rate_limited", retryAfterSeconds: 9 });
  });

  it("rate limits before Mapbox: a limited visitor never spends quota", async () => {
    const geocodes: string[] = [];
    let quotaUsed = false;
    await buildSearchPage(
      req("?area=Sandton"),
      deps(
        {
          limits: () =>
            Promise.resolve({ kind: "limited", retryAfterSeconds: 5 }),
          quota: () => {
            quotaUsed = true;
            return allow();
          },
        },
        [],
        geocodes,
      ),
    );
    expect(geocodes).toHaveLength(0);
    expect(quotaUsed).toBe(false);
  });

  it("does not store or echo geocoder output beyond the visitor's chosen label", async () => {
    const { model } = await buildSearchPage(req("?area=Sandton"), deps());
    const text = JSON.stringify(model);
    expect(text).not.toContain("-26.1071");
    expect(text).not.toContain("28.0567");
  });
});
