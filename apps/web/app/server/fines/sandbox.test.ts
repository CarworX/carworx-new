import { describe, expect, it } from "vitest";
import {
  parseOutcome,
  parseScenario,
  sandbox,
  settleSandbox,
} from "./sandbox.server";

describe("synthetic fines checkout", () => {
  it("provides populated, empty and unavailable fixtures without accepting identities", () => {
    expect(sandbox.lookup("sample")?.fines).toHaveLength(2);
    expect(sandbox.lookup("empty")?.fines).toEqual([]);
    expect(sandbox.lookup("unavailable")).toBeNull();
    expect(parseScenario("1234567890123")).toBe("sample");
  });

  it("authorizes only a payable fixture and validates outcomes", () => {
    expect(sandbox.checkout("DEMO-101")?.cents).toBe(45000);
    expect(sandbox.checkout("DEMO-102")).toBeUndefined();
    expect(sandbox.checkout("real-notice")).toBeUndefined();
    expect(parseOutcome("paid")).toBeNull();
  });

  it("allows retries after failure and keeps an issued receipt stable", () => {
    expect(settleSandbox("timeout", "pending")).toBe("pending");
    expect(settleSandbox("cancelled", "confirmed")).toBe("confirmed");
    expect(settleSandbox("pending", "confirmed")).toBe("pending");
    expect(settleSandbox("confirmed", "cancelled")).toBe("confirmed");
  });
});
