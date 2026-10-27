// Frame renderer: timeline.mjs → resvg → raw RGBA → ffmpeg.
// Background drawn once per frame; the moving foreground is averaged over sub-frames (real motion blur)
// and composited on top. Frames render in parallel worker threads and are written in order.
//   node render.mjs <cut> <format> [--fps 60] [--scale 1] [--alpha] [--noblur] [--out file]
//   node render.mjs <cut> <format> --sheet 24 [--out sheet.png]     contact sheet across the cut
//   node render.mjs <cut> <format> --at 4.9,6.0 [--out file.png]     chosen frames
import { Resvg } from '@resvg/resvg-js';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { wordmark, layout } from './geometry.mjs';
import { scene, frame, subframes, CUTS } from './timeline.mjs';

const require = createRequire(import.meta.url);
export const FFMPEG = require('ffmpeg-static');
export const FFPROBE = require('ffprobe-static').path;
const NOFONTS = { font: { loadSystemFonts: false } };

export const FORMATS = {
  '16x9': { w: 1920, h: 1080, kind: 'horizontal', H: 150 },
  '1x1': { w: 1080, h: 1080, kind: 'stacked', H: 100 },
  '9x16': { w: 1080, h: 1920, kind: 'stacked', H: 110 },
  'card': { w: 1200, h: 630, kind: 'horizontal', H: 96 },
};

// Film grain: one 256 px fractal-noise tile with a fixed seed, identical on every frame.
let GRAIN = null;
function grain() {
  if (GRAIN) return GRAIN;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="256" height="256" filter="url(#n)"/></svg>`;
  GRAIN = 'data:image/png;base64,' + Buffer.from(new Resvg(svg, NOFONTS).render().asPng()).toString('base64');
  return GRAIN;
}
const withGrain = (S, svg) =>
  svg.replace('<defs>', `<defs><pattern id="gr" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${grain()}" width="256" height="256"/></pattern>`)
     .replace('</svg>', `<rect width="${S.w}" height="${S.h}" fill="url(#gr)" opacity="0.07"/></svg>`);

export function makeScene(cut, format, { alpha = false, scale = 1 } = {}) {
  const F = FORMATS[format];
  const G = { word: wordmark(), L: layout(F.kind, F.H * scale) };
  return scene(G, { w: Math.round(F.w * scale), h: Math.round(F.h * scale), bg: !alpha, cut });
}

const raster = (svg) => new Resvg(svg, { background: 'rgba(0,0,0,0)', ...NOFONTS }).render().pixels;

// One finished frame as straight-alpha RGBA.
export function renderFrame(S, t, fps, blur = true) {
  const n = blur ? subframes(S, t, fps) : 1;
  const acc = new Float64Array(S.w * S.h * 4);
  for (let i = 0; i < n; i++) {
    const ts = n === 1 ? t : t + ((i + 0.5) / n - 0.5) * (0.5 / fps);
    const px = raster(frame(S, ts, 'fg'));
    for (let j = 0; j < px.length; j += 4) {
      const a = px[j + 3] / 255;
      acc[j] += px[j] * a; acc[j + 1] += px[j + 1] * a; acc[j + 2] += px[j + 2] * a; acc[j + 3] += a;
    }
  }
  const out = Buffer.alloc(S.w * S.h * 4);
  if (S.bg) {
    // Premultiplied foreground over the opaque background.
    const bg = raster(withGrain(S, frame(S, t, 'bg')));
    for (let j = 0; j < out.length; j += 4) {
      const a = acc[j + 3] / n;
      out[j] = Math.round(acc[j] / n + bg[j] * (1 - a));
      out[j + 1] = Math.round(acc[j + 1] / n + bg[j + 1] * (1 - a));
      out[j + 2] = Math.round(acc[j + 2] / n + bg[j + 2] * (1 - a));
      out[j + 3] = 255;
    }
  } else {
    for (let j = 0; j < out.length; j += 4) {
      const a = acc[j + 3];
      if (a > 0) { out[j] = Math.round(acc[j] / a); out[j + 1] = Math.round(acc[j + 1] / a); out[j + 2] = Math.round(acc[j + 2] / a); }
      out[j + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

export function rgbaToPng(rgba, w, h) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', '-f', 'image2', '-c:v', 'png', '-']);
    const chunks = [];
    p.stdout.on('data', (c) => chunks.push(c));
    p.on('close', (code) => (code ? rej(new Error('ffmpeg png ' + code)) : res(Buffer.concat(chunks))));
    p.stdin.end(rgba);
  });
}

// ---------- Parallel frame pool ----------
const SELF = fileURLToPath(import.meta.url);
function pool(job, times, fps, blur, onFrame) {
  const N = Math.max(1, Math.min(cpus().length - 1, 7));
  return new Promise((resolve, reject) => {
    const ready = new Map();
    let next = 0, written = 0, dispatched = 0, live = N;
    const workers = Array.from({ length: N }, () => new Worker(SELF, { workerData: { job, fps, blur } }));
    const feed = (w) => {
      if (dispatched < times.length) { w.postMessage({ i: dispatched, t: times[dispatched] }); dispatched++; }
      else { w.postMessage(null); }
    };
    workers.forEach((w) => {
      w.on('message', async ({ i, buf }) => {
        ready.set(i, Buffer.from(buf));
        while (ready.has(next)) { const b = ready.get(next); ready.delete(next); await onFrame(b, next); next++; written++; }
        feed(w);
      });
      w.on('error', reject);
      w.on('exit', () => { if (--live === 0) written === times.length ? resolve() : reject(new Error(`wrote ${written}/${times.length}`)); });
      feed(w);
    });
  });
}

if (!isMainThread) {
  const { job, fps, blur } = workerData;
  const S = makeScene(job.cut, job.format, job);
  parentPort.on('message', (m) => {
    if (!m) return process.exit(0);
    const buf = renderFrame(S, m.t, fps, blur);
    parentPort.postMessage({ i: m.i, buf }, [buf.buffer]);
  });
}

export async function encode(job, { fps = 60, blur = true, out, duration = CUTS[job.cut].duration }) {
  const S = makeScene(job.cut, job.format, job);
  const alpha = !!job.alpha;
  const args = ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${S.w}x${S.h}`, '-r', String(fps), '-i', '-'];
  if (out.endsWith('.webm')) args.push('-c:v', 'libvpx-vp9', '-pix_fmt', alpha ? 'yuva420p' : 'yuv420p', '-b:v', '0', '-crf', '20', '-row-mt', '1', '-auto-alt-ref', '0');
  else if (out.endsWith('.gif')) args.push('-vf', `split[a][b];[a]palettegen=max_colors=${alpha ? 32 : 48}:stats_mode=full${alpha ? ':reserve_transparent=1' : ''}[p];[b][p]paletteuse=dither=sierra2_4a${alpha ? ':alpha_threshold=128' : ''}`, '-loop', '0');
  else args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-tune', 'animation', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart');
  args.push('-an', '-metadata', 'title=CarworX Turbine', out);
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg exit ' + c)) : res())));
  const n = Math.round(duration * fps), t0 = Date.now();
  const times = Array.from({ length: n }, (_, i) => i / fps);
  await pool(job, times, fps, blur, async (buf, i) => {
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) process.stdout.write(`\r${out}: ${i}/${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
  });
  ff.stdin.end();
  await done;
  console.log(`\r${out}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s            `);
}

// Contact sheet of chosen timestamps, labelled.
export async function sheet(job, times, out, { cols = 6, fps = 60, tw = 320 } = {}) {
  const S = makeScene(job.cut, job.format, job);
  const th = Math.round((S.h / S.w) * tw), rows = Math.ceil(times.length / cols);
  const cells = new Array(times.length);
  await pool(job, times, fps, true, async (buf, i) => {
    cells[i] = 'data:image/png;base64,' + (await rgbaToPng(buf, S.w, S.h)).toString('base64');
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * (tw + 8) + 8}" height="${rows * (th + 26) + 8}"><rect width="100%" height="100%" fill="#2a2f36"/>` +
    cells.map((c, i) => {
      const x = 8 + (i % cols) * (tw + 8), y = 8 + Math.floor(i / cols) * (th + 26);
      return `<image href="${c}" x="${x}" y="${y}" width="${tw}" height="${th}"/><text x="${x}" y="${y + th + 17}" font-family="Consolas, monospace" font-size="13" fill="#c9ced4">${times[i].toFixed(3)} s</text>`;
    }).join('') + '</svg>';
  writeFileSync(out, new Resvg(svg).render().asPng());
}

// ---------- CLI ----------
if (isMainThread && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cut = 'hero', format = '16x9', ...rest] = process.argv.slice(2);
  const opt = (k, d) => { const i = rest.indexOf('--' + k); return i < 0 ? d : rest[i + 1] ?? true; };
  const has = (k) => rest.includes('--' + k);
  const fps = +opt('fps', 60);
  const job = { cut, format, alpha: has('alpha'), scale: +opt('scale', 1) };
  mkdirSync('.cache', { recursive: true });
  if (has('sheet')) {
    const n = +opt('sheet', 24), D = CUTS[cut].duration;
    const times = Array.from({ length: n }, (_, i) => (i / (n - 1)) * (D - 1 / fps));
    await sheet(job, times, opt('out', `.cache/sheet-${cut}-${format}.png`), { cols: +opt('cols', 6), fps, tw: +opt('tw', 320) });
  } else if (has('at')) {
    const times = String(opt('at')).split(',').map(Number);
    await sheet(job, times, opt('out', `.cache/at-${cut}-${format}.png`), { cols: Math.min(times.length, +opt('cols', 4)), fps, tw: +opt('tw', 480) });
  } else {
    await encode(job, { fps, blur: !has('noblur'), out: opt('out', `.cache/${cut}-${format}.mp4`) });
  }
}
