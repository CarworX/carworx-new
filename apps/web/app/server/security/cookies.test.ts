import { describe, expect, it } from "vitest";

import { isCompliantSetCookie, serializeAppCookie } from "./cookies";
import { csrfTokenMatches, issueCsrfToken } from "./csrf";

describe("app cookies", () => {
  it("always carry Secure, HttpOnly, SameSite=Lax and Path=/", () => {
    const header = serializeAppCookie("__Host-cx-auth", "value", {
      maxAge: 60,
    });
    expect(header).toMatch(/^__Host-cx-auth=value;/);
    expect(header).toContain("Secure");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).not.toMatch(/Domain=/i);
    expect(isCompliantSetCookie(header)).toBe(true);
  });

  it("refuse names without the __Host-cx- prefix", () => {
    expect(() => serializeAppCookie("session", "v")).toThrow();
  });

  it.each([
    "__Host-cx-auth=v; Path=/; HttpOnly; SameSite=Lax",
    "__Host-cx-auth=v; Path=/; Secure; SameSite=Lax",
    "__Host-cx-auth=v; Path=/; Secure; HttpOnly; SameSite=None",
    "__Host-cx-auth=v; Path=/; Secure; HttpOnly; SameSite=Lax; Domain=carworx.app",
    "sb-auth=v; Path=/; Secure; HttpOnly; SameSite=Lax",
  ])("non-compliant: %s", (header) => {
    expect(isCompliantSetCookie(header)).toBe(false);
  });
});

describe("CSRF tokens", () => {
  it("issues a new token and cookie when none is present, and reuses a valid one", () => {
    const first = issueCsrfToken(new Request("http://localhost:5173/"));
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.setCookie).toContain("__Host-cx-csrf=");
    const again = issueCsrfToken(
      new Request("http://localhost:5173/", {
        headers: { Cookie: `__Host-cx-csrf=${first.token}` },
      }),
    );
    expect(again).toEqual({ token: first.token, setCookie: undefined });
  });

  it("match only when cookie and field are equal valid tokens", () => {
    const token = "Q".repeat(43);
    const request = new Request("http://localhost:5173/", {
      headers: { Cookie: `__Host-cx-csrf=${token}` },
    });
    expect(csrfTokenMatches(request, token)).toBe(true);
    expect(csrfTokenMatches(request, "R".repeat(43))).toBe(false);
    expect(csrfTokenMatches(request, token.slice(1))).toBe(false);
    expect(csrfTokenMatches(request, null)).toBe(false);
    expect(csrfTokenMatches(new Request("http://localhost:5173/"), token)).toBe(
      false,
    );
  });
});
