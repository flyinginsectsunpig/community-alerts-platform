"use client";

import { useEffect, useRef, useState } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

interface Options {
  /** False once the surface starts leaving, so focus goes back promptly. */
  active: boolean;
  /** Keep Tab inside. True for modal dialogs, false for docked panels. */
  trap: boolean;
}

/**
 * Moves focus into a surface when it opens and returns it to whatever was
 * focused before when it closes — with an optional Tab trap for modal
 * dialogs.
 *
 * Without this, opening a dialog left focus on the button behind it: keyboard
 * users tabbed through the page underneath while a modal covered it, and
 * screen readers never entered the dialog at all.
 */
export function useFocusCapture<T extends HTMLElement>({ active, trap }: Options) {
  const ref = useRef<T>(null);

  // Captured during the first render, which is the only moment it is still
  // correct: React applies the `autoFocus` that these panels put on their first
  // field during commit, so by the time an effect runs the "previously focused
  // element" is already a field *inside* the panel — and restoring to that
  // leaves focus stranded on a node that is about to unmount.
  const [restoreTo] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    // Where focus lands is resolved from the DOM rather than from whatever
    // happens to be focused right now: React's StrictMode double-mount makes
    // "is focus already inside?" an unreliable signal in development.
    // A panel marks its own first field with data-autofocus; otherwise the
    // first real control, falling back to the surface itself, which carries
    // tabindex={-1} so it can hold focus without joining the tab order.
    // A surface can mark itself, not just a child: docked panels want focus on
    // the panel so its label is announced before its contents, rather than
    // dropped onto whatever control happens to come first (usually "close").
    const target =
      (root.matches("[data-autofocus]") ? root : root.querySelector<HTMLElement>("[data-autofocus]")) ??
      focusable(root)[0] ??
      root;

    // After paint, so the entrance animation doesn't fight the scroll that
    // focusing can trigger.
    const raf = requestAnimationFrame(() => target.focus({ preventScroll: true }));

    return () => {
      cancelAnimationFrame(raf);
      // Only take focus back if it is still inside the surface; the user may
      // have deliberately clicked elsewhere by now.
      if (restoreTo && document.contains(restoreTo) && root.contains(document.activeElement)) {
        restoreTo.focus({ preventScroll: true });
      }
    };
  }, [active, restoreTo]);

  useEffect(() => {
    if (!active || !trap) return;
    const root = ref.current;
    if (!root) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !root) return;
      const items = focusable(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [active, trap]);

  return ref;
}
