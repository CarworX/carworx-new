// Canvas helpers shared by the lens 404 and the ripple loader. Browser only.
import { BLADE, BLADE_SMALL } from "../brand/mark.generated";
import { D2R, PITCH } from "../motion";

let blades: { full: Path2D; small: Path2D } | null = null;
function bladePaths() {
  blades ??= { full: new Path2D(BLADE), small: new Path2D(BLADE_SMALL) };
  return blades;
}

/** Draws the mark with tip radius r, rotated deg (REST = the logo). */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  deg: number,
  small = false,
) {
  const p = small ? bladePaths().small : bladePaths().full;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 100, r / 100);
  ctx.rotate(deg * D2R);
  for (let i = 0; i < 5; i++) {
    ctx.fill(p);
    ctx.rotate(PITCH * D2R);
  }
  ctx.restore();
}

/** Sizes a canvas for its CSS box at up to `cap` device pixels per px. */
export function fit(cv: HTMLCanvasElement, w: number, h: number, cap = 2) {
  const d = Math.min(window.devicePixelRatio || 1, cap);
  const W = Math.max(1, Math.round(w * d));
  const H = Math.max(1, Math.round(h * d));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  return d;
}

/** Studio colours as the page resolved them (one source: the tokens). */
export function palette(el: Element) {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    canvas: v("--canvas", "#f2f1ee"),
    ink: v("--ink", "#0d0f12"),
    blue: v("--blue", "#3d6dff"),
  };
}

/**
 * Runs `frame` on requestAnimationFrame while the element is on screen and
 * the tab is visible. Returns a stop function.
 */
export function loopWhileVisible(
  el: Element,
  frame: (t: number, dt: number) => void,
): () => void {
  let raf = 0;
  let last = 0;
  let onScreen = false;
  const tick = (ms: number) => {
    raf = requestAnimationFrame(tick);
    const t = ms / 1000;
    const dt = last ? Math.min(t - last, 0.1) : 1 / 60;
    last = t;
    frame(t, dt);
  };
  const sync = () => {
    const run = onScreen && !document.hidden;
    if (run && !raf) {
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const io = new IntersectionObserver((es) => {
    onScreen = es.some((e) => e.isIntersecting);
    sync();
  });
  io.observe(el);
  document.addEventListener("visibilitychange", sync);
  return () => {
    io.disconnect();
    document.removeEventListener("visibilitychange", sync);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
