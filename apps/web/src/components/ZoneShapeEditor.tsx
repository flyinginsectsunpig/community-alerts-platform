"use client";

import { useEffect, useRef, type RefObject } from "react";
import L from "leaflet";
import { Circle, CircleMarker, Marker, Polygon, Polyline, Tooltip, useMap } from "react-leaflet";

import type { LatLng, ZoneDraft, ZoneMode, ZoneShape } from "@/lib/types";
import {
  FREEHAND_STEP_PX,
  centroid,
  circleOutline,
  handles,
  insertPointAt,
  moveHandle,
  outline,
  penDownAction,
  removeHandle,
  resetToCircle,
  snapToCircle,
  startPull,
  translateShape,
} from "@/lib/zoneShape";

// Zone drafts wear the accent: an action of yours in progress, not data.
export const ZONE_COLOR = "#24abe8";

// Styled via .zone-handle in globals.css; a DivIcon avoids Leaflet's default
// marker sprite (whose assets don't survive bundling).
const ZONE_HANDLE_ICON = L.divIcon({
  className: "zone-handle",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const DRAFT_STYLE = {
  color: ZONE_COLOR,
  weight: 2,
  dashArray: "6 6",
  fillColor: ZONE_COLOR,
  fillOpacity: 0.08,
};

/** Width of the invisible band along the edge that can be grabbed. */
const HIT_WIDTH_PX = 24;
const LONG_PRESS_MS = 600;
/** Movement under this is a press held still, not a drag. */
const DRAG_SLOP_PX = 5;
/** A freehand shape can't lose a point below this. */
const MIN_FREEHAND_POINTS = 3;

interface ZoneShapeEditorProps {
  draft: ZoneDraft;
  mode: ZoneMode;
  onChange: (draft: ZoneDraft) => void;
  /** The pieces of freehand line drawn so far. */
  pieces: LatLng[][];
  /** Whether a press on the map draws (true) or moves the map (false). */
  penDown: boolean;
  onPiecesChange: (pieces: LatLng[][]) => void;
  /** The shape was closed by pressing its first point. */
  onFinish: () => void;
  /** A press with the pen down was too far from the end of the line to carry it on. */
  onStrayStart: () => void;
}

/**
 * Where the centre pin sits: the circle's centre for a pulled shape, the
 * outline's centroid for a freehand one. Not `draft.center`, which for a
 * reopened zone is the server's average of the outline's vertices.
 */
function pinAnchor(draft: ZoneDraft): LatLng {
  if (!draft.shape) {
    return draft.center;
  }
  return draft.shape.kind === "pulled" ? draft.shape.circle.center : centroid(outline(draft.shape));
}

function translateDraft(draft: ZoneDraft, dLat: number, dLng: number): ZoneDraft {
  return {
    ...draft,
    center: { lat: draft.center.lat + dLat, lng: draft.center.lng + dLng },
    shape: draft.shape && translateShape(draft.shape, dLat, dLng),
  };
}

function canRemove(shape: ZoneShape): boolean {
  return shape.kind === "pulled" || shape.points.length > MIN_FREEHAND_POINTS;
}

/** Stops the click a press ends with from reaching the map, which would move the zone. */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}

/** Swallows the click that follows this pointer's release, however the press was used. */
function swallowClickAfterRelease(pointerId: number) {
  const released = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    window.removeEventListener("pointerup", released);
    window.removeEventListener("pointercancel", released);
    swallowNextClick();
  };
  window.addEventListener("pointerup", released);
  window.addEventListener("pointercancel", released);
}

/**
 * Calls `onGrab` for a primary pointerdown on the layer's element, keeping
 * the press from the map so it neither pans nor starts a touch gesture.
 */
function useGrab(layer: RefObject<L.Path>, onGrab: (event: PointerEvent) => void) {
  const latest = useRef(onGrab);
  latest.current = onGrab;

  useEffect(() => {
    const element = layer.current?.getElement();
    if (!element) {
      return;
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      latest.current(event);
    };
    const stop = (event: Event) => event.stopPropagation();
    const noMenu = (event: Event) => event.preventDefault();
    element.addEventListener("pointerdown", down as EventListener);
    element.addEventListener("touchstart", stop, { passive: true });
    element.addEventListener("contextmenu", noMenu);
    return () => {
      element.removeEventListener("pointerdown", down as EventListener);
      element.removeEventListener("touchstart", stop);
      element.removeEventListener("contextmenu", noMenu);
    };
  }, [layer]);
}

/** The invisible band along the edge, `HIT_WIDTH_PX` wide. */
function GrabRing({ edge, onGrab }: { edge: LatLng[]; onGrab: (event: PointerEvent) => void }) {
  const ring = useRef<L.Polyline>(null);
  useGrab(ring, onGrab);
  return (
    <Polyline
      ref={ring}
      positions={[...edge, edge[0]].map((p) => [p.lat, p.lng] as [number, number])}
      className="zone-grab"
      bubblingMouseEvents={false}
      pathOptions={{ color: ZONE_COLOR, weight: HIT_WIDTH_PX, opacity: 0 }}
    />
  );
}

function ZoneHandle({
  at,
  onGrab,
  onRemove,
}: {
  at: LatLng;
  onGrab: (event: PointerEvent) => void;
  onRemove?: () => void;
}) {
  const target = useRef<L.CircleMarker>(null);
  useGrab(target, onGrab);
  return (
    <>
      <CircleMarker
        center={[at.lat, at.lng]}
        radius={6}
        interactive={false}
        pathOptions={{ color: ZONE_COLOR, weight: 2, fillColor: "#ffffff", fillOpacity: 1 }}
      />
      {/* The dot is 12px; this carries a finger-sized target the width of the edge's band. */}
      <CircleMarker
        ref={target}
        center={[at.lat, at.lng]}
        radius={HIT_WIDTH_PX / 2}
        className="zone-grab"
        bubblingMouseEvents={false}
        pathOptions={{ stroke: false, fillOpacity: 0 }}
        eventHandlers={onRemove ? { dblclick: onRemove } : {}}
      />
    </>
  );
}

/**
 * The zone being drawn: a circle until its edge is pulled, then the shape.
 * In pull mode, grabbing the edge pulls out a point there and grabbing a
 * point moves it; double-click or long-press a point to take it out again.
 * In freehand mode, with the pen down, dragging across the map draws a line
 * in pieces; with it up the map pans and zooms as usual.
 */
export default function ZoneShapeEditor({
  draft,
  mode,
  onChange,
  pieces,
  penDown,
  onPiecesChange,
  onFinish,
  onStrayStart,
}: ZoneShapeEditorProps) {
  const map = useMap();
  const active = mode === "pull";
  const drawing = mode === "freehand" && penDown;

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const drawCallbacks = useRef({ onPiecesChange, onFinish, onStrayStart });
  drawCallbacks.current = { onPiecesChange, onFinish, onStrayStart };
  const endDrag = useRef<(() => void) | null>(null);
  const pinStart = useRef<{ draft: ZoneDraft; at: LatLng } | null>(null);

  useEffect(() => () => endDrag.current?.(), []);

  // With the pen down a press draws instead of panning. Map dragging is off
  // for as long, restored only if it was on; touch-action is too, or the
  // browser would take the stroke for a scroll.
  useEffect(() => {
    if (!drawing) return;
    const container = map.getContainer();
    const wasDraggable = map.dragging.enabled();
    map.dragging.disable();
    container.classList.add("zone-drawing");

    let endStroke: (() => void) | null = null;

    const down = (event: PointerEvent) => {
      if (!event.isPrimary) {
        endStroke?.(); // a second finger is a pinch: leave it to the map
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if ((event.target as Element).closest(".leaflet-control, .leaflet-popup")) return;
      event.preventDefault();
      event.stopPropagation();
      swallowClickAfterRelease(event.pointerId);

      const start = map.mouseEventToContainerPoint(event);
      const action = penDownAction(piecesRef.current, (p) => map.latLngToContainerPoint(p), start);
      if (action === "finish") {
        drawCallbacks.current.onFinish();
        return;
      }
      if (action === "stray") {
        drawCallbacks.current.onStrayStart();
        return;
      }

      endStroke?.();
      const before = piecesRef.current;
      const first = map.mouseEventToLatLng(event);
      const piece: LatLng[] = [{ lat: first.lat, lng: first.lng }];
      let last = start;
      const move = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        const at = map.mouseEventToContainerPoint(e);
        if (last.distanceTo(at) < FREEHAND_STEP_PX) return;
        last = at;
        const { lat, lng } = map.mouseEventToLatLng(e);
        piece.push({ lat, lng });
        drawCallbacks.current.onPiecesChange([...before, [...piece]]);
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId === event.pointerId) endStroke?.();
      };
      endStroke = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        endStroke = null;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };

    container.addEventListener("pointerdown", down, { capture: true });
    return () => {
      container.removeEventListener("pointerdown", down, { capture: true });
      endStroke?.();
      container.classList.remove("zone-drawing");
      if (wasDraggable) map.dragging.enable();
    };
  }, [map, drawing]);

  const toLatLng = (event: PointerEvent): LatLng => {
    const { lat, lng } = map.mouseEventToLatLng(event);
    return { lat, lng };
  };

  /**
   * Moves handle `index` of `shape` with the pointer until it's released. A
   * press held still for `LONG_PRESS_MS` calls `onLongPress` instead. `created`
   * says the press already added a point to `base`: even a tap must not click
   * the map, and a tap that never drags it is undone back to `base`.
   */
  function drag(
    down: PointerEvent,
    base: ZoneDraft,
    shape: ZoneShape,
    index: number,
    { onLongPress, created = false }: { onLongPress?: () => void; created?: boolean } = {},
  ) {
    endDrag.current?.();
    const container = map.getContainer();
    const wasDraggable = map.dragging.enabled();
    map.dragging.disable();
    container.classList.add("zone-dragging");
    (down.target as Element).setPointerCapture?.(down.pointerId);

    let moved = false;
    let held = false;
    const press = onLongPress
      ? window.setTimeout(() => {
          held = true;
          onLongPress();
        }, LONG_PRESS_MS)
      : undefined;

    const move = (event: PointerEvent) => {
      if (event.pointerId !== down.pointerId || held) return;
      if (!moved && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < DRAG_SLOP_PX) {
        return; // a shaky press must not nudge the point off the edge
      }
      moved = true;
      window.clearTimeout(press);
      onChangeRef.current({ ...base, shape: moveHandle(shape, index, toLatLng(event)) });
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== down.pointerId) return;
      end();
      // A tap on the edge that never became a drag takes its new point back:
      // a plain circle must not turn into a drawn zone by being touched.
      if (created && !moved && !held) onChangeRef.current(base);
      if (moved || held || created) swallowNextClick();
    };
    function end() {
      window.clearTimeout(press);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      container.classList.remove("zone-dragging");
      if (wasDraggable) map.dragging.enable();
      endDrag.current = null;
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    endDrag.current = end;
  }

  function removeAt(index: number) {
    const base = draftRef.current;
    const { shape } = base;
    // removeHandle throws rather than leave a freehand shape under 3 points
    if (!shape || !canRemove(shape)) return;
    const next = removeHandle(shape, index);
    onChangeRef.current(next ? { ...base, shape: next } : resetToCircle(base));
  }

  /** A grab within half the band of the circle lands on it, so a first touch can't dent it. */
  function onCircleIfNear(center: LatLng, radiusM: number, grab: LatLng): LatLng {
    const snapped = snapToCircle(center, radiusM, grab);
    const gapPx = map.latLngToContainerPoint(snapped).distanceTo(map.latLngToContainerPoint(grab));
    return gapPx <= HIT_WIDTH_PX / 2 ? snapped : grab;
  }

  function grabEdge(event: PointerEvent) {
    const base = draftRef.current;
    const grab = toLatLng(event);
    let shape: ZoneShape;
    let index: number;
    if (!base.shape) {
      shape = startPull(base.center, base.radiusM, snapToCircle(base.center, base.radiusM, grab));
      index = 0;
    } else if (base.shape.kind === "pulled") {
      const { center, radiusM } = base.shape.circle;
      ({ shape, index } = insertPointAt(base.shape, onCircleIfNear(center, radiusM, grab)));
    } else {
      ({ shape, index } = insertPointAt(base.shape, grab));
    }
    onChangeRef.current({ ...base, shape });
    drag(event, base, shape, index, { created: true });
  }

  const { shape } = draft;
  const edge = shape ? outline(shape) : circleOutline(draft.center, draft.radiusM);
  const anchor = pinAnchor(draft);

  return (
    <>
      {/* Not interactive: presses fall through to the grab band, which can end
          up under the polygon when the circle turns into one, or to the map. */}
      {shape ? (
        <Polygon
          positions={edge.map((p) => [p.lat, p.lng] as [number, number])}
          interactive={false}
          pathOptions={DRAFT_STYLE}
        />
      ) : (
        <Circle
          center={[draft.center.lat, draft.center.lng]}
          radius={draft.radiusM}
          interactive={false}
          pathOptions={DRAFT_STYLE}
        />
      )}

      {mode === "freehand" && pieces.length > 0 && (
        <Polyline
          positions={pieces.flat().map((p) => [p.lat, p.lng] as [number, number])}
          interactive={false}
          pathOptions={{ color: ZONE_COLOR, weight: 3, dashArray: DRAFT_STYLE.dashArray }}
        />
      )}

      {active && (
        <>
          <GrabRing edge={edge} onGrab={grabEdge} />
          {shape &&
            handles(shape).map((at, index) => (
              <ZoneHandle
                key={index}
                at={at}
                onGrab={(event) => {
                  const base = draftRef.current;
                  if (!base.shape) return;
                  const onLongPress = canRemove(base.shape) ? () => removeAt(index) : undefined;
                  drag(event, base, base.shape, index, { onLongPress });
                }}
                onRemove={canRemove(shape) ? () => removeAt(index) : undefined}
              />
            ))}
        </>
      )}

      <Marker
        position={[anchor.lat, anchor.lng]}
        icon={ZONE_HANDLE_ICON}
        draggable={active}
        eventHandlers={{
          dragstart: () => {
            pinStart.current = { draft: draftRef.current, at: pinAnchor(draftRef.current) };
          },
          drag: (event) => {
            const start = pinStart.current;
            if (!start) return;
            const to = (event.target as L.Marker).getLatLng();
            onChangeRef.current(translateDraft(start.draft, to.lat - start.at.lat, to.lng - start.at.lng));
          },
          dragend: () => {
            pinStart.current = null;
          },
        }}
      >
        {active && (
          <Tooltip direction="top" offset={[0, -10]}>
            Drag to move the zone
          </Tooltip>
        )}
      </Marker>
    </>
  );
}
