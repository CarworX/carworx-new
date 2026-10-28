// Builds planning/design/pack/index.html from src/pack.html.
// Inlines the locked Turbine brand files (unchanged geometry), the Sora font and the hero motion,
// so the pack opens offline from a single file. Planning artefact, not application code.
//
//   node planning/design/pack/src/build.mjs
//
// Placeholders in pack.html:
//   {{font}}               Sora SemiBold as a base64 @font-face src
//   {{symbols}}            hidden <svg> with brand symbols (currentColor) and UI icons
//   {{logo:NAME}}          <svg><use href="#cx-NAME"></svg>  NAME = lockup | mark | marksm | word
//   {{icon:NAME}}          inline UI icon
//   {{img:PATH}}           data: URI of a brand export (PATH relative to brand/exports)
//   {{srcdoc:PATH}}        attribute-escaped HTML of a brand export, for <iframe srcdoc>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pack = join(here, '..');
const brand = join(pack, '..', 'brand');
const exp = (p) => join(brand, 'exports', p);

// Brand symbols: the white exports with their single fill swapped for currentColor. Paths untouched.
const brandSymbols = {
  lockup: 'core/carworx-lockup-horizontal-white.svg',
  mark: 'core/carworx-mark-white.svg',
  marksm: 'core/carworx-mark-small-white.svg',
  word: 'core/carworx-wordmark-white.svg',
};
const viewBoxes = {};
function toSymbol(id, file) {
  const svg = readFileSync(exp(file), 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1];
  viewBoxes[id] = vb;
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replaceAll('fill="#ffffff"', 'fill="currentColor"');
  return `<symbol id="cx-${id}" viewBox="${vb}">${inner}</symbol>`;
}

// UI icons (concept). 24-unit grid, 1.8 stroke.
const icons = {
  wash: '<path d="M12 3c3 4 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 9 7 12 3z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>',
  repair: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.3-.5-.5-2.3z"/>',
  glass: '<path d="M3 8c6-3 12-3 18 0l-2 9H5z"/><path d="M12 8.2l-1.2 3 2.2 1.2-1.2 3"/>',
  tyre: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v5.3M12 15.2v5.3M3.5 12h5.3M15.2 12h5.3"/>',
  fines: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h6M9.5 15.5h6"/>',
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
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  refresh: '<path d="M19 8a7.5 7.5 0 1 0 1 6"/><path d="M19.5 3.5V8H15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
};
const iconSymbols = Object.entries(icons)
  .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v}</g></symbol>`)
  .join('');

const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ttf': 'font/ttf' };
const dataUri = (abs) => `data:${mime[extname(abs)]};base64,${readFileSync(abs).toString('base64')}`;
const attr = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

const symbols = Object.entries(brandSymbols).map(([id, f]) => toSymbol(id, f)).join('');
let html = readFileSync(join(here, 'pack.html'), 'utf8');
const used = new Set();
html = html
  .replace('{{font}}', () => dataUri(join(brand, 'motion', 'fonts', 'Sora-SemiBold.ttf')))
  .replace('{{symbols}}', () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${symbols}${iconSymbols}</svg>`)
  .replace(/\{\{logo:(\w+)\}\}/g, (_, id) => `<svg class="cx cx-${id}" viewBox="${viewBoxes[id]}" aria-hidden="true" focusable="false"><use href="#cx-${id}"/></svg>`)
  .replace(/\{\{icon:(\w+)\}\}/g, (_, id) => {
    if (!icons[id]) throw new Error(`unknown icon ${id}`);
    return `<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;
  })
  .replace(/\{\{img:([^}]+)\}\}/g, (_, p) => { used.add(p); return dataUri(exp(p)); })
  .replace(/\{\{srcdoc:([^}]+)\}\}/g, (_, p) => { used.add(p); return attr(readFileSync(exp(p), 'utf8')); });

const left = html.match(/\{\{[^}]*\}\}/g);
if (left) throw new Error(`unresolved placeholders: ${left.join(', ')}`);
if (/(src|href)="https?:/i.test(html)) throw new Error('network reference found');
writeFileSync(join(pack, 'index.html'), html);
console.log(`index.html ${(html.length / 1024).toFixed(0)} KB; brand files inlined: ${[...Object.values(brandSymbols), ...used].join(', ')}`);
