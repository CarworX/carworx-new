import { describe, expect, it } from "vitest";
import { supportContactEmail } from "./contact";

describe("public support contact", () => {
  it("accepts an explicit address without inventing a default", () => {
    expect(supportContactEmail(" Support+Privacy@Example.test ")).toBe(
      "support+privacy@example.test",
    );
    expect(supportContactEmail(undefined)).toBeNull();
  });
  it.each([
    null,
    1,
    "",
    "support",
    "support@localhost",
    "[support@]",
    "a@-example.test",
    "a@example..test",
    "a..b@example.test",
    "a@example.test?subject=x",
    "a?bcc=x@example.test",
    "a%0d@example.test",
    "a\r\n@example.test",
    "a@" + "x".repeat(64) + ".test",
  ])("rejects invalid or URI-injecting configuration %#", (value) => {
    expect(supportContactEmail(value)).toBeNull();
  });
});
