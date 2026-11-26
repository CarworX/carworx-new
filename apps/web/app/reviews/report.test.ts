import { describe, expect, it } from "vitest";

import { reportText } from "./report";

describe("report reasons", () => {
  it("stores the chosen reason, with any note after it", () => {
    expect(reportText("Spam or advertising", null)).toBe("Spam or advertising");
    expect(reportText("Spam or advertising", "  Promotes a site  ")).toBe(
      "Spam or advertising: Promotes a site",
    );
  });

  it("needs a note for 'Something else'", () => {
    expect(reportText("Something else", null)).toBeNull();
    expect(reportText("Something else", "ok")).toBeNull();
    expect(reportText("Something else", "Not about a visit")).toBe(
      "Something else: Not about a visit",
    );
  });

  it("refuses a reason it does not know", () => {
    expect(reportText("Please delete this", null)).toBeNull();
    expect(reportText("", null)).toBeNull();
  });
});
