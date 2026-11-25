import { describe, expect, it } from "vitest";

import { firstNameOf, initialsOf } from "./viewer";
import { accessTokenFrom } from "./viewer.server";

// A synthetic, unsigned JWT shape: three segments. Nothing here is verified.
const TOKEN = "aaa.bbb.ccc";
const b64url = (text: string) =>
  btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("names for the header (C1)", () => {
  it("takes the first word of a name", () => {
    expect(firstNameOf("Thandi Mokoena")).toBe("Thandi");
    expect(firstNameOf("  Lerato  ")).toBe("Lerato");
    expect(firstNameOf("")).toBe("");
  });

  it("uses up to two name initials", () => {
    expect(initialsOf("Thandi Mokoena", "t@example.test")).toBe("TM");
    expect(initialsOf("Lerato van der Berg", null)).toBe("LV");
  });

  it("falls back to the email's first letter, never the whole email", () => {
    expect(initialsOf(null, "thandi@example.test")).toBe("T");
    expect(initialsOf(null, null)).toBe("?");
  });
});

describe("the access token from the session cookie", () => {
  it("reads a plain JSON cookie", () => {
    const value = JSON.stringify({ access_token: TOKEN });
    expect(accessTokenFrom([{ name: "__Host-cx-auth", value }])).toBe(TOKEN);
  });

  it("reads a base64url cookie with the base64- prefix", () => {
    const value = `base64-${b64url(JSON.stringify({ access_token: TOKEN }))}`;
    expect(accessTokenFrom([{ name: "__Host-cx-auth", value }])).toBe(TOKEN);
  });

  it("joins chunked cookies in order", () => {
    const value = `base64-${b64url(JSON.stringify({ access_token: TOKEN }))}`;
    const half = Math.floor(value.length / 2);
    expect(
      accessTokenFrom([
        { name: "__Host-cx-auth.1", value: value.slice(half) },
        { name: "__Host-cx-auth.0", value: value.slice(0, half) },
      ]),
    ).toBe(TOKEN);
  });

  it("ignores unrelated cookies and anything that isn't a token", () => {
    expect(accessTokenFrom([{ name: "other", value: "x" }])).toBeNull();
    expect(
      accessTokenFrom([
        {
          name: "__Host-cx-auth",
          value: JSON.stringify({ access_token: "nope" }),
        },
      ]),
    ).toBeNull();
    expect(
      accessTokenFrom([{ name: "__Host-cx-auth", value: "{not json" }]),
    ).toBeNull();
  });
});
