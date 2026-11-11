/** Synthetic browser proof of the non-widget support contact. Never sends mail. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
interface Worker {
  fetch(request: Request, env: unknown, context: unknown): Promise<Response>;
}
const worker = (
  (await import(pathToFileURL(join(app, "build/server/index.js")).href)) as {
    default: Worker;
  }
).default;
const address = "synthetic-support@example.test";
let contact: string | undefined = address;
let widget = true;
let origin = "";
const client = normalize(join(app, "build/client"));
const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", origin);
    const file = normalize(join(client, url.pathname));
    if (
      url.pathname.startsWith("/assets/") &&
      file.startsWith(client + "/") &&
      existsSync(file)
    ) {
      const types: Record<string, string> = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
      };
      response.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
      });
      response.end(readFileSync(file));
      return;
    }
    const result: Response = await worker.fetch(
      new Request(url, { headers: request.headers as Record<string, string> }),
      {
        CARWORX_ENV: "local",
        APP_ORIGIN: origin,
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_PUBLISHABLE_KEY: "local-synthetic-publishable-fixture",
        SUPPORT_CONTACT_EMAIL: contact,
        ...(widget
          ? {
              TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
              TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
            }
          : {}),
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
    result.headers.forEach((value, key) => response.setHeader(key, value));
    response.writeHead(result.status);
    response.end(Buffer.from(await result.arrayBuffer()));
  })().catch(() => {
    response.writeHead(500);
    response.end();
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const bound = server.address();
assert(bound && typeof bound !== "string");
origin = `http://127.0.0.1:${String(bound.port)}`;
const browser = await chromium.launch({
  args: process.env.GITHUB_ACTIONS === "true" ? ["--no-sandbox"] : [],
});
let passed = 0;
try {
  for (const mode of [
    "no_javascript",
    "blocked_widget",
    "missing_widget",
    "missing_contact",
  ]) {
    widget = mode !== "missing_widget";
    contact = mode === "missing_contact" ? undefined : address;
    const context = await browser.newContext({
      javaScriptEnabled: mode !== "no_javascript",
    });
    try {
      await context.route("https://**/*", (route) => route.abort());
      const page = await context.newPage();
      const blocked =
        mode === "blocked_widget"
          ? page.waitForRequest(
              (request) => request.url().includes("/turnstile/v0/api.js"),
              { timeout: 10_000 },
            )
          : undefined;
      const result = await page.goto(origin + "/support");
      assert(result);
      assert.equal(result.status(), 200);
      assert.equal(result.headers()["cache-control"], "private, no-store");
      if (blocked) await blocked;
      if (mode === "missing_contact") {
        assert(
          await page.locator("[data-support-contact-unavailable]").isVisible(),
        );
        assert.equal(await page.locator('a[href^="mailto:"]').count(), 0);
      } else {
        const link = page.getByRole("link", { name: address, exact: true });
        assert(await link.isVisible());
        assert.equal(await link.getAttribute("href"), `mailto:${address}`);
      }
      if (mode === "missing_widget")
        assert.equal(
          await page.locator('form[data-form="support"]').count(),
          0,
        );
      passed++;
    } finally {
      await context.close();
    }
  }
} catch {
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  const report = {
    version: 1,
    status: passed === 4 ? "passed" : "failed",
    tests: 4,
    passed,
  };
  if (process.env.SUPPORT_FALLBACK_REPORT)
    writeFileSync(
      process.env.SUPPORT_FALLBACK_REPORT,
      JSON.stringify(report) + "\n",
    );
  console.log(JSON.stringify(report));
}
