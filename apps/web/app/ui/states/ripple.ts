// The D-041 loading screen between pages: the dot-grid ripple with the blade
// pulse. Ported from rippleField, bladePulse, biAngle and rippleScene in
// planning/design/concepts/states/src/template.html.
import { REST, REST_SMALL } from "../brand/mark.generated";
import { clamp, inOutCubic, lerp, OVERSHOOT, PITCH } from "../motion";
import { drawMark, fit, loopWhileVisible, palette } from "./canvas";

const MK = { rHub: 21, rTip: 100 };
const MK_S = { rHub: 27, rTip: 100 };
const PALE = "rgba(13,15,18,.14)";

/** The ratchet: a quick 72° index, a hard stop, a 1.8° overshoot that settles. */
export function biAngle(t: number, rest: number) {
  const k = Math.floor(t / 1.2);
  const u = t - k * 1.2;
  const base = rest + k * PITCH;
  if (u < 0.3)
    return (
      base -
      PITCH +
      PITCH * inOutCubic(u / 0.3) +
      OVERSHOOT * inOutCubic(u / 0.3)
    );
  return (
    base +
    OVERSHOOT *
      Math.exp(-14 * (u - 0.3)) *
      Math.cos(2 * Math.PI * 3 * (u - 0.3))
  );
}

/** Radius (mark units) of the ink front at time t: hub→tips, then back. */
export function pulseFront(t: number, small: boolean) {
  const T = t + 0.9;
  const k = Math.floor(T / 1.2);
  const p = inOutCubic(clamp((T - k * 1.2) / 0.45));
  const f = 2;
  const hub = (small ? MK_S : MK).rHub - f;
  const tip = MK.rTip + f;
  return k % 2 ? lerp(tip, hub, p) : lerp(hub, tip, p);
}

interface Grid {
  xs: number[];
  ys: number[];
  ds: number[];
  ux: number[];
  uy: number[];
  reach: number;
}

export interface RippleOptions {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  reduced: boolean;
  /** Rotor tip radius in px; 0 for the 5 × 5 button patch. */
  R?: number;
  pitch?: number;
  base?: number;
  speed?: number;
  off?: number;
  /** Paint on ink, for the patch inside the ink pill. */
  dark?: boolean;
}

export function startRipple(o: RippleOptions): () => void {
  const ctx = o.canvas.getContext("2d");
  if (!ctx) return () => undefined;
  const col = palette(o.root);
  let W = 0;
  let H = 0;
  let dpr = 1;
  let grid: Grid | null = null;
  let T = 0;

  const params = () => {
    const full = o.R === undefined;
    return {
      R: full ? clamp(Math.min(W, H) * 0.08, 36, 56) : (o.R ?? 0),
      pitch: o.pitch ?? 24,
      base: o.base ?? 1.15,
      speed: o.speed ?? (full ? clamp(Math.max(W, H) * 0.26, 220, 380) : 190),
      off: o.off ?? 1,
    };
  };

  function makeGrid(
    cx: number,
    cy: number,
    pitch: number,
    R: number,
    off: number,
  ): Grid {
    const xs: number[] = [];
    const ys: number[] = [];
    const ds: number[] = [];
    const ux: number[] = [];
    const uy: number[] = [];
    for (let y = off; y < H + pitch; y += pitch)
      for (let x = off; x < W + pitch; x += pitch) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R * 1.5) continue;
        xs.push(x);
        ys.push(y);
        ds.push(d);
        ux.push(dx / d);
        uy.push(dy / d);
      }
    return {
      xs,
      ys,
      ds,
      ux,
      uy,
      reach: Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)),
    };
  }

  function paint(t: number) {
    if (!ctx) return;
    const p = params();
    const cx = W / 2;
    const cy = H / 2;
    grid ??= makeGrid(cx, cy, p.pitch, p.R, p.off);
    const g = grid;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = o.dark ? col.ink : col.canvas;
    ctx.fillRect(0, 0, W, H);
    // the field: rings leave the rotor once per index, with a smaller echo
    const tt = o.reduced ? 0.28 : t;
    const maxA = o.reduced ? 0.9 : 1;
    const period = 1.2;
    const rings: number[] = [];
    for (let k = 0; k < 6; k++) {
      const r = ((tt % period) + k * period) * p.speed;
      if (r < g.reach + p.pitch * 4)
        rings.push(r, Math.pow(Math.max(0, 1 - r / g.reach), 0.7) * maxA);
    }
    const w1 = p.pitch * 1.4;
    const w2 = p.pitch * 1.2;
    const lag = p.pitch * 2.4;
    const cut = p.pitch * 5;
    const pA = new Path2D();
    const pB = new Path2D();
    const pC = new Path2D();
    for (let i = 0; i < g.ds.length; i++) {
      const d = g.ds[i] ?? 0;
      let crest = 0;
      for (let k = 0; k < rings.length; k += 2) {
        const r = rings[k] ?? 0;
        if (d < r - lag - cut || d > r + cut) continue;
        const q = (d - r) / w1;
        const e = (d - r + lag) / w2;
        crest +=
          (Math.exp(-q * q) + 0.35 * Math.exp(-e * e)) * (rings[k + 1] ?? 0);
      }
      crest = Math.min(1.4, crest);
      const push = crest * p.pitch * 0.2;
      const px = (g.xs[i] ?? 0) + (g.ux[i] ?? 0) * push;
      const py = (g.ys[i] ?? 0) + (g.uy[i] ?? 0) * push;
      const rr = p.base * (1 + 2.6 * crest);
      const path = crest > 0.55 ? pC : crest > 0.18 ? pB : pA;
      path.moveTo(px + rr, py);
      path.arc(px, py, rr, 0, 6.283);
    }
    ctx.fillStyle = "rgba(13,15,18,.13)";
    ctx.fill(pA);
    ctx.fillStyle = "rgba(42,84,212,.4)";
    ctx.fill(pB);
    ctx.fillStyle = col.blue;
    ctx.fill(pC);
    if (p.R > 0) {
      const small = p.R < 24;
      const rest = small ? REST_SMALL : REST;
      if (o.reduced) {
        // the still: the rotor at rest as the solid logo, not pulsing
        ctx.fillStyle = col.ink;
        drawMark(ctx, cx, cy, p.R, rest, small);
      } else {
        // blade pulse: ink inside the front, pale outside, in mark units
        const f = 2;
        const outer = MK.rTip + f * 2;
        const r = pulseFront(t, small);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
        grad.addColorStop(clamp((r - f / 2) / outer), col.ink);
        grad.addColorStop(clamp((r + f / 2) / outer), PALE);
        ctx.fillStyle = grad;
        drawMark(ctx, cx, cy, p.R, biAngle(t + 0.9, rest), small);
      }
    }
  }

  function resize() {
    W = Math.max(10, o.root.clientWidth);
    H = Math.max(10, o.root.clientHeight);
    dpr = fit(o.canvas, W, H, 2);
    grid = null;
    paint(T);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(o.root);
  resize();
  const stop = o.reduced
    ? () => undefined
    : loopWhileVisible(o.root, (_t, dt) => {
        T += dt;
        paint(T);
      });
  return () => {
    ro.disconnect();
    stop();
  };
}
