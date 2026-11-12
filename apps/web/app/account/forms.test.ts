import { describe, expect, it } from "vitest";

import { accountTab, displayName } from "./forms";

describe("account settings input", () => {
  it("only accepts supported settings tabs", () => {
    expect(accountTab("security")).toBe("security");
    expect(accountTab("admin")).toBeNull();
    expect(accountTab(undefined)).toBeNull();
  });

  it("accepts optional international display names without treating them as identity", () => {
    expect(displayName("  Léa van Wyk  ")).toBe("Léa van Wyk");
    expect(displayName("")).toBe("");
  });

  it("refuses oversized, control-character and non-text input", () => {
    expect(displayName("a".repeat(81))).toBeNull();
    expect(displayName("First\nLast")).toBeNull();
    expect(displayName(new File(["x"], "name.txt"))).toBeNull();
  });
});
