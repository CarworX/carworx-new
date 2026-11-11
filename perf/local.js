import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { freemem, tmpdir } from "node:os";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluate, ROUTES } from "./budgets.js";

const directory = mkdtempSync(join(tmpdir(), "carworx-perf-private-"));
let phase = "preflight";
const summary = {
  version: 1,
  scope: "loopback-mobile-lab",
  status: "incomplete",
  routes: [],
};
try {
  summary.source_sha = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (freemem() < 2 * 1024 ** 3) throw new Error("available_ram_below_2_gib");
  const origin = new URL(process.argv[2] ?? "http://localhost:8787");
  if (
    origin.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(origin.hostname) ||
    origin.href !== `${origin.origin}/`
  )
    throw new Error("loopback_origin_required");
  phase = "toolchain";
  const require = createRequire(import.meta.resolve("lighthouse"));
  const { launch } = await import(
    pathToFileURL(require.resolve("chrome-launcher")).href
  );
  const { default: lighthouse } = await import("lighthouse");
  const appRequire = createRequire(
    new URL("../apps/web/package.json", import.meta.url),
  );
  const { chromium } = appRequire("playwright");
  for (const [index, route] of ROUTES.entries()) {
    phase = "preview_route";
    const reports = [];
    const samples = [];
    const entry = { route, samples, status: "incomplete" };
    summary.routes.push(entry);
    summary.current_route = route;
    summary.completed_samples = 0;
    const routeUrl = new URL(route, origin).href;
    const response = await fetch(routeUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error("Invalid preview route");
    await response.body?.cancel();
    for (let run = 0; run < 5; run++) {
      if (freemem() < 2 * 1024 ** 3)
        throw new Error("available_ram_below_2_gib");
      phase = "chromium_launch";
      const chrome = await launch({
        chromePath: chromium.executablePath(),
        chromeFlags: [
          "--headless",
          "--disable-extensions",
          ...(process.env.GITHUB_ACTIONS === "true" ? ["--no-sandbox"] : []),
        ],
        logLevel: "silent",
      });
      try {
        phase = "lighthouse_measurement";
        const result = await lighthouse(routeUrl, {
          port: chrome.port,
          output: ["json", "html"],
          onlyCategories: ["performance", "accessibility"],
          logLevel: "error",
        });
        if (result.lhr.finalDisplayedUrl !== routeUrl)
          throw new Error("Unexpected measured route");
        reports.push(result.lhr);
        summary.completed_samples = reports.length;
        if (result.lhr.runtimeError) {
          const code = result.lhr.runtimeError.code;
          summary.failure_code =
            typeof code === "string" && /^[A-Z][A-Z_]{0,63}$/.test(code)
              ? code
              : "lighthouse_runtime_error";
          throw new Error("Invalid Lighthouse run");
        }
        samples.push({
          performance: result.lhr.categories.performance.score * 100,
          accessibility: result.lhr.categories.accessibility.score * 100,
          failed_accessibility_audits:
            result.lhr.categories.accessibility.auditRefs
              .filter(
                ({ id, weight }) =>
                  weight > 0 &&
                  /^[a-z0-9-]+$/.test(id) &&
                  result.lhr.audits[id]?.score === 0,
              )
              .map(({ id }) => id),
          lcp_ms: result.lhr.audits["largest-contentful-paint"].numericValue,
          cls: result.lhr.audits["cumulative-layout-shift"].numericValue,
        });
        summary.browser = result.lhr.environment.hostUserAgent;
        const settings = result.lhr.configSettings;
        summary.conditions = {
          formFactor: settings.formFactor,
          throttlingMethod: settings.throttlingMethod,
          screenEmulation: settings.screenEmulation,
          throttling: settings.throttling,
        };
        for (const [format, content] of [
          ["json", result.report[0]],
          ["html", result.report[1]],
        ])
          writeFileSync(join(directory, `${index}-${run}.${format}`), content);
      } finally {
        await chrome.kill();
      }
    }
    phase = "budget_evaluation";
    Object.assign(entry, evaluate(reports));
  }
  summary.status = summary.routes.every((r) => r.status === "passed")
    ? "passed"
    : "failed";
  if (summary.status !== "passed") process.exitCode = 1;
} catch (error) {
  summary.status = "blocked";
  summary.stage = phase;
  summary.failure_code ??=
    {
      "Invalid Lighthouse run": "invalid_lighthouse_report",
      "Missing measurement": "missing_measurement",
      "Five complete runs required": "incomplete_measurements",
      "Invalid preview route": "invalid_preview_route",
      "Unexpected measured route": "unexpected_measured_route",
    }[error.message] ?? "stage_error";
  summary.reason = [
    "available_ram_below_2_gib",
    "loopback_origin_required",
  ].includes(error.message)
    ? error.message
    : phase;
  process.exitCode = 1;
} finally {
  writeFileSync(
    join(directory, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  if (process.env.K3_REPORT)
    writeFileSync(
      process.env.K3_REPORT,
      JSON.stringify(summary, null, 2) + "\n",
    );
  console.log(
    JSON.stringify({
      status: summary.status,
      reason: summary.reason,
      private_reports: directory,
    }),
  );
}
