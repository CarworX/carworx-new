import { describe, expect, it } from "vitest";

import {
  EXPORT_KEY,
  EXPORT_TOKEN,
  exportCookie,
  exportLink,
  newExport,
  pendingExport,
  tokenHash,
} from "./export.server";

describe("download my data helpers (D-098)", () => {
  it("makes a fresh random key and a 256-bit link token", () => {
    const a = newExport();
    const b = newExport();
    expect(a.key).toMatch(EXPORT_KEY);
    expect(a.token).toMatch(EXPORT_TOKEN);
    expect(a.key).not.toBe(b.key);
    expect(a.token).not.toBe(b.token);
    expect(exportLink(a.token)).toBe(`/account/data/${a.token}`);
  });

  it("sends PostgREST the SHA-256 as bytea hex", async () => {
    // SHA-256("abc"), a published test vector.
    expect(await tokenHash("abc")).toBe(
      "\\xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("keeps the token only in a short-lived secure cookie", () => {
    const { token } = newExport();
    const cookie = exportCookie(token);
    for (const part of [
      "__Host-cx-export=",
      "Secure",
      "HttpOnly",
      "Max-Age=600",
    ])
      expect(cookie).toContain(part);
    const request = new Request("https://example.test/", {
      headers: { Cookie: `__Host-cx-export=${token}` },
    });
    expect(pendingExport(request)).toBe(token);
    expect(
      pendingExport(
        new Request("https://example.test/", {
          headers: { Cookie: "__Host-cx-export=not-a-token" },
        }),
      ),
    ).toBeNull();
    expect(() => exportCookie("bad")).toThrow();
  });
});
