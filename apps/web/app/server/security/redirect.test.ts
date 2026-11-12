import { describe, expect, it } from "vitest";

import { safeReturnTo } from "./redirect";

const APP = "http://localhost:5173";

describe("safeReturnTo", () => {
  it.each([
    "/",
    "/account",
    "/account?tab=1",
    "/admin",
    "/org/0b0b5f4e-2f8c-4b55-9a52-6a5f3c7d1e20",
    "/provider",
    "/provider/apply",
    "/provider/get-listed/business",
    "/provider/setup/team/role",
    "/join",
    "/provider/claim/0b0b5f4e-2f8c-4b55-9a52-6a5f3c7d1e20",
  ])("accepts %s", (path) => {
    expect(safeReturnTo(path, APP)).toBe(path);
  });

  it.each([
    "https://evil.example/account",
    "//evil.example/account",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/%2F%2Fevil.example",
    "/%5Cevil.example",
    "javascript:alert(1)",
    "http:/evil.example",
    "/account\r\nLocation: https://evil.example",
    "/auth/sign-out",
    "/admin-evil",
    "/provider-evil",
    "/provider/elsewhere",
    "/provider/claim/not-a-listing",
    "/join/secret-token",
    "/join?token=secret-token",
    "/provider/get-listed/not-a-step",
    "/org/../auth/sign-out",
    "",
    "account",
  ])("rejects %j", (hostile) => {
    expect(safeReturnTo(hostile, APP)).toBe("/account");
  });

  it("rejects non-strings and very long values", () => {
    expect(safeReturnTo(null, APP)).toBe("/account");
    expect(safeReturnTo(["/admin"], APP)).toBe("/account");
    expect(safeReturnTo(`/account?${"a".repeat(600)}`, APP)).toBe("/account");
  });
});
