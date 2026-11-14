/// <reference lib="dom" />
// Phase 3 test round (P3-O2): one customer + provider booking journey in a
// real browser (Chromium), against the PRODUCTION BUILD of the Worker served
// in Node and the local Supabase stack:
//
//   supabase start && pnpm --filter @carworx/web build
//   node scripts/bookings-e2e.ts [screenshot-dir]
//
// Customer picks a slot and requests -> provider accepts in the inbox ->
// customer sees the 15-minute hold and the /checkout/:holdId pay link ->
// payment is confirmed through the lane contract (private.confirm_paid, as
// the money lane does; no Paystack call) -> customer moves the booking ->
// customer cancels (24h+ ahead) -> the refund request reaches the money lane
// with key cancel:<booking_id>. Not part of `pnpm run check` (CI has no
// browser). Exits 1 on any failure. Synthetic identities only.
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
const PORT = 5173;
const ORIGIN = `http://localhost:${String(PORT)}`;
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

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
  const args = ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c"];
  const host = spawnSync("psql", ["--version"]).status === 0;
  const r = host
    ? spawnSync("psql", [...args, statement, stack.DB_URL], {
        encoding: "utf8",
      })
    : spawnSync(
        "docker",
        [
          "exec",
          "-i",
          "supabase_db_carworx",
          "psql",
          "-U",
          "postgres",
          ...args,
          statement,
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
const clientDir = join(app, "build", "client");
const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
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
async function shot(page: Page, name: string) {
  if (shots)
    await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
}

// --- Synthetic fixture: one org, one capacity-1 bay, one fixed offer --------
async function user(label: string): Promise<{ id: string; email: string }> {
  const email = `bk-e2e-${label}-${TAG}@example.test`;
  const r = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (r.error !== null) throw new Error("createUser failed");
  return { id: r.data.user.id, email };
}
const owner = await user("owner");
const customer = await user("customer");
const [org, listing, resource, offer, source, branch] = [
  randomUUID(),
  randomUUID(),
  randomUUID(),
  randomUUID(),
  randomUUID(),
  randomUUID(),
];
psql(`
  insert into public.organisations(id, name) values ('${org}', 'E2E Bays ${TAG} (synthetic)');
  insert into public.memberships(organisation_id, user_id, role, status) values ('${org}', '${owner.id}', 'owner', 'active');
  insert into public.coordinate_sources(id, organisation_id, source_kind, licence_note) values ('${source}', '${org}', 'provider_supplied', 'Synthetic');
  insert into public.branches(public_id, organisation_id, name, public_address, public_latitude, public_longitude, coordinate_source_id)
    values ('${branch}', '${org}', 'E2E branch', '1 Synthetic Road', -26.1, 28.0, '${source}');
  insert into public.listings(public_id, organisation_id, service_slug, branch_public_id, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
    values ('${listing}', '${org}', 'wash', '${branch}', 'E2E Wash ${TAG} (synthetic)', 'Synthetic e2e fixture', 'Gauteng', 'fixed', 'live', 'admin_import', 'synthetic-e2e');
  insert into public.resources(id, organisation_id, kind, name, capacity) values ('${resource}', '${org}', 'bay', 'E2E bay', 1);
  insert into public.resource_hours(resource_id, organisation_id, weekday, opens, closes)
    select '${resource}', '${org}', w, '08:00', '17:00' from generate_series(1, 7) w;
  insert into public.service_offers(id, organisation_id, listing_public_id, name, pricing, price_minor, duration_minutes, resource_kind)
    values ('${offer}', '${org}', '${listing}', 'E2E wash', 'fixed', 25000, 60, 'bay');
`);
// An ordinary weekday 4+ days out (past the 2-business-hour accept window
// and more than 24 hours ahead, so cancelling is a full refund).
const day =
  psql(`select d::date from generate_series(current_date + 4, current_date + 30, interval '1 day') d
  where not private.is_public_holiday(d::date) and extract(isodow from d) between 2 and 4 order by d limit 1`);

async function signIn(page: Page, email: string) {
  await page.goto(`${ORIGIN}/auth/sign-in?returnTo=/account`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/account");
}

const browser = await chromium.launch();
try {
  const shopper = await (
    await browser.newContext({ viewport: { width: 420, height: 900 } })
  ).newPage();
  const provider = await (await browser.newContext()).newPage();
  shopper.setDefaultTimeout(15_000);
  provider.setDefaultTimeout(15_000);

  // 1. Customer: pick 10:00 on the chosen day and send the request.
  await signIn(shopper, customer.email);
  await shopper.goto(`${ORIGIN}/book/${listing}?offer=${offer}&day=${day}`);
  await shopper.getByRole("radio", { name: "10:00" }).check();
  await shot(shopper, "1-customer-slot-picker");
  await shopper.getByRole("button", { name: "Send booking request" }).click();
  await shopper.waitForURL(/\/bookings\/[0-9a-f-]{36}$/);
  const booking = new URL(shopper.url()).pathname.split("/").pop() ?? "";
  check(
    "customer request created a 'requested' booking",
    psql(`select state from public.bookings where id = '${booking}'`) ===
      "requested",
  );

  // 2. Provider: accept it in the request inbox.
  await signIn(provider, owner.email);
  await provider.goto(`${ORIGIN}/provider/bookings?org=${org}`);
  await shot(provider, "2-provider-inbox");
  await provider.getByRole("button", { name: "Accept" }).first().click();
  await provider.getByText("New requests (0)").waitFor();
  const hold = psql(
    `select hold_id from public.bookings where id = '${booking}' and state = 'awaiting_payment'`,
  );
  check(
    "provider accept placed a 15-minute hold",
    /^[0-9a-f-]{36}$/.test(hold),
  );

  // 3. Customer: sees the pay link to the money lane's checkout.
  await shopper.goto(`${ORIGIN}/bookings/${booking}`);
  const pay = shopper.getByRole("link", { name: /^Pay R/ });
  check(
    "customer sees Pay linking to /checkout/:holdId",
    (await pay.getAttribute("href")) === `/checkout/${hold}`,
  );
  await shot(shopper, "3-customer-awaiting-payment");

  // 4. Payment confirmed the way the money lane does it (contract call).
  const outcome = psql(`select private.confirm_paid('${hold}', '${booking}')`);
  check("contract confirm_paid confirmed the booking", outcome === "confirmed");
  psql(`insert into private.payment_accounts(organisation_id, subaccount) values ('${org}', 'ACCT_e2e${TAG}') on conflict do nothing;
    insert into private.payment_attempts(id, hold_id, booking_id, customer_id, organisation_id, amount_minor, subaccount, hold_expires_at, state, provider_id)
    values ('${booking}', '${hold}', '${booking}', '${customer.id}', '${org}', 25000, 'ACCT_e2e${TAG}', now(), 'paid', 'e2e_${TAG}')`);

  // 5. Customer: move the booking to 14:00 the same day.
  await shopper.goto(`${ORIGIN}/bookings/${booking}`);
  await shopper.getByRole("link", { name: "Change the time" }).click();
  await shopper.waitForURL(/reschedule=1/);
  await shopper.goto(`${ORIGIN}/bookings/${booking}?reschedule=1&day=${day}`);
  await shopper.getByRole("radio", { name: /14:00/ }).check();
  await shot(shopper, "4-customer-reschedule");
  await shopper.getByRole("button", { name: "Move my booking" }).click();
  await shopper.getByRole("link", { name: "Change the time" }).waitFor();
  check(
    "reschedule moved the booking to 14:00 local and released 10:00",
    psql(`select to_char(lower(during) at time zone 'Africa/Johannesburg', 'HH24:MI') || '|' ||
      (select count(*) from public.reservations where booking_id = '${booking}' and state = 'active')
      from public.bookings where id = '${booking}'`) === "14:00|1",
  );

  // 6. Provider: the confirmed job shows in the schedule.
  await provider.goto(`${ORIGIN}/provider/bookings?org=${org}`);
  check(
    "provider sees the confirmed job",
    (await provider.getByText(/confirmed/i).count()) > 0,
  );
  await shot(provider, "5-provider-confirmed");

  // 7. Customer: cancel more than 24 hours ahead -> refund request.
  await shopper.goto(`${ORIGIN}/bookings/${booking}`);
  await shopper.getByLabel("Reason (optional)").fill("Synthetic e2e cancel");
  await shopper.getByRole("button", { name: "Cancel booking" }).click();
  await shopper
    .getByRole("button", { name: "Cancel booking" })
    .waitFor({ state: "detached" });
  await shot(shopper, "6-customer-cancelled");
  check(
    "cancel released the slot and asked the money lane for a full refund",
    psql(`select b.state || '|' || r.amount_minor || '|' || r.actor
      from public.bookings b join private.payment_refunds r on r.attempt_id = '${booking}'
      where b.id = '${booking}'`) === `cancelled|25000|cancel:${booking}`,
  );
} finally {
  await browser.close();
  server.close();
}
console.log(
  failures === 0
    ? "bookings-e2e: all passed"
    : `bookings-e2e: ${String(failures)} failed`,
);
process.exit(failures === 0 ? 0 : 1);
