import { useState, useSyncExternalStore } from "react";

import { usePrefersReducedMotion } from "./motion";

const noop = () => () => {};
const yes = () => true;
const no = () => false;

/** Milliseconds between chained segments on a jump of more than one step. */
const CHAIN_MS = 231;
/** The whole chain never waits longer than this before the last segment. */
const CHAIN_CAP_MS = 640;

interface SegmentedProgressProps {
  /** Zero-based index of the current step. */
  step: number;
  /** Number of steps (segments). */
  total: number;
  /** The current step's name, shown on the left ("Location"). */
  name: string;
  /** Accessible name for the bar, for example "Application progress". */
  label: string;
}

/**
 * The approved segmented progress bar (owner, 2026-11-12). One segment per
 * step: going forward fills the next segment left to right, going back drains
 * it right to left, and a jump of several steps chains them in order. Under
 * reduced motion the segments switch instantly (CSS and no delays).
 */
export function SegmentedProgress({
  step,
  total,
  name,
  label,
}: SegmentedProgressProps) {
  const reduced = usePrefersReducedMotion();
  // Previous-step-in-state: remember where we came from without a ref read
  // during render.
  const [seen, setSeen] = useState({ step, from: step });
  if (seen.step !== step) setSeen({ step, from: seen.step });
  const from = seen.from;
  // Server and hydration paint draw in place ("still"); the client takes over.
  const ready = useSyncExternalStore(noop, yes, no);

  const at = Math.min(Math.max(step, 0), total - 1);
  const span = Math.abs(at - from);
  const per = reduced || span < 2 ? 0 : Math.min(CHAIN_MS, CHAIN_CAP_MS / span);
  const dir = at >= from ? "fwd" : "back";
  const count = `${String(at + 1)} of ${String(total)}`;

  return (
    <div
      className={`cx-segbar${ready ? "" : " still"}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={at + 1}
      aria-valuetext={`Step ${String(at + 1)} of ${String(total)}: ${name}`}
    >
      <div className="segrow" aria-hidden="true">
        <span key={`n-${name}`} className={`segname ${ready ? dir : ""}`}>
          {name}
        </span>
        <span key={`c-${count}`} className={`segcount ${ready ? dir : ""}`}>
          {count}
        </span>
      </div>
      <div className="segs">
        {Array.from({ length: total }, (_, k) => {
          let delay = 0;
          // Forward: segments after `from` fill in order, left to right.
          if (at > from && k > from && k <= at) delay = (k - from - 1) * per;
          // Back: segments after `at` drain in reverse, right to left.
          if (at < from && k > at && k <= from) delay = (from - k) * per;
          return (
            <span key={k} className={`seg${k <= at ? " on" : ""}`} data-seg={k}>
              <i
                style={
                  delay ? { transitionDelay: `${String(delay)}ms` } : undefined
                }
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
