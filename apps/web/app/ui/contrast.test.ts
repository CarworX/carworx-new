import { describe, expect, it } from "vitest";

import { over, parseColor, ratio } from "./contrast";

describe("WCAG contrast maths", () => {
  it("matches the reference extremes", () => {
    expect(ratio(parseColor("#000000"), parseColor("#ffffff"))).toBeCloseTo(
      21,
      5,
    );
    expect(ratio(parseColor("#777777"), parseColor("#777777"))).toBeCloseTo(
      1,
      5,
    );
  });
  it("composites translucent layers before measuring", () => {
    const frostOnCanvas = over(
      parseColor("rgba(255,255,255,.82)"),
      parseColor("#f2f1ee"),
    );
    expect(frostOnCanvas[0]).toBeCloseTo(252.6, 0);
    expect(() => parseColor("hsl(0 0% 0%)")).toThrow();
  });
});
