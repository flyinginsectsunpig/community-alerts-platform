import L from "leaflet";

import { SEVERITY_COLORS } from "./format";
import type { AlertCategory, Severity } from "./types";

// Glyph path data from Lucide (https://lucide.dev), ISC License.
// Rendered inside the `.category-pin` disc (globals.css); simple,
// professionally drawn shapes that stay readable at pin size on a dark map.
const SVG_OPEN =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
  `stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">`;

const CATEGORY_GLYPHS: Record<AlertCategory, string> = {
  // wallet
  THEFT: `<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>`,
  // zap
  ASSAULT: `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`,
  // door-open
  BURGLARY: `<path d="M11 20H2"/><path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.562Z"/><path d="M11 4H8a2 2 0 0 0-2 2v14"/><path d="M14 12h.01"/><path d="M22 20h-3"/>`,
  // spray-can
  VANDALISM: `<path d="M3 3h.01"/><path d="M7 5h.01"/><path d="M11 7h.01"/><path d="M3 7h.01"/><path d="M7 9h.01"/><path d="M3 11h.01"/><rect width="4" height="4" x="15" y="5"/><path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2"/><path d="m13 14 8-2"/><path d="m13 19 8-2"/>`,
  // eye
  SUSPICIOUS_ACTIVITY: `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>`,
  // car
  VEHICLE_CRIME: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>`,
  // pill
  DRUGS: `<path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 1 1-7 7Z"/><path d="m8.5 8.5 7 7"/>`,
  // message-square-warning
  HARASSMENT: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/>`,
  // flame
  HAZARD: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  // circle-help's question mark (the disc itself is the circle)
  OTHER: `<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
};

/** Everything that changes how a pin looks. */
export interface PinState {
  category: AlertCategory;
  severity: Severity;
  /** 0 = just reported, 1 = at the staleness horizon. */
  age: number;
  /** Arrived over the live stream moments ago — runs the ripple. */
  isNew: boolean;
  /** Hovered, from the map itself or from its row in the feed. */
  isLinked: boolean;
  isSelected: boolean;
}

// Icons are immutable in Leaflet, so one is built per distinct appearance and
// reused. Age is bucketed to keep that set small — without it, every marker
// would get a unique icon on each refresh.
const iconCache = new Map<string, L.DivIcon>();

function ageBucket(age: number): number {
  return Math.round(Math.min(1, Math.max(0, age)) * 4) / 4;
}

/**
 * A pin encodes three things at once: what happened (glyph), how bad it is
 * (ring colour), and how recent it is (opacity). Older alerts recede so the
 * map reads as "what is happening now" rather than "everything ever filed".
 */
export function categoryDivIcon(state: PinState): L.DivIcon {
  const bucket = ageBucket(state.age);
  const key = [
    state.category,
    state.severity,
    bucket,
    state.isNew ? "n" : "",
    state.isLinked ? "l" : "",
    state.isSelected ? "s" : "",
  ].join("|");

  let icon = iconCache.get(key);
  if (icon) return icon;

  const classes = ["category-pin"];
  if (state.isNew) classes.push("category-pin--new");
  if (state.isLinked) classes.push("category-pin--linked");
  if (state.isSelected) classes.push("category-pin--selected");
  if (state.severity === "CRITICAL") classes.push("category-pin--critical");

  // Never fade past 0.55 — a stale alert still has to be clickable.
  const fade = (1 - bucket * 0.45).toFixed(2);
  const style = `--sev:${SEVERITY_COLORS[state.severity]};--pin-fade:${fade}`;

  icon = L.divIcon({
    className: "category-pin-wrap",
    html:
      `<span class="${classes.join(" ")}" style="${style}">` +
      `${SVG_OPEN}${CATEGORY_GLYPHS[state.category]}</svg></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
    tooltipAnchor: [0, -15],
  });
  iconCache.set(key, icon);
  return icon;
}
