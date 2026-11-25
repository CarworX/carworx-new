/// <reference lib="dom" />
// Finish-build PR 4b (D-098): design-vs-ours screenshots for "Delete my
// account" on Account > Privacy, the reinstate page and the closed notice, in Chromium against the PRODUCTION BUILD of the
// Worker served in Node, the local Supabase stack and an in-memory MEDIA
// bucket:
//
//   supabase start && pnpm --filter @carworx/web build
//   node scripts/close-shots.ts <preview dist dir> [--out build/close-shots]
//
// Same method as scripts/team-shots.ts: design-*.png, ours-*.png, diff-*.png
// and a Markdown table of differing pixels, at 1280 and 390. Synthetic
// identities only; rows are deleted after.
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
    ? (argv[outIndex + 1] ?? "build/close-shots")
    : join(app, "build/close-shots"),
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
const stored = new Map<string, Uint8Array<ArrayBuffer>>();
const env = {
  APP_ORIGIN: ORIGIN,
  SUPABASE_URL: stack.API_URL,
  SUPABASE_PUBLISHABLE_KEY: stack.ANON_KEY,
  MEDIA: {
    put: (key: string, value: Uint8Array) => {
      stored.set(key, new Uint8Array(value));
      return Promise.resolve();
    },
    get: (key: string) => {
      const v = stored.get(key);
      return Promise.resolve(
        v === undefined ? null : { body: new Blob([v]).stream() },
      );
    },
    delete: () => Promise.resolve(),
  },
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
      (url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/fonts/")) &&
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
  const email = `close-shots-${label}-${randomUUID().slice(0, 8)}@example.test`;
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
const owner = await person("person", "Lerato Mokoena");

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

async function design(p: Page) {
  await p.goto(
    `${pathToFileURL(join(PREVIEW, "onboarding")).href}/account/index.html?as=driver&tab=privacy`,
  );
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
    for (const screen of ["delete", "closed", "closing"] as const) {
      const designPage = await (
        await browser.newContext({
          viewport: { width: w.width, height: w.height },
        })
      ).newPage();
      await design(designPage);
      const designFile = join(OUT, `design-${screen}-${w.name}.png`);
      await designPage.screenshot({ path: designFile, fullPage: true });

      psql(
        `delete from private.account_closures where user_id = '${owner.id}'`,
      );
      const ours = await signedIn(browser, owner.email, w.width, w.height);
      if (screen === "delete") {
        await ours.goto(`${ORIGIN}/account/privacy#delete-account`);
      } else {
        await ours.goto(`${ORIGIN}/account/privacy`);
        await ours.getByLabel("Your password").fill(PASSWORD);
        await ours.getByLabel(/I understand/).check();
        await ours.getByRole("button", { name: "Delete my account" }).click();
        await ours.waitForURL(/\/account\/closed/);
        if (screen === "closing") {
          await ours.goto(`${ORIGIN}/auth/sign-in`);
          await ours.getByLabel("Email").fill(owner.email);
          await ours.getByLabel("Password").fill(PASSWORD);
          await ours
            .getByRole("button", { name: "Sign in", exact: true })
            .click();
          await ours.waitForLoadState("networkidle");
          await ours.goto(`${ORIGIN}/account/closing`);
        }
      }
      await ours.waitForLoadState("networkidle");
      const oursFile = join(OUT, `ours-${screen}-${w.name}.png`);
      await ours.screenshot({ path: oursFile, fullPage: true });

      const d = await diff(
        designPage,
        designFile,
        oursFile,
        join(OUT, `diff-${screen}-${w.name}.png`),
      );
      const label = {
        delete: "Account › Privacy, Delete my account",
        closed: "Account closed notice",
        closing: "Signed back in: reinstate?",
      }[screen];
      rows.push(
        `| ${label} | ${w.name} | design-${screen}-${w.name}.png | ours-${screen}-${w.name}.png | ${((100 * d.changed) / d.total).toFixed(1)}% of ${String(d.w)}×${String(d.h)} |`,
      );
    }
  }
  console.log(rows.join("\n"));
} finally {
  await browser.close();
  server.close();
  psql(`delete from private.account_closures where user_id = '${owner.id}';
    delete from public.profiles where id = '${owner.id}'`);
  await service.auth.admin.deleteUser(owner.id);
}
