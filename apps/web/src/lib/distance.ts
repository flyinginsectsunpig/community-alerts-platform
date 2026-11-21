import { haversineM } from "./zoneShape";

export { haversineM as distanceMetres };

/** How far away something is, at a precision a person can actually use. */
export function distanceLabel(metres: number): string {
  if (metres < 50) return "Under 50 m away";
  const rounded = Math.round(metres / 50) * 50;
  if (rounded < 1000) return `${rounded} m away`;
  const km = metres / 1000;
  return km < 10 ? `${Number(km.toFixed(1))} km away` : `${Math.round(km)} km away`;
}
