import type { LatLng, ZoneShape } from "./types";

/** Angular step between the points that approximate the circle's arcs. */
export const ARC_STEP_DEG = 5;
/** Half-angle of the cone when a pull sits inside the circle. */
export const INWARD_SPAN_DEG = 30;

const MIN_POINTS = 3;
const MAX_POINTS = 500;
const MAX_REACH_M = 10_000;
const MIN_REACH_M = 50;
const EARTH_RADIUS_M = 6_371_000;
const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180;
const MIN_SIMPLIFY_TOLERANCE_M = 5;
const SIMPLIFY_TOLERANCE_FRACTION = 0.005;

const TOO_FEW_POINTS = "A drawn zone needs at least 3 points";

interface Xy {
  x: number;
  y: number;
}

/**
 * Equirectangular projection about `origin` into local metres:
 * x = east, y = north. Accurate enough at the 10 km scale of a watch zone.
 */
function projection(origin: LatLng) {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  return {
    toXy: (p: LatLng): Xy => ({
      x: (p.lng - origin.lng) * M_PER_DEG * cosLat,
      y: (p.lat - origin.lat) * M_PER_DEG,
    }),
    toLatLng: (p: Xy): LatLng => ({
      lat: origin.lat + p.y / M_PER_DEG,
      lng: origin.lng + p.x / (M_PER_DEG * cosLat),
    }),
  };
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// --- pulled shapes ---------------------------------------------------------

interface Ring {
  points: LatLng[];
  /** gap[k] is the pull index whose gap the segment points[k] -> points[k+1] belongs to. */
  gap: number[];
}

/**
 * The circle with a cone from each pull back to its edge: tangent when the
 * pull is outside the circle, `INWARD_SPAN_DEG` either side when inside.
 * Between two pulls the outline follows the circle, or runs straight from one
 * pull to the next when their cones overlap.
 */
function pulledRing(circle: { center: LatLng; radiusM: number }, pulls: LatLng[]): Ring {
  const { toXy, toLatLng } = projection(circle.center);
  const r = circle.radiusM;
  const onCircle = (angleDeg: number): LatLng =>
    toLatLng({ x: r * Math.cos(toRad(angleDeg)), y: r * Math.sin(toRad(angleDeg)) });

  const polar = pulls.map((pull) => {
    const { x, y } = toXy(pull);
    const distance = Math.hypot(x, y);
    return {
      theta: toDeg(Math.atan2(y, x)),
      alpha: distance > r ? toDeg(Math.acos(r / distance)) : INWARD_SPAN_DEG,
    };
  });

  const points: LatLng[] = [];
  const gap: number[] = [];
  const emit = (p: LatLng, gapIndex: number) => {
    points.push(p);
    gap.push(gapIndex);
  };

  pulls.forEach((pull, i) => {
    const current = polar[i];
    const next = polar[(i + 1) % pulls.length];
    emit(pull, i);

    const ccw = (((next.theta - current.theta) % 360) + 360) % 360;
    const span = ccw === 0 ? 360 : ccw;
    if (span - current.alpha - next.alpha <= 0) {
      return;
    }

    const arcStart = current.theta + current.alpha;
    const arcEnd = current.theta + span - next.alpha;
    emit(onCircle(arcStart), i);
    for (let a = arcStart + ARC_STEP_DEG; a < arcEnd - 1e-9; a += ARC_STEP_DEG) {
      emit(onCircle(a), i);
    }
    emit(onCircle(arcEnd), i);
  });

  return { points, gap };
}

export function startPull(center: LatLng, radiusM: number, grab: LatLng): ZoneShape {
  return { kind: "pulled", circle: { center, radiusM }, pulls: [grab] };
}

// --- shape editing ---------------------------------------------------------

export function outline(shape: ZoneShape): LatLng[] {
  return shape.kind === "pulled"
    ? pulledRing(shape.circle, shape.pulls).points
    : shape.points.map((p) => p.at);
}

export function handles(shape: ZoneShape): LatLng[] {
  return shape.kind === "pulled"
    ? shape.pulls
    : shape.points.filter((p) => p.handle).map((p) => p.at);
}

/** Position in `points` of the `index`-th handle. */
function freehandPosition(points: { handle: boolean }[], index: number): number {
  let seen = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].handle && ++seen === index) {
      return i;
    }
  }
  throw new RangeError(`No handle at index ${index}`);
}

function checkHandleIndex(shape: ZoneShape, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= handles(shape).length) {
    throw new RangeError(`No handle at index ${index}`);
  }
}

/** Adds a handle at `grab` on the outline segment nearest to it. */
export function insertPointAt(shape: ZoneShape, grab: LatLng): { shape: ZoneShape; index: number } {
  if (shape.kind === "pulled") {
    const { points, gap } = pulledRing(shape.circle, shape.pulls);
    const { toXy } = projection(shape.circle.center);
    const { index: segment } = nearestSegment(points.map(toXy), toXy(grab));
    const index = gap[segment] + 1;
    const pulls = [...shape.pulls.slice(0, index), grab, ...shape.pulls.slice(index)];
    return { shape: { ...shape, pulls }, index };
  }

  const { toXy } = projection(shape.points[0].at);
  const { index: segment } = nearestSegment(shape.points.map((p) => toXy(p.at)), toXy(grab));
  const position = segment + 1;
  const points = [
    ...shape.points.slice(0, position),
    { at: grab, handle: true },
    ...shape.points.slice(position),
  ];
  const index = points.slice(0, position).filter((p) => p.handle).length;
  return { shape: { ...shape, points }, index };
}

export function moveHandle(shape: ZoneShape, index: number, to: LatLng): ZoneShape {
  checkHandleIndex(shape, index);
  if (shape.kind === "pulled") {
    return { ...shape, pulls: shape.pulls.map((p, i) => (i === index ? to : p)) };
  }
  const position = freehandPosition(shape.points, index);
  return {
    ...shape,
    points: shape.points.map((p, i) => (i === position ? { ...p, at: to } : p)),
  };
}

/** Returns null when the last pull goes: the shape is a plain circle again. */
export function removeHandle(shape: ZoneShape, index: number): ZoneShape | null {
  checkHandleIndex(shape, index);
  if (shape.kind === "pulled") {
    return shape.pulls.length === 1
      ? null
      : { ...shape, pulls: shape.pulls.filter((_, i) => i !== index) };
  }
  if (shape.points.length <= MIN_POINTS) {
    throw new Error(TOO_FEW_POINTS);
  }
  const position = freehandPosition(shape.points, index);
  return { ...shape, points: shape.points.filter((_, i) => i !== position) };
}

export function translateShape(shape: ZoneShape, dLat: number, dLng: number): ZoneShape {
  const shift = (p: LatLng): LatLng => ({ lat: p.lat + dLat, lng: p.lng + dLng });
  if (shape.kind === "pulled") {
    return {
      ...shape,
      circle: { ...shape.circle, center: shift(shape.circle.center) },
      pulls: shape.pulls.map(shift),
    };
  }
  return { ...shape, points: shape.points.map((p) => ({ ...p, at: shift(p.at) })) };
}

// --- freehand --------------------------------------------------------------

/** Distance from `p` to the segment a-b (to `a` when the segment has no length). */
function distanceToSegment(p: Xy, a: Xy, b: Xy): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Douglas–Peucker: the indices of the points kept, ascending. */
function simplify(points: Xy[], tolerance: number): number[] {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const pending: [number, number][] = [[0, points.length - 1]];
  while (pending.length > 0) {
    const [first, last] = pending.pop()!;
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i], points[first], points[last]);
      if (d > farthestDistance) {
        farthest = i;
        farthestDistance = d;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = true;
      pending.push([first, farthest], [farthest, last]);
    }
  }
  return keep.flatMap((kept, i) => (kept ? [i] : []));
}

/** Joins the strokes and thins them to at most 500 points; none of them is a handle. */
export function freehandShape(pieces: LatLng[][]): ZoneShape {
  const all = pieces.flat();
  if (all.length < MIN_POINTS) {
    throw new Error(TOO_FEW_POINTS);
  }

  const { toXy } = projection(all[0]);
  const xy = all.map(toXy);
  const box = xy.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p.x),
      maxX: Math.max(b.maxX, p.x),
      minY: Math.min(b.minY, p.y),
      maxY: Math.max(b.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const diagonal = Math.hypot(box.maxX - box.minX, box.maxY - box.minY);

  let tolerance = Math.max(MIN_SIMPLIFY_TOLERANCE_M, SIMPLIFY_TOLERANCE_FRACTION * diagonal);
  let kept = simplify(xy, tolerance);
  while (kept.length > MAX_POINTS) {
    tolerance *= 2;
    kept = simplify(xy, tolerance);
  }

  if (kept.length < MIN_POINTS) {
    throw new Error(TOO_FEW_POINTS);
  }
  return { kind: "freehand", points: kept.map((i) => ({ at: all[i], handle: false })) };
}

// --- measurements and validation -------------------------------------------

export function centroid(outline: LatLng[]): LatLng {
  if (outline.length === 0) {
    throw new Error("Cannot take the centre of an empty outline");
  }
  const sum = outline.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / outline.length, lng: sum.lng / outline.length };
}

/** Shoelace area of the outline, in square kilometres. */
export function areaKm2(outline: LatLng[]): number {
  if (outline.length < MIN_POINTS) {
    return 0;
  }
  const { toXy } = projection(outline[0]);
  const xy = outline.map(toXy);
  let twiceArea = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2 / 1_000_000;
}

/**
 * The closed-ring segment nearest to `p`: `index` is the segment from
 * `points[index]` to the next point (wrapping), `distance` is in the points' units.
 */
export function nearestSegment(points: Xy[], p: Xy): { index: number; distance: number } {
  if (points.length === 0) {
    throw new Error("Cannot find the nearest segment of an empty ring");
  }
  let best = { index: 0, distance: Infinity };
  for (let i = 0; i < points.length; i++) {
    const distance = distanceToSegment(p, points[i], points[(i + 1) % points.length]);
    if (distance < best.distance) {
      best = { index: i, distance };
    }
  }
  return best;
}

function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Cross product of (b - a) x (c - a), with lng as x and lat as y, as the API computes it. */
function orientation(a: LatLng, b: LatLng, c: LatLng): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

/** Whether c, already known to be collinear with a-b, lies within its bounding box. */
function onSegment(a: LatLng, b: LatLng, c: LatLng): boolean {
  return (
    c.lng >= Math.min(a.lng, b.lng) &&
    c.lng <= Math.max(a.lng, b.lng) &&
    c.lat >= Math.min(a.lat, b.lat) &&
    c.lat <= Math.max(a.lat, b.lat)
  );
}

function segmentsIntersect(p1: LatLng, p2: LatLng, p3: LatLng, p4: LatLng): boolean {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // collinear or touching: an endpoint lying on the other segment counts as crossing
  return (
    (d1 === 0 && onSegment(p3, p4, p1)) ||
    (d2 === 0 && onSegment(p3, p4, p2)) ||
    (d3 === 0 && onSegment(p1, p2, p3)) ||
    (d4 === 0 && onSegment(p1, p2, p4))
  );
}

function hasCrossingEdges(ring: LatLng[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (!adjacent && segmentsIntersect(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The reason the API would reject this outline, or null if it would accept it.
 * Same rules, order and messages as the API's ZoneGeometry.
 */
export function validateOutline(outline: LatLng[]): string | null {
  if (outline.length < MIN_POINTS) {
    return TOO_FEW_POINTS;
  }
  if (outline.length > MAX_POINTS) {
    return "A drawn zone can have at most 500 points";
  }
  if (hasCrossingEdges(outline)) {
    return "A drawn zone's edges must not cross";
  }

  const middle = centroid(outline);
  const reach = Math.max(...outline.map((p) => haversineM(middle, p)));
  if (reach > MAX_REACH_M) {
    return "A drawn zone must fit within 10 km of its centre";
  }
  if (reach < MIN_REACH_M) {
    return "A drawn zone must reach at least 50 m from its centre";
  }
  return null;
}
