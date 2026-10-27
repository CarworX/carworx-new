// Builds preview.html: the live, scrubbable motion, running the same shape.mjs + timeline.mjs code
// as the video renderer, inlined so it opens straight from disk with no server.
import { readFileSync, writeFileSync } from 'node:fs';
import { wordmark, layout } from './geometry.mjs';
import { FORMATS } from './render.mjs';

const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export (const|function|\*)/gm, (m, k) => (k === '*' ? '' : k));
const code = strip(readFileSync('shape.mjs', 'utf8')) + '\n' + strip(readFileSync('timeline.mjs', 'utf8'));
const word = wordmark();
const formats = Object.fromEntries(['16x9', '1x1', '9x16'].map((k) => {
  const F = FORMATS[k];
  return [k, { w: F.w, h: F.h, L: layout(F.kind, F.H) }];
}));

const html = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CarworX Turbine motion</title>
<style>
  :root { --ink:#0d0f12; --graphite:#1c2128; --steel:#8a97a6; --paper:#f4efe6; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #07080a; color: var(--paper); font: 14px/1.4 system-ui, sans-serif; }
  main { max-width: 1280px; margin: 0 auto; padding: 16px; }
  .stage { display: grid; place-items: center; background: #000; border-radius: 10px; overflow: hidden; }
  .stage svg { width: 100%; height: auto; max-height: 72vh; display: block; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 12px; }
  button, select { font: inherit; color: var(--paper); background: var(--graphite); border: 1px solid #2c333c; border-radius: 8px; padding: 8px 12px; min-height: 40px; cursor: pointer; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--paper); outline-offset: 2px; }
  input[type=range] { flex: 1 1 260px; accent-color: var(--steel); }
  output { font-variant-numeric: tabular-nums; min-width: 6ch; color: var(--steel); }
  p { color: var(--steel); }
</style>
</head>
<body>
<main>
  <div class="stage" id="stage" aria-label="CarworX logo animation" role="img"></div>
  <div class="bar">
    <button id="play" aria-pressed="false">Play</button>
    <input id="t" type="range" min="0" max="8" step="0.001" value="8" aria-label="Time">
    <output id="tv">8.000 s</output>
    <select id="cut" aria-label="Cut"><option value="hero">Hero 8 s</option><option value="loop">Loop 8.6 s</option><option value="splash">App splash 1.6 s</option></select>
    <select id="fmt" aria-label="Format"><option>16x9</option><option>1x1</option><option>9x16</option></select>
    <select id="spd" aria-label="Speed"><option value="1">1×</option><option value="0.25">¼×</option><option value="0.1">0.1×</option></select>
  </div>
  <p id="note">This preview runs the same timeline code as the rendered videos. Shown still because your system asks for reduced motion; press Play to watch anyway.</p>
</main>
<script>
${code}
const WORD = ${JSON.stringify(word)};
const FORMATS = ${JSON.stringify(formats)};
const $ = (id) => document.getElementById(id);
let S, playing = false, last = 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('note').hidden = !reduce;
function build() {
  const F = FORMATS[$('fmt').value];
  S = scene({ word: WORD, L: F.L }, { w: F.w, h: F.h, bg: true, cut: $('cut').value });
  $('t').max = S.duration; if (+$('t').value > S.duration) $('t').value = S.duration;
  draw();
}
function draw() {
  const t = Math.min(+$('t').value, S.duration - 1e-4);
  $('stage').innerHTML = frame(S, t);
  $('tv').textContent = t.toFixed(3) + ' s';
}
function tick(now) {
  if (!playing) return;
  const dt = (now - last) / 1000 * +$('spd').value; last = now;
  let t = +$('t').value + dt;
  if (t >= S.duration) t = $('cut').value === 'loop' ? t % S.duration : 0;
  $('t').value = t; draw(); requestAnimationFrame(tick);
}
$('play').onclick = () => {
  playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; $('play').setAttribute('aria-pressed', playing);
  if (playing) { if (+$('t').value >= S.duration - 0.01) $('t').value = 0; last = performance.now(); requestAnimationFrame(tick); }
};
$('t').oninput = draw; $('cut').onchange = build; $('fmt').onchange = build;
build();
if (!reduce) $('play').click();
</script>
</body>
</html>`;
writeFileSync('preview.html', html);
console.log('preview.html', (html.length / 1024).toFixed(0), 'KB');
