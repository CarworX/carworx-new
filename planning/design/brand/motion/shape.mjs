// CarworX Turbine: pure geometry for the mark (no Node or browser APIs, so the preview can inline it).
// Mark space: centred on (0,0), tip radius 100, y down, 0° = straight up, clockwise positive.

export const COLOR = {
  ink: '#0d0f12',
  graphite: '#1c2128',
  steel: '#8a97a6',
  paper: '#f4efe6',
  white: '#ffffff',
  black: '#000000',
  signal: '#ff3b0a',
};

export const BLADES = 5;
export const PITCH = 360 / BLADES;

// Two optical sizes. "full" for 48 px and up; "small" (heavier blades, bigger hub) below that.
export const MARK = {
  full:  { rHub: 21, rTip: 100, sweep: 110, lead: 50, trail: -14, rootRound: 0.04, p: 0.42, q: 0.9 },
  small: { rHub: 27, rTip: 100, sweep: 92, lead: 64, trail: -10, rootRound: 0.04, p: 0.45, q: 0.85 },
};

// The X's rising stroke angle (degrees from vertical). Sora's own X is ~35°; 38° gives it lean.
export const X_ANGLE = 38;

const rad = (d) => (d * Math.PI) / 180;
export const f2 = (n) => (Math.abs(n) < 1e-9 ? 0 : +n.toFixed(2));
const params = (v) => (typeof v === 'string' ? MARK[v] : v);

// Centreline: a logarithmic spiral from hub to tip, the path air takes through an impeller.
// theta grows with ln(r), so the blade meets every radius at the same angle.
function centre(p, s) {
  const r = p.rHub + (p.rTip - p.rHub) * s;
  const th = (rad(p.sweep) * Math.log(r / p.rHub)) / Math.log(p.rTip / p.rHub);
  return { r, th };
}
const toXY = (r, th) => [r * Math.sin(th), -r * Math.cos(th)];

// Thickness either side of the centreline: a skewed beta curve, full near the root, needle at the tip.
// A negative trail value pulls the trailing edge over to the lead side, so the blade is a scythe, not a leaf.
function profile(s, amp, root, p, q) {
  const peak = p / (p + q);
  const norm = Math.pow(peak, p) * Math.pow(1 - peak, q);
  const a = (Math.pow(s, p) * Math.pow(1 - s, q)) / norm;
  const easeRoot = s < root ? Math.sin((Math.PI / 2) * (s / root)) : 1;
  return amp * a * easeRoot;
}

// Blade outline, lead edge hub→tip then trail edge tip→hub. k scales the thickness (0 = bare airflow line).
export function bladeOutline(variant = 'full', n = 96, k = 1) {
  const p = params(variant);
  const lead = [], trail = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const { r, th } = centre(p, s);
    lead.push(toXY(r, th + (k * profile(s, p.lead, p.rootRound, p.p, p.q)) / r));
    trail.push(toXY(r, th - (k * profile(s, p.trail, p.rootRound, p.p, p.q)) / r));
  }
  return { lead, trail: trail.reverse() };
}

// Catmull-Rom to cubic Béziers for an open run of points.
function smooth(pts, move = true) {
  let d = move ? `M${f2(pts[0][0])},${f2(pts[0][1])}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f2(c1[0])},${f2(c1[1])} ${f2(c2[0])},${f2(c2[1])} ${f2(p2[0])},${f2(p2[1])}`;
  }
  return d;
}

function thin(pts, keep) {
  const out = [];
  for (let i = 0; i <= keep; i++) out.push(pts[Math.round((i / keep) * (pts.length - 1))]);
  return out;
}

export function bladePath(variant = 'full', k = 1, keep = 40) {
  const { lead, trail } = bladeOutline(variant, 96, k);
  const t = thin(trail, keep);
  return smooth(thin(lead, keep)) + `L${f2(t[0][0])},${f2(t[0][1])}` + smooth(t, false) + 'Z';
}

// The airflow line along the centreline, with its length for dash drawing.
export function streamline(variant = 'full', n = 32) {
  const p = params(variant);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const { r, th } = centre(p, i / n);
    pts.push(toXY(r, th));
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { d: smooth(pts), len };
}

// Blade-tip direction of the unrotated top blade, degrees from vertical, clockwise.
export function tipTangent(variant = 'full') {
  const p = params(variant);
  const a = centre(p, 0.97), b = centre(p, 1);
  const [x1, y1] = toXY(a.r, a.th), [x2, y2] = toXY(b.r, b.th);
  return (Math.atan2(x2 - x1, -(y2 - y1)) * 180) / Math.PI;
}

// Resting rotation: turns the rotor so one blade's tip runs exactly parallel to the X's rising stroke.
export function restAngle(variant = 'full') {
  return (((X_ANGLE - tipTangent(variant)) % PITCH) + PITCH) % PITCH;
}

// A rotor group. d defaults to the finished blade.
export function rotorSVG({ cx = 0, cy = 0, radius = 100, fill = COLOR.ink, variant = 'full', rotate = restAngle(variant), d = bladePath(variant), attrs = '' } = {}) {
  const k = radius / 100;
  let s = `<g transform="translate(${f2(cx)},${f2(cy)}) scale(${+k.toFixed(4)}) rotate(${+rotate.toFixed(4)})" fill="${fill}"${attrs}>`;
  for (let i = 0; i < BLADES; i++) s += `<path transform="rotate(${i * PITCH})" d="${d}"/>`;
  return s + '</g>';
}
