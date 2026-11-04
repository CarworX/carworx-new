// CarworX Turbine: wordmark and lockups (Node only, reads the font). Mark geometry lives in shape.mjs.

import opentype from 'opentype.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COLOR, X_ANGLE, f2, rotorSVG } from './shape.mjs';

export * from './shape.mjs';
export const markSVG = rotorSVG;

const here = dirname(fileURLToPath(import.meta.url));
const font = opentype.loadSync(join(here, 'fonts', 'Sora-SemiBold.ttf'));
const CAP = 730; // Sora cap height in font units

export const WORD = {
  capHeight: 100,
  // Hand-set spacing (font units, added after each glyph) for C a r w o r.
  track: [-6, -4, -18, -10, -8, -14],
  xStroke: 152, // horizontal stroke width of the X, matched to Sora SemiBold
};

// Custom X: two straight strokes in font units (baseline y=0, cap at -730).
// The rising stroke is set to X_ANGLE, the same direction as a resting blade tip.
export function xGlyph(angle = X_ANGLE) {
  const w = WORD.xStroke, h = CAP;
  const run = Math.tan((angle * Math.PI) / 180) * h;
  const x0 = 14;
  const rise = [[x0, 0], [x0 + w, 0], [x0 + w + run, -h], [x0 + run, -h]];
  const fall = [[x0 + 8, -h], [x0 + 8 + w, -h], [x0 + run + w - 8, 0], [x0 + run - 8, 0]];
  return { rise, fall, advance: x0 * 2 + w + run };
}

const cmdsToD = (cmds, dx, k) =>
  cmds.map((c) => {
    const X = (v) => f2((v + dx) * k), Y = (v) => f2(v * k);
    if (c.type === 'M') return `M${X(c.x)},${Y(c.y)}`;
    if (c.type === 'L') return `L${X(c.x)},${Y(c.y)}`;
    if (c.type === 'Q') return `Q${X(c.x1)},${Y(c.y1)} ${X(c.x)},${Y(c.y)}`;
    if (c.type === 'C') return `C${X(c.x1)},${Y(c.y1)} ${X(c.x2)},${Y(c.y2)} ${X(c.x)},${Y(c.y)}`;
    return 'Z';
  }).join('');

// Letters in wordmark units: cap height 100, baseline y=0, left ink edge at x=0.
// The X is two separate strokes so the animation can cross them.
export function wordmark() {
  const k = WORD.capHeight / CAP;
  const left = font.charToGlyph('C').getBoundingBox().x1;
  const letters = [];
  let pen = -left;
  [...'Carwor'].forEach((ch, i) => {
    const g = font.charToGlyph(ch);
    const bb = g.getBoundingBox();
    letters.push({ ch, d: cmdsToD(g.getPath(0, 0, 1000).commands, pen, k), x0: f2((pen + bb.x1) * k), x1: f2((pen + bb.x2) * k) });
    pen += g.advanceWidth + WORD.track[i];
  });
  const X = xGlyph();
  const pt = ([x, y]) => [f2((x + pen) * k), f2(y * k)];
  const xr = X.rise.map(pt), xf = X.fall.map(pt);
  const P = (q) => 'M' + q.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
  letters.push({ ch: 'X', d: P(xr) + P(xf), rise: xr, fall: xf, x0: xr[0][0], x1: Math.max(xr[2][0], xf[1][0]) });
  return { letters, width: Math.max(xr[2][0], xf[1][0]), cap: 100 };
}

export function wordmarkSVG({ x = 0, y = 0, cap = 100, fill = COLOR.ink } = {}) {
  const w = wordmark();
  return `<g transform="translate(${f2(x)},${f2(y)}) scale(${cap / 100})" fill="${fill}">` +
    w.letters.map((l) => `<path d="${l.d}"/>`).join('') + '</g>';
}

// ---------- Lockups ----------
// Proportions in units of the cap height H. Clear space around any lockup = H.
export const LOCKUP = {
  horizontal: { markR: 0.92, gap: 0.62 },
  stacked: { markR: 1.6, gap: 0.6 },
  clear: 1.0,
};

// Layout of a lockup with cap height H in a box starting at (0,0): mark centre/radius and
// wordmark origin (baseline), shared by the stills and the motion.
export function layout(kind = 'horizontal', H = 100) {
  const r2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? f2(v) : v]));
  const W = (wordmark().width * H) / 100;
  if (kind === 'horizontal') {
    const R = LOCKUP.horizontal.markR * H, gap = LOCKUP.horizontal.gap * H;
    return r2({ kind, H, R, W, mx: R, my: R, wx: 2 * R + gap, wy: R + H / 2, w: 2 * R + gap + W, h: 2 * R });
  }
  const R = LOCKUP.stacked.markR * H, gap = LOCKUP.stacked.gap * H;
  const w = Math.max(2 * R, W);
  return r2({ kind, H, R, W, mx: w / 2, my: R, wx: (w - W) / 2, wy: 2 * R + gap + H, w, h: 2 * R + gap + H });
}

export function lockup(kind = 'horizontal', { H = 100, mark = COLOR.ink, word = COLOR.ink, variant = 'full' } = {}) {
  const L = layout(kind, H);
  const svg = rotorSVG({ cx: L.mx, cy: L.my, radius: L.R, fill: mark, variant }) +
    wordmarkSVG({ x: L.wx, y: L.wy, cap: H, fill: word });
  return { svg, w: L.w, h: L.h, L };
}
