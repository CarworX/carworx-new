/**
 * The per-day hours form (Claude 26 §3): fields open-N, opens-N and closes-N
 * for N = 1 (Monday) … 7. Shared by the About step and the edit screen.
 * Times on closed days are kept for redisplay and never saved.
 */
import { dayName, minutes, TIME, type HoursRow } from "../catalogue/hours";

export interface DayRow {
  day: number;
  open: boolean;
  opens: string;
  closes: string;
}

/** 00:00 to 23:30 every 30 minutes, then 23:59 ("midnight"). */
export const HOUR_TIMES: readonly string[] = [
  ...Array.from({ length: 48 }, (_, i) => {
    const m = i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
  }),
  "23:59",
];

/** Mon–Fri 08:00–17:00, Sat 08:00–13:00, Sun closed. */
export const DEFAULT_ROWS: readonly DayRow[] = [1, 2, 3, 4, 5, 6, 7].map(
  (day) => ({
    day,
    open: day <= 6,
    opens: "08:00",
    closes: day === 6 ? "13:00" : "17:00",
  }),
);

/** Saved hours as seven editor rows. Nothing saved yet → the defaults. */
export function rowsFromHours(hours: readonly HoursRow[]): DayRow[] {
  if (hours.length === 0) return DEFAULT_ROWS.map((r) => ({ ...r }));
  return DEFAULT_ROWS.map((d) => {
    const saved = hours.find((h) => h.day === d.day);
    return saved
      ? { day: d.day, open: true, opens: saved.opens, closes: saved.closes }
      : { ...d, open: false };
  });
}

function value(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** What was posted, made safe to draw again (unknown times → defaults). */
export function readRows(form: FormData): DayRow[] {
  return DEFAULT_ROWS.map((d) => {
    const opens = value(form, `opens-${String(d.day)}`);
    const closes = value(form, `closes-${String(d.day)}`);
    return {
      day: d.day,
      open: value(form, `open-${String(d.day)}`) === "on",
      opens: HOUR_TIMES.includes(opens) ? opens : d.opens,
      closes: HOUR_TIMES.includes(closes) ? closes : d.closes,
    };
  });
}

/** "Copy Monday to weekdays": Tue–Fri take Monday's switch and times. */
export function copyMonday(rows: readonly DayRow[]): DayRow[] {
  const monday = rows.find((r) => r.day === 1);
  return rows.map((r) =>
    monday && r.day >= 2 && r.day <= 5
      ? { ...monday, day: r.day }
      : { ...r },
  );
}

export type HoursResult =
  | { ok: true; hours: HoursRow[] }
  | { ok: false; rows: DayRow[]; problems: Record<number, string> };

/**
 * Strict parse of the posted form. Problems are per day (keyed by day
 * number, 0 for the whole week) and written for the person filling it in.
 */
export function parseHoursForm(
  form: FormData,
  { requireOpenDay }: { requireOpenDay: boolean },
): HoursResult {
  const problems: Record<number, string> = {};
  const hours: HoursRow[] = [];
  for (let day = 1; day <= 7; day++) {
    const flag = value(form, `open-${String(day)}`);
    if (flag !== "" && flag !== "on") problems[day] = "Choose open or closed.";
    if (flag !== "on") continue;
    const opens = value(form, `opens-${String(day)}`);
    const closes = value(form, `closes-${String(day)}`);
    if (
      !TIME.test(opens) ||
      !TIME.test(closes) ||
      !HOUR_TIMES.includes(opens) ||
      !HOUR_TIMES.includes(closes)
    )
      problems[day] = `${dayName(day)}: choose times from the list.`;
    else if (minutes(closes) <= minutes(opens))
      problems[day] =
        `${dayName(day)}: closing time must be after opening time.`;
    else hours.push({ day, opens, closes });
  }
  if (requireOpenDay && hours.length === 0 && Object.keys(problems).length === 0)
    problems[0] = "Choose at least one day you're open.";
  return Object.keys(problems).length === 0
    ? { ok: true, hours }
    : { ok: false, rows: readRows(form), problems };
}
