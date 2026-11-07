"use client";

import { useEffect, useState } from "react";

export type ColorScheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The scheme globals.css is currently rendering, for the few things CSS cannot
 * reach — the map's tile URLs. Starts light, the CSS default, and follows the
 * device if it changes while the page is open.
 */
export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>("light");

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const sync = () => setScheme(mql.matches ? "dark" : "light");
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return scheme;
}
