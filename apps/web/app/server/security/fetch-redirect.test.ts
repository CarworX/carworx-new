import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The Cloudflare Workers runtime throws on `fetch(..., { redirect: "error" })`
 * ("Invalid redirect value"), while Node accepts it, so unit tests passed and
 * every such call failed only once deployed (staging, 2026-11-14). Worker code
 * must use "manual" and treat a 3xx as a failure.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

describe("Worker fetch redirect mode", () => {
  it('never uses redirect: "error" in code that runs on Workers', () => {
    const root = join(__dirname, "..", "..", "..");
    const offenders = ["app", "workers"]
      .flatMap((dir) => sources(join(root, dir)))
      .filter((file) =>
        /redirect:\s*["']error["']/.test(readFileSync(file, "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});
