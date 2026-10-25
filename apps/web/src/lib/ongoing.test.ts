import { describe, expect, it } from "vitest";

import { canReportOngoing } from "./ongoing";
import { ALERT_CATEGORIES } from "./types";

describe("canReportOngoing", () => {
  it("is true for the categories that can be a danger still in progress", () => {
    expect(canReportOngoing("ASSAULT")).toBe(true);
    expect(canReportOngoing("HAZARD")).toBe(true);
    expect(canReportOngoing("OTHER")).toBe(true);
  });

  it("is false for every other category", () => {
    const others = ALERT_CATEGORIES.filter((c) => !["ASSAULT", "HAZARD", "OTHER"].includes(c));
    expect(others.length).toBeGreaterThan(0);
    for (const category of others) {
      expect(canReportOngoing(category), category).toBe(false);
    }
  });
});
