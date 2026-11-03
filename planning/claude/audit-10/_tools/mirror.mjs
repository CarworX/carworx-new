// Route M (Claude 09 §4.4, F6's resolver): render a design-system component preview from the repo mirror.
// Each /_blob/<id> is rewritten to its brand/exports/ file, using design-system.json assetGroups.
// The output is labelled MIRROR, NOT LIVE: it shows the repo copy, not the signed-in design system.
//
//   node mirror.mjs <exportRoot> <Comp|all> <outDir>     (card width/height from the @dsCard comment; default width 720)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [root, comp, outDir] = process.argv.slice(2);
const brand = join(root, 'planning/design/brand');
const { openBrowser, sleep } = await import(pathToFileURL(join(root, 'planning/design/pack/src/cdp.mjs')).href);
const ds = JSON.parse(readFileSync(join(brand, 'design-system.json'), 'utf8'));

const files = {}; // blob id -> file name
for (const g of Object.values(ds.assetGroups || {})) for (const [name, f] of Object.entries(g.files || {})) if (f && f.blob) files[f.blob] = name;
const byName = {};
(function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? walk(p) : (byName[e.name] ??= p); } })(join(brand, 'exports'));

const compsDir = join(brand, 'studio/components');
const comps = comp === 'all' ? readdirSync(compsDir).filter((c) => existsSync(join(compsDir, c, 'preview.html'))) : [comp];
const css = ['studio/tokens.css', 'studio/components/bundle.css'].map((p) => pathToFileURL(join(brand, p)).href);
mkdirSync(outDir, { recursive: true });

const b = await openBrowser();
const log = [];
for (const c of comps) {
  let html = readFileSync(join(compsDir, c, 'preview.html'), 'utf8');
  const meta = html.match(/@dsCard([^>]*)-->/)?.[1] || '';
  const width = +(meta.match(/width=(\d+)/)?.[1] || 720), height = +(meta.match(/height=(\d+)/)?.[1] || 400);
  const missing = [];
  html = html.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => { const f = byName[files[id]]; if (!f) { missing.push(id); return m; } return pathToFileURL(f).href; });
  const page = `<!doctype html><meta charset="utf-8">${css.map((h) => `<link rel="stylesheet" href="${h}">`).join('')}<style>html,body{margin:0}</style>${html}`;
  const tmp = join(outDir, `_${c}.html`); writeFileSync(tmp, page);
  await b.load(pathToFileURL(tmp).href, width, 1);
  await b.S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(1500);
  const { data } = await b.S('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 }, captureBeyondViewport: true });
  writeFileSync(join(outDir, `${c}-mirror.png`), Buffer.from(data, 'base64'));
  log.push({ comp: c, width, height, blobs: (html.match(/file:\/\//g) || []).length, unresolved: missing });
}
await b.close();
console.log(JSON.stringify(log, null, 1));
