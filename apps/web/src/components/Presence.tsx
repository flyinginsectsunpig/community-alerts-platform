"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/** Matches --speed in globals.css, which every exit animation uses. */
const EXIT_MS = 200;

const ExitContext = createContext(false);

/**
 * True while the surrounding <Presence> is playing its exit animation. Panels
 * read this and add their own `--exiting` modifier, so each one leaves by the
 * edge it arrived from rather than sharing a generic fade.
 */
export function useExiting(): boolean {
  return useContext(ExitContext);
}

/**
 * Selectors for overlays that are still open, for the panels that check
 * whether something is stacked above them before claiming Escape. A panel
 * playing its exit animation is still in the DOM for another frame or two but
 * has already given up its claim, so it must not be matched.
 */
export const OPEN_MODAL = ".panel-overlay:not(.panel-overlay--exiting)";
export const OPEN_ZONE_PANEL = ".zone-panel:not(.zone-panel--exiting)";

interface PresenceProps {
  /** Whether the content should be on screen. */
  when: boolean;
  /** Exit duration; keep in step with the CSS animation. */
  duration?: number;
  children: React.ReactNode;
}

/**
 * Keeps children mounted for the length of their exit animation after `when`
 * goes false. Without this a closing panel is simply unmounted mid-frame, so
 * the entrance animations had no counterpart and everything vanished abruptly.
 *
 * The parent usually drops the data at the same moment it flips `when` (the
 * selected alert becomes null), so the last rendered children are retained and
 * replayed during the exit.
 */
export default function Presence({ when, duration = EXIT_MS, children }: PresenceProps) {
  const [mounted, setMounted] = useState(when);
  const lastShown = useRef<React.ReactNode>(null);

  // Written in an effect rather than during render so the ref is never a
  // render-phase side effect. By the time `when` flips false this holds the
  // children from the last render where the panel was open.
  useEffect(() => {
    if (when) lastShown.current = children;
  });

  useEffect(() => {
    if (when) {
      setMounted(true);
      return;
    }
    if (!mounted) return;

    // Reduced motion skips the animation entirely, so there is nothing to
    // wait for — unmount on the spot.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMounted(false);
      return;
    }

    const timer = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(timer);
  }, [when, mounted, duration]);

  if (!mounted) return null;

  return (
    <ExitContext.Provider value={!when}>
      {when ? children : lastShown.current}
    </ExitContext.Provider>
  );
}
