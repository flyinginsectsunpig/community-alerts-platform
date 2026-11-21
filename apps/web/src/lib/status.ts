import type { Alert, Severity } from "./types";

const HOUR_MS = 3_600_000;
const STATUS_WINDOW_MS = 24 * HOUR_MS;

/** Worst first. */
const SEVERITY_RANK: readonly Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNSCORED"];
const SERIOUS: ReadonlySet<Severity> = new Set<Severity>(["CRITICAL", "HIGH"]);

export interface NearbyStatus {
  /** The worst severity reported recently; null when nothing was. */
  level: Severity | null;
  headline: string;
  /** The newest alert at that level: the one to open first. */
  lead: Alert | null;
}

function ageMs(alert: Alert, now: Date): number {
  return now.getTime() - new Date(alert.createdAt).getTime();
}

function countLabel(count: number, adjective: string): string {
  return `${count} ${adjective}alert${count === 1 ? "" : "s"} nearby`;
}

/**
 * The one-line answer to "is anything happening around here?". With no reports
 * it says exactly that and no more: an absence of reports is not an all-clear.
 */
export function nearbyStatus(alerts: readonly Alert[], now: Date = new Date()): NearbyStatus {
  const recent = alerts.filter((alert) => ageMs(alert, now) <= STATUS_WINDOW_MS);
  const level = SEVERITY_RANK.find((severity) => recent.some((a) => a.severity === severity));
  if (!level) {
    return { level: null, headline: "No reports in the last 24 hours", lead: null };
  }

  const atLevel = recent
    .filter((alert) => alert.severity === level)
    .sort((a, b) => ageMs(a, now) - ageMs(b, now));

  return {
    level,
    headline: SERIOUS.has(level)
      ? countLabel(atLevel.length, `${level.toLowerCase()} `)
      : countLabel(recent.length, ""),
    lead: atLevel[0],
  };
}

export function isSerious(level: Severity | null): boolean {
  return level !== null && SERIOUS.has(level);
}

export interface AlertGroup {
  label: string;
  alerts: Alert[];
}

/** Splits a newest-first feed into time bands, dropping any that are empty. */
export function groupByRecency(alerts: readonly Alert[], now: Date = new Date()): AlertGroup[] {
  const groups: AlertGroup[] = [
    { label: "Last hour", alerts: [] },
    { label: "Last 24 hours", alerts: [] },
    { label: "Earlier", alerts: [] },
  ];
  for (const alert of alerts) {
    const age = ageMs(alert, now);
    groups[age <= HOUR_MS ? 0 : age <= STATUS_WINDOW_MS ? 1 : 2].alerts.push(alert);
  }
  return groups.filter((group) => group.alerts.length > 0);
}
