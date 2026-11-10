import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Browser, sql, stack, workerEnv } from "./harness";

/**
 * P2-3 public pages through the built Worker, server-rendered with no client
 * JavaScript, against the seeded synthetic catalogue (Claude 20, D-083).
 */
const password = `synthetic-${randomUUID()}`;
const SEED_FIXED = "ca7c1000-0000-4000-8000-000000000001";
const SEED_MOBILE = "ca7c1000-0000-4000-8000-000000000002";
const SEED_PENDING = "ca7c1000-0000-4000-8000-000000000003";

function login(): string {
  const url = new URL(stack.dbUrl);
  url.username = "catalogue_server";
  url.password = password;
  return url.toString();
}

/** In-memory stand-in for the limiter namespace (no workerd in this harness). */
function allowAll() {
  return {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: () => Promise.resolve(Response.json({ allowed: true })),
    }),
  };
}

beforeAll(() => {
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sql(
    `alter role catalogue_server password '${password}' valid until '${until}'`,
  );
});
afterAll(() => {
  sql("alter role catalogue_server password null");
});

function browser(extra: Record<string, unknown> = {}) {
  return new Browser({
    ...workerEnv,
    SEARCH_CURSOR_KEY: `synthetic-cursor-${randomUUID()}`,
    SEARCH_LIMITER_SALT: `synthetic-salt-${randomUUID()}`,
    SEARCH_LIMITER: allowAll(),
    CATALOGUE_DB: { connectionString: login() },
    ...extra,
  } as unknown as typeof workerEnv & Record<string, string>);
}

describe("catalogue matches the design taxonomy", () => {
  it("has the four design categories and four repair subcategories", async () => {
    const client = new Client({ connectionString: stack.dbUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{
        slug: string;
        parent: string | null;
      }>(
        "select slug, parent_slug as parent from public.categories where slug not like 'srch-%' order by slug",
      );
      expect(rows).toEqual([
        { slug: "auto-electrical", parent: "repairs-and-maintenance" },
        { slug: "glass-repair-and-replacement", parent: null },
        { slug: "mechanical-service", parent: "repairs-and-maintenance" },
        { slug: "mobile-mechanic", parent: "repairs-and-maintenance" },
        { slug: "panel-and-paint", parent: "repairs-and-maintenance" },
        { slug: "repairs-and-maintenance", parent: null },
        { slug: "tyres-and-wheel-alignment", parent: null },
        { slug: "wash-and-detailing", parent: null },
      ]);
    } finally {
      await client.end();
    }
  });
});

describe("public pages without JavaScript", () => {
  it("home has a GET search form and the five service keys", async () => {
    const reply = await browser().send("/");
    expect(reply.status).toBe(200);
    expect(reply.body).toMatch(/<form[^>]*action="\/search"/);
    expect(reply.body).toMatch(/<form[^>]*method="get"/);
    for (const href of [
      "/c/wash-and-detailing",
      "/c/repairs-and-maintenance",
      "/c/glass-repair-and-replacement",
      "/c/tyres-and-wheel-alignment",
      "/fines",
    ])
      expect(reply.body).toContain(`href="${href}"`);
  });

  it("a category page lists live providers from its subcategories, never pending ones", async () => {
    const reply = await browser().send("/c/repairs-and-maintenance");
    expect(reply.status).toBe(200);
    expect(reply.body).toContain(`/p/${SEED_FIXED}`);
    expect(reply.body).toContain(`/p/${SEED_MOBILE}`);
    expect(reply.body).not.toContain(SEED_PENDING);
    expect((await browser().send("/c/not-a-category")).status).toBe(404);
  });

  it("a mobile listing shows no address or coordinates", async () => {
    const reply = await browser().send(`/p/${SEED_MOBILE}`);
    expect(reply.status).toBe(200);
    expect(reply.body).toContain("Comes to you.");
    expect(reply.body).not.toMatch(/26\.112233|28\.112233/);
    expect(reply.body).not.toMatch(/"public_latitude":\s*-?\d/);
    expect((await browser().send(`/p/${SEED_PENDING}`)).status).toBe(404);
    expect((await browser().send("/p/not-a-uuid")).status).toBe(404);
  });

  it("search by point renders both groups, is never cached and keeps the base private", async () => {
    const reply = await browser().send(
      "/search?lat=-26.2&lng=28.04&near=Johannesburg",
    );
    expect(reply.status).toBe(200);
    expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
    expect(reply.body).toContain("Workshops you visit");
    expect(reply.body).toContain("Providers who come to you");
    expect(reply.body).toContain(`/p/${SEED_FIXED}`);
    expect(reply.body).toContain(`/p/${SEED_MOBILE}`);
    expect(reply.body).not.toMatch(/26\.112233|28\.112233/);
  });

  it("area search fails closed without a Mapbox token and spends nothing", async () => {
    const reply = await browser().send("/search?area=Sandton");
    expect(reply.status).toBe(200);
    expect(reply.body).toContain("Area search isn");
    expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("the map session refuses without a public token", async () => {
    const reply = await browser().send("/api/map-session");
    expect(reply.status).toBe(503);
    expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
