import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { freemem, tmpdir } from "node:os";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluate, ROUTES } from "./budgets.js";

const directory = mkdtempSync(join(tmpdir(), "carworx-perf-private-"));
const summary = {
  version: 1,
  scope: "local-mobile-only",
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
  const require = createRequire(
    new URL("../node_modules/lighthouse/package.json", import.meta.url),
  );
  const { launch } = await import(
    pathToFileURL(require.resolve("chrome-launcher")).href
  );
  const { default: lighthouse } = await import("lighthouse");
  const appRequire = createRequire(
    new URL("../apps/web/package.json", import.meta.url),
  );
  const { chromium } = appRequire("playwright");
  for (const [index, route] of ROUTES.entries()) {
    const reports = [];
    for (let run = 0; run < 5; run++) {
      if (freemem() < 2 * 1024 ** 3)
        throw new Error("available_ram_below_2_gib");
      const chrome = await launch({
        chromePath: chromium.executablePath(),
        chromeFlags: ["--headless", "--disable-extensions"],
        logLevel: "silent",
      });
      try {
        const result = await lighthouse(new URL(route, origin).href, {
          port: chrome.port,
          output: ["json", "html"],
          onlyCategories: ["performance", "accessibility"],
          logLevel: "error",
        });
        reports.push(result.lhr);
        summary.browser = result.lhr.environment.hostUserAgent;
        summary.conditions = result.lhr.configSettings;
        for (const [format, content] of [
          ["json", result.report[0]],
          ["html", result.report[1]],
        ])
          writeFileSync(join(directory, `${index}-${run}.${format}`), content);
      } finally {
        await chrome.kill();
      }
    }
    summary.routes.push({ route, ...evaluate(reports) });
  }
  summary.status = summary.routes.every((r) => r.status === "passed")
    ? "passed"
    : "failed";
  if (summary.status !== "passed") process.exitCode = 1;
} catch (error) {
  summary.status = "blocked";
  summary.reason = [
    "available_ram_below_2_gib",
    "loopback_origin_required",
  ].includes(error.message)
    ? error.message
    : "measurement_failed";
  process.exitCode = 1;
} finally {
  writeFileSync(
    join(directory, "summary.json"),
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
