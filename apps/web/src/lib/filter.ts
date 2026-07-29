import { CATEGORY_LABELS } from "./format";
import type { Alert, AlertCategory, Severity } from "./types";

/**
 * What the feed and the map are currently narrowed to. Empty sets mean "no
 * constraint" rather than "nothing", which keeps the default state cheap to
 * express and makes every predicate below a no-op until the user acts.
 */
export interface AlertFilter {
  categories: ReadonlySet<AlertCategory>;
  severities: ReadonlySet<Severity>;
  query: string;
}

export const EMPTY_FILTER: AlertFilter = {
  categories: new Set(),
  severities: new Set(),
  query: "",
};

export function isFiltered(filter: AlertFilter): boolean {
  return (
    filter.categories.size > 0 || filter.severities.size > 0 || filter.query.trim().length > 0
  );
}

/** Immutable toggle, so the sets can live in React state safely. */
export function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

export function applyFilter(alerts: readonly Alert[], filter: AlertFilter): Alert[] {
  const query = filter.query.trim().toLowerCase();

  return alerts.filter((alert) => {
    if (filter.categories.size > 0 && !filter.categories.has(alert.category)) return false;
    if (filter.severities.size > 0 && !filter.severities.has(alert.severity)) return false;
    if (query.length === 0) return true;

    // Searching the category label as well as the description means typing
    // "burglary" works whether or not the reporter used the word.
    const haystack = `${alert.description} ${CATEGORY_LABELS[alert.category] ?? ""}`;
    return haystack.toLowerCase().includes(query);
  });
}
