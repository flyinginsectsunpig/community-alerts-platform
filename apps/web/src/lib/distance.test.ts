import { describe, expect, it } from "vitest";

import { distanceLabel, distanceMetres } from "./distance";

describe("distanceMetres", () => {
  it("is zero between a point and itself", () => {
    const point = { lat: 51.5, lng: -0.12 };
    expect(distanceMetres(point, point)).toBe(0);
  });

  it("measures a known distance to within a few metres", () => {
    // One degree of latitude is about 111.2 km.
    const metres = distanceMetres({ lat: 51, lng: 0 }, { lat: 52, lng: 0 });
    expect(metres).toBeGreaterThan(111_100);
    expect(metres).toBeLessThan(111_300);
  });
});

describe("distanceLabel", () => {
  it("rounds short distances to the nearest 50 metres", () => {
    expect(distanceLabel(374)).toBe("350 m away");
    expect(distanceLabel(376)).toBe("400 m away");
  });

  it("does not claim a false zero when very close", () => {
    expect(distanceLabel(12)).toBe("Under 50 m away");
  });

  it("switches to kilometres with one decimal", () => {
    expect(distanceLabel(975)).toBe("1 km away");
    expect(distanceLabel(1240)).toBe("1.2 km away");
  });

  it("drops the decimal for long distances", () => {
    expect(distanceLabel(12_600)).toBe("13 km away");
  });
});
