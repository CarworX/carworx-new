import { useId } from "react";

import {
  dayName,
  dayShort,
  timeLabel,
  type HoursRow,
  type OpenStatus,
} from "../catalogue/hours";
import { HOUR_TIMES, type DayRow } from "../onboarding/hours";
import { Button } from "./Button";
import { Icon } from "./Icon";

function TimeSelect({
  label,
  day,
  name,
  value,
}: {
  label: "Opens" | "Closes";
  day: number;
  name: string;
  value: string;
}) {
  return (
    <label className="cx-field">
      <span className="lbl">
        {label}
        <span className="cx-vh"> on {dayName(day)}</span>
      </span>
      <select className="cx-input" name={name} defaultValue={value}>
        {HOUR_TIMES.map((t) => (
          <option key={t} value={t}>
            {t === "23:59" ? "23:59 (midnight)" : t}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Opening hours, a row per day (Claude 26 §3): an Open/Closed switch and
 * that day's own times. Plain form fields, so it works with no JavaScript;
 * "Copy Monday to weekdays" is a submit button the server answers without
 * saving. Closed rows dim their times with CSS only.
 */
export function OpeningHoursEditor({
  rows,
  problems = {},
  legend = "Opening hours",
  hint = "Times are South African time. Public holiday hours can go in your description.",
}: {
  rows: readonly DayRow[];
  problems?: Readonly<Record<number, string>>;
  legend?: string;
  hint?: string;
}) {
  const id = useId();
  const week = problems[0];
  return (
    <fieldset
      className="cx-field cx-hours"
      aria-describedby={[`${id}-hint`, week ? `${id}-err` : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <legend className="lbl">{legend}</legend>
      <span id={`${id}-hint`} className="hint">
        {hint}
      </span>
      {week ? (
        <span id={`${id}-err`} className="error">
          <Icon name="alert" size="sm" />
          {week}
        </span>
      ) : null}
      {rows.map((row) => {
        const problem = problems[row.day];
        const err = `${id}-err-${String(row.day)}`;
        return (
          <fieldset
            key={row.day}
            className="cx-hours-row"
            data-day={row.day}
            aria-describedby={problem ? err : undefined}
            {...(problem ? { "aria-invalid": true } : {})}
          >
            <legend className="cx-hours-day">{dayName(row.day)}</legend>
            <label className="cx-switch cx-hours-switch">
              <span className="cx-vh">Open on {dayName(row.day)}</span>
              <span className="txt" aria-hidden="true">
                <span className="t on">Open</span>
                <span className="t off">Closed</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                name={`open-${String(row.day)}`}
                value="on"
                defaultChecked={row.open}
              />
              <span className="track" aria-hidden="true" />
            </label>
            <div className="cx-hours-times">
              <TimeSelect
                label="Opens"
                day={row.day}
                name={`opens-${String(row.day)}`}
                value={row.opens}
              />
              <TimeSelect
                label="Closes"
                day={row.day}
                name={`closes-${String(row.day)}`}
                value={row.closes}
              />
            </div>
            {problem ? (
              <span id={err} className="error">
                <Icon name="alert" size="sm" />
                {problem}
              </span>
            ) : null}
          </fieldset>
        );
      })}
      <div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          name="hoursAction"
          value="copy-monday"
          formNoValidate
        >
          Copy Monday to weekdays
        </Button>
      </div>
    </fieldset>
  );
}

/** "Mon 08:00–17:00 · … · Sun closed", for summaries. */
export function hoursSummary(hours: readonly HoursRow[]): string {
  return [1, 2, 3, 4, 5, 6, 7]
    .map((day) => {
      const row = hours.find((h) => h.day === day);
      return row
        ? `${dayShort(day)} ${row.opens}–${timeLabel(row.closes)}`
        : `${dayShort(day)} closed`;
    })
    .join(" · ");
}

/**
 * The customer's 7-day table (Claude 26 §5). Today is marked with text and
 * aria-current, not colour alone. `today` and `status` come from the server
 * (Africa/Johannesburg), so the markup never depends on the visitor's clock.
 */
export function OpeningHoursTable({
  hours,
  today,
  status,
}: {
  hours: readonly HoursRow[] | null;
  today: number;
  status: OpenStatus;
}) {
  return (
    <section
      id="hours"
      aria-labelledby="hours-h"
      className="cx-hours-card grid gap-3"
    >
      <h2 id="hours-h" className="type-heading">
        Opening hours
      </h2>
      {hours === null ? (
        <p className="type-body">Opening hours aren't available right now.</p>
      ) : hours.length === 0 ? (
        <p className="type-body">Hours not provided.</p>
      ) : (
        <>
          {status.kind !== "none" ? (
            <p
              className={`cx-hours-now ${status.kind === "open" ? "open" : "closed"}`}
              data-open-status={status.kind}
            >
              <span className="dot" aria-hidden="true" />
              {status.kind === "open"
                ? `Open now · closes ${timeLabel(status.closes)}`
                : `Closed · opens ${status.today ? "today" : dayShort(status.day)} ${status.opens}`}
            </p>
          ) : null}
          <table className="cx-hours-table">
            <caption className="cx-vh">Opening hours by day</caption>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const row = hours.find((h) => h.day === day);
                const isToday = day === today;
                return (
                  <tr
                    key={day}
                    className={isToday ? "today" : undefined}
                    {...(isToday ? { "aria-current": "date" as const } : {})}
                  >
                    <th scope="row">
                      {dayName(day)}
                      {isToday ? <span className="tag">Today</span> : null}
                    </th>
                    <td>
                      {row
                        ? `${row.opens} – ${timeLabel(row.closes)}`
                        : "Closed"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="type-caption">
            Times are South African time. Public holiday hours may differ; check
            with the business before you travel.
          </p>
        </>
      )}
    </section>
  );
}
