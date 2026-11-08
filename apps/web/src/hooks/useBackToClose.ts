"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the phone's back button dismiss what is open instead of leaving the
 * app. Each open adds one history entry, and back consumes it.
 */
export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  // True while our history entry is on the stack.
  const pushed = useRef(false);

  useEffect(() => {
    if (open && !pushed.current) {
      window.history.pushState({ overlay: true }, "");
      pushed.current = true;
    } else if (!open && pushed.current) {
      // Closed from the UI, so the entry is stale. Clearing the flag first
      // stops the popstate below from treating this as the user pressing back.
      pushed.current = false;
      window.history.back();
    }
  }, [open]);

  useEffect(() => {
    function onPopState() {
      if (!pushed.current) return;
      pushed.current = false;
      closeRef.current();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
