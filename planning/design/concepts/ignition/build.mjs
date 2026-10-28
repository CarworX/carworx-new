// Ignition concept: inlines the locked brand artwork and the Turbine geometry into one self-contained index.html.
// Run from anywhere: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const brand = new URL('../../brand/', here);
const read = (u) => readFileSync(u, 'utf8');
const core = (f) => read(new URL(`exports/core/${f}`, brand));

// shape.mjs is pure geometry; drop the ES-module exports so it runs as a classic script.
const shape = read(new URL('motion/shape.mjs', brand)).replace(/^export /gm, '');

// Artwork is used as exported. Only the outer <svg> gets a class and loses its fixed size;
// the lockup's two groups get classes so the intro can hand the wordmark over to the nav.
const svg = (src, cls) => src
  .replace(/<title>.*?<\/title>/, '')
  .replace(/<svg ([^>]*?) width="[^"]+" height="[^"]+"/, `<svg class="${cls}" $1`);
const lockup = (cls) => svg(core('carworx-lockup-horizontal-white.svg'), cls)
  .replace('<g transform="translate(92,92)', '<g class="lk-mark" transform="translate(92,92)')
  .replace('<g transform="translate(246,142)', '<g class="lk-word" transform="translate(246,142)');

const parts = {
  '/*@@SHAPE@@*/': shape,
  '<!--@@WORDMARK@@-->': svg(core('carworx-wordmark-white.svg'), 'iword-svg'),
  '<!--@@LOCKUP_NAV@@-->': lockup('lockup lockup-nav'),
  '<!--@@LOCKUP_FOOT@@-->': lockup('lockup lockup-foot'),
  '<!--@@MARK@@-->': svg(core('carworx-mark-white.svg'), 'mark-still'),
};

let html = read(new URL('src/page.html', here));
for (const [k, v] of Object.entries(parts)) {
  if (!html.includes(k)) throw new Error(`placeholder missing: ${k}`);
  html = html.split(k).join(v);
}
writeFileSync(new URL('index.html', here), html);
console.log(`index.html ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
