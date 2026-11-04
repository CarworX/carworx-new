import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEFAULT_TOKENS } from "../tokens/cli.ts";
import { parseTokens } from "../tokens/generate.ts";
import { check, parsePairArg } from "./report.ts";

const tokens = () =>
  parseTokens(JSON.parse(readFileSync(DEFAULT_TOKENS, "utf8")) as unknown);

describe("contrast check (G15)", () => {
  it("measures real pairs, including the 404 page's, and all meet their floor", () => {
    const r = check(tokens());
    expect(r.measured.length).toBeGreaterThan(40);
    expect(
      r.measured.filter((m) => m.where.startsWith("404")).length,
    ).toBeGreaterThanOrEqual(8);
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("reports the ratios the brand book states", () => {
    const by = (where: string) =>
      check(tokens()).measured.find((m) => m.where === where)?.ratio;
    expect(by("404 · headline grey line (32–56 px)")).toBeCloseTo(3.8, 1); // quiet on canvas
    expect(by("404 · sub line")).toBeCloseTo(5.3, 1); // muted on canvas
    expect(by("edge · input")).toBeCloseTo(3.14, 2); // D-066 control edge on white
    expect(by("primary button")).toBeCloseTo(19.2, 1);
  });

  it("fails on a deliberately low-contrast pair", () => {
    const r = check(tokens(), [parsePairArg("line:surface:ui")]);
    expect(r.ok).toBe(false);
    expect(r.failures.map((f) => f.ratio)).toEqual([1.37]);
  });

  it("fails when a token is lowered in a scratch copy", () => {
    const t = tokens();
    const muted = t.color.tokens.find((c) => c.name === "muted");
    if (muted) muted.value = "#9aa1aa";
    const r = check(t);
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.where === "404 · sub line")).toBe(true);
  });

  it("measuring nothing is a failure", () => {
    expect(check(tokens(), [], []).ok).toBe(false);
  });
});
