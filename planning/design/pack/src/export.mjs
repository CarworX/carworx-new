// Static exports of the pack: a PNG per section and screen group at 1440 px, each phone screen at 390 px (2×),
// intro stills, and an A4 PDF. Uses a local headless Chrome or Edge; opens only the local index.html.
// Exports render with the motion classes removed, so every reveal and scroll-linked element shows its settled still.
//
//   node planning/design/pack/src/export.mjs
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pack = join(here, '..');
const out = join(pack, 'exports');
const url = pathToFileURL(join(pack, 'index.html')).href;

// [file, selector, viewport width, device scale]
const shots = [
  ['01-cover.png', '#cover', 1440, 1],
  ['02-summary.png', '#summary', 1440, 1],
  ['03-brand.png', '#brand', 1440, 1],
  ['04-1-home.png', '#s-home', 1440, 1],
  ['04-2-search.png', '#s-search', 1440, 1],
  ['04-3-listing.png', '#s-listing', 1440, 1],
  ['04-4-booking-quote.png', '#s-quote', 1440, 1],
  ['04-5-checkout.png', '#s-checkout', 1440, 1],
  ['04-6-business-dashboard.png', '#s-dashboard', 1440, 1],
  ['04-7-business-application.png', '#s-apply', 1440, 1],
  ['04-8-fines.png', '#s-fines', 1440, 1],
  ['05-desktop-home.png', '#d-home', 1440, 1.5],
  ['05-desktop-search.png', '#d-search', 1440, 1.5],
  ['06-journey-thandi.png', '#j-thandi', 1440, 1],
  ['06-journey-pieter.png', '#j-pieter', 1440, 1],
  ['07-roadmap-decisions.png', '#roadmap', 1440, 1],
  ['08-footer.png', 'footer', 1440, 1],
  ['09-phone-1-home-390.png', '#s-home figure.phone', 390, 2],
  ['09-phone-2-search-390.png', '#s-search figure.phone', 390, 2],
  ['09-phone-3-listing-390.png', '#s-listing figure.phone', 390, 2],
  ['09-phone-4-quote-390.png', '#s-quote figure.phone', 390, 2],
  ['09-phone-5-checkout-390.png', '#s-checkout figure.phone', 390, 2],
  ['09-phone-6-dashboard-390.png', '#s-dashboard figure.phone', 390, 2],
  ['09-phone-7-application-390.png', '#s-apply figure.phone', 390, 2],
  ['09-phone-8-fines-390.png', '#s-fines figure.phone', 390, 2],
];

const b = await openBrowser();
const settle = async () => {
  await b.evalJs(`(function(){document.documentElement.classList.remove('motion');document.querySelectorAll('[data-reveal]').forEach(function(e){e.classList.add('in')});var f=document.getElementById('hero');if(f&&!f.srcdoc)f.srcdoc=f.getAttribute('data-srcdoc');return true})()`);
};
// The logo film plays to its resting frame (8 s) so the brand page and PDF show the logo.
const playHero = async () => { await settle(); await sleep(9000); };

mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(join(out, f));

// Intro stills: the settled full-scale lockup on desktop and phone.
for (const [file, w, scale] of [['00-intro-1440.png', 1440, 1], ['00-intro-390.png', 390, 2]]) {
  await b.load(url + '#intro=2.85', w, scale);
  await sleep(600);
  const { data } = await b.S('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, file), Buffer.from(data, 'base64'));
  console.log(file);
}

let current = '';
for (const [file, sel, width, scale] of shots) {
  if (current !== `${width}@${scale}`) {
    await b.load(url + '#skip', width, scale);
    current = `${width}@${scale}`;
    if (width === 1440 && scale === 1) await playHero(); else { await settle(); await sleep(500); }
  }
  const box = await b.evalJs(`(function(){var r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`);
  const pad = /phone|#d-/.test(sel) ? 16 : 0;
  const full = /^#(cover|summary|brand|roadmap|j-)|^footer|^#s-/.test(sel);
  const clip = full
    ? { x: 0, y: Math.max(0, box.y - 24), width, height: box.h + 48, scale: 1 }
    : { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(width, box.w + 2 * pad), height: box.h + 2 * pad, scale: 1 };
  const { data } = await b.S('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  writeFileSync(join(out, file), Buffer.from(data, 'base64'));
  console.log(`${file} ${Math.round(clip.width * scale)}×${Math.round(clip.height * scale)}`);
}

// Whole pack as an A4 PDF. Print styles hide the intro and nav, start each part on a new page,
// and show the scroll-linked journeys as their step lists.
await b.load(url + '#skip', 1440, 1);
await playHero();
const pdf = await b.S('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.35, marginBottom: 0.35, marginLeft: 0.35, marginRight: 0.35 });
writeFileSync(join(out, 'CarworX-presentation-pack.pdf'), Buffer.from(pdf.data, 'base64'));
console.log('CarworX-presentation-pack.pdf');
await b.close();
