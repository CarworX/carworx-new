import {
  BLADE,
  LOCKUP_MARK_TRANSFORM,
  LOCKUP_VIEWBOX,
  LOCKUP_WORD_TRANSFORM,
  REST,
  WORDMARK,
} from "./mark.generated";

/** The horizontal lockup, drawn from the exported logo's own paths. */
export function Lockup({ title = "CarworX" }: { title?: string }) {
  return (
    <svg
      viewBox={LOCKUP_VIEWBOX}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <g fill="currentColor">
        <g transform={LOCKUP_MARK_TRANSFORM}>
          {[0, 72, 144, 216, 288].map((a) => (
            <path key={a} transform={`rotate(${String(a)})`} d={BLADE} />
          ))}
        </g>
        <g transform={LOCKUP_WORD_TRANSFORM}>
          {WORDMARK.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** The turbine mark on its own, at its rest angle (decoration: no name). */
export function Mark() {
  return (
    <svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <g fill="currentColor" transform={`rotate(${String(REST)})`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} transform={`rotate(${String(a)})`} d={BLADE} />
        ))}
      </g>
    </svg>
  );
}
