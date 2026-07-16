import L from "leaflet";

import type { AlertCategory } from "./types";

/**
 * One inline SVG glyph per category, rendered white inside the neutral
 * `.category-pin` disc (see globals.css). Deliberately simple silhouettes —
 * they have to read at 14px on a dark map.
 */
const CATEGORY_GLYPHS: Record<AlertCategory, string> = {
  // Wallet with a notch.
  THEFT: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Zm8 2.5a1 1 0 1 0 0 2h4V7h-4Z"/></svg>`,
  // Raised fist.
  ASSAULT: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M5 2.5a1 1 0 0 1 2 0V6h.5V1.5a1 1 0 0 1 2 0V6h.5V2.5a1 1 0 0 1 2 0V8.8c0 .6-.2 1.2-.6 1.7l-1 1.2a2 2 0 0 0-.4 1.3v1.5H6v-1.6a2 2 0 0 0-.6-1.4L4.2 10A2.6 2.6 0 0 1 3.5 8V5a1 1 0 0 1 2 0v1.6H5V2.5Z"/></svg>`,
  // Burglar: masked head over a swag bag.
  BURGLARY: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M8 2a3 3 0 0 1 3 3H5a3 3 0 0 1 3-3Zm-3.5 4h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1ZM8 8c2.8 0 5 2 5 4.5 0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5C3 10 5.2 8 8 8Z"/><circle cx="6.6" cy="4.4" r=".8" fill="#2f2d28"/><circle cx="9.4" cy="4.4" r=".8" fill="#2f2d28"/></svg>`,
  // Spray can with mist.
  VANDALISM: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M6 2h2v1.5H6V2Zm-1 2.5h4A1.5 1.5 0 0 1 10.5 6v6.5A1.5 1.5 0 0 1 9 14H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5Z"/><circle cx="12.2" cy="3" r=".9" fill="#fff"/><circle cx="14" cy="5" r=".7" fill="#fff"/><circle cx="12.6" cy="6.8" r=".6" fill="#fff"/></svg>`,
  // Eye.
  SUSPICIOUS_ACTIVITY: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M8 4c3.2 0 5.6 2.2 6.7 3.7a.6.6 0 0 1 0 .6C13.6 9.8 11.2 12 8 12S2.4 9.8 1.3 8.3a.6.6 0 0 1 0-.6C2.4 6.2 4.8 4 8 4Z"/><circle cx="8" cy="8" r="2.2" fill="#2f2d28"/><circle cx="8" cy="8" r="1" fill="#fff"/></svg>`,
  // Car silhouette.
  VEHICLE_CRIME: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M3.6 6.6 4.5 4A1.5 1.5 0 0 1 5.9 3h4.2a1.5 1.5 0 0 1 1.4 1l.9 2.6c.9.2 1.6 1 1.6 2v2.4a1 1 0 0 1-1 1h-.5a1.25 1.25 0 0 1-2.5 0h-4a1.25 1.25 0 0 1-2.5 0H3a1 1 0 0 1-1-1V8.6c0-1 .7-1.8 1.6-2Zm1.9-.1h5l-.6-1.8a.5.5 0 0 0-.5-.35H6.6a.5.5 0 0 0-.5.35L5.5 6.5Z"/></svg>`,
  // Capsule pill, angled.
  DRUGS: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M3.2 9.6 9.6 3.2a3.1 3.1 0 0 1 4.4 4.4l-6.4 6.4a3.1 3.1 0 0 1-4.4-4.4Zm3.3 3.3 2.9-2.9-3.3-3.3-2.9 2.9a2 2 0 1 0 3.3 3.3Z"/></svg>`,
  // Speech bubble with exclamation mark.
  HARASSMENT: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M3 2.5h10A1.5 1.5 0 0 1 14.5 4v6a1.5 1.5 0 0 1-1.5 1.5H8.4L5 14.4a.5.5 0 0 1-.8-.4v-2.5H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5Z"/><path fill="#2f2d28" d="M7.4 4.4h1.2l-.2 3.4H7.6l-.2-3.4ZM8 8.7a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z"/></svg>`,
  // Flame.
  HAZARD: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M8.2 1.5c.3 2 1.6 3.1 2.8 4.3 1.2 1.2 2.3 2.5 2.3 4.4a5.3 5.3 0 0 1-10.6 0c0-1.4.6-2.6 1.4-3.5.3 1 .8 1.6 1.5 2 0-2.3.6-5.6 2.6-7.2Zm-.1 11.9a2.3 2.3 0 0 0 2.3-2.3c0-1-.6-1.6-1.2-2.2-.5-.6-1-1-1.3-1.9-.9 1-1.4 2.4-1.4 3.6 0 1.6 1 2.8 1.6 2.8Z"/></svg>`,
  // Question mark.
  OTHER: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M8 1.8A3.7 3.7 0 0 1 11.7 5.5c0 1.6-1 2.4-1.8 3-.6.5-1 .8-1 1.5v.3H6.9v-.4c0-1.4.8-2 1.5-2.6.6-.5 1.2-.9 1.2-1.8a1.6 1.6 0 0 0-3.2 0H4.3A3.7 3.7 0 0 1 8 1.8ZM8 11.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"/></svg>`,
};

const iconCache = new Map<AlertCategory, L.DivIcon>();

/** Neutral disc pin with the category's glyph; cached per category. */
export function categoryDivIcon(category: AlertCategory): L.DivIcon {
  let icon = iconCache.get(category);
  if (!icon) {
    icon = L.divIcon({
      className: "category-pin",
      html: CATEGORY_GLYPHS[category],
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14],
      tooltipAnchor: [0, -14],
    });
    iconCache.set(category, icon);
  }
  return icon;
}
