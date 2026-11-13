import { afterEach, describe, expect, it } from "vitest";

import {
  localClock,
  openStatus,
  readHours,
  statusText,
  type HoursRow,
} from "./hours";

// 2026-11-16 is a Monday. SAST is UTC+2 all year (no daylight saving).
const sast = (iso: string) => new Date(`${iso}+02:00`);
const week: HoursRow[] = [
  { day: 1, opens: "08:00", closes: "17:00" },
  { day: 2, opens: "08:00", closes: "17:00" },
  { day: 3, opens: "08:00", closes: "17:00" },
  { day: 4, opens: "08:00", closes: "17:00" },
  { day: 5, opens: "08:00", closes: "17:00" },
  { day: 6, opens: "08:00", closes: "13:00" },
];
const text = (hours: HoursRow[], iso: string) =>
  statusText(openStatus(hours, sast(iso)));

describe("open now, in South African time", () => {
  const original = process.env["TZ"];
  afterEach(() => {
    process.env["TZ"] = original;
  });

  it("is open during the day and names the closing time", () => {
    expect(text(week, "2026-11-16T10:00:00")).toBe(
      "Open now · closes 17:00",
    );
  });
  it("opens at the opening minute and closes at the closing minute", () => {
    expect(text(week, "2026-11-16T08:00:00")).toBe(
      "Open now · closes 17:00",
    );
    expect(text(week, "2026-11-16T07:59:00")).toBe(
      "Closed · opens today 08:00",
    );
    expect(text(week, "2026-11-16T16:59:00")).toBe(
      "Open now · closes 17:00",
    );
    expect(text(week, "2026-11-16T17:00:00")).toBe("Closed · opens Tue 08:00");
  });
  it("skips closed days and wraps from the weekend to Monday", () => {
    expect(text(week, "2026-11-21T13:00:00")).toBe("Closed · opens Mon 08:00");
    expect(text(week, "2026-11-22T12:00:00")).toBe("Closed · opens Mon 08:00");
  });
  it("finds the same day next week when it's the only open day", () => {
    const one = [{ day: 3, opens: "09:00", closes: "12:00" }];
    expect(text(one, "2026-11-18T12:30:00")).toBe("Closed · opens Wed 09:00");
  });
  it("treats 23:59 as open until midnight", () => {
    const late = [{ day: 1, opens: "18:00", closes: "23:59" }];
    expect(text(late, "2026-11-16T23:59:30")).toBe(
      "Open now · closes midnight",
    );
  });
  it("uses SAST, not the server's time zone, across the day boundary", () => {
    // 22:30 UTC on Sunday is 00:30 SAST on Monday.
    const instant = new Date("2026-11-15T22:30:00Z");
    for (const zone of ["UTC", "America/New_York", "Asia/Tokyo"]) {
      process.env["TZ"] = zone;
      expect(localClock(instant)).toEqual({ day: 1, minute: 30 });
      expect(statusText(openStatus(week, instant))).toBe(
        "Closed · opens today 08:00",
      );
    }
    // 06:30 UTC on Saturday is 08:30 SAST: open, closing at 13:00.
    expect(
      statusText(openStatus(week, new Date("2026-11-21T06:30:00Z"))),
    ).toBe("Open now · closes 13:00");
  });
  it("says nothing when there are no hours", () => {
    expect(openStatus([], sast("2026-11-16T10:00:00"))).toEqual({
      kind: "none",
    });
    expect(text([], "2026-11-16T10:00:00")).toBeNull();
  });
});

describe("hours from the database", () => {
  it("accepts clean rows and sorts them by day", () => {
    expect(
      readHours([
        { day: 6, opens: "08:00", closes: "13:00" },
        { day: "1", opens: "08:00", closes: "17:00" },
      ]),
    ).toEqual([
      { day: 1, opens: "08:00", closes: "17:00" },
      { day: 6, opens: "08:00", closes: "13:00" },
    ]);
  });
  it("rejects anything unexpected", () => {
    for (const bad of [
      null,
      {},
      [{ day: 0, opens: "08:00", closes: "17:00" }],
      [{ day: 8, opens: "08:00", closes: "17:00" }],
      [{ day: 1, opens: "8:00", closes: "17:00" }],
      [{ day: 1, opens: "17:00", closes: "08:00" }],
      [
        { day: 1, opens: "08:00", closes: "17:00" },
        { day: 1, opens: "09:00", closes: "12:00" },
      ],
      Array(8).fill({ day: 1, opens: "08:00", closes: "17:00" }),
    ])
      expect(readHours(bad)).toBeNull();
  });
});
