/// <reference lib="dom" />
// Finish-build PR 1 (D-098): design-vs-ours screenshots for team management,
// in Chromium against the PRODUCTION BUILD of the Worker served in Node and
// the local Supabase stack:
//
//   supabase start && pnpm --filter @carworx/web build
//   node scripts/team-shots.ts <preview dist dir> [--out build/team-shots]
//
// <preview dist dir> is planning/sites-customer-preview/dist from #83 @
// b88a8ca (git archive it into a scratch folder). For each screen and width
// (1280 and 390) it saves design-*.png, ours-*.png and diff-*.png, and prints
// a Markdown table with the share of differing pixels. Not part of
// `pnpm run check` (K1 CI has no browser). Synthetic identities only; rows
// this run writes are deleted at the end.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..", "..");
const argv = process.argv.slice(2);
const PREVIEW = argv[0] === undefined ? "" : resolve(argv[0]);
if (!existsSync(join(PREVIEW, "onboarding", "setup", "index.html")))
  throw new Error("pass the preview dist folder from #83 @ b88a8ca");
const outIndex = argv.indexOf("--out");
const OUT = resolve(
  outIndex >= 0
    ? (argv[outIndex + 1] ?? "build/team-shots")
    : join(app, "build/team-shots"),
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

// --- Synthetic fixture -------------------------------------------------------
async function person(label: string, name: string) {
  const email = `team-shots-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const created = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error !== null) throw new Error("createUser failed");
  psql(
    `insert into public.profiles(id, display_name) values ('${created.data.user.id}', '${name}')`,
  );
  return { id: created.data.user.id, email };
}
const org = randomUUID();
const owner = await person("owner", "Sipho Dlamini");
const staff = await person("staff", "Thabo Mokoena");
psql(`insert into public.organisations(id, name) values ('${org}', 'Shine Bay Car Wash');
  insert into public.memberships(organisation_id, user_id, role) values
    ('${org}', '${owner.id}', 'owner'), ('${org}', '${staff.id}', 'staff');
  insert into public.invites(organisation_id, role, token_hash, email, created_by, control_generation)
    select '${org}', 'manager', extensions.digest(gen_random_uuid()::text, 'sha256'),
      'lerato@example.test', '${owner.id}', control_generation
    from public.organisations where id = '${org}'`);

// --- Screens -----------------------------------------------------------------
const WIDTHS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "390", width: 390, height: 844 },
];
mkdirSync(OUT, { recursive: true });

async function signedIn(
  browser: Browser,
  email: string,
  width: number,
  height: number,
) {
  const context = await browser.newContext({ viewport: { width, height } });
  const p = await context.newPage();
  await p.goto(`${ORIGIN}/auth/sign-in`);
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForLoadState("networkidle");
  return p;
}

async function design(p: Page, screen: string) {
  const base = pathToFileURL(join(PREVIEW, "onboarding")).href;
  if (screen === "team") {
    await p.goto(`${base}/setup/index.html#t-team`);
    await p.evaluate(() => {
      const set = (k: string, v: string) => {
        for (const el of document.querySelectorAll<HTMLInputElement>(
          `[name="${k}"]`,
        )) {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      set("invEmail", "lerato@example.test");
      set("invRole", "Manager");
      set("sent", "yes");
    });
  } else {
    await p.goto(`${base}/account/index.html?as=staff&tab=work`);
  }
  await p.waitForTimeout(400);
}

async function diff(p: Page, a: string, b: string, out: string) {
  const [left, right] = [readFileSync(a), readFileSync(b)].map((x) =>
    x.toString("base64"),
  );
  const result = await p.evaluate(
    async ([l, r]) => {
      const load = async (s: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${s}`;
        await img.decode();
        return img;
      };
      const [x, y] = [await load(l ?? ""), await load(r ?? "")];
      const w = Math.max(x.width, y.width);
      const h = Math.max(x.height, y.height);
      const draw = (img: HTMLImageElement) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        if (g === null) throw new Error("no canvas");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, w, h);
      };
      const [dx, dy] = [draw(x), draw(y)];
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      if (g === null) throw new Error("no canvas");
      const outImg = g.createImageData(w, h);
      let changed = 0;
      for (let i = 0; i < dx.data.length; i += 4) {
        const delta =
          Math.abs((dx.data[i] ?? 0) - (dy.data[i] ?? 0)) +
          Math.abs((dx.data[i + 1] ?? 0) - (dy.data[i + 1] ?? 0)) +
          Math.abs((dx.data[i + 2] ?? 0) - (dy.data[i + 2] ?? 0));
        const hit = delta > 48;
        if (hit) changed++;
        outImg.data[i] = hit ? 255 : 235;
        outImg.data[i + 1] = hit ? 0 : 235;
        outImg.data[i + 2] = hit ? 80 : 235;
        outImg.data[i + 3] = 255;
      }
      g.putImageData(outImg, 0, 0);
      return {
        changed,
        total: w * h,
        png: c.toDataURL("image/png").split(",")[1] ?? "",
        w,
        h,
      };
    },
    [left, right] as const,
  );
  const { writeFileSync } = await import("node:fs");
  writeFileSync(out, Buffer.from(result.png, "base64"));
  return result;
}

const rows: string[] = [
  "| Screen | Width | Design | Ours | Differing pixels |",
  "|---|---|---|---|---|",
];
const browser = await chromium.launch();
try {
  for (const w of WIDTHS) {
    for (const screen of ["team", "work"] as const) {
      const designPage = await (
        await browser.newContext({
          viewport: { width: w.width, height: w.height },
        })
      ).newPage();
      await design(designPage, screen);
      const designFile = join(OUT, `design-${screen}-${w.name}.png`);
      await designPage.screenshot({ path: designFile, fullPage: true });

      const ours = await signedIn(
        browser,
        screen === "team" ? owner.email : staff.email,
        w.width,
        w.height,
      );
      await ours.goto(
        screen === "team"
          ? `${ORIGIN}/provider/setup/team/start?org=${org}`
          : `${ORIGIN}/account/work`,
      );
      await ours.waitForLoadState("networkidle");
      const oursFile = join(OUT, `ours-${screen}-${w.name}.png`);
      await ours.screenshot({ path: oursFile, fullPage: true });

      const d = await diff(
        designPage,
        designFile,
        oursFile,
        join(OUT, `diff-${screen}-${w.name}.png`),
      );
      rows.push(
        `| ${screen === "team" ? "Setup › Your team (owner)" : "Account › Your work (staff)"} | ${w.name} | design-${screen}-${w.name}.png | ours-${screen}-${w.name}.png | ${((100 * d.changed) / d.total).toFixed(1)}% of ${String(d.w)}×${String(d.h)} |`,
      );
    }
  }
  console.log(rows.join("\n"));
} finally {
  await browser.close();
  server.close();
  psql(`delete from public.invites where organisation_id = '${org}';
    delete from public.memberships where organisation_id = '${org}';
    delete from public.organisations where id = '${org}';
    delete from public.profiles where id in ('${owner.id}', '${staff.id}')`);
  await service.auth.admin.deleteUser(owner.id);
  await service.auth.admin.deleteUser(staff.id);
}
