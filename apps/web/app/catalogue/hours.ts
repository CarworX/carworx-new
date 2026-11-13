/**
 * Opening hours (Claude 26): one period per day, day 1 = Monday, times as
 * "HH:MM" in South African time. No midnight crossing in v1, so a period
 * always sits inside one calendar day; "23:59" means "until midnight".
 */
export interface HoursRow {
  day: number;
  opens: string;
  closes: string;
}

export const DAY_SHORT = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const TIME_ZONE = "Africa/Johannesburg";

export function minutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** "23:59" reads as midnight: that's the last choice in the editor. */
export function timeLabel(time: string): string {
  return time === "23:59" ? "midnight" : time;
}

export function dayShort(day: number): string {
  return DAY_SHORT[day - 1] ?? "";
}
export function dayName(day: number): string {
  return DAY_NAMES[day - 1] ?? "";
}

/**
 * Untrusted rows (from the database driver) to clean hours, or null if
 * anything is off. Sorted by day; a repeated day or closes <= opens fails.
 */
export function readHours(value: unknown): HoursRow[] | null {
  if (!Array.isArray(value) || value.length > 7) return null;
  const rows: HoursRow[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== "object" || item === null) return null;
    const { day, opens, closes } = item as Record<string, unknown>;
    const n = typeof day === "string" ? Number(day) : day;
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > 7 ||
      typeof opens !== "string" ||
      typeof closes !== "string" ||
      !TIME.test(opens) ||
      !TIME.test(closes) ||
      minutes(closes) <= minutes(opens) ||
      rows.some((r) => r.day === n)
    )
      return null;
    rows.push({ day: n, opens, closes });
  }
  return rows.sort((a, b) => a.day - b.day);
}

/** The weekday (1 = Monday) and minute of the day in South Africa. */
export function localClock(now: Date): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const day = DAY_SHORT.findIndex((d) => d === part("weekday")) + 1;
  return {
    day: day || 1,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export type OpenStatus =
  | { kind: "open"; closes: string }
  | { kind: "closed"; day: number; opens: string; today: boolean }
  | { kind: "none" };

/** Open from the opening minute up to, not including, the closing minute. */
export function openStatus(hours: readonly HoursRow[], now: Date): OpenStatus {
  if (hours.length === 0) return { kind: "none" };
  const { day, minute } = localClock(now);
  const end = (row: HoursRow) =>
    row.closes === "23:59" ? 24 * 60 : minutes(row.closes);
  const today = hours.find((h) => h.day === day);
  if (today && minute >= minutes(today.opens) && minute < end(today))
    return { kind: "open", closes: today.closes };
  if (today && minute < minutes(today.opens))
    return { kind: "closed", day, opens: today.opens, today: true };
  for (let step = 1; step <= 7; step++) {
    const next = ((day - 1 + step) % 7) + 1;
    const row = hours.find((h) => h.day === next);
    if (row) return { kind: "closed", day: next, opens: row.opens, today: false };
  }
  return { kind: "none" };
}

/** "Open now · closes 17:00", "Closed · opens Mon 08:00". */
export function statusText(status: OpenStatus): string | null {
  if (status.kind === "open")
    return `Open now · closes ${timeLabel(status.closes)}`;
  if (status.kind === "closed")
    return `Closed · opens ${status.today ? "today" : dayShort(status.day)} ${status.opens}`;
  return null;
}
