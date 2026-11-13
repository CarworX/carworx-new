/// <reference lib="dom" />
// A12 (PLAN §11) in a real browser: application → approval → live; a
// disputed claim; a suspension. Drives Chromium with the pinned `playwright`
// against the PRODUCTION BUILD of the Worker (build/server/index.js), served
// in Node with build/client as static assets, and the local Supabase stack.
//
//   supabase start -x vector,realtime && pnpm --filter @carworx/web build
//   node scripts/a12-e2e.ts --out /tmp/a12
//
// Not part of `pnpm run check`: K1 CI has no browser (as browser-audit.ts).
// Exits 1 on any failure. Saves phone-width screenshots (390 × 844 at device
// scale 2) of the provider and admin pages. Every identity is synthetic
// (@example.test, random per run); local stack keys are never printed.
import { spawnSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..", "..");
const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");
const OUT = resolve(
  outIndex >= 0 ? (argv[outIndex + 1] ?? "build/a12") : join(app, "build/a12"),
);
const PORT = 5173;
const ORIGIN = `http://localhost:${String(PORT)}`;

// --- Local stack ---------------------------------------------------------------
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

async function user(label: string) {
  const email = `a12-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error !== null) throw new Error("createUser failed");
  return { id: data.user.id, email };
}

function psql(statement: string): string {
  const r = spawnSync(
    "psql",
    [
      "-X",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
      stack.DB_URL,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error("psql failed");
  return r.stdout.trim();
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
const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
};
const clientDir = join(app, "build", "client");

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
    const response = await worker.fetch(
      new Request(url, {
        method: req.method ?? "GET",
        headers,
        body:
          req.method === "GET" || req.method === "HEAD"
            ? undefined
            : Buffer.concat(chunks),
      }),
      env,
      ctx,
    );
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

// --- Checks --------------------------------------------------------------------
let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}
mkdirSync(OUT, { recursive: true });

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

async function page(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  return context.newPage();
}

async function signIn(p: Page, email: string) {
  await p.goto(`${ORIGIN}/auth/sign-in`);
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForLoadState("networkidle");
}

async function shot(p: Page, name: string) {
  await p.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

const browser = await chromium.launch();
try {
  // 1. Application → approval → live
  const owner = await user("owner");
  const provider = await page(browser);
  await signIn(provider, owner.email);
  // The stepped application (Claude 23 O3): business → service → location
  // → about → check. Location uses the device path (no Mapbox in this run),
  // with a synthetic Johannesburg position granted to this context only.
  await provider
    .context()
    .grantPermissions(["geolocation"], { origin: ORIGIN });
  await provider
    .context()
    .setGeolocation({ latitude: -26.1201, longitude: 28.0601 });
  const next = async () => {
    await provider.getByRole("button", { name: "Save and continue" }).click();
    await provider.waitForLoadState("networkidle");
  };
  await provider.goto(`${ORIGIN}/provider/apply`);
  await provider.waitForURL(/\/provider\/get-listed\/business/);
  await provider.getByLabel("Business name").fill("A12 Motors (synthetic)");
  await shot(provider, "01-provider-apply");
  await next();
  await provider.waitForURL(/\/get-listed\/service/);
  await provider.getByLabel("Mechanical service").check();
  await provider.getByLabel(/They come to me/).check();
  await next();
  await provider.waitForURL(/\/get-listed\/location/);
  await provider.getByLabel("Area or metro").selectOption("Johannesburg");
  await provider
    .getByLabel("Public premises address")
    .fill("12 Synthetic Avenue, Exampleville");
  await provider.getByRole("button", { name: "Use my location" }).click();
  await provider
    .getByRole("button", { name: "Continue to browser permission" })
    .click();
  await provider.getByText(/Location chosen \(your device\)/).waitFor();
  await next();
  await provider.waitForURL(/\/get-listed\/about/);
  await provider
    .getByLabel("A line about your business")
    .fill("Synthetic workshop for the A12 browser run");
  await next();
  await provider.waitForURL(/\/get-listed\/check/);
  await provider.getByText("I am 18 or older").click();
  await provider.getByRole("button", { name: "Send for review" }).click();
  await provider.waitForURL(/\/get-listed\/submitted/);
  await provider.goto(`${ORIGIN}/provider`);
  const publicId =
    (await provider
      .locator("[data-listing]")
      .first()
      .getAttribute("data-listing")) ?? "";
  check(
    "application lands in submitted",
    (await provider.locator('[data-status="submitted"]').count()) === 1,
  );
  await shot(provider, "02-provider-dashboard-submitted");

  const adminUser = await user("admin");
  psql(
    `insert into private.platform_admins(user_id) values ('${adminUser.id}')`,
  );
  const admin = await page(browser);
  await signIn(admin, adminUser.email);
  await admin.goto(`${ORIGIN}/admin/listings`);
  check("aal1 admin is sent to TOTP", admin.url().includes("/auth/mfa"));
  await admin
    .getByRole("button", { name: "Set up an authenticator app" })
    .click();
  const secret =
    (await admin
      .locator("[data-totp-secret]")
      .getAttribute("data-totp-secret")) ?? "";
  await admin.getByLabel(/6-digit code/).fill(totp(secret));
  await admin.getByRole("button", { name: "Verify" }).click();
  await admin.waitForLoadState("networkidle");
  await admin.goto(`${ORIGIN}/admin/listings?status=submitted`);
  check(
    "queue lists the application",
    (await admin.locator(`[data-row="${publicId}"]`).count()) === 1,
  );
  await shot(admin, "03-admin-queue");
  await admin.goto(`${ORIGIN}/admin/listings/${publicId}`);
  // Guided review (O4): Business → Location → Checks → Decision → Confirm.
  const cont = () =>
    admin.getByRole("button", { name: "Continue", exact: true }).click();
  await cont();
  await cont();
  await admin.getByLabel("How did you check it?").selectOption("site_visit");
  await admin.getByLabel("Identity checked").check();
  await admin.getByLabel("Premises visited").check();
  await admin.getByLabel(/Evidence reference/).fill("synthetic-a12-visit");
  await shot(admin, "04-admin-review");
  await cont();
  await admin.getByRole("radio", { name: "Approve and publish" }).check();
  await cont();
  await admin.getByLabel("I checked this myself").check();
  await admin.getByRole("button", { name: "Approve and publish" }).click();
  await admin.waitForURL(/done=1/);
  const visitor = await page(browser);
  const live = await visitor.goto(`${ORIGIN}/p/${publicId}`);
  check("approved listing is live", live?.status() === 200);
  check(
    "labels are shown",
    (await visitor.getByText("Premises visited").count()) > 0,
  );
  await shot(visitor, "05-public-listing-live");

  // 2. A disputed claim
  const claimant = await user("claimant");
  const claimer = await page(browser);
  await signIn(claimer, claimant.email);
  await claimer.goto(`${ORIGIN}/provider/claim/${publicId}`);
  // Zero-typed claim (O3): Business → Proof (picks only) → Check → Send.
  await claimer.getByRole("link", { name: "Continue to proof" }).click();
  await claimer.getByLabel(/Business document/).check();
  await claimer.getByLabel("Document type").selectOption("lease");
  await claimer.getByLabel("Year").selectOption({ index: 1 });
  await claimer.getByLabel("Month").selectOption({ index: 1 });
  await claimer.getByLabel("Day").selectOption({ index: 1 });
  await shot(claimer, "06-claim");
  await claimer.getByRole("button", { name: "Review claim" }).click();
  await claimer.getByRole("button", { name: "Send claim" }).click();
  await claimer.waitForURL(/claimed=1/);
  await provider.goto(`${ORIGIN}/provider`);
  await provider
    .getByLabel("Why this claim is wrong")
    .fill("Synthetic: I run this workshop");
  await shot(provider, "07-provider-claim-to-dispute");
  await provider.getByRole("button", { name: "Dispute this claim" }).click();
  await provider.waitForURL(/done=1/);
  check(
    "claim is disputed",
    (await provider.locator('[data-claim-status="disputed"]').count()) === 1,
  );
  await admin.goto(`${ORIGIN}/admin/claims`);
  await shot(admin, "08-admin-claims");
  // Open this run's own claim: the list may hold other synthetic claims.
  const claimId =
    (await provider
      .locator("[data-claim]")
      .first()
      .getAttribute("data-claim")) ?? "";
  check(
    "admin claims list shows the disputed claim",
    (await admin.locator(`[data-row="${claimId}"]`).count()) === 1,
  );
  await admin.goto(`${ORIGIN}/admin/claims/${claimId}`);
  await admin
    .getByLabel("Why you uphold it")
    .fill("Synthetic: the owner's evidence is stronger");
  await shot(admin, "09-admin-dispute");
  await admin.getByRole("button", { name: "Uphold dispute" }).click();
  await admin.waitForURL(/done=1/);
  check(
    "upheld dispute rejects the claim",
    (await admin.locator('[data-claim-status="rejected"]').count()) === 1,
  );
  check(
    "control did not transfer",
    psql(`select count(*) from public.memberships m join public.listings l on l.organisation_id = m.organisation_id
      where l.public_id = '${publicId}' and m.status = 'active' and m.user_id = '${claimant.id}'`) ===
      "0",
  );

  // 3. A suspension
  await admin.goto(`${ORIGIN}/admin/listings/${publicId}`);
  await admin.getByLabel(/^Reason/).fill("Synthetic: complaint under review");
  await admin.getByRole("button", { name: "Suspend listing" }).click();
  await admin.waitForURL(/done=1/);
  check(
    "suspended listing is gone",
    (await visitor.goto(`${ORIGIN}/p/${publicId}`))?.status() === 404,
  );
  await provider.goto(`${ORIGIN}/provider`);
  check(
    "provider sees the suspension",
    (await provider.locator('[data-status="suspended"]').count()) === 1,
  );
  await shot(provider, "10-provider-suspended");
  await admin.goto(`${ORIGIN}/admin/audit`);
  await shot(admin, "11-admin-audit");
} catch (error) {
  for (const p of browser.contexts().flatMap((c) => c.pages()))
    console.log(p.url(), await p.locator("[data-problem]").allInnerTexts());
  throw error;
} finally {
  await browser.close();
  server.close();
}
console.log(`screenshots: ${OUT}`);
if (failures > 0) process.exit(1);
