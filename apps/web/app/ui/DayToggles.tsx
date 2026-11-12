import { useId } from "react";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

/** Times from 05:00 to 22:00 every 30 minutes, for the open and close selects. */
export const TIMES: readonly string[] = Array.from({ length: 35 }, (_, i) => {
  const m = 5 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
});

/**
 * Opening hours as taps: a toggle per day plus open and close selects.
 * Mon–Fri and 08:00–17:00 are the defaults, so most businesses just tap Next.
 */
export function DayToggles({
  legend,
  hint,
  name = "days",
  defaultDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  defaultOpen = "08:00",
  defaultClose = "17:00",
}: {
  legend: string;
  hint?: string;
  name?: string;
  defaultDays?: readonly Day[];
  defaultOpen?: string;
  defaultClose?: string;
}) {
  const id = useId();
  return (
    <fieldset
      className="cx-field cx-choice"
      aria-describedby={hint ? `${id}-hint` : undefined}
    >
      <legend className="lbl">{legend}</legend>
      {hint ? (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      ) : null}
      <div className="cx-days">
        {DAYS.map((d) => (
          <label key={d} className="cx-day">
            <input
              type="checkbox"
              name={name}
              value={d}
              defaultChecked={defaultDays.includes(d)}
            />
            <span>{d}</span>
          </label>
        ))}
      </div>
      <div className="cx-times">
        <label className="cx-field">
          <span className="lbl">Opens</span>
          <select className="cx-input" name="opens" defaultValue={defaultOpen}>
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="cx-field">
          <span className="lbl">Closes</span>
          <select
            className="cx-input"
            name="closes"
            defaultValue={defaultClose}
          >
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
