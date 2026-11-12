import { describe, expect, it } from "vitest";

import {
  handleSearch,
  pgRound,
  type SearchArgs,
  type SearchRow,
} from "./handler";

const KEY = "synthetic-cursor-key-".repeat(3);
const BASE = "http://localhost:5173/api/search";

function row(i: number, mode: "fixed" | "mobile"): SearchRow {
  return {
    public_id: `5ea0${mode === "fixed" ? "1" : "2"}000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    display_name: `Synthetic ${mode} ${String(i)}`,
    description: "Synthetic",
    metro: "Synthetic Cape",
    mode,
    service_slug: "srch",
    service_name: "Search",
    category_slug: "srch-cat",
    category_name: "Search category",
    public_address: mode === "fixed" ? `${String(i)} Synthetic Road` : null,
    public_latitude: mode === "fixed" ? -33.9 : null,
    public_longitude: mode === "fixed" ? 18.4 : null,
    verification_labels: [],
    distance_bucket: mode === "fixed" ? Math.floor(i / 3) : null,
  };
}

/** Fake bounded wrapper over 45 fixed and 25 mobile rows, keyset like the SQL. */
function fakeSearch(calls: SearchArgs[] = []) {
  const fixed = Array.from({ length: 45 }, (_, i) => row(i + 1, "fixed"));
  const mobile = Array.from({ length: 25 }, (_, i) => row(i + 1, "mobile"));
  return (args: SearchArgs) => {
    calls.push(args);
    const all = args.group === "fixed" ? fixed : mobile;
    const after = all.filter((r) => {
      if (args.group === "mobile")
        return args.afterId === null || r.public_id > args.afterId;
      if (args.afterBucket === null) return true;
      const bucket = r.distance_bucket ?? 0;
      return (
        bucket > args.afterBucket ||
        (bucket === args.afterBucket && r.public_id > (args.afterId ?? ""))
      );
    });
    return Promise.resolve(after.slice(0, args.limit));
  };
}

const allow = () => Promise.resolve({ kind: "allowed" as const });

async function get(path: string, deps = {}, cookie?: string) {
  const response = await handleSearch(
    new Request(
      `${BASE}${path}`,
      cookie ? { headers: { Cookie: cookie } } : {},
    ),
    { cursorKey: KEY, limits: allow, search: fakeSearch(), ...deps },
  );
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json<Record<string, never>>(),
  };
}

describe("GET /api/search handler", () => {
  it("returns separate fixed and mobile groups, no-store, and sets a search session", async () => {
    const r = await get("?lat=-33.9&lng=18.4");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Set-Cookie")).toMatch(
      /^__Host-cx-search=[0-9a-f]{32};.*HttpOnly/,
    );
    const body = r.body as unknown as {
      fixed: { items: Record<string, unknown>[]; next: string };
      mobile: { items: Record<string, unknown>[]; next: string };
      radius_km: number;
      widened: boolean;
    };
    expect(body.radius_km).toBe(25);
    expect(body.widened).toBe(false);
    expect(body.fixed.items).toHaveLength(20);
    expect(body.mobile.items).toHaveLength(20);
    expect(body.fixed.items[0]).toMatchObject({
      distance_kind: "straight-line",
    });
    for (const item of body.mobile.items) {
      expect(item).toMatchObject({
        coverage: "approximate",
        also_premises: false,
      });
      expect(Object.keys(item)).not.toContain("public_latitude");
      expect(Object.keys(item)).not.toContain("distance_km");
    }
  });

  it("marks a both-business in the mobile group, with no location or distance (O2)", async () => {
    const both: SearchRow = {
      ...row(1, "mobile"),
      mode: "both",
      display_name: "Synthetic both",
    };
    const r = await get("?lat=-33.9&lng=18.4", {
      search: (args: SearchArgs) =>
        Promise.resolve(args.group === "mobile" ? [both] : []),
    });
    const body = r.body as unknown as {
      mobile: { items: Record<string, unknown>[] };
    };
    expect(body.mobile.items[0]).toMatchObject({
      display_name: "Synthetic both",
      also_premises: true,
      coverage: "approximate",
    });
    expect(Object.keys(body.mobile.items[0] ?? {})).not.toContain(
      "public_address",
    );
    expect(Object.keys(body.mobile.items[0] ?? {})).not.toContain(
      "distance_km",
    );
  });

  it("pages each group through its own cursor without gaps or duplicates", async () => {
    const seen = { fixed: new Set<string>(), mobile: new Set<string>() };
    for (const group of ["fixed", "mobile"] as const) {
      let next: string | null = null;
      let pages = 0;
      do {
        const query: string = next
          ? `&${group}_cursor=${encodeURIComponent(next)}`
          : "";
        const r = await get(`?lat=-33.9&lng=18.4${query}`);
        const part = (
          r.body as unknown as Record<
            string,
            { items: { public_id: string }[]; next: string | null } | null
          >
        )[group];
        expect(part).not.toBeNull();
        for (const item of part?.items ?? []) {
          expect(seen[group].has(item.public_id)).toBe(false);
          seen[group].add(item.public_id);
        }
        next = part?.next ?? null;
        pages += 1;
      } while (next && pages < 10);
    }
    expect(seen.fixed.size).toBe(45);
    expect(seen.mobile.size).toBe(25);
  });

  it("continues only the group whose cursor was given", async () => {
    const first = await get("?lat=-33.9&lng=18.4");
    const next = (first.body as unknown as { fixed: { next: string } }).fixed
      .next;
    const r = await get(
      `?lat=-33.9&lng=18.4&fixed_cursor=${encodeURIComponent(next)}`,
    );
    expect((r.body as unknown as { mobile: unknown }).mobile).toBeNull();
  });

  it("rejects cursors from another group or query", async () => {
    const first = await get("?lat=-33.9&lng=18.4");
    const next = (first.body as unknown as { fixed: { next: string } }).fixed
      .next;
    expect(
      (
        await get(
          `?lat=-33.9&lng=18.4&mobile_cursor=${encodeURIComponent(next)}`,
        )
      ).body,
    ).toEqual({ error: "invalid_cursor" });
    expect(
      (
        await get(
          `?lat=-33.9&lng=18.4&radius=50&fixed_cursor=${encodeURIComponent(next)}`,
        )
      ).body,
    ).toEqual({ error: "invalid_cursor" });
    expect((await get(`?lat=-33.9&lng=18.4&fixed_cursor=junk`)).status).toBe(
      400,
    );
    const expired = await handleSearch(
      new Request(
        `${BASE}?lat=-33.9&lng=18.4&fixed_cursor=${encodeURIComponent(next)}`,
      ),
      {
        cursorKey: KEY,
        limits: allow,
        search: fakeSearch(),
        now: () => Date.now() + 16 * 60 * 1000,
      },
    );
    expect(expired.status).toBe(400);
  });

  it("binds a mobile cursor to the database's 2 dp discovery point", async () => {
    const first = await get("?lat=-33.90499&lng=18.4");
    const body = first.body as unknown as {
      fixed: { next: string };
      mobile: { next: string };
    };
    const mobile = encodeURIComponent(body.mobile.next);
    const fixed = encodeURIComponent(body.fixed.next);
    // Both round to -33.905 at 3 dp, but to -33.90 vs -33.91 at 2 dp.
    expect(
      (await get(`?lat=-33.90501&lng=18.4&mobile_cursor=${mobile}`)).body,
    ).toEqual({ error: "invalid_cursor" });
    expect(
      (await get(`?lat=-33.90501&lng=18.4&fixed_cursor=${fixed}`)).status,
    ).toBe(200);
    expect(
      (await get(`?lat=-33.904&lng=18.4&mobile_cursor=${mobile}`)).status,
    ).toBe(200);
  });

  it("rounds like Postgres numeric round, half away from zero", () => {
    expect(pgRound(-33.90499, 2)).toBe("-33.90");
    expect(pgRound(-33.90501, 2)).toBe("-33.91");
    expect(pgRound(-33.905, 2)).toBe("-33.91");
    expect(pgRound(18.4005, 3)).toBe("18.401");
    expect(pgRound(28.0567, 3)).toBe("28.057");
    expect(pgRound(-26.1, 3)).toBe("-26.100");
  });

  it("validates input strictly before touching the database", async () => {
    const calls: SearchArgs[] = [];
    for (const bad of [
      "",
      "?lat=-33.9",
      "?lat=51.5&lng=-0.1",
      "?lat=NaN&lng=18.4",
      "?lat=-33.9&lng=18.4&radius=7",
      "?lat=-33.9&lng=18.4&radius=25.0",
      "?lat=-33.9&lng=18.4&limit=21",
      "?lat=-33.9&lng=18.4&service=Bad Slug",
      "?lat=-33.9&lng=18.4&address=1 Main Rd",
      "?lat=-33.9&lng=18.4&lat=-33.8",
      "?lat=1e1&lng=18.4",
    ]) {
      const r = await get(bad, { search: fakeSearch(calls) });
      expect(r.status, bad).toBe(400);
      expect(r.body).toEqual({ error: "invalid_query" });
    }
    expect(calls).toHaveLength(0);
  });

  it("fails closed: limiter unavailable/limited, missing key or database", async () => {
    expect(
      (
        await get("?lat=-33.9&lng=18.4", {
          limits: () => Promise.resolve({ kind: "unavailable" }),
        })
      ).status,
    ).toBe(503);
    const limited = await get("?lat=-33.9&lng=18.4", {
      limits: () => Promise.resolve({ kind: "limited", retryAfterSeconds: 17 }),
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("17");
    expect(
      (await get("?lat=-33.9&lng=18.4", { cursorKey: undefined })).status,
    ).toBe(503);
    expect(
      (await get("?lat=-33.9&lng=18.4", { search: undefined })).status,
    ).toBe(503);
    const failing = await get("?lat=-33.9&lng=18.4", {
      search: () =>
        Promise.reject(new Error("password authentication failed for user")),
    });
    expect(failing.status).toBe(503);
    expect(failing.body).toEqual({ error: "search_unavailable" });
  });

  it("rate-limits invalid requests too and reuses a valid session cookie", async () => {
    const sessions: string[] = [];
    const limits = (_ip: string, session: string) => {
      sessions.push(session);
      return Promise.resolve({ kind: "allowed" as const });
    };
    const session = "0123456789abcdef0123456789abcdef";
    const r = await get("?lat=bad", { limits }, `__Host-cx-search=${session}`);
    expect(r.status).toBe(400);
    expect(sessions).toEqual([session]);
    expect(r.headers.get("Set-Cookie")).toBeNull();
  });
});
