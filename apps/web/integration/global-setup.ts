import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { TestProject } from "vitest/node";

/**
 * Reads the local Supabase stack that K1 (or a developer) started with
 * `supabase start`, and hands its URLs and local keys to the tests. Keys are
 * the CLI's local development keys; they are never printed or written.
 */
export interface Stack {
  apiUrl: string;
  dbUrl: string;
  mailUrl: string;
  anonKey: string;
  serviceKey: string;
  root: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    stack: Stack;
  }
}

const root = join(import.meta.dirname, "..", "..", "..");

function fail(message: string): never {
  throw new Error(`test:integration: ${message}`);
}

function readStatus(): Record<string, unknown> {
  const cli = join(root, "node_modules", ".bin", "supabase");
  const native = process.env["CARWORX_NATIVE_TEST_STACK"] === "native-auth";
  const args = native
    ? ["status", "--stack", "native-auth", "--output-format", "json"]
    : ["status", "-o", "json"];
  const status = spawnSync(cli, args, {
    cwd: root,
    encoding: "utf8",
  });
  if (status.status !== 0)
    fail("`supabase status` failed; start local Supabase first");
  const start = status.stdout.indexOf("{");
  try {
    const parsed = JSON.parse(status.stdout.slice(start)) as Record<
      string,
      unknown
    >;
    if (!native) return parsed;
    if (
      parsed["runtime"] !== "native" ||
      typeof parsed["env"] !== "object" ||
      parsed["env"] === null
    )
      return fail("native stack status is incomplete");
    return parsed["env"] as Record<string, unknown>;
  } catch {
    return fail("could not parse `supabase status -o json`");
  }
}

function pick(status: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = status[name];
    if (typeof value === "string" && value !== "") return value;
  }
  return fail(`no ${names.join(" or ")} in supabase status`);
}

export default function setup(project: TestProject) {
  if (
    !existsSync(join(import.meta.dirname, "..", "build", "server", "index.js"))
  ) {
    fail("no production build; run `react-router build` first");
  }
  const status = readStatus();
  let mailUrl: string;
  try {
    mailUrl = pick(status, "MAILPIT_URL", "INBUCKET_URL");
  } catch {
    mailUrl = "http://127.0.0.1:54324";
  }
  project.provide("stack", {
    apiUrl: pick(status, "API_URL"),
    dbUrl: pick(status, "DB_URL"),
    mailUrl,
    anonKey: pick(status, "ANON_KEY", "PUBLISHABLE_KEY"),
    serviceKey: pick(status, "SERVICE_ROLE_KEY", "SECRET_KEY"),
    root,
  });
}
