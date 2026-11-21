import { describe, expect, it } from "vitest";

import { groupByRecency, nearbyStatus } from "./status";
import type { Alert, Severity } from "./types";

const NOW = new Date("2026-07-30T12:00:00Z");

function alert(id: string, severity: Severity, minutesAgo: number): Alert {
  return {
    id,
    category: "THEFT",
    description: "Something happened here",
    lat: 0,
    lng: 0,
    reportedByUserId: null,
    severity,
    riskScore: null,
    status: "ACTIVE",
    confirmationCount: 0,
    commentCount: 0,
    createdAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

describe("nearbyStatus", () => {
  it("makes no all-clear claim when nothing was reported", () => {
    expect(nearbyStatus([], NOW)).toEqual({
      level: null,
      headline: "No reports in the last 24 hours",
      lead: null,
    });
  });

  it("ignores alerts older than 24 hours", () => {
    expect(nearbyStatus([alert("old", "CRITICAL", 25 * 60)], NOW).level).toBeNull();
  });

  it("leads with the count at the worst serious level", () => {
    const status = nearbyStatus(
      [alert("a", "LOW", 1), alert("b", "CRITICAL", 30), alert("c", "CRITICAL", 5), alert("d", "HIGH", 2)],
      NOW,
    );
    expect(status.level).toBe("CRITICAL");
    expect(status.headline).toBe("2 critical alerts nearby");
    expect(status.lead?.id).toBe("c");
  });

  it("uses the singular for one", () => {
    expect(nearbyStatus([alert("a", "HIGH", 5)], NOW).headline).toBe("1 high alert nearby");
  });

  it("counts everything when nothing is serious", () => {
    const status = nearbyStatus([alert("a", "LOW", 5), alert("b", "MEDIUM", 50)], NOW);
    expect(status.level).toBe("MEDIUM");
    expect(status.headline).toBe("2 alerts nearby");
    expect(status.lead?.id).toBe("b");
  });
});

describe("groupByRecency", () => {
  it("buckets alerts and keeps their order", () => {
    const groups = groupByRecency(
      [alert("a", "LOW", 5), alert("b", "LOW", 59), alert("c", "LOW", 61), alert("d", "LOW", 24 * 60 + 1)],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.alerts.map((a) => a.id)])).toEqual([
      ["Last hour", ["a", "b"]],
      ["Last 24 hours", ["c"]],
      ["Earlier", ["d"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(groupByRecency([alert("a", "LOW", 120)], NOW).map((g) => g.label)).toEqual([
      "Last 24 hours",
    ]);
  });
});
