import type { AlertCategory } from "./types";

/** Categories where the danger can still be in progress when it is reported. */
export const ONGOING_CATEGORIES: readonly AlertCategory[] = ["ASSAULT", "HAZARD", "OTHER"];

export function canReportOngoing(category: AlertCategory): boolean {
  return ONGOING_CATEGORIES.includes(category);
}
