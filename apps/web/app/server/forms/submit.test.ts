import { describe, expect, it } from "vitest";

import { outcomeFrom, type FormsDb } from "./db";
import { parseSupport } from "./parse";
import { runForm, type FormDeps } from "./submit";
import { TEST_SECRET_PASS, TEST_SITE_KEY_PASS } from "./turnstile";

const GOOD = (() => {
  const f = new FormData();
  f.set("email", "sue@example.test");
  f.set("topic", "other");
  f.set("message", "Synthetic support message");
  f.set("cf-turnstile-response", "tok");
  return f;
})();
const request = new Request("http://localhost:5173/support", {
  method: "POST",
  headers: { "CF-Connecting-IP": "198.51.100.7" },
});

function deps(over: Partial<FormDeps> = {}) {
  const seen: string[] = [];
  const db = {
    support: () => {
      seen.push("db");
      return Promise.resolve("ok" as const);
    },
  } as unknown as FormsDb;
  const d: FormDeps = {
    limit: (ip) => {
      seen.push(`limit:${ip}`);
      return Promise.resolve({ kind: "allowed" });
    },
    turnstile: {
      siteKey: TEST_SITE_KEY_PASS,
      secretKey: TEST_SECRET_PASS,
      testMode: true,
    },
    verify: (_s, token, ip) => {
      seen.push(`verify:${String(token)}:${String(ip)}`);
      return Promise.resolve("pass");
    },
    db,
    ...over,
  };
  return { d, seen };
}
const run = (d: FormDeps, form = GOOD) =>
  runForm(request, form, d, parseSupport, (db, v) => db.support(v));

describe("runForm", () => {
  it("runs limit, Turnstile, then the database, in that order", async () => {
    const { d, seen } = deps();
    expect(await run(d)).toEqual({ kind: "sent" });
    expect(seen).toEqual([
      "limit:198.51.100.7",
      "verify:tok:198.51.100.7",
      "db",
    ]);
  });
  it("counts a bad post against the limit, and stops before Turnstile", async () => {
    const { d, seen } = deps();
    const bad = new FormData();
    bad.set("email", "nope");
    expect(await run(d, bad)).toEqual({
      kind: "problem",
      problem: "invalid_input",
    });
    expect(seen).toEqual(["limit:198.51.100.7"]);
  });
  it("is limited before anything else", async () => {
    const { d, seen } = deps({
      limit: () => Promise.resolve({ kind: "limited", retryAfterSeconds: 42 }),
    });
    expect(await run(d)).toEqual({
      kind: "problem",
      problem: "rate_limited",
      retryAfterSeconds: 42,
    });
    expect(seen).toEqual([]);
  });
  it("fails closed when the limiter, Turnstile keys or database are missing", async () => {
    for (const over of [
      { limit: () => Promise.resolve({ kind: "unavailable" as const }) },
      { turnstile: undefined },
      { db: undefined },
      { verify: () => Promise.resolve("unavailable" as const) },
    ]) {
      const { d, seen } = deps(over);
      expect(await run(d)).toEqual({ kind: "problem", problem: "unavailable" });
      expect(seen).not.toContain("db");
    }
  });
  it("never writes when Turnstile fails", async () => {
    const { d, seen } = deps({ verify: () => Promise.resolve("fail") });
    expect(await run(d)).toEqual({ kind: "problem", problem: "check_failed" });
    expect(seen).not.toContain("db");
  });
});

describe("outcomeFrom", () => {
  it("maps only fixed keys; anything else is unavailable", () => {
    expect(outcomeFrom({ code: "22023", message: "invalid_input" })).toBe(
      "invalid_input",
    );
    expect(outcomeFrom({ code: "P0001", message: "consent_required" })).toBe(
      "consent_required",
    );
    expect(
      outcomeFrom({ code: "P0001", message: "listing_not_available" }),
    ).toBe("listing_not_available");
    expect(outcomeFrom({ code: "P0001", message: "something else" })).toBe(
      "unavailable",
    );
    expect(outcomeFrom({ code: "42501" })).toBe("unavailable");
    expect(outcomeFrom(new Error("connect ECONNREFUSED"))).toBe("unavailable");
  });
});
