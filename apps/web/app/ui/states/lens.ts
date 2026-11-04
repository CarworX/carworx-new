// The D-041 404: the dot-grid lens. Ported from SCENES['404-4'] in
// planning/design/concepts/states/src/template.html (the approved build in
// planning/design/states/index.html). Same grid, numerals, loupe, springs,
// pressure waves and rotor index; sized to its container instead of the
// window so it can sit inside the living page as well as fill the 404.
import { REST } from "../brand/mark.generated";
import { inOutCubic, lerp, OVERSHOOT, PITCH } from "../motion";
import { drawMark, fit, loopWhileVisible, palette } from "./canvas";

const SUB = 12; // the numerals' sub-grid, aligned with the 24 px canvas grid
const MS = 4; // mask samples per dot
const settle = (v: number) =>
  OVERSHOOT * Math.exp(-6.5 * v) * Math.cos(2 * Math.PI * 1.7 * v);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  fs: number;
  cap: number;
  rr: number;
  x4a: number;
  x4b: number;
  rx: number;
  ry: number;
  cy: number;
}

export interface LensOptions {
  root: HTMLElement; // positioned container; the canvas fills it
  canvas: HTMLCanvasElement;
  slot: HTMLElement; // where the numerals go
  reduced: boolean;
}

export function startLens({
  root,
  canvas,
  slot,
  reduced,
}: LensOptions): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  const col = palette(root);
  let W = 0;
  let H = 0;
  let dpr = 1;
  let n = 0;
  let RX = new Float32Array(0);
  let RY = RX;
  let OX = RX;
  let OY = RX;
  let VX = RX;
  let VY = RX;
  let COV = RX;
  let KIND = new Uint8Array(0);
  let rotIdx: number[] = [];
  let box: Box | null = null;
  let mask: {
    g: CanvasRenderingContext2D;
    cw: number;
    ch: number;
    rq: [number, number, number, number];
  } | null = null;
  const lens = { x: 0, y: 0, vx: 0, vy: 0, R: 140, on: 1 };
  let waves: { x: number; y: number; r: number; a: number }[] = [];
  const rot = { a: REST, from: REST, t0: -9, next: 2.4 };
  let T = 0;
  const ptr = { x: 0, y: 0, at: -1e9 };

  function rasterNumerals(b: Box, angle: number) {
    const cw = Math.ceil(b.w / SUB) * MS;
    const ch = Math.ceil(b.h / SUB) * MS;
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return;
    g.scale(MS / SUB, MS / SUB);
    g.fillStyle = "#000";
    g.font = `500 ${String(b.fs)}px Geist, sans-serif`;
    g.textBaseline = "alphabetic";
    const y = b.h * 0.5 + b.cap / 2;
    g.fillText("4", b.x4a - b.x, y);
    g.fillText("4", b.x4b - b.x, y);
    drawMark(g, b.rx - b.x, b.h / 2, b.rr, angle);
    const r = b.rr * 1.1;
    const q = [b.rx - b.x - r, b.h / 2 - r, 2 * r, 2 * r].map(
      (v) => (v * MS) / SUB,
    );
    mask = {
      g,
      cw,
      ch,
      rq: [
        Math.floor(q[0] ?? 0),
        Math.floor(q[1] ?? 0),
        Math.ceil(q[2] ?? 0) + 1,
        Math.ceil(q[3] ?? 0) + 1,
      ],
    };
  }
  function redrawRotor(b: Box, angle: number) {
    if (!mask) return;
    const { g, rq } = mask;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(...rq);
    g.beginPath();
    g.rect(...rq);
    g.clip();
    g.scale(MS / SUB, MS / SUB);
    g.fillStyle = "#000";
    drawMark(g, b.rx - b.x, b.h / 2, b.rr, angle);
    g.restore();
  }
  function layout(): Box {
    const r0 = root.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    const left = s.left - r0.left;
    const topS = s.top - r0.top;
    const fs = Math.min(s.height / 0.74, s.width / 2.15);
    const m = document.createElement("canvas").getContext("2d");
    if (m) m.font = `500 ${String(fs)}px Geist, sans-serif`;
    const w4 = m ? m.measureText("4").width : fs * 0.6;
    const cap = fs * 0.7;
    const rr = cap * 0.52;
    const gap = fs * 0.03;
    const total = w4 * 2 + rr * 2 + gap * 2;
    const x0 = left + (s.width - total) / 2;
    const top = topS + (s.height - cap) / 2;
    const snap = (v: number) => Math.floor((v - 1) / 24) * 24 + 1;
    const x = snap(x0 - 12);
    const y = snap(top - 24);
    const w = Math.ceil((total + 48) / 24) * 24;
    const h = Math.ceil((cap + 72) / 24) * 24;
    return {
      x,
      y,
      w,
      h,
      fs,
      cap,
      rr,
      x4a: x0,
      rx: x0 + w4 + gap + rr,
      x4b: x0 + w4 + gap * 2 + rr * 2,
      cy: y + h / 2,
      ry: y + h / 2,
    };
  }
  function coverage(b: Box, angle: number, all: boolean) {
    if (all) rasterNumerals(b, angle);
    else redrawRotor(b, angle);
    if (!mask) return;
    const [x0, y0, w, h] = all ? [0, 0, mask.cw, mask.ch] : mask.rq;
    const d = mask.g.getImageData(x0, y0, w, h).data;
    const idx = all ? Array.from({ length: n }, (_, k) => k) : rotIdx;
    for (const i of idx) {
      if (KIND[i] === 0) continue;
      const cx = Math.round(((RX[i] ?? 0) - b.x) / SUB) * MS - x0;
      const cy = Math.round(((RY[i] ?? 0) - b.y) / SUB) * MS - y0;
      let sum = 0;
      for (let yy = -2; yy < 2; yy++)
        for (let xx = -2; xx < 2; xx++) {
          const px = cx + xx;
          const py = cy + yy;
          if (px >= 0 && py >= 0 && px < w && py < h)
            sum += d[(py * w + px) * 4 + 3] ?? 0;
        }
      COV[i] = sum / (16 * 255);
    }
  }
  function build() {
    const b = layout();
    box = b;
    const cols = Math.ceil(W / 24) + 1;
    const rows = Math.ceil(H / 24) + 1;
    const bc = Math.ceil(b.w / SUB);
    const br = Math.ceil(b.h / SUB);
    const max = cols * rows + bc * br;
    RX = new Float32Array(max);
    RY = new Float32Array(max);
    OX = new Float32Array(max);
    OY = new Float32Array(max);
    VX = new Float32Array(max);
    VY = new Float32Array(max);
    COV = new Float32Array(max);
    KIND = new Uint8Array(max);
    n = 0;
    rotIdx = [];
    const inBox = (x: number, y: number) =>
      x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = 1 + i * 24;
        const y = 1 + j * 24;
        if (inBox(x, y)) continue;
        RX[n] = x;
        RY[n] = y;
        KIND[n] = 0;
        n++;
      }
    for (let j = 0; j < br; j++)
      for (let i = 0; i < bc; i++) {
        const x = b.x + i * SUB;
        const y = b.y + j * SUB;
        RX[n] = x;
        RY[n] = y;
        const nearRotor =
          Math.abs(x - b.rx) < b.rr * 1.08 + SUB &&
          Math.abs(y - b.ry) < b.rr * 1.08 + SUB;
        KIND[n] = nearRotor ? 2 : 1;
        if (nearRotor) rotIdx.push(n);
        n++;
      }
    coverage(b, rot.a, true);
  }
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col.canvas;
    ctx.fillRect(0, 0, W, H);
    const L = lens;
    const R = L.R;
    const R2 = R * R;
    const sub = W < 700 ? 2.3 : 3.2;
    if (L.on > 0.01) {
      // the loupe's shadow and glass sit under the dots
      const g = ctx.createRadialGradient(
        L.x + 6,
        L.y + 18,
        R * 0.7,
        L.x + 6,
        L.y + 18,
        R * 1.18,
      );
      g.addColorStop(0, "rgba(13,15,18,0)");
      g.addColorStop(0.5, `rgba(13,15,18,${String(0.07 * L.on)})`);
      g.addColorStop(1, "rgba(13,15,18,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(L.x + 6, L.y + 18, R * 1.18, 0, 6.283);
      ctx.fill();
      const gg = ctx.createRadialGradient(
        L.x - R * 0.3,
        L.y - R * 0.35,
        0,
        L.x,
        L.y,
        R,
      );
      gg.addColorStop(0, `rgba(255,255,255,${String(0.42 * L.on)})`);
      gg.addColorStop(0.75, `rgba(227,234,255,${String(0.16 * L.on)})`);
      gg.addColorStop(1, `rgba(227,234,255,${String(0.4 * L.on)})`);
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(L.x, L.y, R, 0, 6.283);
      ctx.fill();
    }
    // grid, grid in the lens, numeral, numeral in the lens
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < n; i++) {
      const k = KIND[i] ?? 0;
      const cov = COV[i] ?? 0;
      if (k && cov < 0.04) continue;
      const rx = RX[i] ?? 0;
      const ry = RY[i] ?? 0;
      const x = rx + (OX[i] ?? 0);
      const y = ry + (OY[i] ?? 0);
      const dx = rx - L.x;
      const dy = ry - L.y;
      const d2 = dx * dx + dy * dy;
      let f = 0;
      if (d2 < R2) {
        f = 1 - Math.sqrt(d2) / R;
        f = f * f * (3 - 2 * f) * L.on;
      }
      let r = k ? sub * Math.sqrt(cov) : 1.15;
      r *= 1 + (k ? 0.9 : 1.9) * f;
      const p = paths[(k ? 2 : 0) + (f > 0.18 ? 1 : 0)];
      p?.moveTo(x + r, y);
      p?.arc(x, y, r, 0, 6.283);
    }
    const [p0, p1, p2, p3] = paths as [Path2D, Path2D, Path2D, Path2D];
    ctx.fillStyle = "rgba(13,15,18,.13)";
    ctx.fill(p0);
    ctx.fillStyle = "rgba(42,84,212,.42)";
    ctx.fill(p1);
    ctx.fillStyle = col.ink;
    ctx.fill(p2);
    ctx.fillStyle = col.blue;
    ctx.fill(p3);
    if (L.on > 0.01) {
      // rim and a highlight, like a glass loupe on the desk
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(13,15,18,${String(0.14 * L.on)})`;
      ctx.beginPath();
      ctx.arc(L.x, L.y, R, 0, 6.283);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(255,255,255,${String(0.9 * L.on)})`;
      ctx.beginPath();
      ctx.arc(L.x, L.y, R - 3, Math.PI * 1.05, Math.PI * 1.55);
      ctx.stroke();
    }
  }
  function physics(dt: number) {
    const L = lens;
    const R = L.R;
    const R2 = R * R;
    const K = 210;
    const C = 15;
    const push = 0.55 * L.on;
    for (let i = 0; i < n; i++) {
      const rx = RX[i] ?? 0;
      const ry = RY[i] ?? 0;
      const dx = rx - L.x;
      const dy = ry - L.y;
      const d2 = dx * dx + dy * dy;
      let tx = 0;
      let ty = 0;
      if (d2 < R2) {
        const f = 1 - Math.sqrt(d2) / R;
        const m = push * f * f;
        tx = dx * m;
        ty = dy * m;
      }
      const ox = OX[i] ?? 0;
      const oy = OY[i] ?? 0;
      let vx = VX[i] ?? 0;
      let vy = VY[i] ?? 0;
      let ax = K * (tx - ox) - C * vx;
      let ay = K * (ty - oy) - C * vy;
      for (const w of waves) {
        const wx = rx - w.x;
        const wy = ry - w.y;
        const d = Math.sqrt(wx * wx + wy * wy) + 0.01;
        const q = (d - w.r) / 26;
        const g = Math.exp(-q * q) * w.a;
        if (g > 0.01) {
          ax += (wx / d) * g * 5200;
          ay += (wy / d) * g * 5200;
        }
      }
      vx += ax * dt;
      vy += ay * dt;
      VX[i] = vx;
      VY[i] = vy;
      OX[i] = ox + vx * dt;
      OY[i] = oy + vy * dt;
    }
  }
  function resize() {
    W = root.clientWidth;
    H = root.clientHeight;
    dpr = fit(canvas, W, H, 2);
    lens.R = W < 700 ? 74 : 150;
    build();
    if (!box) return;
    if (reduced) {
      // the still: the loupe rests over the rotor and nothing moves
      lens.x = box.rx;
      lens.y = box.ry;
      lens.on = 1;
      OX.fill(0);
      OY.fill(0);
      for (let s = 0; s < 90; s++) physics(1 / 60);
      draw();
    } else if (!lens.x) {
      lens.x = box.rx;
      lens.y = box.ry;
    }
  }
  function frame(_t: number, dt: number) {
    if (!box || reduced) return;
    T += dt;
    let tx = ptr.x;
    let ty = ptr.y;
    if (performance.now() - ptr.at > 3000) {
      // idle: the loupe drifts along the numerals
      const g = T * 0.5;
      tx = box.x + box.w * (0.5 + 0.42 * Math.sin(g));
      ty = box.cy + box.h * 0.22 * Math.sin(g * 1.7);
    }
    const k = 90;
    const c = 2 * 0.8 * Math.sqrt(k);
    lens.vx += (k * (tx - lens.x) - c * lens.vx) * dt;
    lens.vy += (k * (ty - lens.y) - c * lens.vy) * dt;
    lens.x += lens.vx * dt;
    lens.y += lens.vy * dt;
    // the rotor 0 indexes one blade every 3.2 s, re-lighting its dots as it turns
    if (T > rot.next) {
      rot.from = rot.a;
      rot.t0 = T;
      rot.next = T + 3.2;
    }
    const u = T - rot.t0;
    if (u < 1.2) {
      const tgt = rot.from + PITCH;
      rot.a =
        u < 0.42
          ? lerp(rot.from, tgt + OVERSHOOT, inOutCubic(u / 0.42))
          : tgt + settle(u - 0.42);
      coverage(box, rot.a, false);
    }
    for (const w of waves) {
      w.r += 620 * dt;
      w.a *= Math.exp(-1.8 * dt);
    }
    waves = waves.filter((w) => w.a > 0.03);
    physics(Math.min(dt, 1 / 40));
    draw();
  }

  const local = (e: PointerEvent) => {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMove = (e: PointerEvent) => {
    const p = local(e);
    ptr.x = p.x;
    ptr.y = p.y;
    ptr.at = performance.now();
  };
  const onDown = (e: PointerEvent) => {
    onMove(e);
    const target = e.target instanceof Element ? e.target : null;
    if (!reduced && !target?.closest("a,button"))
      waves.push({ ...local(e), r: 0, a: 1 });
  };

  let stopLoop: () => void = () => undefined;
  let alive = true;
  const ro = new ResizeObserver(() => {
    resize();
  });
  // The numerals are drawn in Geist: wait for the self-hosted face first.
  void document.fonts.load("500 100px Geist").finally(() => {
    if (!alive) return;
    root.dataset["live"] = "";
    resize();
    ro.observe(root);
    if (!reduced) stopLoop = loopWhileVisible(root, frame);
  });
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerdown", onDown);
  return () => {
    alive = false;
    ro.disconnect();
    stopLoop();
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerdown", onDown);
    delete root.dataset["live"];
  };
}
