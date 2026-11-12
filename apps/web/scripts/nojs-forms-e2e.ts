/// <reference lib="dom" />
// No-JavaScript forms on personal pages (T5 boundary). Chromium with
// JavaScript OFF submits native HTML forms. Under `Referrer-Policy:
// no-referrer` it sends `Origin: null`, which the boundary must refuse; under
// `same-origin` it sends the real Origin. This drives the PRODUCTION BUILD of
// the Worker, served in Node, against the local Supabase stack:
//
//   supabase start -x vector,realtime && pnpm --filter @carworx/web build
//   node scripts/nojs-forms-e2e.ts
//
// Checks: password sign-in, TOTP enrolment (aal2) and an admin form post
// (close a support case), all with JavaScript disabled, and that every POST
// reached the Worker with Origin equal to APP_ORIGIN and a CSRF token. Not
// part of `pnpm run check` (K1 CI has no browser). Exits 1 on any failure.
// Synthetic identities only; the rows this run writes are deleted at the end.
// SQL runs through psql inside the local database container (docker exec).
import { spawnSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..", "..");
const PORT = 5173;
const ORIGIN = `http://localhost:${String(PORT)}`;

const status = spawnSync(
  join(root, "node_modules", ".bin", "supabase"),
  ["status", "-o", "json"],
  { cwd: root, encoding: "utf8" },
);
if (status.status !== 0) throw new Error("start local Supabase first");
const stack = JSON.parse(status.stdout.slice(status.stdout.indexOf("{"))) as {
  API_URL: string;
  DB_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};
const service = createClient(stack.API_URL, stack.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PASSWORD = `synthetic-${randomUUID()}`;
const TAG = randomUUID().slice(0, 8);

function psql(statement: string): string {
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_carworx",
      "psql",
      "-U",
      "postgres",
      "-X",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error("psql failed");
  return r.stdout.trim();
}

function totp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const o = (h[h.length - 1] ?? 0) & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, "0");
}

// --- The built Worker, served in Node ---------------------------------------
interface Worker {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
}
const worker = (
  (await import(
    pathToFileURL(join(app, "build", "server", "index.js")).href
  )) as { default: Worker }
).default;
const env = {
  APP_ORIGIN: ORIGIN,
  SUPABASE_URL: stack.API_URL,
  SUPABASE_PUBLISHABLE_KEY: stack.ANON_KEY,
};
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };
const clientDir = join(app, "build", "client");
const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
/** What the Worker saw for each POST: path, Origin, status. */
const posts: { path: string; origin: string | null; status: number }[] = [];

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", ORIGIN);
    const file = normalize(join(clientDir, url.pathname));
    if (
      file.startsWith(clientDir) &&
      url.pathname.startsWith("/assets/") &&
      existsSync(file)
    ) {
      res.writeHead(200, {
        "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      });
      res.end(readFileSync(file));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    const method = req.method ?? "GET";
    const response = await worker.fetch(
      new Request(url, {
        method,
        headers,
        body:
          method === "GET" || method === "HEAD"
            ? undefined
            : Buffer.concat(chunks),
      }),
      env,
      ctx,
    );
    if (method === "POST")
      posts.push({
        path: url.pathname,
        origin: headers.get("origin"),
        status: response.status,
      });
    const out: Record<string, string | string[]> = {};
    response.headers.forEach((v, k) => {
      if (k !== "set-cookie") out[k] = v;
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) out["set-cookie"] = cookies;
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  })().catch(() => {
    res.writeHead(500);
    res.end();
  });
});
await new Promise<void>((done) => server.listen(PORT, "127.0.0.1", done));

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}

const email = `nojs-admin-${TAG}@example.test`;
const created = await service.auth.admin.createUser({
  email,
  password: PASSWORD,
  email_confirm: true,
});
if (created.error !== null) throw new Error("createUser failed");
const userId = created.data.user.id;
psql(`insert into private.platform_admins(user_id) values ('${userId}')`);
const caseEmail = `nojs-case-${TAG}@example.test`;
const caseId = psql(`insert into public.support_cases(email, topic, message)
  values ('${caseEmail}', 'other', 'Synthetic no-JS support case') returning id`);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);

  // 1. Sign in with a native form post.
  const signIn = await page.goto(`${ORIGIN}/auth/sign-in?returnTo=/account`);
  console.log(
    `info  /auth/sign-in Referrer-Policy: ${String(signIn?.headers()["referrer-policy"])}`,
  );
  const probe = await context.newPage();
  await probe.setContent(
    '<p id="x">off</p><script>document.getElementById("x").textContent = "on"</script>',
  );
  const jsOff = (await probe.locator("#x").textContent()) === "off";
  await probe.close();
  check("JavaScript is disabled in this context", jsOff);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("load");
  check(
    "sign-in post accepted and redirected to /account",
    new URL(page.url()).pathname === "/account",
  );

  // 2. Reach aal2 with TOTP, still without JavaScript.
  await page.goto(`${ORIGIN}/auth/mfa?returnTo=/admin/support`);
  await page
    .getByRole("button", { name: "Set up an authenticator app" })
    .click();
  await page.waitForLoadState("load");
  const secret =
    (await page
      .locator("[data-totp-secret]")
      .getAttribute("data-totp-secret")) ?? "";
  check("TOTP enrolment form post accepted", secret.length > 0);
  await page.getByLabel(/6-digit code/).fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForLoadState("load");

  // 3. An admin form post: close the support case.
  await page.goto(`${ORIGIN}/admin/support/${caseId}`);
  await page.getByLabel("What was done").fill("Synthetic close note");
  await page.getByRole("button", { name: "Close case" }).click();
  await page.waitForLoadState("load");
  check(
    "admin close-case form post accepted",
    psql(`select status from public.support_cases where id = '${caseId}'`) ===
      "closed",
  );

  check("at least three native form posts were made", posts.length >= 3);
  check(
    "every POST carried Origin equal to APP_ORIGIN (never null)",
    posts.every((p) => p.origin === ORIGIN),
  );
  check(
    "no POST was refused by the boundary",
    posts.every((p) => p.status !== 403),
  );
} catch (error) {
  check(`flow completed (${(error as Error).name})`, false);
} finally {
  for (const p of posts)
    console.log(
      `info  POST ${p.path} Origin=${String(p.origin)} -> ${String(p.status)}`,
    );
  await browser.close();
  server.close();
  psql(`delete from public.support_cases where email = '${caseEmail}'`);
  psql(`delete from private.platform_admins where user_id = '${userId}'`);
  await service.auth.admin.deleteUser(userId);
}
if (failures > 0) {
  console.log(`${String(failures)} check(s) failed`);
  process.exitCode = 1;
} else console.log("all no-JS checks passed");
