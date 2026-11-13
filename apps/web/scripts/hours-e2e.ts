/// <reference lib="dom" />
// Opening hours journey (Claude 26), in Chromium against the PRODUCTION BUILD
// of the Worker served in Node and the local Supabase stack:
//
//   supabase start -x vector,realtime && pnpm --filter @carworx/web build
//   node scripts/hours-e2e.ts [--out build/hours]
//
// An owner signs in on a phone-sized screen, opens Opening hours from the
// business page, changes Monday, uses "Copy Monday to weekdays", closes
// Saturday at 12:00 and saves; the public listing then shows the new 7-day
// table with exactly one "Today" row and an open-now line. Not part of
// `pnpm run check` (K1 CI has no browser). Exits 1 on any failure. Synthetic
// identities only; rows this run writes are deleted at the end.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..", "..");
const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");
const OUT = resolve(
  outIndex >= 0
    ? (argv[outIndex + 1] ?? "build/hours")
    : join(app, "build/hours"),
);
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

const cataloguePassword = `synthetic-${randomUUID()}`;
const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
psql(
  `alter role catalogue_server password '${cataloguePassword}' valid until '${until}'`,
);
function login(role: string, password: string): string {
  const url = new URL(stack.DB_URL);
  url.username = role;
  url.password = password;
  return url.toString();
}
const allowAll = {
  idFromName: (name: string) => name,
  get: () => ({
    fetch: () => Promise.resolve(Response.json({ allowed: true })),
  }),
};

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
  CATALOGUE_DB: {
    connectionString: login("catalogue_server", cataloguePassword),
  },
  SEARCH_LIMITER: allowAll,
  SEARCH_LIMITER_SALT: `synthetic-salt-${randomUUID()}`,
  SEARCH_CURSOR_KEY: `synthetic-cursor-${randomUUID()}`,
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

// --- The journey ---------------------------------------------------------------
let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}
mkdirSync(OUT, { recursive: true });
async function shot(p: Page, name: string) {
  await p.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

const org = randomUUID();
const listing = randomUUID();
const email = `hours-owner-${randomUUID().slice(0, 8)}@example.test`;
const browser = await chromium.launch();
let ownerId: string | null = null;
try {
  const created = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error !== null) throw new Error("createUser failed");
  ownerId = created.data.user.id;
  psql(`
    insert into public.organisations(id, name) values ('${org}', 'Hours E2E Wash (synthetic)');
    insert into public.memberships(organisation_id, user_id, role, status) values ('${org}', '${ownerId}', 'owner', 'active');
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      values ('${listing}', '${org}', 'wash', 'Hours E2E Wash (synthetic)', 'Synthetic mobile wash for the hours browser run', 'Gauteng', 'mobile', 'live', 'provider_application', 'synthetic-hours-e2e');`);

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const p = await context.newPage();
  await p.goto(`${ORIGIN}/auth/sign-in`);
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForLoadState("networkidle");

  await p.goto(`${ORIGIN}/provider`);
  await p
    .locator(`[data-listing="${listing}"]`)
    .getByRole("link", { name: "Opening hours" })
    .click();
  await p.waitForURL(`${ORIGIN}/provider/hours/${listing}`);
  check(
    "editor starts from the defaults, Sunday closed",
    !(await p.getByRole("switch", { name: "Open on Sunday" }).isChecked()) &&
      (await p.getByLabel("Closes on Saturday").inputValue()) === "13:00",
  );
  await shot(p, "1-editor-defaults");

  await p.getByLabel("Opens on Monday").selectOption("07:00");
  await p.getByLabel("Closes on Monday").selectOption("18:00");
  await p.getByRole("button", { name: "Copy Monday to weekdays" }).click();
  await p.waitForLoadState("networkidle");
  check(
    "Copy Monday sets Tuesday to Friday",
    (await p.getByLabel("Opens on Friday").inputValue()) === "07:00" &&
      (await p.getByLabel("Closes on Tuesday").inputValue()) === "18:00",
  );
  check(
    "Copy Monday saves nothing",
    psql(
      `select count(*) from public.listing_hours where listing_public_id = '${listing}'`,
    ) === "0",
  );
  await p.getByLabel("Closes on Saturday").selectOption("12:00");
  await shot(p, "2-editor-changed");
  await p.getByRole("button", { name: "Save hours" }).click();
  await p.getByText("Hours saved.").waitFor();
  check(
    "saved per day",
    psql(
      `select string_agg(day || ' ' || to_char(opens,'HH24:MI') || '-' || to_char(closes,'HH24:MI'), ',' order by day) from public.listing_hours where listing_public_id = '${listing}'`,
    ) ===
      "1 07:00-18:00,2 07:00-18:00,3 07:00-18:00,4 07:00-18:00,5 07:00-18:00,6 08:00-12:00",
  );

  const visitor = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    })
  ).newPage();
  await visitor.goto(`${ORIGIN}/p/${listing}`);
  const table = visitor.locator("#hours table");
  check(
    "public table has seven days",
    (await table.locator("tr").count()) === 7,
  );
  check(
    "exactly one row is today",
    (await table.locator('tr[aria-current="date"]').count()) === 1 &&
      (await table.locator('tr[aria-current="date"]').textContent())?.includes(
        "Today",
      ) === true,
  );
  check(
    "Saturday and Sunday read correctly",
    (
      await table.getByRole("row", { name: /Saturday/ }).textContent()
    )?.includes("08:00 – 12:00") === true &&
      (
        await table.getByRole("row", { name: /Sunday/ }).textContent()
      )?.includes("Closed") === true,
  );
  check(
    "open-now line is shown",
    /^(Open now · closes|Closed · opens)/.test(
      (await visitor.locator("[data-open-status]").textContent()) ?? "",
    ),
  );
  check(
    "public holiday note is shown",
    await visitor.getByText("Public holiday hours may differ").isVisible(),
  );
  await visitor.locator("#hours").scrollIntoViewIfNeeded();
  await shot(visitor, "3-public-listing");
} catch (error) {
  failures++;
  console.error(error);
} finally {
  await browser.close();
  server.close();
  psql(`
    delete from public.listings where public_id = '${listing}';
    delete from public.memberships where organisation_id = '${org}';
    delete from public.organisations where id = '${org}';
    alter role catalogue_server password null;`);
  if (ownerId !== null) await service.auth.admin.deleteUser(ownerId);
}
console.log(`screenshots: ${OUT}`);
if (failures > 0) process.exit(1);
