import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_ROWS } from "../onboarding/hours";
import {
  hoursSummary,
  OpeningHoursEditor,
  OpeningHoursTable,
} from "./OpeningHours";

const week = [
  { day: 1, opens: "08:00", closes: "17:00" },
  { day: 6, opens: "08:00", closes: "13:00" },
];

describe("opening hours editor", () => {
  const h = renderToStaticMarkup(<OpeningHoursEditor rows={DEFAULT_ROWS} />);
  it("has a labelled row per day with its own switch and times", () => {
    for (const day of [1, 2, 3, 4, 5, 6, 7]) {
      expect(h).toContain(`name="open-${String(day)}"`);
      expect(h).toContain(`name="opens-${String(day)}"`);
      expect(h).toContain(`name="closes-${String(day)}"`);
    }
    expect((h.match(/<legend class="cx-hours-day">/g) ?? []).length).toBe(7);
    expect(h).toContain("Open on Monday");
    expect(h).toContain(" on Sunday</span>");
    expect((h.match(/role="switch"/g) ?? []).length).toBe(7);
  });
  it("starts with Monday to Saturday open and Sunday closed", () => {
    expect((h.match(/checked=""/g) ?? []).length).toBe(6);
  });
  it("copies Monday without JavaScript, skipping browser validation", () => {
    expect(h).toMatch(
      /<button[^>]*name="hoursAction"[^>]*value="copy-monday"[^>]*formNoValidate|<button[^>]*formNoValidate[^>]*name="hoursAction"/i,
    );
    expect(h).toContain("Copy Monday to weekdays");
  });
  it("ties a day's problem to that day", () => {
    const bad = renderToStaticMarkup(
      <OpeningHoursEditor
        rows={DEFAULT_ROWS}
        problems={{ 2: "Tuesday: closing time must be after opening time." }}
      />,
    );
    expect(bad).toContain('aria-invalid="true"');
    expect(bad).toContain("Tuesday: closing time must be after opening time.");
  });
});

describe("opening hours for customers", () => {
  it("marks today with text and aria-current, and shows the status", () => {
    const h = renderToStaticMarkup(
      <OpeningHoursTable
        hours={week}
        today={6}
        status={{ kind: "open", closes: "13:00" }}
      />,
    );
    expect(h).toContain("Open now · closes 13:00");
    expect((h.match(/aria-current="date"/g) ?? []).length).toBe(1);
    expect(h).toMatch(/aria-current="date"><th scope="row">Saturday<span class="tag">Today<\/span>/);
    expect((h.match(/>Closed</g) ?? []).length).toBe(5);
    expect(h).toContain("Public holiday hours may differ");
  });
  it("names the next opening when closed", () => {
    const h = renderToStaticMarkup(
      <OpeningHoursTable
        hours={week}
        today={7}
        status={{ kind: "closed", day: 1, opens: "08:00", today: false }}
      />,
    );
    expect(h).toContain("Closed · opens Mon 08:00");
  });
  it("says when there are no hours, and when they couldn't load", () => {
    const none = renderToStaticMarkup(
      <OpeningHoursTable hours={[]} today={1} status={{ kind: "none" }} />,
    );
    expect(none).toContain("Hours not provided.");
    expect(none).not.toContain("<table");
    const down = renderToStaticMarkup(
      <OpeningHoursTable hours={null} today={1} status={{ kind: "none" }} />,
    );
    expect(down).toContain("Opening hours aren&#x27;t available right now.");
  });
  it("summarises the week for the Check step", () => {
    expect(hoursSummary(week)).toBe(
      "Mon 08:00–17:00 · Tue closed · Wed closed · Thu closed · Fri closed · Sat 08:00–13:00 · Sun closed",
    );
  });
});
