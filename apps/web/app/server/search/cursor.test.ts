import { describe, expect, it } from "vitest";

import { CURSOR_TTL_MS, readCursor, signCursor } from "./cursor";

const KEY = "synthetic-cursor-key-".repeat(3);
const Q = "-33.900|18.400||25|20";
const ID = "5ea01000-0000-4000-8000-000000000001";
const NOW = 1_800_000_000_000;

describe("search cursors", () => {
  it("round-trips a fixed and a mobile position", async () => {
    const fixed = await signCursor(
      KEY,
      "fixed",
      Q,
      { bucket: 12, id: ID },
      NOW,
    );
    expect(await readCursor(KEY, "fixed", Q, fixed, NOW + 1)).toEqual({
      bucket: 12,
      id: ID,
    });
    const mobile = await signCursor(KEY, "mobile", Q, { id: ID }, NOW);
    expect(await readCursor(KEY, "mobile", Q, mobile, NOW + 1)).toEqual({
      id: ID,
    });
  });

  it("rejects tampering, swaps, expiry, wrong keys and junk", async () => {
    const token = await signCursor(KEY, "fixed", Q, { bucket: 3, id: ID }, NOW);
    const [body = "", mac = ""] = token.split(".");
    const flipped = `${body.slice(0, -1)}${body.endsWith("A") ? "B" : "A"}.${mac}`;
    expect(await readCursor(KEY, "fixed", Q, flipped, NOW)).toBeNull();
    expect(await readCursor(KEY, "mobile", Q, token, NOW)).toBeNull();
    expect(
      await readCursor(KEY, "fixed", "-33.900|18.400||50|20", token, NOW),
    ).toBeNull();
    expect(
      await readCursor(KEY, "fixed", Q, token, NOW + CURSOR_TTL_MS),
    ).toBeNull();
    expect(await readCursor(`${KEY}x`, "fixed", Q, token, NOW)).toBeNull();
    for (const junk of ["", ".", "a.b.c", "%%%.%%%", "x".repeat(2000)])
      expect(await readCursor(KEY, "fixed", Q, junk, NOW)).toBeNull();
  });

  it("contains only public IDs, a bucket and a query hash", async () => {
    const token = await signCursor(KEY, "fixed", Q, { bucket: 7, id: ID }, NOW);
    const body = token.split(".")[0] ?? "";
    const decoded = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    expect(decoded).not.toMatch(/33\.9|18\.4|centre|radius|organisation/);
    expect(Object.keys(JSON.parse(decoded) as object).sort()).toEqual([
      "a",
      "e",
      "g",
      "q",
      "v",
    ]);
  });
});
