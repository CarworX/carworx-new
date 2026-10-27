// Still-asset matrix: every logo file, by where it is used, from the shared geometry.
// Run: node export.mjs   → ../exports/<use>/...
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { COLOR, rotorSVG, wordmarkSVG, lockup, layout, wordmark, streamline, restAngle, MARK, X_ANGLE, PITCH } from './geometry.mjs';
import { scene } from './timeline.mjs';
import { renderFrame, FFMPEG } from './render.mjs';

const ROOT = '../exports';
const DIRS = ['core', 'web-app', 'social', 'business', 'vehicle', 'guidelines'];
for (const d of DIRS) { rmSync(`${ROOT}/${d}`, { recursive: true, force: true }); mkdirSync(`${ROOT}/${d}`, { recursive: true }); }
const files = [];

const doc = (w, h, body, title = 'CarworX', extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${+w.toFixed(2)}" height="${+h.toFixed(2)}" viewBox="0 0 ${+w.toFixed(2)} ${+h.toFixed(2)}"${extra} role="img" aria-label="CarworX"><title>${title}</title>${body}</svg>`;
const NOFONTS = { font: { loadSystemFonts: false } };
const png = (svg, width) => new Resvg(svg, { ...NOFONTS, fitTo: { mode: 'width', value: width } }).render().asPng();
function save(path, data, note = '') {
  writeFileSync(`${ROOT}/${path}`, data);
  files.push({ path, note });
}
const svgAndPng = (base, svg, widths, note) => {
  save(`${base}.svg`, svg, note);
  for (const [w, suffix] of widths) save(`${base}${suffix}.png`, png(svg, w), note);
};

const WAYS = { ink: COLOR.ink, white: COLOR.white, black: COLOR.black };

// ---------- core ----------
for (const [way, c] of Object.entries(WAYS)) {
  svgAndPng(`core/carworx-mark-${way}`, doc(200, 200, rotorSVG({ cx: 100, cy: 100, radius: 100, fill: c })), [[1024, '']], 'Mark, full detail (48 px and up)');
  svgAndPng(`core/carworx-mark-small-${way}`, doc(200, 200, rotorSVG({ cx: 100, cy: 100, radius: 100, fill: c, variant: 'small' })), [[256, '']], 'Mark, small optical size (16–47 px)');
  for (const kind of ['horizontal', 'stacked']) {
    const L = lockup(kind, { H: 100, mark: c, word: c });
    svgAndPng(`core/carworx-lockup-${kind}-${way}`, doc(L.w, L.h, L.svg), [[kind === 'horizontal' ? 2400 : 1600, '']], `${kind} lockup, transparent`);
  }
  const W = wordmark().width;
  svgAndPng(`core/carworx-wordmark-${way}`, doc(W, 100, wordmarkSVG({ x: 0, y: 100, cap: 100, fill: c })), [[2000, '']], 'Wordmark only');
}
// Lockups on their grounds, with clear space (= cap height) built in.
for (const [ground, fg] of [[COLOR.ink, COLOR.white], [COLOR.paper, COLOR.ink]]) {
  const name = ground === COLOR.ink ? 'on-ink' : 'on-paper';
  for (const kind of ['horizontal', 'stacked']) {
    const L = lockup(kind, { H: 100, mark: fg, word: fg });
    const w = L.w + 200, h = L.h + 200;
    svgAndPng(`core/carworx-lockup-${kind}-${name}`, doc(w, h, `<rect width="${w}" height="${h}" fill="${ground}"/><g transform="translate(100,100)">${L.svg}</g>`), [[kind === 'horizontal' ? 2400 : 1600, '']], `${kind} lockup on ${name.slice(3)} with clear space`);
  }
}

// ---------- web & app icons ----------
// Icon tile: ink ground, white mark. `scale` is mark diameter as a fraction of the tile.
const tile = (S, { scale = 0.62, radius = 0, variant = 'full', ground = COLOR.ink, mark = COLOR.white, transparent = false } = {}) =>
  doc(S, S, (transparent ? '' : `<rect width="${S}" height="${S}" rx="${radius * S}" fill="${ground}"/>`) +
    rotorSVG({ cx: S / 2, cy: S / 2, radius: (scale * S) / 2, fill: mark, variant }));

save('web-app/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.m{fill:${COLOR.ink}}@media (prefers-color-scheme:dark){.m{fill:${COLOR.white}}}</style>` +
  rotorSVG({ cx: 16, cy: 16, radius: 15.5, fill: COLOR.ink, variant: 'small', attrs: ' class="m"' }).replace(` fill="${COLOR.ink}"`, '') + '</svg>',
  'Scalable favicon; switches to white in dark browser themes');
const fav = {};
for (const s of [16, 32, 48]) {
  fav[s] = png(tile(s, { scale: 0.8, radius: 0.22, variant: 'small' }), s);
  save(`web-app/favicon-${s}.png`, fav[s], 'Favicon tile, small optical size');
}
// favicon.ico: an ICO container holding the three PNGs.
{
  const imgs = [16, 32, 48].map((s) => [s, fav[s]]);
  const head = Buffer.alloc(6 + 16 * imgs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  let off = head.length;
  imgs.forEach(([s, b], i) => {
    const e = 6 + i * 16;
    head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(b.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += b.length;
  });
  save('web-app/favicon.ico', Buffer.concat([head, ...imgs.map(([, b]) => b)]), 'Legacy favicon: 16, 32 and 48 px');
}
save('web-app/apple-touch-icon-180.png', png(tile(180, { scale: 0.6 }), 180), 'iOS home screen (iOS rounds the corners itself)');
save('web-app/ios-app-icon-1024.png', png(tile(1024, { scale: 0.6 }), 1024), 'App Store icon: full bleed, no transparency');
save('web-app/pwa-icon-192.png', png(tile(192, { scale: 0.64, radius: 0.22 }), 192), 'PWA icon (purpose: any)');
save('web-app/pwa-icon-512.png', png(tile(512, { scale: 0.64, radius: 0.22 }), 512), 'PWA icon (purpose: any)');
// Maskable: the mark stays inside the central 80% safe circle; ground runs to the edges.
save('web-app/pwa-icon-maskable-512.png', png(tile(512, { scale: 0.5 }), 512), 'PWA icon (purpose: maskable), mark within the 80% safe zone');
// Android adaptive: 108 dp canvas, 66 dp safe circle → mark diameter ≤ 61% of the layer.
save('web-app/android-adaptive-foreground-432.png', png(tile(432, { scale: 0.5, transparent: true }), 432), 'Android adaptive icon foreground');
save('web-app/android-adaptive-background-432.png', png(doc(432, 432, `<rect width="432" height="432" fill="${COLOR.ink}"/>`), 432), 'Android adaptive icon background');
save('web-app/android-monochrome-432.png', png(tile(432, { scale: 0.5, transparent: true }), 432), 'Android 13+ themed icon (system tints it)');
svgAndPng('web-app/carworx-app-icon', tile(1024, { scale: 0.6, radius: 0.2237 }), [[1024, '-1024']], 'App icon master with iOS-style corner radius');
save('web-app/site.webmanifest.json', JSON.stringify({
  name: 'CarworX', short_name: 'CarworX', theme_color: COLOR.ink, background_color: COLOR.ink,
  icons: [
    { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'pwa-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2), 'Manifest icon block to copy into the app later');

// ---------- social ----------
// Posters reuse the motion scene at its hold frame, so stills and film share one look.
function poster(w, h, kind, H, path, note) {
  const S = scene({ word: wordmark(), L: layout(kind, H) }, { w, h, bg: true, cut: 'hero' });
  const rgba = renderFrame(S, 7.0, 60, false);
  const r = spawnSync(FFMPEG, ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'image2', '-c:v', 'png', '-'], { input: rgba, maxBuffer: 1 << 28 });
  save(path, r.stdout, note);
}
poster(1200, 630, 'horizontal', 96, 'social/share-card-1200x630.png', 'Link preview (Open Graph / WhatsApp / LinkedIn)');
poster(1500, 500, 'horizontal', 82, 'social/x-header-1500x500.png', 'X header; lockup kept inside the centre safe area');
poster(1584, 396, 'horizontal', 70, 'social/linkedin-banner-1584x396.png', 'LinkedIn company banner');
poster(1640, 624, 'horizontal', 80, 'social/facebook-cover-1640x624.png', 'Facebook cover; lockup centred for mobile crop');
poster(1080, 1080, 'stacked', 100, 'social/instagram-post-1080.png', 'Square post');
poster(1080, 1920, 'stacked', 110, 'social/story-1080x1920.png', 'Story / Status / Reel cover');
// Profile pictures: mark only, sized for a circular crop.
const profile = (S, ground, mark) => doc(S, S, `<rect width="${S}" height="${S}" fill="${ground}"/>` + rotorSVG({ cx: S / 2, cy: S / 2, radius: S * 0.3, fill: mark }));
save('social/profile-1080-ink.png', png(profile(1080, COLOR.ink, COLOR.white), 1080), 'Profile picture; safe in a circle crop');
save('social/profile-1080-paper.png', png(profile(1080, COLOR.paper, COLOR.ink), 1080), 'Profile picture, light');
save('social/whatsapp-business-640.png', png(profile(640, COLOR.ink, COLOR.white), 640), 'WhatsApp Business profile');

// ---------- business ----------
{
  const L = lockup('horizontal', { H: 100, mark: COLOR.ink, word: COLOR.ink });
  const w = L.w + 40, h = L.h + 40;
  const sig = doc(w, h, `<g transform="translate(20,20)">${L.svg}</g>`);
  save('business/email-signature-600.png', png(sig, 1200), 'Email signature: 1200 px wide, display at 600 px; transparent');
  save('business/email-signature-600-white.png', png(doc(w, h, `<rect width="${w}" height="${h}" fill="#fff"/><g transform="translate(20,20)">${L.svg}</g>`), 1200), 'Email signature on white, for clients without transparency');
}
{
  // A4 letterhead header band, 210 × 32 mm (mm as user units).
  const L = lockup('horizontal', { H: 6.2, mark: COLOR.ink, word: COLOR.ink });
  save('business/letterhead-header-a4.svg', doc(210, 32, `<g transform="translate(18,${(32 - L.h) / 2})">${L.svg}</g><rect x="18" y="30.6" width="174" height="0.25" fill="${COLOR.steel}"/>`, 'CarworX letterhead header', ' data-units="mm"'), 'A4 letterhead header band, 210 × 32 mm');
}
{
  // Business card 85 × 55 mm; PNG at 300 dpi (1004 × 650).
  const front = doc(85, 55, `<rect width="85" height="55" fill="${COLOR.ink}"/>` + rotorSVG({ cx: 42.5, cy: 27.5, radius: 11.5, fill: COLOR.white }));
  const L = lockup('horizontal', { H: 5.4, mark: COLOR.ink, word: COLOR.ink });
  const back = doc(85, 55, `<rect width="85" height="55" fill="${COLOR.paper}"/><g transform="translate(7,7)">${L.svg}</g>`);
  svgAndPng('business/business-card-front', front, [[1004, '-300dpi']], 'Business card front, 85 × 55 mm, add 3 mm bleed at the printer');
  svgAndPng('business/business-card-back', back, [[1004, '-300dpi']], 'Business card back, space below for name and contact');
}
{
  const L = lockup('horizontal', { H: 100, mark: COLOR.ink, word: COLOR.ink });
  svgAndPng('business/invoice-quote-header', doc(2400, 420, `<g transform="translate(0,${(420 - L.h) / 2})">${L.svg}</g><rect y="410" width="2400" height="3" fill="${COLOR.ink}"/>`), [[2400, '']], 'Invoice and quote header');
}
{
  // 58 mm thermal printers are 384 dots wide: pure black and white, no grey edges.
  const L = lockup('horizontal', { H: 100, mark: COLOR.black, word: COLOR.black });
  const w = L.w + 60, h = L.h + 60;
  const grey = new Resvg(doc(w, h, `<rect width="${w}" height="${h}" fill="#fff"/><g transform="translate(30,30)">${L.svg}</g>`), { ...NOFONTS, fitTo: { mode: 'width', value: 384 } }).render();
  const r = spawnSync(FFMPEG, ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${grey.width}x${grey.height}`, '-i', '-', '-vf', 'format=gray,lutyuv=y=if(lt(val\\,128)\\,0\\,255)', '-pix_fmt', 'monob', '-f', 'image2', '-c:v', 'png', '-'], { input: grey.pixels, maxBuffer: 1 << 26 });
  save('business/receipt-logo-384-1bit.png', r.stdout, '1-bit logo for 58 mm receipt printers');
}

// ---------- vehicle & workshop ----------
{
  const L = lockup('horizontal', { H: 100, mark: COLOR.white, word: COLOR.white });
  save('vehicle/door-decal-white.svg', doc(L.w, L.h, L.svg, 'CarworX door decal'), 'One-colour cut vinyl. Weld overlapping shapes in the cutter software before cutting.');
  const Lk = lockup('horizontal', { H: 100, mark: COLOR.black, word: COLOR.black });
  save('vehicle/door-decal-black.svg', doc(Lk.w, Lk.h, Lk.svg, 'CarworX door decal'), 'One-colour cut vinyl for light vehicles. Weld before cutting.');
  const S = lockup('stacked', { H: 100, mark: COLOR.white, word: COLOR.white });
  save('vehicle/windscreen-sticker-white.svg', doc(S.w, S.h, S.svg, 'CarworX windscreen sticker'), 'Reversed (white) sticker for glass');
  const sign = (w, h, ground, fg, H) => {
    const l = lockup('horizontal', { H, mark: fg, word: fg });
    return doc(w, h, `<rect width="${w}" height="${h}" fill="${ground}"/><g transform="translate(${(w - l.w) / 2},${(h - l.h) / 2})">${l.svg}</g>`);
  };
  svgAndPng('vehicle/workshop-sign-3x1', sign(3000, 1000, COLOR.ink, COLOR.white, 210), [[3000, '']], 'Workshop fascia sign, 3:1, scale to any size');
  svgAndPng('vehicle/service-bay-banner-4x1', sign(4000, 1000, COLOR.paper, COLOR.ink, 200), [[4000, '']], 'Service-bay banner, 4:1');
  save('vehicle/embroidery-stamp-mark-black.svg', doc(200, 200, rotorSVG({ cx: 100, cy: 100, radius: 100, fill: COLOR.black, variant: 'small' }), 'CarworX stamp'), 'Small optical-size mark for embroidery, rubber stamps and laser etching');
}

// ---------- guidelines ----------
{
  const W = 2400, Hh = 1520;
  const Lh = lockup('horizontal', { H: 90, mark: COLOR.ink, word: COLOR.ink });
  const cap = 90;
  const lab = (x, y, t, s = 26, c = COLOR.ink, wgt = 400) => `<text x="${x}" y="${y}" font-family="Sora, Segoe UI, Arial, sans-serif" font-size="${s}" font-weight="${wgt}" fill="${c}">${t}</text>`;
  let b = `<rect width="${W}" height="${Hh}" fill="${COLOR.paper}"/>` + lab(120, 130, 'CarworX: logo use', 54, COLOR.ink, 600);
  // Clear space
  const ox = 120 + cap, oy = 250 + cap;
  b += `<rect x="120" y="250" width="${Lh.w + 2 * cap}" height="${Lh.h + 2 * cap}" fill="none" stroke="${COLOR.steel}" stroke-dasharray="10 8" stroke-width="2"/>`;
  b += `<g transform="translate(${ox},${oy})">${Lh.svg}</g>`;
  b += `<rect x="${ox + Lh.w}" y="${oy + Lh.h / 2 - cap / 2}" width="${cap}" height="${cap}" fill="${COLOR.signal}" opacity=".18"/>`;
  b += lab(120, 250 + Lh.h + 2 * cap + 50, 'Clear space on every side = the height of the X.', 26, '#3b424c');
  // Construction: the five centrelines are logarithmic spirals; one blade tip runs at the X's angle.
  {
    const cx = 1790, cy = 440, r = 200, st = streamline('full');
    b += `<g transform="translate(${cx},${cy})" fill="none" stroke="${COLOR.steel}" stroke-width="1.5">` +
      `<circle r="${r}" stroke-dasharray="6 6"/><circle r="${(r * MARK.full.rHub) / 100}" stroke-dasharray="4 4"/></g>`;
    b += `<g opacity=".88">${rotorSVG({ cx, cy, radius: r, fill: COLOR.ink })}</g>`;
    b += `<g transform="translate(${cx},${cy}) scale(${r / 100}) rotate(${restAngle()})" fill="none" stroke="${COLOR.signal}" stroke-width="${160 / r}">` +
      Array.from({ length: 5 }, (_, i) => `<path transform="rotate(${i * PITCH})" d="${st.d}"/>`).join('') + '</g>';
    b += lab(1300, 210, 'Construction', 34, COLOR.ink, 600);
    b += lab(1300, 690, 'Each blade grows from a logarithmic spiral (orange), 72° apart.', 22, '#3b424c');
    b += lab(1300, 722, `One blade tip runs at ${X_ANGLE}°, the angle of the X.`, 22, '#3b424c');
  }
  // Minimum sizes
  const my = 820;
  b += lab(120, my, 'Minimum sizes', 34, COLOR.ink, 600);
  b += `<g transform="translate(120,${my + 40})">${rotorSVG({ cx: 12, cy: 12, radius: 12, fill: COLOR.ink, variant: 'small' })}</g>` + lab(160, my + 60, 'Mark 24 px (small version below 48 px)', 24, '#3b424c');
  const Lmin = lockup('horizontal', { H: 96 / (lockup('horizontal', { H: 100 }).w / 100), mark: COLOR.ink, word: COLOR.ink });
  b += `<g transform="translate(120,${my + 100})">${Lmin.svg}</g>` + lab(250, my + 118, 'Lockup 96 px wide', 24, '#3b424c');
  // Colour pairs
  const cy0 = 820, cx0 = 1300;
  b += lab(cx0, cy0, 'Colour pairs', 34, COLOR.ink, 600);
  [[COLOR.ink, COLOR.white, 'White on ink'], [COLOR.paper, COLOR.ink, 'Ink on paper'], ['#ffffff', COLOR.black, 'Black, one colour'], [COLOR.graphite, COLOR.white, 'White on graphite']].forEach(([g, f, t], i) => {
    const x = cx0 + (i % 2) * 480, y = cy0 + 30 + Math.floor(i / 2) * 190;
    const l = lockup('horizontal', { H: 34, mark: f, word: f });
    b += `<rect x="${x}" y="${y}" width="450" height="150" rx="10" fill="${g}" stroke="#d9d3c7"/><g transform="translate(${x + (450 - l.w) / 2},${y + 30})">${l.svg}</g>` + lab(x + 16, y + 135, t, 18, f === COLOR.white ? '#c9ced4' : '#5b6470');
  });
  // Don'ts
  const dy = 1260;
  b += lab(120, dy, 'Don’t', 34, COLOR.ink, 600);
  const small = lockup('horizontal', { H: 30, mark: COLOR.ink, word: COLOR.ink });
  const donts = [
    ['Stretch or squash', `transform="scale(1.22,0.72)"`],
    ['Recolour in signal orange', `fill="${COLOR.signal}"`],
    ['Rotate the lockup', `transform="rotate(-12 ${small.w / 2} ${small.h / 2})"`],
    ['Add shadows or effects', 'filter="url(#ds)"'],
    ['Rearrange mark and name', 'swap'],
    ['Write it Carworx or CARWORX', 'case'],
  ];
  b = `<defs><filter id="ds"><feDropShadow dx="4" dy="5" stdDeviation="3" flood-opacity=".5"/></filter></defs>` + b;
  donts.forEach(([t, how], i) => {
    const x = 120 + i * 360, y = dy + 40;
    let art = small.svg;
    if (how.startsWith('fill')) art = lockup('horizontal', { H: 30, mark: COLOR.signal, word: COLOR.signal }).svg;
    if (how === 'swap') { const L2 = layout('horizontal', 30); art = wordmarkSVG({ x: 0, y: L2.wy, cap: 30, fill: COLOR.ink }) + rotorSVG({ cx: L2.W + 30 + L2.R, cy: L2.my, radius: L2.R, fill: COLOR.ink }); }
    if (how === 'case') art = `<text x="0" y="45" font-family="Sora, Segoe UI, Arial, sans-serif" font-weight="600" font-size="40" fill="${COLOR.ink}">Carworx</text>`;
    const g = how.startsWith('transform') || how.startsWith('filter') ? `<g ${how}>${art}</g>` : art;
    b += `<rect x="${x}" y="${y}" width="330" height="170" rx="10" fill="#fff" stroke="#d9d3c7"/><g transform="translate(${x + 30},${y + 50})">${g}</g>`;
    b += `<path d="M${x + 290},${y + 18} l22,22 m0,-22 l-22,22" stroke="${COLOR.signal}" stroke-width="4"/>` + lab(x + 16, y + 160, t, 18, '#5b6470');
  });
  const sheet = doc(W, Hh, b, 'CarworX logo use');
  save('guidelines/carworx-logo-usage.svg', sheet, 'One-page usage sheet');
  save('guidelines/carworx-logo-usage.png', new Resvg(sheet, { fitTo: { mode: 'width', value: W } }).render().asPng(), 'One-page usage sheet');
}

// ---------- contrast of the approved pairs (WCAG relative luminance) ----------
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const pairs = [['white', COLOR.white, 'ink', COLOR.ink], ['ink', COLOR.ink, 'paper', COLOR.paper], ['white', COLOR.white, 'graphite', COLOR.graphite], ['black', COLOR.black, 'white', '#ffffff']]
  .map(([a, ah, b, bh]) => ({ pair: `${a} on ${b}`, ratio: +ratio(ah, bh).toFixed(2) }));
writeFileSync(`${ROOT}/files.json`, JSON.stringify({ files, contrast: pairs }, null, 2));
console.log(`${files.length} files`); console.log(pairs);
