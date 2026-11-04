// Web motion pieces: loading spinner (SVG + CSS, and a GIF), hover snippet and an embeddable hero player.
// Run: node build-web-motion.mjs   → ../exports/motion/
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { COLOR, PITCH, bladePath, restAngle, f2, lockup, wordmark, layout } from './geometry.mjs';
import { FFMPEG, FORMATS } from './render.mjs';

const OUT = '../exports/motion';
mkdirSync(OUT, { recursive: true });
const blade = bladePath('small');
const rest = f2(restAngle('small'));
const blades = (fill) => Array.from({ length: 5 }, (_, i) => `<path transform="rotate(${i * PITCH})" d="${blade}" fill="${fill}"/>`).join('');

// Loader: the rotor indexes one blade (72°) at a time, like a ratchet, rather than spinning freely.
// One 72° step looks identical to the start, so the loop is seamless.
const loader = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220" width="48" height="48" role="img" aria-label="Loading">
<title>Loading</title>
<style>
.r{transform-box:view-box;transform-origin:0 0;animation:cxi 1.2s cubic-bezier(.65,0,.25,1) infinite}
@keyframes cxi{0%{transform:rotate(${rest}deg)}55%,100%{transform:rotate(${f2(rest + PITCH)}deg)}}
@media (prefers-reduced-motion:reduce){.r{animation:cxp 1.6s ease-in-out infinite;transform:rotate(${rest}deg)}@keyframes cxp{50%{opacity:.45}}}
</style>
<g class="r">${blades(fill)}</g></svg>`;
writeFileSync(`${OUT}/carworx-loader-ink.svg`, loader(COLOR.ink));
writeFileSync(`${OUT}/carworx-loader-white.svg`, loader(COLOR.white));

// Loader GIF (for email and places without CSS): same ratchet, 25 fps, transparent.
{
  const fps = 25, n = 30, S = 96;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const u = Math.min(1, (i / n) / 0.55);
    const a = restAngle('small') + PITCH * ease(u);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="-110 -110 220 220"><g transform="rotate(${a})">${blades(COLOR.ink)}</g></svg>`;
    frames.push(Buffer.from(new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels));
  }
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${S}x${S}`, '-r', String(fps), '-i', '-',
    '-vf', 'split[a][b];[a]palettegen=max_colors=32:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128', '-loop', '0', `${OUT}/carworx-loader-ink.gif`], { input: Buffer.concat(frames) });
  if (r.status) throw new Error(String(r.stderr));
}

// Snippets page: the hover quarter-index and the loader, with copyable code.
{
  const L = lockup('horizontal', { H: 40, mark: COLOR.ink, word: COLOR.ink });
  const svg = L.svg.replace('<g transform="translate(', '<g class="cx-rotor" transform="translate(');
  const html = `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CarworX web motion</title>
<style>
body{margin:0;background:${COLOR.paper};color:${COLOR.ink};font:15px/1.5 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px}
.demo{display:flex;gap:40px;align-items:center;flex-wrap:wrap;padding:24px;background:#fff;border:1px solid #e2dccf;border-radius:10px}
pre{overflow:auto;background:${COLOR.ink};color:${COLOR.paper};padding:16px;border-radius:10px;font-size:13px}
a.cx-logo{display:inline-block;border-radius:6px}
a.cx-logo:focus-visible{outline:2px solid ${COLOR.ink};outline-offset:4px}
/* Hover: the rotor indexes one blade. The resting logo is unchanged. */
.cx-logo .cx-blades{transform-box:view-box;transform-origin:0 0;transition:transform .6s cubic-bezier(.65,0,.25,1)}
.cx-logo:hover .cx-blades,.cx-logo:focus-visible .cx-blades{transform:rotate(72deg)}
@media (prefers-reduced-motion:reduce){.cx-logo .cx-blades{transition:none}}
</style></head><body><main>
<h1>CarworX web motion</h1>
<h2>Hover</h2>
<div class="demo"><a class="cx-logo" href="#" aria-label="CarworX home"><svg width="${f2(L.w)}" height="${f2(L.h)}" viewBox="0 0 ${f2(L.w)} ${f2(L.h)}" aria-hidden="true">${hoverize(L.svg)}</svg></a><span>Hover or focus the logo: the rotor indexes one blade (72°).</span></div>
<pre>.cx-logo .cx-blades { transition: transform .6s cubic-bezier(.65,0,.25,1); }
.cx-logo:hover .cx-blades,
.cx-logo:focus-visible .cx-blades { transform: rotate(72deg); }
@media (prefers-reduced-motion: reduce) { .cx-logo .cx-blades { transition: none; } }</pre>
<h2>Loader</h2>
<div class="demo"><img src="carworx-loader-ink.svg" width="48" height="48" alt="Loading"><img src="carworx-loader-ink.gif" width="48" height="48" alt="Loading"><span>SVG (CSS) left, GIF right. With reduced motion the SVG pulses instead of turning.</span></div>
<pre>&lt;img src="carworx-loader-ink.svg" width="48" height="48" alt="Loading"&gt;</pre>
</main></body></html>`;
  writeFileSync(`${OUT}/carworx-web-motion.html`, html);
}
// Wrap the blades of a lockup's rotor group in an inner group the CSS can turn about the hub.
function hoverize(svg) {
  return svg.replace(/(<g transform="translate\([^)]*\) scale\([^)]*\) rotate\([^)]*\)" fill="[^"]*">)([\s\S]*?)(<\/g>)/, '$1<g class="cx-blades">$2</g>$3');
}

// Embeddable hero: the live timeline (same code as the renders) as a drop-in HTML file.
{
  const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export (const|function)/gm, '$1');
  const code = strip(readFileSync('shape.mjs', 'utf8')) + '\n' + strip(readFileSync('timeline.mjs', 'utf8'));
  const F = FORMATS['16x9'];
  const html = `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CarworX</title>
<style>html,body{margin:0;height:100%;background:${COLOR.ink}}#s{width:100%;height:100%;display:grid;place-items:center}#s svg{width:100%;height:auto;max-height:100%}</style></head>
<body><div id="s" role="img" aria-label="CarworX"></div><script>
${code}
const S = scene({ word: ${JSON.stringify(wordmark())}, L: ${JSON.stringify(layout(F.kind, F.H))} }, { w: ${F.w}, h: ${F.h}, bg: true, cut: 'hero' });
const el = document.getElementById('s');
if (matchMedia('(prefers-reduced-motion: reduce)').matches) el.innerHTML = frame(S, S.duration - 0.001);
else { const t0 = performance.now(); const tick = (n) => { const t = (n - t0) / 1000; el.innerHTML = frame(S, Math.min(t, S.duration - 0.001)); if (t < S.duration) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
</script></body></html>`;
  writeFileSync(`${OUT}/carworx-hero-embed.html`, html);
}
console.log('web motion written');
