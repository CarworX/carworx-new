/// <reference lib="dom" />
// page.evaluate callbacks run in the browser, so this file also sees DOM types.
// Browser audit for T4's D-checks, against a running build:
//   pnpm --filter @carworx/web preview          (terminal 1)
//   pnpm --filter @carworx/web audit:browser    (terminal 2)
//   node scripts/browser-audit.ts --base http://localhost:4173 --out /tmp/t4-audit
//
// Needs a Chromium that matches the pinned `playwright` (npx playwright install
// chromium, or a preinstalled one). Not part of `pnpm run check`: K1 CI has no
// browser. It checks, and exits 1 on any failure:
//   D2  no request leaves the origin; fonts come from the app
//   D8  every focusable element shows a 2 px ink outline with a 2 px offset;
//       primary actions are at least 44 × 44 px; all targets at least 24 × 24
//   D7  text contrast measured in the rendered DOM (404 and living page)
//   D9  with prefers-reduced-motion the spinner, shimmer, lens and ripple stop
//   axe-core WCAG 2.2 A/AA rules
// and saves phone and desktop screenshots, with and without reduced motion.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser, type Page } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k: string, d: string) => {
  const i = argv.indexOf(k);
  return i >= 0 ? (argv[i + 1] ?? d) : d;
};
const BASE = arg("--base", "http://localhost:4173");
const OUT = resolve(arg("--out", join(app, "build/audit")));
const AXE = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);
const PAGES = {
  components: "/_dev/components",
  notFound: "/this-page-does-not-exist",
};
const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

type Result = { check: string; ok: boolean; detail: string };
const results: Result[] = [];
const record = (check: string, ok: boolean, detail: string) => {
  results.push({ check, ok, detail });
  console.log(`${ok ? "pass" : "FAIL"}  ${check}: ${detail}`);
};

async function open(
  browser: Browser,
  path: string,
  vp: { width: number; height: number },
  reduced: boolean,
) {
  const ctx = await browser.newContext({
    viewport: vp,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(600);
  return { ctx, page, requests, status: res?.status() ?? 0 };
}

function checkBuiltCss() {
  const dir = join(app, "build/client/assets");
  const files = readdirSync(dir).filter((f) => f.endsWith(".css"));
  const hits = files.flatMap((f) =>
    (
      readFileSync(join(dir, f), "utf8").match(
        /fonts\.(googleapis|gstatic)|https?:\/\/[^\s"')]*/g,
      ) ?? []
    ).map((h) => `${f}: ${h}`),
  );
  record(
    "D2 built CSS has no remote URL",
    files.length > 0 && hits.length === 0,
    files.length
      ? hits.join(", ") || `${String(files.length)} file(s) clean`
      : "no CSS in build/client",
  );
}

function checkNetwork(label: string, requests: string[]) {
  const origin = new URL(BASE).origin;
  const foreign = requests.filter(
    (u) =>
      !u.startsWith("data:") &&
      !u.startsWith("blob:") &&
      new URL(u).origin !== origin,
  );
  const fonts = requests.filter((u) => u.endsWith(".woff2"));
  record(
    `D2 ${label}: no request leaves ${origin}`,
    foreign.length === 0,
    `${String(requests.length)} requests, ${String(foreign.length)} external${foreign.length ? `: ${foreign.join(", ")}` : ""}; fonts: ${fonts.map((u) => new URL(u).pathname).join(", ") || "none"}`,
  );
}

/** Tabs through the page and checks the ring each focused element draws. */
async function checkFocus(page: Page, label: string) {
  const report = await page.evaluate(() => {
    const sel =
      'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
    const els = [...document.querySelectorAll<HTMLElement>(sel)].filter(
      (e) => e.getClientRects().length > 0 && !e.closest("[hidden]"),
    );
    return els.length;
  });
  const bad: string[] = [];
  let seen = 0;
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  for (let i = 0; i < report + 5 && i < 400; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // Hidden native inputs forward the ring to their visible control.
      const proxy = el.matches("input[type=radio],input[type=checkbox]")
        ? el
            .closest(".cx-slot, .cx-seg > label")
            ?.matches(".cx-slot, .cx-seg > label")
          ? el.closest<HTMLElement>(".cx-slot, .cx-seg > label")
          : el.closest(".cx-check")?.querySelector<HTMLElement>(".cx-box")
        : el.matches(".cx-search input")
          ? el.closest<HTMLElement>(".cx-search")
          : el;
      const t = proxy ?? el;
      const s = getComputedStyle(t);
      const r = t.getBoundingClientRect();
      return {
        id: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : ""} "${(el.textContent.trim() || (el.getAttribute("aria-label") ?? "")).slice(0, 30)}"`,
        style: s.outlineStyle,
        width: s.outlineWidth,
        color: s.outlineColor,
        offset: s.outlineOffset,
        visible: r.width > 0 && r.height > 0,
      };
    });
    if (!info) break;
    seen++;
    const ok =
      info.style === "solid" &&
      info.width === "2px" &&
      info.offset === "2px" &&
      info.color === "rgb(13, 15, 18)";
    if (!ok)
      bad.push(
        `${info.id} → ${info.style} ${info.width} ${info.color} offset ${info.offset}`,
      );
  }
  record(
    `D8 ${label}: focus ring on every Tab stop`,
    seen > 0 && bad.length === 0,
    `${String(seen)} stops checked${bad.length ? `; ${String(bad.length)} wrong: ${bad.slice(0, 6).join(" | ")}` : ", all 2px solid rgb(13,15,18) offset 2px"}`,
  );
}

async function checkTargets(page: Page, label: string) {
  const r = await page.evaluate(() => {
    // A link stretched over its card by an absolute ::after targets the card.
    const box = (e: Element) => {
      const after = getComputedStyle(e, "::after");
      if (
        getComputedStyle(e).position === "static" &&
        after.content !== "none" &&
        after.position === "absolute" &&
        after.inset === "0px"
      ) {
        for (let a = e.parentElement; a; a = a.parentElement)
          if (getComputedStyle(a).position !== "static")
            return a.getBoundingClientRect();
      }
      return e.getBoundingClientRect();
    };
    const visible = (e: Element) =>
      box(e).width > 0 &&
      e.getClientRects().length > 0 &&
      !e.closest("[hidden]");
    const primary = [...document.querySelectorAll(".cx-btn.primary")]
      .filter(visible)
      .map((e) => ({
        t: e.textContent.trim().slice(0, 30),
        w: box(e).width,
        h: box(e).height,
      }));
    const sel = "a[href],button,.cx-slot,.cx-seg > label,.cx-check,.cx-search";
    const small = [...document.querySelectorAll(sel)]
      .filter(visible)
      .filter((e) => !e.matches("input[type=radio],input[type=checkbox]"))
      .map((e) => ({
        t: `${e.tagName.toLowerCase()}.${e.className} "${e.textContent.trim().slice(0, 24)}"`,
        w: box(e).width,
        h: box(e).height,
      }))
      .filter((b) => b.w < 24 || b.h < 24);
    return { primary, small };
  });
  const lowP = r.primary.filter((b) => b.w < 44 || b.h < 44);
  record(
    `D8 ${label}: primary actions ≥ 44 × 44 px`,
    r.primary.length > 0 ? lowP.length === 0 : true,
    `${String(r.primary.length)} primary, smallest ${r.primary.length ? `${String(Math.min(...r.primary.map((b) => b.h)))} px tall` : "n/a"}${lowP.length ? `; too small: ${JSON.stringify(lowP)}` : ""}`,
  );
  record(
    `D8 ${label}: every target ≥ 24 × 24 px (WCAG 2.5.8)`,
    r.small.length === 0,
    r.small.length ? JSON.stringify(r.small.slice(0, 6)) : "none smaller",
  );
}

/** Measures text contrast in the rendered DOM: colour against the composited ground. */
async function checkDomContrast(page: Page, label: string) {
  const r = await page.evaluate(() => {
    const parse = (c: string): [number, number, number, number] | null => {
      const m =
        /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
      return m
        ? [
            Number(m[1]),
            Number(m[2]),
            Number(m[3]),
            m[4] === undefined ? 1 : Number(m[4]),
          ]
        : null;
    };
    const over = (t: number[], b: number[]) =>
      [0, 1, 2].map(
        (i) => (t[i] ?? 0) * (t[3] ?? 1) + (b[i] ?? 0) * (1 - (t[3] ?? 1)),
      );
    const lin = (c: number) =>
      (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const lum = (c: number[]) =>
      0.2126 * lin(c[0] ?? 0) +
      0.7152 * lin(c[1] ?? 0) +
      0.0722 * lin(c[2] ?? 0);
    const out: { text: string; ratio: number; floor: number }[] = [];
    let skipped = 0;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !(n.textContent ?? "").trim()) continue;
      seen.add(el);
      if (
        el.closest(
          "[aria-hidden=true],[hidden],svg,canvas,.cx-vh,script,style,code",
        ) ||
        el.getClientRects().length === 0
      )
        continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
      const fg = parse(s.color);
      if (!fg) continue;
      // Walk up, painting each background over the next, until an opaque one.
      const layers: number[][] = [];
      let ground: number[] | null = null;
      let gradient = false;
      for (let a: Element | null = el; a; a = a.parentElement) {
        const as = getComputedStyle(a);
        const bg = parse(as.backgroundColor);
        if (
          as.backgroundImage !== "none" &&
          !(bg && bg[3] > 0) &&
          !a.classList.contains("cx-canvas")
        ) {
          gradient = true;
          break;
        }
        if (bg && bg[3] > 0) {
          if (bg[3] >= 1) {
            ground = bg;
            break;
          }
          layers.push(bg);
        }
      }
      if (gradient) {
        skipped++;
        continue;
      }
      let g = ground ?? [255, 255, 255, 1];
      for (const l of layers.reverse()) g = [...over(l, g), 1];
      const f = fg[3] < 1 ? over(fg, g) : fg;
      const a = lum(f);
      const b = lum(g);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const px = parseFloat(s.fontSize);
      const bold = Number(s.fontWeight) >= 700;
      const large = px >= 24 || (bold && px >= 18.66);
      const disabled =
        el.closest(
          ":disabled,[aria-disabled=true]:not([aria-busy=true]),.cx-slot:has(input:disabled)",
        ) !== null;
      if (disabled) continue; // WCAG 1.4.3 exempts inactive controls
      out.push({
        text: (n.textContent ?? "").trim().slice(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        floor: large ? 3 : 4.5,
      });
    }
    return { out, skipped };
  });
  const fails = r.out.filter((m) => m.ratio < m.floor);
  const min = r.out.reduce((m, x) => Math.min(m, x.ratio), Infinity);
  record(
    `D7 ${label}: text contrast in the rendered DOM`,
    r.out.length > 0 && fails.length === 0,
    `${String(r.out.length)} text elements measured (lowest ${min.toFixed(2)}:1), ${String(r.skipped)} on gradients skipped, ${String(fails.length)} below floor${fails.length ? `: ${JSON.stringify(fails.slice(0, 8))}` : ""}`,
  );
}

async function checkAxe(page: Page, label: string) {
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            c: Document,
            o: object,
          ) => Promise<{
            violations: { id: string; impact: string; nodes: unknown[] }[];
            passes: unknown[];
          }>;
        };
      }
    ).axe;
    const r = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return {
      violations: r.violations.map(
        (x) => `${x.id} (${x.impact}, ${String(x.nodes.length)})`,
      ),
      passes: r.passes.length,
    };
  });
  record(
    `axe ${label}`,
    v.violations.length === 0,
    `${String(v.passes)} rules passed, ${String(v.violations.length)} violated${v.violations.length ? `: ${v.violations.join(", ")}` : ""}`,
  );
}

/** Two screenshots of each canvas 700 ms apart: equal when still, different when moving. */
async function canvasesMoving(page: Page) {
  const shots = async () => {
    const out: string[] = [];
    for (const c of await page.$$("canvas")) {
      await c.scrollIntoViewIfNeeded();
      out.push((await c.screenshot()).toString("base64"));
    }
    return out;
  };
  const a = await shots();
  await page.waitForTimeout(700);
  const b = await shots();
  return a.map((x, i) => x !== b[i]);
}

async function checkMotion(browser: Browser) {
  for (const reduced of [false, true]) {
    const { ctx, page } = await open(
      browser,
      PAGES.components,
      VIEWPORTS.desktop,
      reduced,
    );
    const css = await page.evaluate(() => {
      const arc = document.querySelector(".cx-spin .arc");
      const sk = document.querySelector(".cx-sk");
      return {
        spin: arc ? getComputedStyle(arc).animationName : "missing",
        shimmer: sk ? getComputedStyle(sk, "::after").animationName : "missing",
      };
    });
    const moving = await canvasesMoving(page);
    await ctx.close();
    const nf = await open(browser, PAGES.notFound, VIEWPORTS.desktop, reduced);
    const lens = await canvasesMoving(nf.page);
    await nf.ctx.close();
    const all = [...moving, ...lens];
    if (reduced)
      record(
        "D9 reduced motion: spinner, shimmer, lens and ripple are still",
        css.spin === "none" && css.shimmer === "none" && all.every((m) => !m),
        `spinner ${css.spin}, shimmer ${css.shimmer}, ${String(all.filter(Boolean).length)} of ${String(all.length)} canvases changed`,
      );
    else
      record(
        "D9 with motion: the same pieces move",
        css.spin !== "none" && css.shimmer !== "none" && lens.every(Boolean),
        `spinner ${css.spin}, shimmer ${css.shimmer}, ${String(all.filter(Boolean).length)} of ${String(all.length)} canvases changed (each still twin and the forced stills stay fixed)`,
      );
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  checkBuiltCss();
  const browser = await chromium.launch();
  try {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      for (const [name, path] of Object.entries(PAGES)) {
        const { ctx, page, requests, status } = await open(
          browser,
          path,
          vp,
          false,
        );
        if (name === "notFound")
          record(
            `404 ${vpName}: unknown path answers 404`,
            status === 404,
            `status ${String(status)}`,
          );
        else
          record(
            `/_dev/components ${vpName}: answers 200 locally`,
            status === 200,
            `status ${String(status)}`,
          );
        checkNetwork(`${name} ${vpName}`, requests);
        await checkTargets(page, `${name} ${vpName}`);
        await checkDomContrast(page, `${name} ${vpName}`);
        if (vpName === "desktop") {
          await checkFocus(page, name);
          await checkAxe(page, name);
        }
        await ctx.close();
        for (const reduced of [false, true]) {
          const s = await open(browser, path, vp, reduced);
          await s.page.screenshot({
            path: join(
              OUT,
              `${name}-${vpName}-${reduced ? "still" : "motion"}.png`,
            ),
            fullPage: name === "components",
          });
          await s.ctx.close();
        }
      }
    }
    await checkMotion(browser);
  } finally {
    await browser.close();
  }
  writeFileSync(
    join(OUT, "audit.json"),
    JSON.stringify(
      { base: BASE, at: new Date().toISOString(), results },
      null,
      2,
    ),
  );
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `\nbrowser audit: ${String(results.length)} checks, ${String(failed)} failed. Screenshots and audit.json in ${OUT}`,
  );
  process.exitCode = failed ? 1 : 0;
}

await main();
