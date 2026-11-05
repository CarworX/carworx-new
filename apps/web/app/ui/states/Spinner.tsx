/**
 * The hold dial in a button: a plain spinning arc. White on the ink pill,
 * blue on light pills. Decorative: the button's label says what is happening.
 * Reduced motion: the arc stops (CSS), still showing a quarter ring.
 */
export function Spinner({ tone = "blue" }: { tone?: "light" | "blue" }) {
  const light = tone === "light";
  return (
    <svg
      className="cx-spin"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke={light ? "rgba(255,255,255,.22)" : "rgba(13,15,18,.12)"}
        strokeWidth="2.2"
      />
      <g className="arc">
        <path
          d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5"
          fill="none"
          stroke={light ? "var(--white)" : "var(--blue)"}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
