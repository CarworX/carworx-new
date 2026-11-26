import { describe, expect, it } from "vitest";

import type { HoursRow } from "./hours";
import { cardStatus, hoursChip, statusLabel } from "./card-status";

// SAST is UTC+2 all year. Thursday 26 Nov 2026 is day 4 (Mon = 1).
const at = (iso: string) => new Date(`${iso}+02:00`);
const row = (day: number, opens: string, closes: string): HoursRow => ({
  day,
  opens,
  closes,
});
const WEEKDAYS = [1, 2, 3, 4, 5].map((d) => row(d, "08:00", "17:00"));

describe("card open status", () => {
  it("is open with the closing time, and closing soon inside an hour", () => {
    expect(cardStatus(WEEKDAYS, at("2026-11-26T12:00:00"))).toEqual({
      kind: "open",
      closes: "17:00",
      minutesLeft: 300,
    });
    const soon = cardStatus(WEEKDAYS, at("2026-11-26T16:35:00"));
    expect(soon).toEqual({ kind: "closing", closes: "17:00", minutesLeft: 25 });
    expect(statusLabel(soon, 4)).toBe("Closes in 25 min");
  });

  it("works across midnight: closing at 23:59 counts as the end of the day", () => {
    const late = [row(4, "18:00", "23:59")];
    // 23:30 with closing at 23:59: inside the closing-soon hour.
    expect(cardStatus(late, at("2026-11-26T23:30:00"))).toEqual({
      kind: "closing",
      closes: "23:59",
      minutesLeft: 30,
    });
    // Just after midnight, the Thursday session is over; Friday has none.
    expect(cardStatus(late, at("2026-11-27T00:30:00"))).toEqual({
      kind: "closed",
      opens: "18:00",
      day: 4,
      today: false,
    });
  });

  it("rolls from Sunday to Monday, and says 'tomorrow' when it is", () => {
    const monday = [row(1, "08:00", "17:00")];
    // Sunday 29 Nov 2026 (day 7), after closing: next opening is Monday.
    const sunday = cardStatus(monday, at("2026-11-29T18:00:00"));
    expect(sunday).toEqual({
      kind: "closed",
      opens: "08:00",
      day: 1,
      today: false,
    });
    expect(statusLabel(sunday, 7)).toBe("Opens tomorrow 08:00");
    // Friday evening: Monday is not tomorrow, so the weekday is named.
    const friday = cardStatus(monday, at("2026-11-27T18:00:00"));
    expect(statusLabel(friday, 5)).toBe("Opens Mon 08:00");
  });

  it("says 'today' before the day's opening, and 'tomorrow' after closing", () => {
    const after = cardStatus(WEEKDAYS, at("2026-11-26T18:00:00"));
    expect(statusLabel(after, 4)).toBe("Opens tomorrow 08:00");
    const early = cardStatus(WEEKDAYS, at("2026-11-26T06:00:00"));
    expect(statusLabel(early, 4)).toBe("Opens today 08:00");
  });

  it("is closed all day on a day with no hours, and opens on the next listed day", () => {
    const monTue = [row(1, "08:00", "17:00"), row(2, "08:00", "17:00")];
    // Wednesday 25 Nov 2026 (day 3) has no row; Thursday has none either.
    const status = cardStatus(monTue, at("2026-11-25T12:00:00"));
    expect(status).toEqual({
      kind: "closed",
      opens: "08:00",
      day: 1,
      today: false,
    });
  });

  it("reads split hours: between the two sessions it opens again at the second", () => {
    const split = [row(4, "08:00", "12:00"), row(4, "13:00", "17:00")];
    expect(cardStatus(split, at("2026-11-26T12:30:00"))).toEqual({
      kind: "closed",
      opens: "13:00",
      day: 4,
      today: true,
    });
    expect(cardStatus(split, at("2026-11-26T14:00:00"))).toMatchObject({
      kind: "open",
      closes: "17:00",
    });
  });

  it("says 'Hours not listed' when there are no hours at all", () => {
    const status = cardStatus([], at("2026-11-26T12:00:00"));
    expect(status).toEqual({ kind: "none" });
    expect(statusLabel(status, 4)).toBe("Hours not listed");
  });
});

describe("card extra chip from the hours", () => {
  it("offers 'Open Saturdays' when there is a Saturday session", () => {
    expect(hoursChip([...WEEKDAYS, row(6, "08:00", "13:00")])).toBe(
      "Open Saturdays",
    );
  });

  it("offers '24h call-out' when every day is open all day", () => {
    const all = [1, 2, 3, 4, 5, 6, 7].map((d) => row(d, "00:00", "23:59"));
    expect(hoursChip(all)).toBe("24h call-out");
  });

  it("offers nothing without hours or without a Saturday", () => {
    expect(hoursChip([])).toBeNull();
    expect(hoursChip(WEEKDAYS)).toBeNull();
  });
});
