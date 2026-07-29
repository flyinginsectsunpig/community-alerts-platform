"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 650;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Counts from the previous value to the next one so a figure that changes
 * reads as having *changed*, rather than silently being a different number the
 * next time you glance at the panel. Steps through integers only — the label
 * uses tabular numerals, so the width never jitters.
 */
export function useCountUp(target: number): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    if (from === target || prefersReducedMotion()) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      // ease-out-quint: fast to start, settles gently on the final value.
      const eased = 1 - Math.pow(1 - t, 5);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      // Land on the target if we're interrupted, so the next run starts clean.
      fromRef.current = target;
    };
  }, [target]);

  return display;
}
