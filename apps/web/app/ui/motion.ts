import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
  };
}

/**
 * True when the viewer asked for reduced motion. The server and the first
 * client render assume motion; CSS media queries carry the still until then.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const D2R = Math.PI / 180;
/** One blade index of the Turbine rotor, in degrees. */
export const PITCH = 72;
/** The brand's mechanical overshoot after an index, in degrees. */
export const OVERSHOOT = 1.8;
