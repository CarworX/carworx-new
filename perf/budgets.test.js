import assert from "node:assert/strict";
import test from "node:test";
import { evaluate } from "./budgets.js";
const report = () => ({
  lighthouseVersion: "13.6.0",
  categories: { performance: { score: 0.95 }, accessibility: { score: 0.98 } },
  audits: {
    "largest-contentful-paint": { numericValue: 2000 },
    "cumulative-layout-shift": { numericValue: 0.05 },
  },
});
test("five complete runs satisfy fixed A6 local budgets", () => {
  assert.equal(evaluate(Array.from({ length: 5 }, report)).status, "passed");
});
test("missing/error/version-drift reports fail instead of dropping runs", () => {
  assert.throws(() => evaluate([]));
  for (const patch of [
    { runtimeError: {} },
    { lighthouseVersion: "other" },
    { audits: {} },
  ])
    assert.throws(() =>
      evaluate([
        { ...report(), ...patch },
        ...Array.from({ length: 4 }, report),
      ]),
    );
});
test("one accessibility or CLS failure and median performance/LCP failures block", () => {
  for (const fault of ["accessibility", "cls", "performance", "lcp"]) {
    const runs = Array.from({ length: 5 }, report);
    for (const run of runs.slice(
      0,
      ["performance", "lcp"].includes(fault) ? 3 : 1,
    )) {
      if (fault === "accessibility") run.categories.accessibility.score = 0.94;
      if (fault === "performance") run.categories.performance.score = 0.89;
      if (fault === "lcp")
        run.audits["largest-contentful-paint"].numericValue = 2501;
      if (fault === "cls")
        run.audits["cumulative-layout-shift"].numericValue = 0.101;
    }
    assert.equal(evaluate(runs).status, "failed");
  }
});
