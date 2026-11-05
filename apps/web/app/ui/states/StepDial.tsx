const R = 78;
const C = 2 * Math.PI * R;

interface StepDialProps {
  /** One honest line per step: what is happening now. */
  steps: readonly string[];
  /** Index of the step in progress; steps.length when done. */
  step: number;
  /** 0–1 within the current step. The ring never claims more than it knows. */
  progress?: number;
  done?: string;
  size?: number;
  /** Small dials (in a card) drop the centre read-out. */
  compact?: boolean;
}

/**
 * The hold dial as an in-page loader for a multi-step wait the user is
 * watching (search, availability, quotes). Blue, never signal: loading is not
 * a countdown. The status line is a polite live region.
 */
export function StepDial({
  steps,
  step,
  progress = 0,
  done = "Done. Showing results.",
  size = 132,
  compact = false,
}: StepDialProps) {
  const n = steps.length;
  const finished = step >= n;
  const f = finished
    ? 1
    : (step + 0.92 * Math.min(1, Math.max(0, progress))) / n;
  const a = f * Math.PI * 2;
  const line = finished ? done : (steps[step] ?? "");
  return (
    <div className="cx-hd">
      <div
        className="dial"
        style={{ width: size, height: size }}
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={Math.min(step, n)}
        aria-valuetext={
          finished ? done : `Step ${String(step + 1)} of ${String(n)}`
        }
      >
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient
              id={`cx-hd-${String(size)}`}
              x1="0"
              x2="1"
              y1="0"
              y2="1"
            >
              <stop offset="0" stopColor="var(--blue-soft)" />
              <stop offset="1" stopColor="var(--blue)" />
            </linearGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="rgba(13,15,18,.07)"
            strokeWidth="10"
          />
          <circle
            className="arc"
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={`url(#cx-hd-${String(size)})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(f * C).toFixed(1)} ${C.toFixed(1)}`}
          />
          {f > 0.01 && f < 0.999 ? (
            <circle
              cx={(100 + R * Math.cos(a)).toFixed(1)}
              cy={(100 + R * Math.sin(a)).toFixed(1)}
              r="7"
              fill="#fff"
              stroke="var(--blue)"
              strokeWidth="3"
            />
          ) : null}
        </svg>
        {compact ? null : (
          <div className="read" aria-hidden="true">
            <b style={{ fontSize: Math.round(size * 0.15) }}>
              {finished ? "✓" : `${String(step + 1)}/${String(n)}`}
            </b>
            <small>STEPS</small>
          </div>
        )}
      </div>
      <p className="line" role="status" aria-live="polite">
        {line}
      </p>
    </div>
  );
}
