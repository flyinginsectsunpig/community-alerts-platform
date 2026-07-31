"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Matches the `max-width: 860px` sheet breakpoint in globals.css. */
const SHEET_QUERY = "(max-width: 860px)";
/** Matches `.sidebar { height: 88dvh }` in the same block. */
const SHEET_HEIGHT = 0.88;
/** Handle + feed header + search field + one complete alert row, so the latest
    alert is always readable without opening the sheet. Measured, not guessed:
    the first row's bottom sits 212px below the sheet's top edge, and the extra
    12px keeps the feed's own padding in view. Mirrored by the pre-hydration
    fallback in the `.sidebar` transform in globals.css. */
const PEEK_PX = 224;
const HALF = 0.52;
/** px/ms past which a release counts as a flick rather than a drop. */
const FLICK_VELOCITY = 0.45;

export type Snap = "peek" | "half" | "full";
const ORDER: Snap[] = ["full", "half", "peek"];

/**
 * Turns the desktop rail into a draggable bottom sheet on phones.
 *
 * The offset is applied as a transform through the `--sheet-y` custom property
 * rather than by changing height, so dragging never triggers layout and the
 * map underneath doesn't reflow sixty times a second.
 */
export function useBottomSheet(enabled = true) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const [isSheet, setIsSheet] = useState(false);
  const [snap, setSnap] = useState<Snap>("peek");
  const [dragging, setDragging] = useState(false);

  // Kept in refs because the pointermove handler must not re-subscribe on
  // every frame of a drag.
  const dragRef = useRef({ startY: 0, startOffset: 0, lastY: 0, lastT: 0, velocity: 0 });

  useEffect(() => {
    const mql = window.matchMedia(SHEET_QUERY);
    const sync = () => setIsSheet(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  const offsetFor = useCallback((point: Snap) => {
    const height = window.innerHeight * SHEET_HEIGHT;
    if (point === "full") return 0;
    if (point === "half") return Math.max(0, height - window.innerHeight * HALF);
    return Math.max(0, height - PEEK_PX);
  }, []);

  const applyOffset = useCallback((px: number | null) => {
    const el = sheetRef.current;
    if (!el) return;
    if (px === null) el.style.removeProperty("--sheet-y");
    else el.style.setProperty("--sheet-y", `${px}px`);
  }, []);

  // Settle on the current snap point whenever it changes, the viewport
  // resizes, or the sheet is dismantled back into a desktop rail.
  useEffect(() => {
    if (!isSheet || !enabled) {
      applyOffset(null);
      return;
    }
    const settle = () => {
      if (!dragging) applyOffset(offsetFor(snap));
    };
    settle();
    window.addEventListener("resize", settle);
    return () => window.removeEventListener("resize", settle);
  }, [isSheet, enabled, snap, dragging, offsetFor, applyOffset]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!isSheet || !enabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const now = performance.now();
      dragRef.current = {
        startY: event.clientY,
        startOffset: offsetFor(snap),
        lastY: event.clientY,
        lastT: now,
        velocity: 0,
      };
      setDragging(true);
    },
    [isSheet, enabled, snap, offsetFor],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragging) return;
      const drag = dragRef.current;
      const now = performance.now();
      const dt = now - drag.lastT;
      if (dt > 0) {
        drag.velocity = (event.clientY - drag.lastY) / dt;
        drag.lastY = event.clientY;
        drag.lastT = now;
      }
      const max = offsetFor("peek");
      const next = Math.min(max, Math.max(0, drag.startOffset + (event.clientY - drag.startY)));
      applyOffset(next);
    },
    [dragging, offsetFor, applyOffset],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragging) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);

      const drag = dragRef.current;
      const travelled = event.clientY - drag.startY;
      const current = Math.min(
        offsetFor("peek"),
        Math.max(0, drag.startOffset + travelled),
      );

      // A flick moves one step in the direction of travel; anything slower
      // settles on whichever snap point is physically closest.
      if (Math.abs(drag.velocity) > FLICK_VELOCITY && Math.abs(travelled) > 8) {
        const index = ORDER.indexOf(snap);
        const step = drag.velocity > 0 ? 1 : -1;
        setSnap(ORDER[Math.min(ORDER.length - 1, Math.max(0, index + step))]);
        return;
      }

      let closest: Snap = "peek";
      let best = Infinity;
      for (const point of ORDER) {
        const distance = Math.abs(offsetFor(point) - current);
        if (distance < best) {
          best = distance;
          closest = point;
        }
      }
      setSnap(closest);
    },
    [dragging, snap, offsetFor],
  );

  /** Tap or keyboard: step up through the snap points, then back to peek. */
  const cycle = useCallback(() => {
    setSnap((current) =>
      current === "peek" ? "half" : current === "half" ? "full" : "peek",
    );
  }, []);

  return {
    sheetRef,
    isSheet,
    snap,
    setSnap,
    dragging,
    cycle,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  };
}
