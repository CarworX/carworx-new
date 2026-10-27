// CarworX Turbine motion: frame(t) is a pure function of time that returns one SVG.
// No CSS timing, no randomness: the same t always gives the same picture, in the browser or in Node.

import { COLOR, PITCH, BLADES, bladePath, streamline, restAngle, f2 } from './shape.mjs';

// ---------- Time and easing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = {
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x, s = 0.9) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};

// Beat sheet for the hero (seconds). Every cut is derived from this.
export const BEATS = {
  ignite: [0.0, 0.6], ring: [0.15, 0.95], intake: [0.4, 1.6], forge: [1.2, 2.4],
  spool: [1.3, 5.0], boost: [3.75, 4.75], x: [4.45, 5.0], lock: [5.0, 5.7],
  glint: [5.4, 6.25], hold: [6.0, 8.0], exit: [8.0, 8.55],
};
export const CUTS = {
  hero: { duration: 8.0 },
  loop: { duration: 8.6 },
  splash: { duration: 1.6 },
};

// ---------- Rotor physics ----------
// Turbo spool: angular velocity follows a lag-then-surge-then-brake curve v(u) = u^2.2 (1-u)^1.3,
// integrated once into a lookup table. The rotor brakes past its rest angle by OVERSHOOT, then a
// damped spring settles it, so the final frame lands exactly on the resting logo.
const TURNS = 4, OVERSHOOT = 1.8;
const TABLE = (() => {
  const n = 2048, c = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const u = (i - 0.5) / n;
    c[i] = c[i - 1] + Math.pow(u, 2.2) * Math.pow(1 - u, 1.3);
  }
  for (let i = 0; i <= n; i++) c[i] /= c[n];
  return c;
})();
const spoolE = (u) => {
  const x = clamp(u) * 2048, i = Math.floor(x), f = x - i;
  return i >= 2048 ? 1 : TABLE[i] + (TABLE[i + 1] - TABLE[i]) * f;
};
export function rotorAngle(t, variant = 'full') {
  const rest = restAngle(variant);
  const [a, b] = BEATS.spool;
  if (t < b) return rest - (TURNS * 360 + OVERSHOOT) * (1 - spoolE((t - a) / (b - a))) + OVERSHOOT;
  const v = t - b;
  return rest + OVERSHOOT * Math.exp(-6.5 * v) * Math.cos(2 * Math.PI * 1.7 * v);
}

// ---------- Scene ----------
// G: { word: wordmark() data, L: layout(...) }. opts: { w, h, bg, cut }.
export function scene(G, { w = 1920, h = 1080, bg = true, cut = 'hero' } = {}) {
  const L = G.L;
  // Whole-pixel offsets keep the resting logo crisp and identical to the stills.
  const ox = Math.round((w - L.w) / 2), oy = Math.round((h - L.h) / 2);
  const S = {
    w, h, bg, cut, G, L,
    MX: ox + L.mx, MY: oy + L.my, R: L.R, H: L.H, WX: ox + L.wx, WY: oy + L.wy,
    duration: CUTS[cut].duration,
  };
  const s = L.H / 100;
  S.letters = G.word.letters.map((l) => ({ ...l, cx: S.WX + ((l.x0 + l.x1) / 2) * s, cy: S.WY - 50 * s }));
  const X = S.letters[S.letters.length - 1];
  const mid = (q, i, j) => [(q[i][0] + q[j][0]) / 2, (q[i][1] + q[j][1]) / 2];
  S.xRise = { a: mid(X.rise, 0, 1), b: mid(X.rise, 2, 3) };
  S.xFall = { a: mid(X.fall, 0, 1), b: mid(X.fall, 2, 3) };
  S.stream = streamline('full');
  S.blade = bladePath('full');
  // Opening camera: the rotor is born large at the centre of frame, then glides into its lockup seat.
  S.cam0 = { x: w / 2, y: h / 2, r: 0.27 * Math.min(w, h) };
  return S;
}

// Map a cut's local time onto the hero beat sheet.
function heroTime(S, t) {
  if (S.cut === 'splash') return t < 1.25 ? 0.9 + (t / 1.25) * 4.7 : 6.0;
  return t;
}

export const CAMERA = [2.85, 4.05];
function cam(S, t) {
  const u = ease.inOutCubic(seg(t, ...CAMERA));
  const a = S.cut === 'splash' ? { x: S.MX, y: S.MY, r: S.R } : S.cam0;
  return { x: a.x + (S.MX - a.x) * u, y: a.y + (S.MY - a.y) * u, r: a.r + (S.R - a.r) * u };
}

const glow = (id, color, op) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset=".6" stop-color="${color}" stop-opacity="${f2(op * 0.35)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

// Normalised rotor speed (0–1) from the spool velocity curve; 0 outside the spool.
const V_PEAK = Math.pow(2.2 / 3.5, 2.2) * Math.pow(1.3 / 3.5, 1.3);
function spoolSpeed(t) {
  const [a, b] = BEATS.spool, u = (t - a) / (b - a);
  return u <= 0 || u >= 1 ? 0 : (Math.pow(u, 2.2) * Math.pow(1 - u, 1.3)) / V_PEAK;
}

// The light behind the logo is driven by the rotor:
// - Orbit: the two lights circle the rotor at a 4:1 gear ratio, one full orbit while the rotor makes
//   its four turns, so they settle exactly where they began (the loop has no seam).
// - Level: they come up from dark with the ignition, surge with rotor speed and flash at the boost.
// - Sweep: a soft beam crosses the background with the glint.
// - Breath: a slow drift, periodic over the cut, keeps the hold alive.
function background(S, tLocal) {
  const t = heroTime(S, tLocal);
  const exit = S.cut === 'loop' ? ease.inOutCubic(seg(tLocal, ...BEATS.exit)) : 0;
  const period = S.cut === 'splash' ? 8 : S.duration;
  const P = 2 * Math.PI * (tLocal / period);
  const k = Math.max(S.w, S.h);
  const C = cam(S, t);
  const ox = S.w / 2 + (C.x - S.w / 2) * 0.35, oy = S.h / 2 + (C.y - S.h / 2) * 0.35;
  const geared = ((rotorAngle(t) - rotorAngle(0)) / TURNS) * (Math.PI / 180); // 0 → 2π across the spool
  const phi = -2.95 + geared + 0.22 * Math.sin(P);
  const rho = 0.15 * k * (1 + 0.18 * Math.cos(P));
  const ig = ease.inOutCubic(seg(t, 0.1, 1.4)) * (1 - exit);
  const flash = Math.exp(-Math.pow((t - (BEATS.boost[0] + 0.2)) / 0.28, 2)) * (1 - exit);
  const level = 0.42 + 0.48 * ig + 0.45 * spoolSpeed(t) * (1 - exit) + 0.4 * flash + 0.05 * Math.sin(2 * P);
  const L = (ang, r, rx, ry, id, op) => {
    const x = ox + r * Math.cos(ang), y = oy + r * Math.sin(ang) * 0.6;
    const rot = 9 * Math.sin(ang) - 4;
    return `<ellipse cx="${f2(x)}" cy="${f2(y)}" rx="${f2(rx * k)}" ry="${f2(ry * k)}" fill="url(#${id})" opacity="${f2(Math.min(1, op))}" transform="rotate(${f2(rot)} ${f2(x)} ${f2(y)})"/>`;
  };
  let body = `<rect width="${S.w}" height="${S.h}" fill="${COLOR.ink}"/>` +
    L(phi, rho, 0.46, 0.2, 'g1', level) +
    L(phi + Math.PI + 0.25, rho * 1.3, 0.36, 0.15, 'g2', level * 0.95);
  let defs = '';
  const gl = seg(t, BEATS.glint[0] - 0.15, BEATS.glint[1] + 0.25);
  if (gl > 0 && gl < 1) {
    const span = S.w + 1.2 * k, bx = -0.6 * k + span * ease.inOutCubic(gl), bw = 0.22 * k;
    defs = `<linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="${f2(bx - bw)}" y1="${f2(S.h / 2 + bw * 0.78)}" x2="${f2(bx + bw)}" y2="${f2(S.h / 2 - bw * 0.78)}"><stop offset="0" stop-color="#b9c6d6" stop-opacity="0"/><stop offset=".5" stop-color="#b9c6d6" stop-opacity="${f2(0.16 * Math.sin(Math.PI * gl))}"/><stop offset="1" stop-color="#b9c6d6" stop-opacity="0"/></linearGradient>`;
    body += `<rect width="${S.w}" height="${S.h}" fill="url(#beam)"/>`;
  }
  return { defs, body: body + `<rect width="${S.w}" height="${S.h}" fill="url(#vig)"/>` };
}

const DEFS_BG = `${glow('g1', '#9fb0c5', 0.3)}${glow('g2', '#7489a3', 0.24)}` +
  `<radialGradient id="vig" cx=".5" cy=".5" r=".72"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>`;

const BLOOM = `<radialGradient id="bloom"><stop offset="0" stop-color="#eef3f8" stop-opacity=".95"/><stop offset=".35" stop-color="#c9d4e0" stop-opacity=".35"/><stop offset="1" stop-color="#c9d4e0" stop-opacity="0"/></radialGradient>`;

// The picture at cut-local time t. layer: 'all', 'bg' (background only) or 'fg' (everything else,
// transparent), so the renderer can blur the moving foreground without re-rendering the background.
export function frame(S, tLocal, layer = 'all') {
  const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}" viewBox="0 0 ${S.w} ${S.h}">`;
  const bgOn = S.bg && layer !== 'fg';
  const BG = bgOn ? background(S, tLocal) : { defs: '', body: '' };
  if (layer === 'bg') return `${svgOpen}<defs>${DEFS_BG}${BG.defs}</defs>${BG.body}</svg>`;

  const t = heroTime(S, tLocal);
  const H = S.H, s = H / 100;
  const C = cam(S, t), MX = C.x, MY = C.y, R = C.r;
  const exit = S.cut === 'loop' ? ease.inCubic(seg(tLocal, ...BEATS.exit)) : 0;
  let out = '', under = '', defs = BLOOM;

  // Housing ring: a hairline that draws round the rotor, then dissolves during the glide.
  const ringR = 1.16 * R, circ = 2 * Math.PI * ringR;
  const ringDraw = ease.inOutCubic(seg(t, ...BEATS.ring));
  const ringOp = 0.36 * (1 - seg(t, 2.9, 3.7));
  if (ringDraw > 0 && ringOp > 0.002)
    out += `<circle cx="${f2(MX)}" cy="${f2(MY)}" r="${f2(ringR)}" fill="none" stroke="${COLOR.steel}" stroke-width="${f2(Math.max(1, 0.007 * R))}" opacity="${f2(ringOp)}" stroke-dasharray="${f2(circ * ringDraw)} ${f2(circ)}" transform="rotate(-90 ${f2(MX)} ${f2(MY)})"/>`;

  // Ignition: a point of light at the hub that blooms, then hands the hub back to the dark.
  const ig = ease.outExpo(seg(t, ...BEATS.ignite));
  const igFade = 1 - seg(t, 1.5, 2.4);
  if (ig > 0 && igFade > 0) {
    out += `<circle cx="${f2(MX)}" cy="${f2(MY)}" r="${f2(0.6 * R * ig)}" fill="url(#bloom)" opacity="${f2(igFade)}"/>`;
    out += `<circle cx="${f2(MX)}" cy="${f2(MY)}" r="${f2(0.045 * R * ig)}" fill="${COLOR.white}" opacity="${f2(igFade)}"/>`;
  }

  // Rotor: streamlines and blades live in its frame.
  const theta = rotorAngle(t) + 200 * exit * exit;
  const rot = `translate(${f2(MX)},${f2(MY)}) scale(${+(R / 100).toFixed(4)}) rotate(${+theta.toFixed(4)})`;
  let rotor = '';
  for (let i = 0; i < BLADES; i++) {
    const st = BEATS.intake[0] + i * 0.08;
    const draw = ease.inOutCubic(seg(t, st, st + 0.9));
    const fs = BEATS.forge[0] + i * 0.1;
    const k = ease.outBack(seg(t, fs, fs + 0.75), 0.6) * (1 - exit);
    const lineOp = draw > 0 ? 1 - seg(t, fs + 0.1, fs + 0.6) : 0;
    const g = `<g transform="rotate(${i * PITCH})">`;
    // Intake: the airflow line draws from the tip inward to the hub, at a constant on-screen weight.
    if (lineOp > 0.002)
      rotor += `${g}<path d="${S.stream.d}" fill="none" stroke="${COLOR.white}" stroke-width="${f2((2.4 * 100) / R)}" stroke-linecap="round" opacity="${f2(0.9 * lineOp)}" stroke-dasharray="${f2(S.stream.len * draw)} ${f2(S.stream.len * 2)}" stroke-dashoffset="${f2(-S.stream.len * (1 - draw))}"/></g>`;
    // Forge: the same curve thickens into the blade.
    if (k > 0.002) rotor += `${g}<path d="${Math.abs(k - 1) < 1e-4 ? S.blade : bladePath('full', k)}" fill="${COLOR.white}"/></g>`;
  }
  out += `<g transform="${rot}">${rotor}</g>`;

  // Boost: a pressure ring leaves the rotor; its disc uncovers the wordmark letter by letter.
  const bst = ease.outCubic(seg(t, ...BEATS.boost));
  const far = Math.max(...S.letters.map((l) => Math.hypot(l.cx - MX, l.cy - MY))) + 1.6 * H;
  const pr = R * 1.05 + (far - R * 1.05) * bst;
  const prOp = bst > 0 ? 0.5 * Math.sin(Math.PI * bst) : 0;
  if (prOp > 0.002)
    out += `<circle cx="${f2(MX)}" cy="${f2(MY)}" r="${f2(pr)}" fill="none" stroke="${COLOR.steel}" stroke-width="${f2(0.035 * R * (1 - bst) + 1)}" opacity="${f2(prOp)}"/>`;

  // Wordmark.
  let word = '';
  S.letters.forEach((l) => {
    if (l.ch === 'X' || bst <= 0) return;
    const a = ease.outCubic(clamp((pr - Math.hypot(l.cx - MX, l.cy - MY) + 0.9 * H) / (1.1 * H)));
    if (a <= 0) return;
    word += a >= 1 ? `<path d="${l.d}"/>` : `<path d="${l.d}" transform="translate(0,${f2((1 - a) * 22)})" opacity="${f2(a)}"/>`;
  });
  // X: two strokes slide in along their own axes and cross; the rising stroke runs on the blade angle.
  const xa = ease.outExpo(seg(t, ...BEATS.x));
  const X = S.letters[S.letters.length - 1];
  if (xa > 0) {
    const P = (q) => 'M' + q.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
    if (xa >= 1) word += `<path d="${X.d}"/>`;
    else {
      const slide = (q, dir) => {
        const dx = q.b[0] - q.a[0], dy = q.b[1] - q.a[1], n = Math.hypot(dx, dy), d = (1 - xa) * 140 * dir;
        return `translate(${f2((dx / n) * d)},${f2((dy / n) * d)})`;
      };
      word += `<path d="${P(X.rise)}" transform="${slide(S.xRise, -1)}" opacity="${f2(xa)}"/>`;
      word += `<path d="${P(X.fall)}" transform="${slide(S.xFall, 1)}" opacity="${f2(xa)}"/>`;
    }
  }
  if (word) out += `<g transform="translate(${f2(S.WX)},${f2(S.WY)}) scale(${s})" fill="${COLOR.white}"${exit > 0 ? ` opacity="${f2(1 - exit)}"` : ''}>${word}</g>`;

  // The click: a short flash where the X strokes cross as they seat.
  const click = seg(t, BEATS.x[0] + 0.3, BEATS.x[0] + 0.75);
  if (click > 0 && click < 1) {
    const cx = S.WX + ((X.rise[0][0] + X.rise[2][0]) / 2) * s, cy = S.WY - 50 * s;
    out += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(H * (0.3 + 1.1 * ease.outCubic(click)))}" fill="url(#bloom)" opacity="${f2(0.75 * (1 - click))}"/>`;
  }

  // Glint: a band of halation sweeps across the finished logo, under the shapes.
  const gl = seg(t, ...BEATS.glint);
  if (gl > 0 && gl < 1) {
    const x0 = MX - R - 2 * H, x1 = S.WX + S.L.W + 2 * H;
    const bx = x0 + (x1 - x0) * ease.inOutCubic(gl), bw = 1.4 * H;
    defs += `<linearGradient id="band" gradientUnits="userSpaceOnUse" x1="${f2(bx - bw)}" y1="${f2(MY + bw * 0.78)}" x2="${f2(bx + bw)}" y2="${f2(MY - bw * 0.78)}"><stop offset="0" stop-color="#e4ebf3" stop-opacity="0"/><stop offset=".5" stop-color="#e4ebf3" stop-opacity="1"/><stop offset="1" stop-color="#e4ebf3" stop-opacity="0"/></linearGradient>` +
      `<filter id="halo" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${f2(0.08 * H)}"/></filter>`;
    under = `<g fill="url(#band)" filter="url(#halo)" opacity=".6">` +
      `<g transform="${rot}">${Array.from({ length: BLADES }, (_, i) => `<path transform="rotate(${i * PITCH})" d="${S.blade}"/>`).join('')}</g>` +
      `<g transform="translate(${f2(S.WX)},${f2(S.WY)}) scale(${s})">${S.letters.map((l) => `<path d="${l.d}"/>`).join('')}</g></g>`;
  }

  return `${svgOpen}<defs>${bgOn ? DEFS_BG : ''}${BG.defs}${defs}</defs>${BG.body}${under}${out}</svg>`;
}

// Sub-frames this frame needs for honest motion blur (180° shutter): one per ~2.4 px of blade-tip travel.
export function subframes(S, tLocal, fps) {
  const a = heroTime(S, tLocal - 0.25 / fps), b = heroTime(S, tLocal + 0.25 / fps);
  const px = (Math.abs(rotorAngle(b) - rotorAngle(a)) * Math.PI / 180) * cam(S, (a + b) / 2).r;
  return Math.max(1, Math.min(16, Math.ceil(px / 2.4)));
}
