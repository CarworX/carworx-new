/// <reference lib="dom" />
// P2-5 + P2-6 (Claude 22) in a real browser at phone width: an enquiry from
// a listing page, demand capture from an empty search, a support case, the
// provider inbox, the aal2 admin views and /fines. Drives Chromium with the
// pinned `playwright` against the PRODUCTION BUILD of the Worker, served in
// Node with build/client as static assets, and the local Supabase stack.
//
//   supabase start -x vector,realtime && pnpm --filter @carworx/web build
//   node scripts/forms-e2e.ts --out /tmp/forms
//
// Turnstile: Cloudflare's official test keys. The browser's api.js request is
// answered by a local stub that drops the dummy token into the form, and the
// Worker's siteverify call is answered in this process. Nothing reaches
// Cloudflare. Not part of `pnpm run check` (K1 CI has no browser). Exits 1 on
// any failure. Saves 390 x 844 screenshots at device scale 2. Every identity
// is synthetic; the rows this run writes are deleted at the end.
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
  outIndex >= 0
    ? (argv[outIndex + 1] ?? "build/forms")
    : join(app, "build/forms"),
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
  const email = `forms-${label}-${randomUUID().slice(0, 8)}@example.test`;
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

// --- Turnstile and the scoped logins ------------------------------------------
const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const realFetch = globalThis.fetch;
let verifyCalls = 0;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === SITEVERIFY_URL) {
    verifyCalls++;
    return Promise.resolve(
      Response.json({ success: true, hostname: "example.com" }),
    );
  }
  if (url.startsWith("https://challenges.cloudflare.com"))
    return Promise.reject(new Error("unexpected Cloudflare call"));
  return realFetch(input, init);
};
const formsPassword = `synthetic-${randomUUID()}`;
const cataloguePassword = `synthetic-${randomUUID()}`;
const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
psql(
  `alter role forms_server password '${formsPassword}' valid until '${until}'`,
);
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
  FORMS_DB: { connectionString: login("forms_server", formsPassword) },
  CATALOGUE_DB: {
    connectionString: login("catalogue_server", cataloguePassword),
  },
  SEARCH_LIMITER: allowAll,
  SEARCH_LIMITER_SALT: `synthetic-salt-${randomUUID()}`,
  SEARCH_CURSOR_KEY: `synthetic-cursor-${randomUUID()}`,
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
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

/** A phone-width page whose Turnstile script is the local stub. */
async function phone(browser: Browser): Promise<Page> {
  const p = await page(browser);
  await p.route(TURNSTILE_SCRIPT, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile = {
        render(el) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "cf-turnstile-response";
          input.value = ${JSON.stringify(DUMMY_TOKEN)};
          const box = document.createElement("p");
          box.textContent = "Test check passed (local stub)";
          box.style.cssText = "border:1px solid #ccc;border-radius:8px;padding:12px;margin:0";
          el.append(input, box);
          return "stub";
        },
        remove() {},
      };`,
    }),
  );
  return p;
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

const TAG = randomUUID().slice(0, 8);
const visitorEmail = `forms-visitor-${TAG}@example.test`;
const org = randomUUID();
const listing = randomUUID();
const browser = await chromium.launch();
try {
  // A provider with one live listing, to receive the enquiry.
  const owner = await user("owner");
  psql(`
    insert into public.organisations(id, name) values ('${org}', 'Forms E2E Wash (synthetic)');
    insert into public.memberships(organisation_id, user_id, role, status) values ('${org}', '${owner.id}', 'owner', 'active');
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      values ('${listing}', '${org}', 'wash', 'Forms E2E Wash (synthetic)', 'Synthetic mobile wash for the forms browser run', 'Gauteng', 'mobile', 'live', 'provider_application', 'synthetic-forms-e2e');`);

  // 1. Enquiry from the listing page.
  const visitor = await phone(browser);
  await visitor.goto(`${ORIGIN}/p/${listing}`);
  const consent = visitor.locator(
    '[data-form="enquiry"] input[name="consent"]',
  );
  check("enquiry consent starts unticked", !(await consent.isChecked()));
  await visitor.getByLabel("Your name").fill("Sam Sender");
  await visitor.getByLabel("Your email", { exact: true }).fill(visitorEmail);
  await visitor
    .getByLabel("Your message")
    .fill("Synthetic: can you wash two cars on Saturday morning?");
  await visitor.locator('[data-human-check="enquiry"] p').waitFor();
  await shot(visitor, "01-enquiry-form");
  // The browser won't send it unticked (required); the server refuses too.
  await visitor.getByRole("button", { name: "Send message" }).click();
  check("unticked enquiry is not sent", !visitor.url().includes("sent=1"));
  await consent.check({ force: true });
  await visitor.getByRole("button", { name: "Send message" }).click();
  await visitor.waitForURL(/sent=1/);
  check(
    "enquiry stored",
    psql(
      `select count(*) from public.enquiries where sender_email = '${visitorEmail}'`,
    ) === "1",
  );
  await shot(visitor, "02-enquiry-sent");

  // 2. Demand capture from an empty search.
  await visitor.goto(
    `${ORIGIN}/search?lat=-29.1&lng=21.1&radius=5&category=glass-repair-and-replacement`,
  );
  await shot(visitor, "03-empty-search");
  await visitor.getByRole("link", { name: "Tell me when one joins" }).click();
  await visitor.waitForURL(/\/demand\?category=glass-repair-and-replacement/);
  check(
    "demand form keeps the service",
    (await visitor.getByLabel("Service", { exact: true }).inputValue()) ===
      "glass-repair-and-replacement",
  );
  check(
    "demand consent starts unticked",
    !(await visitor.locator('input[name="consent"]').isChecked()),
  );
  await visitor
    .getByLabel("Province", { exact: true })
    .selectOption("northern-cape");
  await visitor.getByLabel("Your email", { exact: true }).fill(visitorEmail);
  await visitor.locator('input[name="consent"]').check({ force: true });
  await visitor.locator('[data-human-check="demand"] p').waitFor();
  await shot(visitor, "04-demand-form");
  await visitor.getByRole("button", { name: "Save my request" }).click();
  await visitor.waitForURL(/\/demand\?sent=1/);
  check(
    "demand stored privately",
    psql(
      `select count(*) from public.demand_requests where email = '${visitorEmail}'`,
    ) === "1",
  );
  await shot(visitor, "05-demand-sent");

  // 3. Support case.
  await visitor.goto(`${ORIGIN}/support`);
  await visitor.getByLabel("What's it about?").selectOption("privacy_request");
  await visitor.getByLabel("Your email", { exact: true }).fill(visitorEmail);
  await visitor
    .getByLabel("Your message")
    .fill("Synthetic: please delete my demand request.");
  await visitor.locator('[data-human-check="support"] p').waitFor();
  await shot(visitor, "06-support-form");
  await visitor.getByRole("button", { name: "Send message" }).click();
  await visitor.waitForURL(/\/support\?sent=1/);
  check(
    "support case stored",
    psql(
      `select count(*) from public.support_cases where email = '${visitorEmail}'`,
    ) === "1",
  );

  // 4. Fines.
  await visitor.goto(`${ORIGIN}/fines`);
  check(
    "fines page has no field",
    (await visitor.locator("input, select, textarea").count()) === 0,
  );
  await shot(visitor, "07-fines");

  // 5. The provider reads the enquiry.
  const provider = await page(browser);
  await signIn(provider, owner.email);
  await provider.goto(`${ORIGIN}/provider`);
  check(
    "provider sees the enquiry",
    (await provider.locator("[data-enquiry]").count()) === 1,
  );
  await shot(provider, "08-provider-enquiries");

  // 6. The aal2 admin reads demand and support.
  const adminUser = await user("admin");
  psql(
    `insert into private.platform_admins(user_id) values ('${adminUser.id}')`,
  );
  const admin = await page(browser);
  await signIn(admin, adminUser.email);
  await admin.goto(`${ORIGIN}/admin/demand`);
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
  await admin.goto(`${ORIGIN}/admin/demand`);
  check(
    "admin sees the demand request",
    (await admin.getByText(visitorEmail).count()) === 1,
  );
  await shot(admin, "09-admin-demand");
  // A real-browser post from an admin page (Referrer-Policy: same-origin).
  const demandId = psql(
    `select id from public.demand_requests where email = '${visitorEmail}'`,
  );
  await admin
    .locator(`[data-row="${demandId}"]`)
    .getByRole("button", { name: "Withdraw (person asked)" })
    .click();
  await admin.waitForURL(/withdrawn=1/);
  check(
    "admin withdrew the demand request",
    psql(
      `select count(*) from public.demand_requests where email = '${visitorEmail}'`,
    ) === "0",
  );
  await admin.goto(`${ORIGIN}/admin/support`);
  const caseId = psql(
    `select id from public.support_cases where email = '${visitorEmail}'`,
  );
  check(
    "admin support list shows the case",
    (await admin.locator(`[data-row="${caseId}"]`).count()) === 1,
  );
  await admin.goto(`${ORIGIN}/admin/support/${caseId}`);
  await admin.getByLabel("What was done").fill("Synthetic: demand withdrawn.");
  await shot(admin, "10-admin-support-case");
  await admin.getByRole("button", { name: "Close case" }).click();
  await admin.waitForLoadState("networkidle");
  check(
    "admin closed the case",
    psql(`select status from public.support_cases where id = '${caseId}'`) ===
      "closed",
  );
  await shot(admin, "11-admin-support-closed");
  check("siteverify was asked once per form", verifyCalls === 3);
} catch (error) {
  for (const p of browser.contexts().flatMap((c) => c.pages()))
    console.log(p.url(), await p.locator("[data-problem]").allInnerTexts());
  throw error;
} finally {
  await browser.close();
  server.close();
  psql(`
    do $$ declare consent_ids uuid[]; begin
      select array_agg(consent_id) into consent_ids from public.enquiries
        where listing_public_id = '${listing}';
      delete from public.enquiries where listing_public_id = '${listing}';
      delete from public.consents where id = any(consent_ids);
    end $$;
    delete from public.demand_requests where email = '${visitorEmail}';
    delete from public.support_cases where email = '${visitorEmail}';
    delete from public.consents where subject_email = '${visitorEmail}';
    delete from public.listings where public_id = '${listing}';
    alter role forms_server password null;
    alter role catalogue_server password null;`);
}
console.log(`screenshots: ${OUT}`);
if (failures > 0) process.exit(1);
