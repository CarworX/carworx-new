// States concepts: builds index.html from src/template.html.
// It injects the real Turbine paths from brand/exports/core (never redrawn) and the Studio service objects
// from concepts/studio/index.html, and checks every path and transform before writing.
// Usage: node build.mjs
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { restAngle } from '../../brand/motion/shape.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const core = join(here, '../../brand/exports/core');
const read = (f) => readFileSync(join(core, f), 'utf8');
const fail = (m) => { console.error('build: ' + m); process.exit(1); };
const paths = (svg) => [...svg.matchAll(/<path([^>]*?) d="([^"]+)"/g)].map((m) => ({ attrs: m[1], d: m[2] }));
const groups = (svg) => [...svg.matchAll(/<g transform="([^"]+)"/g)].map((m) => m[1]);

// Mark, full and small: one blade drawn five times at 72°.
function mark(file) {
  const svg = read(file), ps = paths(svg);
  if (ps.length !== 5) fail(`${file}: expected 5 blades`);
  ps.forEach((p, i) => {
    if (p.d !== ps[0].d) fail(`${file}: blades differ`);
    if (!p.attrs.includes(`rotate(${i * 72})`)) fail(`${file}: blade ${i} is not at ${i * 72}°`);
  });
  return { d: ps[0].d, g: groups(svg)[0] };
}
const full = mark('carworx-mark-ink.svg'), small = mark('carworx-mark-small-ink.svg');
const REST = +restAngle('full').toFixed(4), REST_S = +restAngle('small').toFixed(4);
if (full.g !== `translate(100,100) scale(1) rotate(${REST})`) fail('full mark rest angle mismatch: ' + full.g);
if (small.g !== `translate(100,100) scale(1) rotate(${REST_S})`) fail('small mark rest angle mismatch: ' + small.g);

// Wordmark: seven outlined glyphs, identical in the wordmark and both lockups.
const word = paths(read('carworx-wordmark-ink.svg')).map((p) => p.d);
if (word.length !== 7) fail('wordmark: expected 7 glyphs');
const lockups = {};
for (const kind of ['horizontal', 'stacked']) {
  const svg = read(`carworx-lockup-${kind}-ink.svg`), ps = paths(svg), g = groups(svg);
  if (ps.slice(0, 5).some((p) => p.d !== full.d)) fail(`${kind} lockup: blade differs from the mark`);
  if (ps.slice(5).map((p) => p.d).join() !== word.join()) fail(`${kind} lockup: glyphs differ from the wordmark`);
  lockups[kind] = { vb: svg.match(/viewBox="([^"]+)"/)[1], mark: g[0], word: g[1] };
}
const H = lockups.horizontal, S = lockups.stacked;
if (H.mark !== `translate(92,92) scale(0.92) rotate(${REST})` || H.word !== 'translate(246,142) scale(1)') fail('horizontal lockup transforms changed');
if (S.mark !== `translate(303.18,160) scale(1.6) rotate(${REST})` || S.word !== 'translate(0,480) scale(1)') fail('stacked lockup transforms changed');

const blades = (id) => [0, 72, 144, 216, 288].map((a) => `<use href="#${id}"${a ? ` transform="rotate(${a})"` : ''}/>`).join('');
let sprite = `<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0"><defs>` +
  `<path id="cx-blade" d="${full.d}"/><path id="cx-blade-s" d="${small.d}"/>` +
  `<g id="cx-mark">${blades('cx-blade')}</g><g id="cx-mark-s">${blades('cx-blade-s')}</g>` +
  `<g id="cx-word">${word.map((d) => `<path d="${d}"/>`).join('')}</g>`;

// Studio service objects and the key fob, lifted from the approved Studio page, ids prefixed.
const studio = readFileSync(join(here, '../studio/index.html'), 'utf8');
const prefix = (s) => s.replace(/id="([\w-]+)"/g, 'id="o-$1"').replace(/url\(#([\w-]+)\)/g, 'url(#o-$1)')
  .replace(/<rect class="glint"[^>]*\/>/g, '').replace(/ class="ko-\w+"/g, '');
for (const k of ['wash', 'repairs', 'glass', 'tyres', 'fines']) {
  const m = studio.match(new RegExp(`<li class="key" data-k="${k}">[\\s\\S]*?<svg viewBox="0 0 80 80">([\\s\\S]*?)</svg>`));
  if (!m) fail('studio object missing: ' + k);
  sprite += `<symbol id="ob-${k}" viewBox="0 0 80 80">${prefix(m[1]).trim()}</symbol>`;
}
const fob = studio.match(/<div class="obj o-fob"[\s\S]*?<svg viewBox="0 0 140 230"[^>]*>([\s\S]*?)<\/svg>/);
if (!fob) fail('studio key fob missing');
sprite += `<symbol id="ob-fob" viewBox="0 0 140 230">${prefix(fob[1]).trim()}</symbol>`;
sprite += `</defs></svg>`;

const lockupH = `<svg viewBox="${H.vb}" role="img" aria-label="CarworX"><g fill="currentColor"><g transform="${H.mark}"><use href="#cx-mark"/></g><g transform="${H.word}"><use href="#cx-word"/></g></g></svg>`;

let html = readFileSync(join(here, 'src/template.html'), 'utf8');
const swap = (key, val) => { if (!html.includes(key)) fail('placeholder missing: ' + key); html = html.split(key).join(val); };
swap('<!--SPRITE-->', sprite);
swap('<!--LOCKUP-H-->', lockupH);
swap('__REST__', String(REST));
swap('__REST_S__', String(REST_S));
writeFileSync(join(here, 'index.html'), html);
console.log(`index.html written, ${(statSync(join(here, 'index.html')).size / 1024).toFixed(1)} KB. Rest angles ${REST}° / ${REST_S}°, lockups verified.`);
