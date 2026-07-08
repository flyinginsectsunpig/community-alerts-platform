import type { AlertCategory, Severity } from "./types";

/**
 * Severity is a status scale (validated for the dark surface): colors never
 * appear without an accompanying text label.
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  UNSCORED: "#898781",
  LOW: "#0ca30c",
  MEDIUM: "#fab219",
  HIGH: "#ec835a",
  CRITICAL: "#d03b3b",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  UNSCORED: "Scoring…",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  THEFT: "Theft",
  ASSAULT: "Assault",
  BURGLARY: "Burglary",
  VANDALISM: "Vandalism",
  SUSPICIOUS_ACTIVITY: "Suspicious activity",
  VEHICLE_CRIME: "Vehicle crime",
  DRUGS: "Drugs",
  HARASSMENT: "Harassment",
  HAZARD: "Hazard",
  OTHER: "Other",
};

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function dayLetter(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
}
