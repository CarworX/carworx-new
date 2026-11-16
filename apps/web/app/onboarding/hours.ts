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

/**
 * The application's About step sends day chips (open-N) and one shared
 * pair of times (opens, closes), as in the Sites preview. Copy that pair
 * to each ticked day that has no times of its own; per-day fields, as the
 * hours editor sends them, always win.
 */
function withSharedTimes(form: FormData): FormData {
  const opens = value(form, "opens");
  const closes = value(form, "closes");
  if (!opens && !closes) return form;
  const out = new FormData();
  for (const [k, v] of form.entries()) out.append(k, v);
  for (let day = 1; day <= 7; day++) {
    if (!form.has(`opens-${String(day)}`))
      out.set(`opens-${String(day)}`, opens);
    if (!form.has(`closes-${String(day)}`))
      out.set(`closes-${String(day)}`, closes);
  }
  return out;
}

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * The preview's one-line hours ("Mon–Fri · 08:00–17:00") when every open
 * day shares its times; otherwise the full week, day by day.
 */
export function shortHours(
  hours: readonly HoursRow[],
  full: (hours: readonly HoursRow[]) => string,
): string {
  if (!hours.length) return "";
  const first = hours[0];
  if (
    !first ||
    hours.some((h) => h.opens !== first.opens || h.closes !== first.closes)
  )
    return full(hours);
  const days = [...new Set(hours.map((h) => h.day))].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const d of days) {
    const last = runs.at(-1);
    if (last && last[1] === d - 1) last[1] = d;
    else runs.push([d, d]);
  }
  const name = (d: number) => SHORT_DAYS[d - 1] ?? "";
  const range = runs
    .map(([a, b]) =>
      a === b
        ? name(a)
        : b === a + 1
          ? `${name(a)}, ${name(b)}`
          : `${name(a)}–${name(b)}`,
    )
    .join(", ");
  const closes = first.closes === "23:59" ? "midnight" : first.closes;
  return `${range} · ${first.opens}–${closes}`;
}

/** What was posted, made safe to draw again (unknown times → defaults). */
export function readRows(posted: FormData): DayRow[] {
  const form = withSharedTimes(posted);
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
    monday && r.day >= 2 && r.day <= 5 ? { ...monday, day: r.day } : { ...r },
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
  posted: FormData,
  { requireOpenDay }: { requireOpenDay: boolean },
): HoursResult {
  const form = withSharedTimes(posted);
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
  if (
    requireOpenDay &&
    hours.length === 0 &&
    Object.keys(problems).length === 0
  )
    problems[0] = "Choose at least one day you're open.";
  return Object.keys(problems).length === 0
    ? { ok: true, hours }
    : { ok: false, rows: readRows(posted), problems };
}
