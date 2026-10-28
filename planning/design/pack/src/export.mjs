// Static exports of the pack: PNG per section and a PDF of the whole pack.
// Uses a local headless Chrome or Edge; opens only the local index.html.
//
//   node planning/design/pack/src/export.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pack = join(here, '..');
const out = join(pack, 'exports');
const url = pathToFileURL(join(pack, 'index.html')).href;

// [file, selector, viewport width, device scale]
const shots = [
  ['01-summary.png', '#summary', 1440, 1],
  ['02-brand.png', '#brand', 1440, 1],
  ['03-1-home.png', '#s-home', 1440, 1],
  ['03-2-search.png', '#s-search', 1440, 1],
  ['03-3-listing.png', '#s-listing', 1440, 1],
  ['03-4-booking-quote.png', '#s-quote', 1440, 1],
  ['03-5-checkout.png', '#s-checkout', 1440, 1],
  ['03-6-business-dashboard.png', '#s-dashboard', 1440, 1],
  ['03-7-business-application.png', '#s-apply', 1440, 1],
  ['03-8-fines.png', '#s-fines', 1440, 1],
  ['04-desktop-home.png', '#d-home', 1440, 1.5],
  ['04-desktop-search.png', '#d-search', 1440, 1.5],
  ['05-journey-thandi.png', '#j-thandi', 1440, 1],
  ['05-journey-pieter.png', '#j-pieter', 1440, 1],
  ['06-roadmap-decisions.png', '#roadmap', 1440, 1],
  ['07-phone-home-360.png', '#s-home figure.phone', 360, 2],
];

const b = await openBrowser();
// Play the hero to its resting frame (8 s) so the brand page and PDF show the logo.
const playHero = async () => {
  await b.evalJs(`(function(){var f=document.getElementById('hero');f.srcdoc=f.getAttribute('data-srcdoc');return true})()`);
  await sleep(9000);
};

mkdirSync(out, { recursive: true });
let current = '';
for (const [file, sel, width, scale] of shots) {
  if (current !== `${width}@${scale}`) {
    await b.load(url, width, scale);
    current = `${width}@${scale}`;
    if (width === 1440 && scale === 1) await playHero();
  }
  const box = await b.evalJs(`(function(){var r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`);
  const pad = /^#[sdj]-/.test(sel) ? 24 : 0;
  const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(width, box.w + 2 * pad), height: box.h + 2 * pad, scale: 1 };
  const { data } = await b.S('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  writeFileSync(join(out, file), Buffer.from(data, 'base64'));
  console.log(`${file} ${Math.round(clip.width * scale)}×${Math.round(clip.height * scale)}`);
}

// Whole pack as an A4 PDF (print styles hide the nav; each part starts a new page).
await b.load(url, 1440, 1);
await playHero();
const pdf = await b.S('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.35, marginBottom: 0.35, marginLeft: 0.35, marginRight: 0.35 });
writeFileSync(join(out, 'CarworX-presentation-pack.pdf'), Buffer.from(pdf.data, 'base64'));
console.log('CarworX-presentation-pack.pdf');
await b.close();
