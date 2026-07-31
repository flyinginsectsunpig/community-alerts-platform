"use client";

import { useEffect } from "react";

/** Keys handled even while a dialog is open. */
const ALWAYS = new Set(["Escape", "?"]);

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

/**
 * Single global key handler for the dashboard's accelerators.
 *
 * Two guards matter more than the bindings: shortcuts must never fire while
 * someone is typing (otherwise "n" in a description opens the report form), and
 * they must stay out of the way while a dialog is open, since the dialog owns
 * the keyboard until it closes.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const handler = shortcuts[event.key];
      if (!handler) return;

      // Typing wins, except for Escape — which is how you get out of a field.
      if (isTyping(event.target) && event.key !== "Escape") return;

      // A dialog owns the keyboard while it is open; only its own exits pass.
      const dialogOpen = document.querySelector(".panel-overlay:not(.panel-overlay--exiting)");
      if (dialogOpen && !ALWAYS.has(event.key)) return;

      handler(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, enabled]);
}
