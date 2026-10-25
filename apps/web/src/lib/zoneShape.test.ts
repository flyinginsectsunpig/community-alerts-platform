import { describe, expect, it } from "vitest";

import type { LatLng, ZoneDraft, ZoneShape } from "./types";
import {
  areaKm2,
  centroid,
  circleOutline,
  freehandShape,
  handles,
  insertPointAt,
  moveHandle,
  nearestSegment,
  outline,
  removeHandle,
  snapToCircle,
  startPull,
  resetToCircle,
  translateShape,
  validateOutline,
  zonePayload,
} from "./zoneShape";

const CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
const RADIUS_M = 1000;
const M_PER_DEG = (6_371_000 * Math.PI) / 180;
const COS_LAT = Math.cos((CENTER.lat * Math.PI) / 180);

/** A point `eastM` east and `northM` north of the test centre. */
function at(eastM: number, northM: number, origin: LatLng = CENTER): LatLng {
  return {
    lat: origin.lat + northM / M_PER_DEG,
    lng: origin.lng + eastM / (M_PER_DEG * COS_LAT),
  };
}

function local(p: LatLng): { x: number; y: number } {
  return { x: (p.lng - CENTER.lng) * M_PER_DEG * COS_LAT, y: (p.lat - CENTER.lat) * M_PER_DEG };
}

function distanceM(p: LatLng): number {
  const { x, y } = local(p);
  return Math.hypot(x, y);
}

/** Compass bearing: degrees clockwise from north. */
function bearingDeg(p: LatLng): number {
  const { x, y } = local(p);
  return (((Math.atan2(x, y) * 180) / Math.PI) % 360 + 360) % 360;
}

function near(p: LatLng, q: LatLng): boolean {
  return Math.abs(p.lat - q.lat) < 1e-9 && Math.abs(p.lng - q.lng) < 1e-9;
}

function square(sideM: number): LatLng[] {
  const h = sideM / 2;
  return [at(-h, -h), at(h, -h), at(h, h), at(-h, h)];
}

function pulled(pulls: LatLng[]): ZoneShape {
  return { kind: "pulled", circle: { center: CENTER, radiusM: RADIUS_M }, pulls };
}

describe("outline", () => {
  it("outward pull makes a cone tangent at ±60°", () => {
    const pull = at(2000, 0);
    const ring = outline(pulled([pull]));

    expect(ring.some((p) => near(p, pull))).toBe(true);

    const contacts = ring.filter((p) => {
      const b = bearingDeg(p);
      return Math.abs(distanceM(p) - 1000) < 1 && (Math.abs(b - 30) < 0.1 || Math.abs(b - 150) < 0.1);
    });
    expect(contacts).toHaveLength(2);

    const contactX = local(contacts[0]).x;
    const others = ring.filter((p) => !near(p, pull));
    expect(others.every((p) => local(p).x <= contactX + 0.01)).toBe(true);
  });

  it("inward pull meets the circle 30° either side", () => {
    const pull = at(500, 0);
    const ring = outline(pulled([pull]));

    expect(ring.some((p) => near(p, pull))).toBe(true);
    for (const bearing of [60, 120]) {
      expect(
        ring.some((p) => Math.abs(distanceM(p) - 1000) < 1 && Math.abs(bearingDeg(p) - bearing) < 0.1),
      ).toBe(true);
    }
  });

  it("a pull exactly on the circle leaves no dent", () => {
    for (const bearing of [0, 37, 90, 200, 333]) {
      const b = (bearing * Math.PI) / 180;
      const ring = outline(pulled([at(RADIUS_M * Math.sin(b), RADIUS_M * Math.cos(b))]));

      expect(ring.every((p) => Math.abs(distanceM(p) - RADIUS_M) < 1)).toBe(true);
      // a 5° arc step bows in by 0.95 m; a chord across the cone would bow in far more
      const midpoints = ring.map((p, i) => {
        const q = ring[(i + 1) % ring.length];
        return { lat: (p.lat + q.lat) / 2, lng: (p.lng + q.lng) / 2 };
      });
      expect(midpoints.every((p) => Math.abs(distanceM(p) - RADIUS_M) < 1)).toBe(true);
      expect(validateOutline(ring)).toBeNull();
    }
  });

  it("neighbouring pulls with overlapping cones join straight", () => {
    const a = at(3000, 0);
    const b = at(3000 * Math.cos(Math.PI / 9), 3000 * Math.sin(Math.PI / 9));
    const ring = outline(pulled([a, b]));

    const ia = ring.findIndex((p) => near(p, a));
    expect(ia).toBeGreaterThanOrEqual(0);
    expect(near(ring[(ia + 1) % ring.length], b)).toBe(true);
  });

  it("walks a freehand shape's points in order", () => {
    const pts = square(1000);
    const shape: ZoneShape = { kind: "freehand", points: pts.map((p) => ({ at: p, handle: false })) };
    expect(outline(shape)).toEqual(pts);
  });
});

describe("circle", () => {
  it("circleOutline rings the circle with a point every 5°", () => {
    const ring = circleOutline(CENTER, RADIUS_M);
    expect(ring).toHaveLength(72);
    expect(ring.every((p) => Math.abs(distanceM(p) - RADIUS_M) < 1e-6)).toBe(true);
    expect(Math.abs(bearingDeg(ring[1]) - bearingDeg(ring[0]) + 360) % 360).toBeCloseTo(355, 6);
  });

  it("snapToCircle moves a point onto the circle along its bearing", () => {
    for (const p of [at(400, 300), at(-900, 1200)]) {
      const snapped = snapToCircle(CENTER, RADIUS_M, p);
      expect(Math.abs(distanceM(snapped) - RADIUS_M)).toBeLessThan(1e-6);
      expect(bearingDeg(snapped)).toBeCloseTo(bearingDeg(p), 9);
    }
  });
});

describe("handles", () => {
  const a = at(3000, 0);
  const b = at(3000 * Math.cos(Math.PI / 9), 3000 * Math.sin(Math.PI / 9));

  it("grabbing the straight edge inserts between its two pulls", () => {
    const shape = pulled([a, b]);
    const mid = at((local(a).x + local(b).x) / 2, (local(a).y + local(b).y) / 2);

    const result = insertPointAt(shape, mid);

    expect(result.index).toBe(1);
    expect(handles(result.shape)).toHaveLength(3);
    expect(near(handles(result.shape)[1], mid)).toBe(true);
  });

  it("grabbing the arc side inserts after the last pull", () => {
    const shape = pulled([a, b]);
    const result = insertPointAt(shape, at(-1000, 0));

    expect(result.index).toBe(2);
    expect(handles(result.shape)).toHaveLength(3);
  });

  it("grabbing a lone pull's shape inserts a second pull at index 1", () => {
    const result = insertPointAt(startPull(CENTER, RADIUS_M, at(2000, 0)), at(-1000, 0));
    expect(result.index).toBe(1);
  });

  it("inserts a handle into a freehand shape and reports its handle index", () => {
    const pts = square(1000);
    const shape: ZoneShape = {
      kind: "freehand",
      points: [
        { at: pts[0], handle: true },
        { at: pts[1], handle: false },
        { at: pts[2], handle: true },
        { at: pts[3], handle: false },
      ],
    };
    const grab = at(0, 520); // just outside the top edge (pts[2] -> pts[3])

    const result = insertPointAt(shape, grab);

    expect(result.index).toBe(2);
    expect(result.shape.kind).toBe("freehand");
    if (result.shape.kind !== "freehand") throw new Error("unreachable");
    expect(result.shape.points).toHaveLength(5);
    expect(result.shape.points[3]).toEqual({ at: grab, handle: true });
    expect(handles(result.shape)).toHaveLength(3);
  });

  it("startPull makes a pulled shape with the grab as its only pull", () => {
    const shape = startPull(CENTER, RADIUS_M, a);
    expect(shape).toEqual({ kind: "pulled", circle: { center: CENTER, radiusM: RADIUS_M }, pulls: [a] });
  });

  it("moves a pull and re-derives the outline from it", () => {
    const moved = moveHandle(pulled([a]), 0, at(0, 2000));
    expect(handles(moved)).toEqual([at(0, 2000)]);
    expect(outline(moved).some((p) => near(p, at(0, 2000)))).toBe(true);
  });

  it("moves only the indexed freehand handle", () => {
    const pts = square(1000);
    const shape: ZoneShape = {
      kind: "freehand",
      points: [
        { at: pts[0], handle: false },
        { at: pts[1], handle: true },
        { at: pts[2], handle: false },
        { at: pts[3], handle: true },
      ],
    };
    const to = at(900, -900);

    const moved = moveHandle(shape, 1, to);

    expect(outline(moved)).toEqual([pts[0], pts[1], pts[2], to]);
  });

  it("rejects an out-of-range handle index", () => {
    expect(() => moveHandle(pulled([a]), 1, a)).toThrow(RangeError);
    expect(() => removeHandle(pulled([a]), -1)).toThrow(RangeError);
  });

  it("removing the last pull returns null", () => {
    expect(removeHandle(pulled([at(2000, 0)]), 0)).toBeNull();
  });

  it("removing one of several pulls keeps the rest", () => {
    expect(removeHandle(pulled([a, b]), 0)).toEqual(pulled([b]));
  });

  it("removing a freehand handle drops the point", () => {
    const pts = [...square(1000), at(0, 800)];
    const shape: ZoneShape = {
      kind: "freehand",
      points: pts.map((p, i) => ({ at: p, handle: i === 4 })),
    };
    const result = removeHandle(shape, 0);
    expect(result && outline(result)).toEqual(square(1000));
  });

  it("refuses to remove a freehand handle when fewer than 3 points would remain", () => {
    const shape: ZoneShape = {
      kind: "freehand",
      points: [at(0, 0), at(500, 0), at(0, 500)].map((p, i) => ({ at: p, handle: i === 0 })),
    };
    expect(() => removeHandle(shape, 0)).toThrow("A drawn zone needs at least 3 points");
  });
});

describe("translateShape", () => {
  it("moves the circle centre and every pull by the same delta", () => {
    const shape = pulled([at(2000, 0), at(0, 2000)]);
    const moved = translateShape(shape, 0.01, -0.02);
    if (moved.kind !== "pulled") throw new Error("unreachable");

    expect(moved.circle.center.lat).toBeCloseTo(CENTER.lat + 0.01, 12);
    expect(moved.circle.center.lng).toBeCloseTo(CENTER.lng - 0.02, 12);
    expect(moved.circle.radiusM).toBe(RADIUS_M);
    handles(shape).forEach((p, i) => {
      expect(moved.pulls[i].lat).toBeCloseTo(p.lat + 0.01, 12);
      expect(moved.pulls[i].lng).toBeCloseTo(p.lng - 0.02, 12);
    });
  });

  it("moves every freehand point and keeps its handle flag", () => {
    const shape: ZoneShape = {
      kind: "freehand",
      points: square(1000).map((p, i) => ({ at: p, handle: i === 1 })),
    };
    const moved = translateShape(shape, 0.5, 0.25);
    if (moved.kind !== "freehand") throw new Error("unreachable");

    expect(moved.points.map((p) => p.handle)).toEqual([false, true, false, false]);
    moved.points.forEach((p, i) => {
      if (shape.kind !== "freehand") return;
      expect(p.at.lat).toBeCloseTo(shape.points[i].at.lat + 0.5, 12);
      expect(p.at.lng).toBeCloseTo(shape.points[i].at.lng + 0.25, 12);
    });
  });
});

describe("freehandShape", () => {
  it("simplifies 1000 noisy points to at most 500 non-handle points", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296 - 0.5;
    };
    const stroke: LatLng[] = [];
    for (let i = 0; i < 1000; i++) {
      const angle = (i / 1000) * 2 * Math.PI;
      stroke.push(at(500 * Math.cos(angle) + rand() * 6, 500 * Math.sin(angle) + rand() * 6));
    }

    const shape = freehandShape([stroke.slice(0, 400), stroke.slice(400)]);

    expect(shape.kind).toBe("freehand");
    if (shape.kind !== "freehand") throw new Error("unreachable");
    expect(shape.points.length).toBeGreaterThanOrEqual(3);
    expect(shape.points.length).toBeLessThanOrEqual(500);
    expect(shape.points.every((p) => !p.handle)).toBe(true);
  });

  it("drops points that lie within tolerance of a straight line", () => {
    const line = Array.from({ length: 101 }, (_, i) => at(i * 10, 0));
    const shape = freehandShape([[...line, at(1000, 1000), at(0, 1000)]]);
    // the collinear run collapses to its two ends plus the two corners
    expect(outline(shape)).toHaveLength(4);
  });

  it("throws when fewer than 3 points are given", () => {
    expect(() => freehandShape([[at(0, 0), at(10, 10)]])).toThrow("A drawn zone needs at least 3 points");
  });

  it("throws when simplification leaves fewer than 3 points", () => {
    const straight = Array.from({ length: 50 }, (_, i) => at(i * 10, 0));
    expect(() => freehandShape([straight])).toThrow("A drawn zone needs at least 3 points");
  });
});

describe("validateOutline", () => {
  it("accepts a 1 km square", () => {
    expect(validateOutline(square(1000))).toBeNull();
  });

  it("rejects fewer than 3 points", () => {
    expect(validateOutline([at(0, 0), at(500, 0)])).toBe("A drawn zone needs at least 3 points");
  });

  it("rejects more than 500 points", () => {
    const ring = Array.from({ length: 501 }, (_, i) => {
      const a = (i / 501) * 2 * Math.PI;
      return at(500 * Math.cos(a), 500 * Math.sin(a));
    });
    expect(validateOutline(ring)).toBe("A drawn zone can have at most 500 points");
  });

  it("rejects a bow-tie", () => {
    const bowTie = [at(0, 0), at(1000, 1000), at(1000, 0), at(0, 1000)];
    expect(validateOutline(bowTie)).toBe("A drawn zone's edges must not cross");
  });

  it("counts an edge that touches another edge's endpoint as crossing", () => {
    // the third vertex lies exactly on the first edge
    const touching = [at(0, 0), at(1000, 0), at(500, 0), at(500, 1000)];
    expect(validateOutline(touching)).toBe("A drawn zone's edges must not cross");
  });

  it("checks the crossing rule before the size rules", () => {
    const hugeBowTie = [at(0, 0), at(30_000, 30_000), at(30_000, 0), at(0, 30_000)];
    expect(validateOutline(hugeBowTie)).toBe("A drawn zone's edges must not cross");
  });

  it("rejects a 20 km triangle as too big", () => {
    const triangle = [at(0, 0), at(20_000, 0), at(0, 20_000)];
    expect(validateOutline(triangle)).toBe("A drawn zone must fit within 10 km of its centre");
  });

  it("rejects a 60 m square as too small", () => {
    expect(validateOutline(square(60))).toBe("A drawn zone must reach at least 50 m from its centre");
  });
});

describe("areaKm2", () => {
  it("is about 1 for a 1 km square", () => {
    expect(areaKm2(square(1000))).toBeCloseTo(1, 2);
  });

  it("does not depend on winding direction", () => {
    expect(areaKm2([...square(1000)].reverse())).toBeCloseTo(1, 2);
  });
});

describe("centroid", () => {
  it("is the plain average of lat and lng", () => {
    const c = centroid([
      { lat: 0, lng: 0 },
      { lat: 2, lng: 10 },
      { lat: 4, lng: 2 },
    ]);
    expect(c.lat).toBeCloseTo(2, 12);
    expect(c.lng).toBeCloseTo(4, 12);
  });
});

describe("nearestSegment", () => {
  const ring = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("finds the closest edge and its distance", () => {
    expect(nearestSegment(ring, { x: 50, y: -10 })).toEqual({ index: 0, distance: 10 });
    expect(nearestSegment(ring, { x: 130, y: 50 })).toEqual({ index: 1, distance: 30 });
  });

  it("treats the ring as closed", () => {
    expect(nearestSegment(ring, { x: -5, y: 50 })).toEqual({ index: 3, distance: 5 });
  });

  it("measures to the end point beyond a segment's span", () => {
    const result = nearestSegment(ring, { x: -30, y: -40 });
    expect(result.distance).toBe(50);
  });
});

describe("zonePayload", () => {
  it("sends the outline and shape, and no circle fields, for a drawn draft", () => {
    const shape = startPull(CENTER, RADIUS_M, at(2000, 0));
    const draft: ZoneDraft = { center: CENTER, radiusM: RADIUS_M, shape };

    const payload = zonePayload(draft);

    expect(payload).toEqual({ polygon: outline(shape), shape });
    expect(payload).not.toHaveProperty("radiusM");
    expect(payload).not.toHaveProperty("centerLat");
    expect(payload).not.toHaveProperty("centerLng");
  });

  it("sends the circle fields, and no polygon or shape, for a circle draft", () => {
    const payload = zonePayload({ center: CENTER, radiusM: RADIUS_M, shape: null });

    expect(payload).toEqual({ centerLat: CENTER.lat, centerLng: CENTER.lng, radiusM: RADIUS_M });
    expect(payload).not.toHaveProperty("polygon");
    expect(payload).not.toHaveProperty("shape");
  });
});

describe("resetToCircle", () => {
  it("keeps the circle of a pulled shape", () => {
    const shape = startPull(CENTER, RADIUS_M, at(2000, 0));

    // the draft's own centre and radius differ: the shape's circle must win
    expect(resetToCircle({ center: at(300, 300), radiusM: 4000, shape })).toEqual({
      center: CENTER,
      radiusM: RADIUS_M,
      shape: null,
    });
  });

  it("turns a freehand shape into a circle at its centroid", () => {
    const points = [at(-500, -500), at(500, -500), at(500, 500), at(-500, 500)];
    const shape = freehandShape([points]);

    const reset = resetToCircle({ center: at(9, 9), radiusM: 1234, shape });

    expect(reset.shape).toBeNull();
    expect(reset.center.lat).toBeCloseTo(centroid(points).lat, 9);
    expect(reset.center.lng).toBeCloseTo(centroid(points).lng, 9);
    expect(reset.radiusM).toBe(1200);
  });

  it("prefers the saved zone's radius, capped at 10 000 m", () => {
    const shape = freehandShape([[at(-500, -500), at(500, -500), at(0, 500)]]);

    expect(resetToCircle({ center: CENTER, radiusM: 800, shape }, 4960).radiusM).toBe(5000);
    expect(resetToCircle({ center: CENTER, radiusM: 800, shape }, 10_000).radiusM).toBe(10_000);
    expect(resetToCircle({ center: CENTER, radiusM: 12_345, shape }).radiusM).toBe(10_000);
  });
});
