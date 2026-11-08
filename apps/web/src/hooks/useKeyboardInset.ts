"use client";

import { useEffect } from "react";

/**
 * Publishes how much of the layout the on-screen keyboard covers as
 * `--keyboard-inset`, so bottom sheets can sit on top of it. Browsers differ on
 * whether the keyboard resizes the page; measuring the visual viewport against
 * the layout viewport gives the right answer (zero, if it did) in both cases.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(covered)}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);
}
