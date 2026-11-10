import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Browser, sql, stack, workerEnv } from "./harness";

/** The same single bound call the Worker's db module makes. */
const SEARCH_SQL =
  "select * from api.search_listings($1, $2, $3, $4, $5, $6, $7, $8, $9)";
interface Row {
  public_id: string;
  mode: string;
  public_address: string | null;
  public_latitude: number | null;
  distance_bucket: number | null;
}
interface Args {
  lat: number;
  lng: number;
  service: string;
  category: string | null;
  radius: number;
  group: "fixed" | "mobile";
  afterBucket: number | null;
  afterId: string | null;
  limit: number;
}
function createCatalogueSearch(connectionString: string) {
  return async (a: Args): Promise<Row[]> => {
    const client = new Client({ connectionString });
    await client.connect();
    try {
      const result = await client.query<Row>(SEARCH_SQL, [
        a.lat,
        a.lng,
        a.service,
        a.category,
        a.radius,
        a.group,
        a.afterBucket,
        a.afterId,
        a.limit,
      ]);
      return result.rows;
    } finally {
      await client.end();
    }
  };
}

interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  transaction<T>(fn: (txn: Storage) => Promise<T>): Promise<T>;
}
interface LimiterObject {
  fetch(request: Request): Promise<Response>;
}
interface LimiterNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(url: string, init: RequestInit): Promise<Response>;
  };
}
type LimiterClass = new (state: { storage: Storage }) => LimiterObject;
/** The real SearchLimiter class, taken from the built Worker module. */
async function builtLimiterClass(): Promise<LimiterClass> {
  const module = (await import(
    pathToFileURL(
      join(import.meta.dirname, "..", "build", "server", "index.js"),
    ).href
  )) as { SearchLimiter: LimiterClass };
  return module.SearchLimiter;
}

/**
 * P2-2 against the real local stack (Claude 19 §8):
 *   - the database layer connects as the real scoped `catalogue_server` login;
 *   - that login can run the wrapper and nothing else;
 *   - PostgREST does not expose `api` or `private`;
 *   - the built Worker's /api/search fails closed and validates input.
 * The synthetic password exists only for this run and is removed afterwards.
 */
const ORG = "5ea0c000-0000-4000-8000-00000000a1a1";
const SRC = "5ea0c000-0000-4000-8000-00000000c1c1";
const password = `synthetic-${randomUUID()}`;
let connection = "";

function login(pass = password): string {
  const url = new URL(stack.dbUrl);
  url.username = "catalogue_server";
  url.password = pass;
  return url.toString();
}

beforeAll(() => {
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sql(
    `alter role catalogue_server password '${password}' valid until '${until}'`,
  );
  connection = login();
  sql(`
    insert into public.organisations(id, name) values ('${ORG}', 'Search integration (synthetic)');
    insert into public.coordinate_sources(id, organisation_id, source_kind, licence_note)
      values ('${SRC}', '${ORG}', 'provider_supplied', 'Synthetic integration fixture');
    insert into public.categories(slug, name) values ('srch-int-cat', 'Integration category');
    insert into public.services(slug, category_slug, name) values ('srch-int', 'srch-int-cat', 'Integration service');
    insert into public.branches(public_id, organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id)
      select ('5ea0b000-0000-4000-8000-0000000a' || lpad(i::text, 4, '0'))::uuid, '${ORG}', 'Int branch ' || i, i || ' Int Road',
        -33.9 + i * 0.001, 18.4, '${SRC}' from generate_series(1, 23) i;
    insert into public.listings(public_id, organisation_id, service_slug, branch_public_id, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      select ('5ea01000-0000-4000-8000-0000000a' || substr(b.public_id::text, 33))::uuid, '${ORG}', 'srch-int', b.public_id,
        'Int fixed', 'Synthetic', 'Synthetic Cape', 'fixed', 'live', 'admin_import', 'synthetic-int'
      from public.branches b where b.organisation_id = '${ORG}';
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      select ('5ea02000-0000-4000-8000-0000000a' || lpad(i::text, 4, '0'))::uuid, '${ORG}', 'srch-int',
        'Int mobile', 'Synthetic', 'Synthetic Cape', 'mobile', 'live', 'provider_application', 'synthetic-int'
      from generate_series(1, 3) i;
    insert into public.service_areas(listing_public_id, organisation_id, centre_latitude, centre_longitude, radius_km, coordinate_source_id)
      select public_id, '${ORG}', -33.95, 18.4, 10, '${SRC}' from public.listings where organisation_id = '${ORG}' and mode = 'mobile';
  `);
});

afterAll(() => {
  sql(`
    delete from public.service_areas where organisation_id = '${ORG}';
    delete from public.listings where organisation_id = '${ORG}';
    delete from public.branches where organisation_id = '${ORG}';
    delete from public.coordinate_sources where organisation_id = '${ORG}';
    delete from public.services where slug = 'srch-int';
    delete from public.categories where slug = 'srch-int-cat';
    delete from public.organisations where id = '${ORG}';
    alter role catalogue_server password null;
  `);
});

const base = {
  lat: -33.9,
  lng: 18.4,
  service: "srch-int",
  category: null,
  radius: 25,
  afterBucket: null,
  afterId: null,
  limit: 21,
} as const;

describe("scoped catalogue_server login", () => {
  it("runs the bounded wrapper for both groups", async () => {
    const search = createCatalogueSearch(connection);
    const fixed = await search({ ...base, group: "fixed" });
    expect(fixed).toHaveLength(21);
    expect(
      fixed.every((r) => r.mode === "fixed" && r.distance_bucket !== null),
    ).toBe(true);
    const mobile = await search({ ...base, group: "mobile" });
    expect(mobile).toHaveLength(3);
    for (const r of mobile) {
      expect(r.public_latitude).toBeNull();
      expect(r.public_address).toBeNull();
      expect(r.distance_bucket).toBeNull();
    }
    expect(JSON.stringify(mobile)).not.toMatch(/33\.95|centre|radius|5ea0c000/);
  });

  it("pages fixed results by keyset with no gaps or duplicates", async () => {
    const search = createCatalogueSearch(connection);
    const seen = new Set<string>();
    let after: { bucket: number; id: string } | null = null;
    for (let page = 0; page < 5; page++) {
      const rows = await search({
        ...base,
        group: "fixed",
        limit: 10,
        afterBucket: after?.bucket ?? null,
        afterId: after?.id ?? null,
      });
      for (const r of rows) {
        expect(seen.has(r.public_id)).toBe(false);
        seen.add(r.public_id);
      }
      const last = rows.at(-1);
      if (rows.length < 10 || !last) break;
      after = { bucket: last.distance_bucket ?? 0, id: last.public_id };
    }
    expect(seen.size).toBe(23);
  });

  it("can read nothing directly and cannot call the private helper", async () => {
    const client = new Client({ connectionString: connection });
    await client.connect();
    try {
      for (const statement of [
        "select * from public.listing_public",
        "select * from public.listings",
        "select centre_latitude from public.service_areas",
        "select * from private.mobile_eligible_ids(-33.9, 18.4, null, null, 5)",
        "insert into public.categories(slug, name) values ('x', 'x')",
      ]) {
        await expect(client.query(statement), statement).rejects.toMatchObject({
          code: "42501",
        });
      }
    } finally {
      await client.end();
    }
  });

  it("rejects a wrong credential", async () => {
    await expect(
      createCatalogueSearch(login("wrong-synthetic-password"))({
        ...base,
        group: "fixed",
      }),
    ).rejects.toBeDefined();
  });
});

describe("PostgREST exposure", () => {
  it("does not expose the api or private schemas", async () => {
    for (const profile of ["api", "private"]) {
      const response = await fetch(
        `${stack.apiUrl}/rest/v1/rpc/search_listings`,
        {
          method: "POST",
          headers: {
            apikey: stack.anonKey,
            Authorization: `Bearer ${stack.anonKey}`,
            "Content-Type": "application/json",
            "Content-Profile": profile,
            "Accept-Profile": profile,
          },
          body: "{}",
        },
      );
      expect(response.ok).toBe(false);
      await response.body?.cancel();
    }
    const response = await fetch(
      `${stack.apiUrl}/rest/v1/rpc/search_listings`,
      {
        method: "POST",
        headers: {
          apikey: stack.anonKey,
          Authorization: `Bearer ${stack.anonKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    expect(response.status).toBe(404);
    await response.body?.cancel();
  });
});

/** Real SearchLimiter objects (from the build) with in-memory storage; the harness has no workerd. */
async function limiterNamespace(): Promise<LimiterNamespace> {
  const SearchLimiter = await builtLimiterClass();
  const objects = new Map<string, LimiterObject>();
  return {
    idFromName: (name: string) => name,
    get: (id: unknown) => {
      const name = id as string;
      let object = objects.get(name);
      if (!object) {
        const data = new Map<string, unknown>();
        const storage: Storage = {
          get: <T>(key: string) =>
            Promise.resolve(data.get(key) as T | undefined),
          put: (key: string, value: unknown) => {
            data.set(key, value);
            return Promise.resolve();
          },
          transaction: <T>(fn: (txn: Storage) => Promise<T>) => fn(storage),
        };
        object = new SearchLimiter({ storage });
        objects.set(name, object);
      }
      const target = object;
      return {
        fetch: (url: string, init: RequestInit) =>
          target.fetch(new Request(url, init)),
      };
    },
  };
}

describe("built Worker /api/search", () => {
  const secrets = {
    SEARCH_CURSOR_KEY: `synthetic-cursor-${randomUUID()}`,
    SEARCH_LIMITER_SALT: `synthetic-salt-${randomUUID()}`,
  };

  it("fails closed with no-store when bindings are missing", async () => {
    const reply = await new Browser().send("/api/search?lat=-33.9&lng=18.4");
    expect(reply.status).toBe(503);
    expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
    expect(JSON.parse(reply.body)).toEqual({ error: "search_unavailable" });
  });

  it("validates input and refuses without a database binding", async () => {
    const browser = new Browser({
      ...workerEnv,
      ...secrets,
      SEARCH_LIMITER: await limiterNamespace(),
    } as unknown as typeof workerEnv & Record<string, string>);
    const bad = await browser.send("/api/search?lat=-33.9&lng=18.4&radius=7");
    expect(bad.status).toBe(400);
    expect(bad.setCookies.join("")).toMatch(/__Host-cx-search=/);
    const ok = await browser.send("/api/search?lat=-33.9&lng=18.4");
    expect(ok.status).toBe(503);
  });

  it("serves both groups through the real login and enforces the limiter", async () => {
    const browser = new Browser({
      ...workerEnv,
      ...secrets,
      SEARCH_LIMITER: await limiterNamespace(),
      CATALOGUE_DB: { connectionString: connection },
    } as unknown as typeof workerEnv & Record<string, string>);
    const first = await browser.send(
      "/api/search?lat=-33.9&lng=18.4&service=srch-int",
    );
    expect(first.status).toBe(200);
    const body = JSON.parse(first.body) as {
      fixed: { items: unknown[]; next: string | null };
      mobile: { items: Record<string, unknown>[]; next: string | null };
    };
    expect(body.fixed.items).toHaveLength(20);
    expect(body.fixed.next).not.toBeNull();
    expect(body.mobile.items).toHaveLength(3);
    expect(JSON.stringify([body.fixed.items, body.mobile.items])).not.toMatch(
      /33\.95|centre|radius|organisation|provenance/,
    );
    const next = await browser.send(
      `/api/search?lat=-33.9&lng=18.4&service=srch-int&fixed_cursor=${encodeURIComponent(body.fixed.next ?? "")}`,
    );
    expect(
      (JSON.parse(next.body) as { fixed: { items: unknown[] } }).fixed.items,
    ).toHaveLength(3);
    let status = 0;
    for (let i = 0; i < 40 && status !== 429; i++)
      status = (
        await browser.send("/api/search?lat=-33.9&lng=18.4&service=srch-int")
      ).status;
    expect(status).toBe(429);
  });
});
