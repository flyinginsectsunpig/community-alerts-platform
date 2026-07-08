"use client";

import { useEffect, useRef, useState } from "react";

import { liveStreamUrl } from "@/lib/api";
import type { LiveEvent } from "@/lib/types";

/**
 * Subscribes to the API's SSE live feed. EventSource reconnects on its own;
 * the returned flag drives the LIVE indicator in the UI.
 */
export function useLiveAlerts(onEvent: (event: LiveEvent) => void): boolean {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource(liveStreamUrl);

    source.addEventListener("alert", (event) => {
      try {
        callbackRef.current(JSON.parse((event as MessageEvent).data) as LiveEvent);
      } catch {
        // Malformed frame; skip it rather than tearing down the stream.
      }
    });
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    return () => source.close();
  }, []);

  return connected;
}
