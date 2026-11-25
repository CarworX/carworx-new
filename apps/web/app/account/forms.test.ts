import { describe, expect, it } from "vitest";

import { accountTab, displayName } from "./forms";

describe("account settings input", () => {
  it("only accepts supported settings tabs", () => {
    expect(accountTab("security")).toBe("security");
    expect(accountTab("admin")).toBeNull();
    expect(accountTab(undefined)).toBeNull();
  });

  it("accepts international display names without treating them as identity", () => {
    expect(displayName("  Léa van Wyk  ")).toBe("Léa van Wyk");
    expect(displayName("")).toBeNull();
    expect(displayName("   ")).toBeNull();
  });

  it("refuses oversized, control-character and non-text input", () => {
    expect(displayName("a".repeat(81))).toBeNull();
    expect(displayName("First\nLast")).toBeNull();
    expect(displayName(new File(["x"], "name.txt"))).toBeNull();
  });
});

describe("mobileNumber (PR 6)", () => {
  it("accepts South African numbers in the usual ways", async () => {
    const { mobileNumber, localMobile } = await import("./forms");
    for (const v of [
      "072 000 0000",
      "0720000000",
      "+27 72 000 0000",
      "27720000000",
      "(072) 000-0000",
    ])
      expect(mobileNumber(v)).toBe("+27720000000");
    expect(mobileNumber("")).toBe("");
    expect(mobileNumber("   ")).toBe("");
    expect(localMobile("+27720000000")).toBe("072 000 0000");
    expect(localMobile(null)).toBe("");
  });
  it("refuses anything else", async () => {
    const { mobileNumber } = await import("./forms");
    for (const v of [
      "072 000 000",
      "07200000000",
      "+44 20 7946 0000",
      "0020000000",
      "072-abc-0000",
      "x".repeat(40),
    ])
      expect(mobileNumber(v)).toBeNull();
    expect(mobileNumber(null)).toBeNull();
  });
});
