import L from "leaflet";

import { categoryGlyphSvg } from "./categoryGlyphs";
import { SEVERITY_COLORS } from "./format";
import type { AlertCategory, Severity } from "./types";

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
 * (disc colour), and how recent it is (opacity). Older alerts recede so the
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
      `<span class="${classes.join(" ")}" style="${style}">${categoryGlyphSvg(state.category)}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
    tooltipAnchor: [0, -15],
  });
  iconCache.set(key, icon);
  return icon;
}
