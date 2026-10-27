// Checks: ffprobe metadata for every motion file, frame determinism, and final frame == static logo.
// Run: node verify.mjs  → prints a JSON report and writes ../exports/verify.json
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Resvg } from '@resvg/resvg-js';
import { makeScene, renderFrame, FFPROBE, FFMPEG, FORMATS } from './render.mjs';
import { COLOR, rotorSVG, wordmarkSVG, layout } from './geometry.mjs';
import { CUTS } from './timeline.mjs';

const OUT = '../exports/motion';
const report = { probe: {}, determinism: [], finalFrame: [] };

for (const f of readdirSync(OUT).filter((f) => /\.(mp4|webm|gif)$/.test(f))) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames', '-of', 'json', `${OUT}/${f}`]);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  report.probe[f] = {
    codec: v.codec_name, size: `${v.width}x${v.height}`, fps: v.r_frame_rate, pix_fmt: v.pix_fmt,
    duration: +(+j.format.duration).toFixed(3), bytes: +j.format.size, audio: j.streams.some((s) => s.codec_type === 'audio'),
  };
}

// Determinism: render frames twice, the second pass in reverse order, and compare decoded pixels.
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
for (const [cut, fmt] of [['hero', '16x9'], ['loop', '16x9'], ['splash', '9x16']]) {
  const S = makeScene(cut, fmt);
  const ts = [0.5, 1.9, 3.3, 4.6, 5.8, 7.5].filter((t) => t < CUTS[cut].duration);
  const a = ts.map((t) => sha(renderFrame(S, t, 60, true)));
  const b = ts.slice().reverse().map((t) => sha(renderFrame(makeScene(cut, fmt), t, 60, true))).reverse();
  report.determinism.push({ cut, fmt, times: ts, identical: a.every((h, i) => h === b[i]) });
}

// Final frame vs the static lockup composited on the same background, pixel for pixel.
for (const fmt of ['16x9', '1x1', '9x16']) {
  const S = makeScene('hero', fmt, { alpha: true });
  const t = CUTS.hero.duration - 1 / 60;
  const last = renderFrame(S, t, 60, true);
  const F = FORMATS[fmt], L = layout(F.kind, F.H), ox = Math.round((F.w - L.w) / 2), oy = Math.round((F.h - L.h) / 2);
  const still = `<svg xmlns="http://www.w3.org/2000/svg" width="${F.w}" height="${F.h}"><g transform="translate(${ox},${oy})">` +
    rotorSVG({ cx: L.mx, cy: L.my, radius: L.R, fill: COLOR.white }) + wordmarkSVG({ x: L.wx, y: L.wy, cap: L.H, fill: COLOR.white }) + '</g></svg>';
  const px = new Resvg(still, { font: { loadSystemFonts: false } }).render().pixels;
  let maxd = 0, diff = 0;
  for (let j = 0; j < px.length; j++) { const d = Math.abs(px[j] - last[j]); if (d > maxd) maxd = d; if (d > 2) diff++; }
  report.finalFrame.push({ fmt, t: +t.toFixed(4), maxChannelDelta: maxd, valuesOverTwo: diff, of: px.length });
}

// Loop seam: the loop's last frame and its first frame.
{
  const S = makeScene('loop', '16x9');
  const a = renderFrame(S, CUTS.loop.duration - 1 / 60, 60, true), b = renderFrame(S, 0, 60, true);
  let maxd = 0; for (let j = 0; j < a.length; j++) maxd = Math.max(maxd, Math.abs(a[j] - b[j]));
  report.loopSeam = { maxChannelDelta: maxd };
}
writeFileSync('../exports/verify.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
