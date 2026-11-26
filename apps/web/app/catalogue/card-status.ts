/**
 * The open status a listing card shows (Option A, listing card redesign):
 * open, closing within an hour, closed with the next opening, or no hours.
 * Pure: the caller passes the hours and the time; Africa/Johannesburg is
 * worked out by localClock. Split hours are several rows on one day.
 */
import { dayShort, localClock, minutes, type HoursRow } from "./hours";

/** A listing that closes within this many minutes shows "Closes in N min". */
export const CLOSING_SOON_MINUTES = 60;

const DAY_END = 24 * 60;

export type CardStatus =
  | { kind: "open"; closes: string; minutesLeft: number }
  | { kind: "closing"; closes: string; minutesLeft: number }
  | { kind: "closed"; opens: string; day: number; today: boolean }
  | { kind: "none" };

function endOf(row: HoursRow): number {
  return row.closes === "23:59" ? DAY_END : minutes(row.closes);
}

/** A day's rows, earliest opening first. */
function rowsOn(hours: readonly HoursRow[], day: number): HoursRow[] {
  return hours
    .filter((h) => h.day === day)
    .sort((a, b) => minutes(a.opens) - minutes(b.opens));
}

export function cardStatus(hours: readonly HoursRow[], now: Date): CardStatus {
  if (hours.length === 0) return { kind: "none" };
  const { day, minute } = localClock(now);

  for (const row of rowsOn(hours, day)) {
    const start = minutes(row.opens);
    const end = endOf(row);
    if (minute >= start && minute < end) {
      const minutesLeft = end - minute;
      return minutesLeft <= CLOSING_SOON_MINUTES
        ? { kind: "closing", closes: row.closes, minutesLeft }
        : { kind: "open", closes: row.closes, minutesLeft };
    }
  }

  const later = rowsOn(hours, day).find((row) => minutes(row.opens) > minute);
  if (later) return { kind: "closed", opens: later.opens, day, today: true };

  for (let step = 1; step <= 7; step++) {
    const next = ((day - 1 + step) % 7) + 1;
    const first = rowsOn(hours, next)[0];
    if (first)
      return { kind: "closed", opens: first.opens, day: next, today: false };
  }
  return { kind: "none" };
}

/** The words on the card: "Open · closes 17:30", "Closes in 25 min · at 13:00". */
export function statusLabel(status: CardStatus, day: number): string {
  if (status.kind === "open") return `Open · closes ${status.closes}`;
  if (status.kind === "closing")
    return `Closes in ${String(status.minutesLeft)} min · at ${status.closes}`;
  if (status.kind === "closed") {
    if (status.today) return `Closed · opens today ${status.opens}`;
    const tomorrow = (day % 7) + 1 === status.day;
    return tomorrow
      ? `Closed · opens tomorrow ${status.opens}`
      : `Closed · opens ${dayShort(status.day)} ${status.opens}`;
  }
  return "Hours not listed";
}

/** Two extra-chip facts worked out from the hours alone, with no new data. */
export function hoursChip(hours: readonly HoursRow[]): string | null {
  if (hours.length === 0) return null;
  const alwaysOpen = [1, 2, 3, 4, 5, 6, 7].every((day) =>
    rowsOn(hours, day).some((r) => r.opens === "00:00" && endOf(r) === DAY_END),
  );
  if (alwaysOpen) return "24h call-out";
  if (rowsOn(hours, 6).length > 0) return "Open Saturdays";
  return null;
}
