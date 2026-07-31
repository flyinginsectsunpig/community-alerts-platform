import type { AlertCategory, Severity } from "./types";

/**
 * Severity is an ordinal heat ramp — cool at the bottom, hot at the top — so
 * the scale reads as a scale before any label is processed. Colors never
 * appear without an accompanying text label.
 *
 * Deliberately contains no green: green belongs to "verified" (--good), and a
 * green LOW badge next to a green verified chip was unreadable as two
 * different things. Every value clears 4.5:1 on --surface and --surface-2.
 *
 * Source of truth for JS and Leaflet. The --sev-* custom properties in
 * globals.css mirror these and must be kept in sync.
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  UNSCORED: "#9298a5", // oklch(0.68 0.02 265)
  LOW: "#66bec3", // oklch(0.75 0.085 200)
  MEDIUM: "#eab532", // oklch(0.80 0.15 85)
  HIGH: "#fa8233", // oklch(0.73 0.17 50)
  CRITICAL: "#f84b4b", // oklch(0.66 0.21 25)
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

/** How stale an alert is, 0 (new) → 1 (at or past the horizon). */
export function ageFraction(iso: string, horizonHours = 48): number {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  return Math.min(1, Math.max(0, hours / horizonHours));
}

export interface WeekDay {
  day: string;
  count: number;
  isToday: boolean;
}

/**
 * The zone the product reports its days in.
 *
 * Statistics are bucketed by local calendar day, not UTC, because "how many
 * alerts today" has to mean the day the reader is living in. The same zone is
 * applied server-side when grouping — see countByDaySince in the Java API's
 * AlertRepository and the matching query in the .NET worker's
 * PostgresRepositories. All three must agree or the bars and their labels
 * describe different days.
 *
 * South Africa observes no daylight saving, which is what makes the plain
 * day-stepping below safe.
 */
export const APP_TIMEZONE = "Africa/Johannesburg";

/** The YYYY-MM-DD calendar date at `instant`, as seen in APP_TIMEZONE. */
function localDayKey(instant: Date): string {
  // en-CA renders ISO-shaped dates, which is what the API's keys look like.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * The API only returns days that actually have alerts, so a quiet week came
 * back as one bar stretched across the whole chart. A "last 7 days" chart has
 * to render seven slots or it isn't reporting a week — quiet days are data.
 *
 * `now` is injectable so the day-boundary behaviour can be tested; production
 * callers use the default.
 */
export function fillWeek(
  byDay: readonly { day: string; count: number }[],
  now: Date = new Date(),
): WeekDay[] {
  const counts = new Map(byDay.map((d) => [d.day, d.count]));
  const todayKey = localDayKey(now);

  // Stepping happens on the bare calendar date rather than on the instant, so
  // it can't be dragged back over a boundary by the reader's own offset.
  const end = Date.parse(`${todayKey}T00:00:00Z`);

  return Array.from({ length: 7 }, (_, i) => {
    const key = new Date(end - (6 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day: key, count: counts.get(key) ?? 0, isToday: key === todayKey };
  });
}
