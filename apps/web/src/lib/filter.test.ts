import { describe, expect, it } from "vitest";

import { applyFilter, EMPTY_FILTER, isFiltered, toggle } from "./filter";
import type { Alert, AlertCategory, Severity } from "./types";

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "a1",
    lat: -34.02,
    lng: 18.49,
    category: "THEFT",
    severity: "HIGH",
    status: "OPEN",
    description: "Bag taken from a parked car",
    createdAt: "2026-07-30T10:00:00Z",
    confirmationCount: 0,
    commentCount: 0,
    riskScore: 0.5,
    ...overrides,
  } as Alert;
}

const withCategories = (...c: AlertCategory[]) => ({ ...EMPTY_FILTER, categories: new Set(c) });
const withSeverities = (...s: Severity[]) => ({ ...EMPTY_FILTER, severities: new Set(s) });
const withQuery = (query: string) => ({ ...EMPTY_FILTER, query });

describe("toggle", () => {
  it("adds a value that is absent and removes one that is present", () => {
    const once = toggle(new Set<string>(), "a");
    expect(Array.from(once)).toEqual(["a"]);
    expect(Array.from(toggle(once, "a"))).toEqual([]);
  });

  it("does not mutate the set it was given", () => {
    const original = new Set(["a"]);
    toggle(original, "b");
    expect(Array.from(original)).toEqual(["a"]);
  });
});

describe("isFiltered", () => {
  it("is false for the empty filter", () => {
    expect(isFiltered(EMPTY_FILTER)).toBe(false);
  });

  it("ignores whitespace-only queries", () => {
    expect(isFiltered(withQuery("   "))).toBe(false);
    expect(isFiltered(withQuery("theft"))).toBe(true);
  });

  it("is true when any dimension is set", () => {
    expect(isFiltered(withCategories("THEFT"))).toBe(true);
    expect(isFiltered(withSeverities("HIGH"))).toBe(true);
  });
});

describe("applyFilter", () => {
  const alerts = [
    alert({ id: "theft-high", category: "THEFT", severity: "HIGH" }),
    alert({ id: "burglary-low", category: "BURGLARY", severity: "LOW", description: "Gate forced" }),
    alert({ id: "assault-crit", category: "ASSAULT", severity: "CRITICAL", description: "Fight outside the shop" }),
  ];

  it("returns everything when nothing is set", () => {
    expect(applyFilter(alerts, EMPTY_FILTER)).toHaveLength(3);
  });

  it("keeps only the selected categories", () => {
    expect(applyFilter(alerts, withCategories("BURGLARY")).map((a) => a.id)).toEqual([
      "burglary-low",
    ]);
  });

  it("treats multiple selections in one dimension as OR", () => {
    expect(applyFilter(alerts, withCategories("THEFT", "ASSAULT")).map((a) => a.id)).toEqual([
      "theft-high",
      "assault-crit",
    ]);
  });

  it("treats separate dimensions as AND", () => {
    const filter = { ...EMPTY_FILTER, categories: new Set<AlertCategory>(["THEFT"]), severities: new Set<Severity>(["LOW"]) };
    expect(applyFilter(alerts, filter)).toEqual([]);
  });

  it("matches the description case-insensitively", () => {
    expect(applyFilter(alerts, withQuery("GATE")).map((a) => a.id)).toEqual(["burglary-low"]);
  });

  // Typing a category name should work even when the reporter never used it.
  it("matches the category label, not just the description", () => {
    expect(applyFilter(alerts, withQuery("burglary")).map((a) => a.id)).toEqual(["burglary-low"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(applyFilter(alerts, withQuery("  gate  ")).map((a) => a.id)).toEqual(["burglary-low"]);
  });

  it("returns nothing when the query matches nothing", () => {
    expect(applyFilter(alerts, withQuery("zzzz"))).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...alerts];
    applyFilter(input, withCategories("THEFT"));
    expect(input).toHaveLength(3);
  });
});
