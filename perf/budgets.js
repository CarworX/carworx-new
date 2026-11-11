export const ROUTES = [
  "/",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/forgot-password",
  "/_dev/components",
  // P2-5 + P2-6 (Claude 22, A15). Forms render closed without Turnstile keys.
  "/fines",
  "/support",
];
export function evaluate(reports) {
  if (!Array.isArray(reports) || reports.length !== 5)
    throw new Error("Five complete runs required");
  const values = reports.map((r) => {
    if (r.runtimeError || r.lighthouseVersion !== "13.6.0")
      throw new Error("Invalid Lighthouse run");
    const v = {
      performance: r.categories?.performance?.score * 100,
      accessibility: r.categories?.accessibility?.score * 100,
      lcp: r.audits?.["largest-contentful-paint"]?.numericValue,
      cls: r.audits?.["cumulative-layout-shift"]?.numericValue,
    };
    if (Object.values(v).some((n) => !Number.isFinite(n) || n < 0))
      throw new Error("Missing measurement");
    return v;
  });
  const median = (name) => values.map((v) => v[name]).sort((a, b) => a - b)[2];
  const result = {
    performance: median("performance"),
    lcp_ms: median("lcp"),
    cls_max: Math.max(...values.map((v) => v.cls)),
    accessibility_min: Math.min(...values.map((v) => v.accessibility)),
  };
  return {
    ...result,
    status:
      result.performance >= 90 &&
      result.lcp_ms <= 2500 &&
      result.cls_max <= 0.1 &&
      result.accessibility_min >= 95
        ? "passed"
        : "failed",
  };
}
