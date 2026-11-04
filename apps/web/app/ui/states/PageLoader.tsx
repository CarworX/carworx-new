import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "../motion";
import { startRipple } from "./ripple";

interface PageLoaderProps {
  /** Fill the viewport (between pages) or the parent box (previews). */
  fullScreen?: boolean;
  /** Force the reduced-motion still, e.g. to compare it on the living page. */
  still?: boolean;
  label?: string;
}

/**
 * The main loading screen between pages: the dot-grid ripple. Reduced motion:
 * one frozen wave and the rotor at rest as the solid logo.
 */
export function PageLoader({
  fullScreen = true,
  still = false,
  label = "Loading",
}: PageLoaderProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion() || still;
  useEffect(() => {
    if (!root.current || !canvas.current) return;
    // In a box, the board's smaller grid: a 22 px rotor on a 16 px pitch.
    const box = fullScreen ? {} : { R: 22, pitch: 16, base: 1.1, speed: 190 };
    return startRipple({
      root: root.current,
      canvas: canvas.current,
      reduced,
      ...box,
    });
  }, [reduced, fullScreen]);
  return (
    <div
      ref={root}
      className={fullScreen ? "cx-ripple full" : "cx-ripple box"}
      role="status"
    >
      <canvas ref={canvas} aria-hidden="true" />
      <p className="cap">{label.toUpperCase()}</p>
    </div>
  );
}

/** The ripple shrunk to a 5 × 5 patch with no rotor, for a button. */
export function RipplePatch({
  dark = false,
  still = false,
}: {
  dark?: boolean;
  still?: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion() || still;
  useEffect(() => {
    if (!root.current || !canvas.current) return;
    return startRipple({
      root: root.current,
      canvas: canvas.current,
      reduced,
      R: 0,
      pitch: 5,
      base: 0.8,
      speed: 26,
      off: 3,
      dark,
    });
  }, [reduced, dark]);
  return (
    <span
      ref={root}
      className="cx-ripple"
      style={{ display: "block", width: 26, height: 26 }}
      aria-hidden="true"
    >
      <canvas ref={canvas} />
    </span>
  );
}
