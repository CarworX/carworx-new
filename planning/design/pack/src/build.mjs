// Builds planning/design/pack/index.html from src/pack.html and src/parts/*.html.
// Inlines the locked Turbine brand files (unchanged geometry), the Studio fonts (OFL, vendored in src/vendor/fonts)
// and the hero motion, so the pack opens offline from a single file. Planning artefact, not application code.
//
//   node planning/design/pack/src/build.mjs
//
// Placeholders:
//   {{part:NAME}}          contents of src/parts/NAME.html (expanded first)
//   {{font:FILE}}          data: URI of src/vendor/fonts/FILE (woff2)
//   {{symbols}}            hidden <svg> with brand symbols (currentColor), intro geometry, UI icons
//   {{logo:NAME}}          <svg><use href="#cx-NAME"></svg>  NAME = lockup | mark | marksm | word
//   {{icon:NAME}}          inline UI icon
//   {{obj:NAME}}           a soft-3D service object (symbols defined in parts/objects.html)
//   {{ill:NAME}}           a hand-drawn line illustration (symbols defined in parts/objects.html)
//   {{img:PATH}}           data: URI of a brand export (PATH relative to brand/exports)
//   {{srcdoc:PATH}}        attribute-escaped HTML of a brand export, for <iframe srcdoc>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pack = join(here, '..');
const brand = join(pack, '..', 'brand');
const exp = (p) => join(brand, 'exports', p);
const read = (p) => readFileSync(p, 'utf8');

// Brand symbols: the white exports with their single fill swapped for currentColor. Paths untouched.
const brandSymbols = {
  lockup: 'core/carworx-lockup-horizontal-white.svg',
  mark: 'core/carworx-mark-white.svg',
  marksm: 'core/carworx-mark-small-white.svg',
  word: 'core/carworx-wordmark-white.svg',
};
const viewBoxes = {};
function toSymbol(id, file) {
  const svg = read(exp(file));
  const vb = svg.match(/viewBox="([^"]+)"/)[1];
  viewBoxes[id] = vb;
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replaceAll('fill="#ffffff"', 'fill="currentColor"');
  return `<symbol id="cx-${id}" viewBox="${vb}">${inner}</symbol>`;
}

// Intro geometry, taken from the same exports: one blade (used 5× at 72°) and the seven wordmark glyphs.
// The intro animates only between the two official arrangements, so their transforms are checked here.
const markSvg = read(exp('core/carworx-mark-white.svg'));
const blade = markSvg.match(/<path transform="rotate\(0\)" d="([^"]+)"/)[1];
const glyphs = [...read(exp('core/carworx-wordmark-white.svg')).matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
if (glyphs.length !== 7) throw new Error('expected 7 wordmark glyphs');
const hz = read(exp('core/carworx-lockup-horizontal-white.svg'));
const st = read(exp('core/carworx-lockup-stacked-white.svg'));
for (const [svg, t] of [[hz, 'translate(92,92) scale(0.92) rotate(21.9494)'], [hz, 'translate(246,142) scale(1)'], [st, 'translate(303.18,160) scale(1.6) rotate(21.9494)'], [st, 'translate(0,480) scale(1)']]) {
  if (!svg.includes(t)) throw new Error(`lockup transform changed: ${t}`);
}
if (!hz.includes(blade) || glyphs.some((g) => !hz.includes(g))) throw new Error('lockup geometry does not match mark/wordmark');
const introSymbols = `<path id="cx-blade" d="${blade}"/>`
  + `<g id="cx-rotor">${[0, 72, 144, 216, 288].map((a) => `<use href="#cx-blade" transform="rotate(${a})"/>`).join('')}</g>`
  + glyphs.map((d, i) => `<path id="cx-g${i}" d="${d}"/>`).join('');

// UI icons (concept). 24-unit grid, 1.8 stroke.
const icons = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.3"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.3"/>',
  home: '<path d="M4 11l8-6.5 8 6.5v9H4z"/><path d="M10 20v-5h4v5"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-4 4.2-5.8 7.5-5.8s6.3 1.8 7.5 5.8"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  car: '<path d="M4 16v-3l2-5h12l2 5v3z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  bay: '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/>',
  doc: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  star: '<path fill="currentColor" stroke="none" d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  refresh: '<path d="M19 8a7.5 7.5 0 1 0 1 6"/><path d="M19.5 3.5V8H15"/>',
  camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
};
const iconSymbols = Object.entries(icons)
  .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v}</g></symbol>`)
  .join('');

const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const dataUri = (abs) => `data:${mime[extname(abs)]};base64,${readFileSync(abs).toString('base64')}`;
const attr = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

let html = read(join(here, 'pack.html'));
for (let i = 0; i < 3; i++) html = html.replace(/\{\{part:([\w-]+)\}\}/g, (_, n) => read(join(here, 'parts', `${n}.html`)));

const objectIds = new Set([...html.matchAll(/<symbol id="o-([\w-]+)"/g)].map((m) => m[1]));
const illIds = new Set([...html.matchAll(/<symbol id="il-([\w-]+)"/g)].map((m) => m[1]));
const symbols = Object.entries(brandSymbols).map(([id, f]) => toSymbol(id, f)).join('');
const used = new Set();
html = html
  .replace(/\{\{font:([\w.-]+)\}\}/g, (_, f) => { const p = join(here, 'vendor', 'fonts', f); if (!existsSync(p)) throw new Error(`missing font ${f}`); return dataUri(p); })
  .replace('{{symbols}}', () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${introSymbols}</defs>${symbols}${iconSymbols}</svg>`)
  .replace(/\{\{logo:(\w+)\}\}/g, (_, id) => `<svg class="cx cx-${id}" viewBox="${viewBoxes[id]}" aria-hidden="true" focusable="false"><use href="#cx-${id}"/></svg>`)
  .replace(/\{\{icon:(\w+)\}\}/g, (_, id) => {
    if (!icons[id]) throw new Error(`unknown icon ${id}`);
    return `<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;
  })
  .replace(/\{\{obj:([\w-]+)\}\}/g, (_, id) => {
    if (!objectIds.has(id)) throw new Error(`unknown object ${id}`);
    return `<svg class="ko" viewBox="0 0 80 80" aria-hidden="true" focusable="false"><use href="#o-${id}"/></svg>`;
  })
  .replace(/\{\{ill:([\w-]+)\}\}/g, (_, id) => {
    if (!illIds.has(id)) throw new Error(`unknown illustration ${id}`);
    return `<svg class="ill" viewBox="0 0 120 84" aria-hidden="true" focusable="false"><use href="#il-${id}"/></svg>`;
  })
  .replace(/\{\{img:([^}]+)\}\}/g, (_, p) => { used.add(p); return dataUri(exp(p)); })
  .replace(/\{\{srcdoc:([^}]+)\}\}/g, (_, p) => { used.add(p); return attr(read(exp(p))); });

const left = html.match(/\{\{[^}]*\}\}/g);
if (left) throw new Error(`unresolved placeholders: ${left.join(', ')}`);
if (/(src|href)="https?:/i.test(html)) throw new Error('network reference found');
if (/@import|url\(["']?https?:/i.test(html)) throw new Error('network reference in CSS');
writeFileSync(join(pack, 'index.html'), html);
console.log(`index.html ${(html.length / 1024).toFixed(0)} KB; brand files inlined: ${[...Object.values(brandSymbols), 'core/carworx-lockup-stacked-white.svg', ...used].join(', ')}`);
