import { describe, expect, it } from "vitest";

import {
  copyMonday,
  DEFAULT_ROWS,
  HOUR_TIMES,
  parseHoursForm,
  readRows,
  rowsFromHours,
} from "./hours";

function form(values: Record<string, string>) {
  const out = new FormData();
  for (const [name, value] of Object.entries(values)) out.append(name, value);
  return out;
}
const week = {
  "open-1": "on",
  "opens-1": "08:00",
  "closes-1": "17:00",
  "open-2": "on",
  "opens-2": "07:30",
  "closes-2": "16:00",
  "open-6": "on",
  "opens-6": "08:00",
  "closes-6": "13:00",
};

describe("per-day hours form", () => {
  it("defaults to Mon–Fri 08:00–17:00, Sat 08:00–13:00 and Sunday closed", () => {
    expect(DEFAULT_ROWS.map((r) => [r.open, r.opens, r.closes])).toEqual([
      [true, "08:00", "17:00"],
      [true, "08:00", "17:00"],
      [true, "08:00", "17:00"],
      [true, "08:00", "17:00"],
      [true, "08:00", "17:00"],
      [true, "08:00", "13:00"],
      [false, "08:00", "17:00"],
    ]);
  });
  it("offers the whole day, ending at 23:59", () => {
    expect(HOUR_TIMES[0]).toBe("00:00");
    expect(HOUR_TIMES.at(-2)).toBe("23:30");
    expect(HOUR_TIMES.at(-1)).toBe("23:59");
  });
  it("keeps each day's own times and skips closed days", () => {
    expect(parseHoursForm(form(week), { requireOpenDay: true })).toEqual({
      ok: true,
      hours: [
        { day: 1, opens: "08:00", closes: "17:00" },
        { day: 2, opens: "07:30", closes: "16:00" },
        { day: 6, opens: "08:00", closes: "13:00" },
      ],
    });
  });
  it("ignores times on a closed day, even bad ones", () => {
    const result = parseHoursForm(
      form({ ...week, "opens-7": "17:00", "closes-7": "nope" }),
      { requireOpenDay: true },
    );
    expect(result.ok).toBe(true);
  });
  it("names the day when closing is not after opening", () => {
    const result = parseHoursForm(form({ ...week, "closes-2": "07:30" }), {
      requireOpenDay: true,
    });
    expect(result).toMatchObject({
      ok: false,
      problems: { 2: "Tuesday: closing time must be after opening time." },
    });
  });
  it("refuses times that aren't in the list", () => {
    for (const bad of ["08:15", "8:00", "24:00", ""]) {
      const result = parseHoursForm(form({ ...week, "opens-1": bad }), {
        requireOpenDay: false,
      });
      expect(result.ok ? null : result.problems[1]).toBe(
        "Monday: choose times from the list.",
      );
    }
  });
  it("refuses an unexpected switch value", () => {
    expect(
      parseHoursForm(form({ ...week, "open-3": "yes" }), {
        requireOpenDay: false,
      }).ok,
    ).toBe(false);
  });
  it("needs an open day only where asked (onboarding)", () => {
    expect(parseHoursForm(form({}), { requireOpenDay: true })).toMatchObject({
      ok: false,
      problems: { 0: "Choose at least one day you're open." },
    });
    expect(parseHoursForm(form({}), { requireOpenDay: false })).toEqual({
      ok: true,
      hours: [],
    });
  });
  it("redraws what was posted, replacing unknown times with defaults", () => {
    const rows = readRows(form({ "open-3": "on", "opens-3": "<b>" }));
    expect(rows[2]).toEqual({
      day: 3,
      open: true,
      opens: "08:00",
      closes: "17:00",
    });
    expect(rows[0]?.open).toBe(false);
  });
  it("copies Monday to Tuesday–Friday only", () => {
    const rows = copyMonday(
      readRows(form({ ...week, "opens-1": "06:00", "closes-1": "18:30" })),
    );
    expect(rows.slice(0, 5).map((r) => [r.open, r.opens, r.closes])).toEqual(
      Array(5).fill([true, "06:00", "18:30"]),
    );
    expect(rows[5]).toMatchObject({ open: true, closes: "13:00" });
    expect(rows[6]?.open).toBe(false);
  });
  it("loads saved hours (including old one-pair drafts) per day", () => {
    const rows = rowsFromHours([
      { day: 1, opens: "08:00", closes: "17:00" },
      { day: 3, opens: "08:00", closes: "17:00" },
    ]);
    expect(rows.map((r) => r.open)).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(rowsFromHours([])).toEqual(DEFAULT_ROWS);
  });
});
