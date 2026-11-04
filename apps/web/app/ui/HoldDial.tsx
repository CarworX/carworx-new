const C = 502.7; // ring circumference: 2π × 80

/** "14 minutes 32 seconds left": the dial's accessible name, in words. */
export function timeInWords(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const part = (n: number, unit: string) =>
    `${String(n)} ${unit}${n === 1 ? "" : "s"}`;
  if (s === 0) return "Time is up";
  return (
    [m ? part(m, "minute") : "", r ? part(r, "second") : ""]
      .filter(Boolean)
      .join(" ") + " left"
  );
}

export const mmss = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

interface HoldDialProps {
  /** Seconds left on the hold. */
  secondsLeft: number;
  /** The hold length; 15 minutes after a business accepts. */
  total?: number;
  /** What is held, under the digits. */
  caption?: string;
  /** Paid: the ring switches to ok. */
  paid?: boolean;
  size?: number;
}

/**
 * The 15-minute hold dial. The ring is signal: the one place it means
 * "counting down". Reduced motion: the digits update, the ring doesn't animate.
 */
export function HoldDial({
  secondsLeft,
  total = 900,
  caption = "Slot held",
  paid = false,
  size = 200,
}: HoldDialProps) {
  const elapsed = Math.min(total, Math.max(0, total - secondsLeft));
  const offset = paid ? 0 : (C * elapsed) / total;
  return (
    <div
      className={paid ? "cx-dial done" : "cx-dial"}
      style={{ width: size }}
      role="img"
      aria-label={
        paid
          ? "Paid. The slot is yours."
          : `${timeInWords(secondsLeft)} on the hold`
      }
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="track" cx="100" cy="100" r="80" />
        <circle
          className="meter"
          cx="100"
          cy="100"
          r="80"
          style={{ strokeDashoffset: offset.toFixed(1) }}
        />
      </svg>
      <div className="read" aria-hidden="true">
        <b>{paid ? "Paid" : mmss(secondsLeft)}</b>
        <small>{caption}</small>
      </div>
    </div>
  );
}
