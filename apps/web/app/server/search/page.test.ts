import { describe, expect, it } from "vitest";

import type { GeocodeResult } from "../geo/geocode";
import { readMapPins } from "../geo/staticMap";
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

  it("'more' links from an off-grid point continue both groups", async () => {
    const first = await buildSearchPage(req("?lat=-33.90499&lng=18.4"), deps());
    if (first.model.kind !== "results") throw new Error(first.model.kind);
    for (const href of [first.model.moreFixed, first.model.moreMobile]) {
      if (!href) throw new Error("no more link");
      const next = await buildSearchPage(
        req(href.slice("/search".length)),
        deps(),
      );
      expect(next.model.kind).toBe("results");
    }
  });

  it("offers the map only when configured, and draws only fixed premises", async () => {
    const off = await buildSearchPage(req("?lat=-26.1&lng=28.0"), deps());
    if (off.model.kind !== "results") throw new Error(off.model.kind);
    expect(off.model.showMap).toBeNull();
    expect(off.model.mapImage).toBeNull();

    const on = await buildSearchPage(
      req("?lat=-26.1&lng=28.0"),
      deps({ mapEnabled: true }),
    );
    if (on.model.kind !== "results") throw new Error(on.model.kind);
    expect(on.model.mapImage).toBeNull();
    expect(on.model.showMap).toMatch(
      /^\/search\?lat=-26\.1&lng=28\.0&.*map=1$/,
    );

    const shown = await buildSearchPage(
      req((on.model.showMap ?? "").slice("/search".length)),
      deps({ mapEnabled: true }),
    );
    if (shown.model.kind !== "results") throw new Error(shown.model.kind);
    expect(shown.model.showMap).toBeNull();
    const m = new URL(`http://x${shown.model.mapImage ?? ""}`).searchParams.get(
      "m",
    );
    const pins = await readMapPins(KEY, m ?? "");
    // Only fixed rows carry coordinates; mobile rows are never pinned.
    expect(pins).toHaveLength(20);
    expect(pins?.every((p) => p.lat === -33.9 && p.lng === 18.4)).toBe(true);
  });

  it("alternating 'more' links keep both groups in place, with no gaps or repeats", async () => {
    // Keyset fake over 45 fixed (3 per 0.1 km bucket) and 45 mobile rows.
    const all = {
      fixed: Array.from({ length: 45 }, (_, i) => ({
        ...row(i + 1, "fixed"),
        distance_bucket: Math.floor((i + 1) / 3),
      })),
      mobile: Array.from({ length: 45 }, (_, i) => row(i + 1, "mobile")),
    };
    const keyset = (args: SearchArgs) => {
      const rows = all[args.group].filter((r) => {
        if (args.afterId === null) return true;
        if (args.group === "mobile") return r.public_id > args.afterId;
        const b = r.distance_bucket ?? 0;
        const after = args.afterBucket ?? 0;
        return b > after || (b === after && r.public_id > args.afterId);
      });
      return Promise.resolve(rows.slice(0, args.limit));
    };
    const visit = async (href: string) => {
      const { model } = await buildSearchPage(
        req(href.slice("/search".length)),
        deps({ search: keyset }),
      );
      if (model.kind !== "results") throw new Error(model.kind);
      return model;
    };
    const ids = (m: Awaited<ReturnType<typeof visit>>) => ({
      fixed: (m.body.fixed?.items ?? []).map((i) => i.public_id),
      mobile: (m.body.mobile?.items ?? []).map((i) => i.public_id),
    });
    const page = (group: "fixed" | "mobile", n: number) =>
      all[group].slice((n - 1) * 20, n * 20).map((r) => r.public_id);

    const p1 = await visit("/search?lat=-26.1&lng=28.0");
    expect(ids(p1)).toEqual({
      fixed: page("fixed", 1),
      mobile: page("mobile", 1),
    });

    // More workshops: fixed advances, mobile stays on its first page.
    const p2 = await visit(p1.moreFixed ?? "");
    expect(ids(p2)).toEqual({
      fixed: page("fixed", 2),
      mobile: page("mobile", 1),
    });

    // Then more mobile: mobile advances, fixed stays on page 2.
    const p3 = await visit(p2.moreMobile ?? "");
    expect(ids(p3)).toEqual({
      fixed: page("fixed", 2),
      mobile: page("mobile", 2),
    });

    // Then more workshops again: fixed page 3 (the last), mobile stays on 2.
    const p4 = await visit(p3.moreFixed ?? "");
    expect(ids(p4)).toEqual({
      fixed: page("fixed", 3),
      mobile: page("mobile", 2),
    });
    expect(p4.moreFixed).toBeNull();

    // And the last mobile page, with fixed still on page 3.
    const p5 = await visit(p4.moreMobile ?? "");
    expect(ids(p5)).toEqual({
      fixed: page("fixed", 3),
      mobile: page("mobile", 3),
    });
    expect(p5.moreMobile).toBeNull();
    expect(p5.moreFixed).toBeNull();
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
