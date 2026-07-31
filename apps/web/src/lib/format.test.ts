import { describe, expect, it } from "vitest";

import { ageFraction, dayLetter, fillWeek } from "./format";

/** 00:30 in Johannesburg on 30 July — 22:30 UTC on the 29th. */
const LATE_NIGHT_SAST = new Date("2026-07-30T00:30:00+02:00");
const MIDDAY_SAST = new Date("2026-07-30T12:00:00+02:00");

describe("fillWeek", () => {
  it("always returns seven days", () => {
    expect(fillWeek([], MIDDAY_SAST)).toHaveLength(7);
    expect(fillWeek([{ day: "2026-07-30", count: 3 }], MIDDAY_SAST)).toHaveLength(7);
  });

  it("ends on the current local day", () => {
    const week = fillWeek([], MIDDAY_SAST);
    expect(week[6].day).toBe("2026-07-30");
    expect(week[6].isToday).toBe(true);
  });

  it("runs from six days back to today, in order", () => {
    expect(fillWeek([], MIDDAY_SAST).map((d) => d.day)).toEqual([
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
    ]);
  });

  // The bug this file was written for: before midnight UTC but after midnight
  // locally, the chart marked the previous day as "today" for every South
  // African user between 00:00 and 02:00.
  it("treats the local day as today just after local midnight", () => {
    const week = fillWeek([], LATE_NIGHT_SAST);
    expect(week[6].day).toBe("2026-07-30");
    expect(week[6].isToday).toBe(true);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("zero-fills days the API omitted", () => {
    const week = fillWeek([{ day: "2026-07-28", count: 4 }], MIDDAY_SAST);
    expect(week.find((d) => d.day === "2026-07-28")?.count).toBe(4);
    expect(week.filter((d) => d.count === 0)).toHaveLength(6);
  });

  it("ignores counts outside the window rather than shifting it", () => {
    const week = fillWeek(
      [
        { day: "2026-07-01", count: 99 },
        { day: "2026-07-30", count: 2 },
      ],
      MIDDAY_SAST,
    );
    expect(week).toHaveLength(7);
    expect(week.some((d) => d.count === 99)).toBe(false);
    expect(week[6].count).toBe(2);
  });
});

describe("dayLetter", () => {
  // A bare calendar date has one weekday regardless of the reader's zone.
  it("maps a calendar date to its weekday initial", () => {
    expect(dayLetter("2026-07-30")).toBe("T"); // Thursday
    expect(dayLetter("2026-08-01")).toBe("S"); // Saturday
  });
});

describe("ageFraction", () => {
  const now = Date.now();

  it("is 0 for something that just happened", () => {
    expect(ageFraction(new Date(now).toISOString())).toBeCloseTo(0, 2);
  });

  it("reaches 1 at the horizon and clamps past it", () => {
    expect(ageFraction(new Date(now - 48 * 3_600_000).toISOString())).toBe(1);
    expect(ageFraction(new Date(now - 500 * 3_600_000).toISOString())).toBe(1);
  });

  it("clamps future timestamps to 0 rather than going negative", () => {
    expect(ageFraction(new Date(now + 3_600_000).toISOString())).toBe(0);
  });

  it("honours a custom horizon", () => {
    expect(ageFraction(new Date(now - 6 * 3_600_000).toISOString(), 12)).toBeCloseTo(0.5, 1);
  });
});
