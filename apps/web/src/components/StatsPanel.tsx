"use client";

import { useCountUp } from "@/hooks/useCountUp";
import {
  CATEGORY_LABELS,
  dayLetter,
  fillWeek,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
} from "@/lib/format";
import type { AlertFilter } from "@/lib/filter";
import type { AlertCategory, Severity, StatsResponse } from "@/lib/types";

const MAX_CATEGORY_ROWS = 6;
/** Per-bar entrance offset; 7 days finish in ~200ms, so it reads as one sweep. */
const STAGGER_MS = 34;

interface StatsPanelProps {
  stats: StatsResponse | null;
  loading: boolean;
  /** Drives the pressed state on the rows and chips below. */
  filter: AlertFilter;
  onToggleCategory: (category: AlertCategory) => void;
  onToggleSeverity: (severity: Severity) => void;
}

export default function StatsPanel({
  stats,
  loading,
  filter,
  onToggleCategory,
  onToggleSeverity,
}: StatsPanelProps) {
  // Hooks can't sit behind the early return below, so the count-up runs on a
  // safe zero until the first payload lands.
  const total = useCountUp(stats?.stats.total ?? 0);

  if (!stats) {
    return (
      <section className="stats" aria-label="7-day statistics" aria-busy={loading}>
        <h2>Last 7 days</h2>
        {loading ? (
          <div className="stats-skeleton" aria-hidden>
            <div className="skeleton stats-skeleton__hero" />
            <div className="skeleton stats-skeleton__row" />
            <div className="skeleton stats-skeleton__row" />
            <div className="skeleton stats-skeleton__row stats-skeleton__row--short" />
          </div>
        ) : (
          // Says what still works, so a failed summary doesn't read as the
          // whole dashboard being broken.
          <div className="feed__empty-state">
            <p className="feed__empty">The weekly summary could not be loaded.</p>
            <p className="panel__hint">
              Live alerts below are unaffected. This will fill in on the next refresh.
            </p>
          </div>
        )}
      </section>
    );
  }

  const { byCategory, byDay, bySeverity } = stats.stats;

  const week = fillWeek(byDay);
  const maxDayCount = Math.max(1, ...week.map((d) => d.count));

  const categoryRows = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_CATEGORY_ROWS);
  const maxCategoryCount = Math.max(1, ...categoryRows.map(([, count]) => count));

  const severityEntries = (Object.keys(SEVERITY_LABELS) as Severity[])
    .filter((severity) => (bySeverity[severity] ?? 0) > 0)
    .map((severity) => [severity, bySeverity[severity]] as const);

  return (
    <section className="stats fade-in" aria-label="7-day statistics">
      <div className="stats__header">
        <h2>Last 7 days</h2>
        <span className="stats__source">
          {stats.source === "cache" ? "live snapshot" : "database"}
        </span>
      </div>

      <div className="stats__hero">
        {/* The animated figure is decorative motion over a live value, so the
            accessible name carries the real number, not the tweened one. */}
        <span className="stats__hero-number" aria-hidden>
          {total}
        </span>
        <span className="stats__hero-label">
          <span className="sr-only">{stats.stats.total} </span>alerts reported
        </span>
      </div>

      <div className="stats__days" role="img" aria-label={weekSummary(week)}>
        {week.map((day, index) => (
          <div
            className={
              "stats__day" +
              (day.count === 0 ? " stats__day--empty" : "") +
              (day.isToday ? " stats__day--today" : "")
            }
            key={day.day}
            title={`${day.day}: ${day.count} alert${day.count === 1 ? "" : "s"}`}
          >
            <div
              className="stats__day-bar"
              style={{
                height: `${day.count === 0 ? 2 : Math.max(8, (day.count / maxDayCount) * 100)}%`,
                "--bar-delay": `${index * STAGGER_MS}ms`,
              } as React.CSSProperties}
            />
            <span className="stats__day-label">{dayLetter(day.day)}</span>
          </div>
        ))}
      </div>

      {/* These rows read as a breakdown, so they now behave like one: each is
          a toggle that narrows the feed and the map to that category. The
          counts stay 7-day totals from the server — the filter applies to the
          live list, which is why the feed reports the visible count itself. */}
      {categoryRows.length > 0 && (
        <ul className="stats__categories">
          {categoryRows.map(([category, count], index) => {
            const key = category as AlertCategory;
            const label = CATEGORY_LABELS[key] ?? category;
            const on = filter.categories.has(key);
            return (
              <li key={category}>
                <button
                  type="button"
                  className={`stats__category${on ? " stats__category--on" : ""}`}
                  aria-pressed={on}
                  title={`${count} in the last 7 days — click to ${on ? "stop filtering" : "filter"}`}
                  onClick={() => onToggleCategory(key)}
                >
                  <span className="stats__category-label">{label}</span>
                  <span className="stats__category-track">
                    <span
                      className="stats__category-bar"
                      style={{
                        "--fill": count / maxCategoryCount,
                        "--bar-delay": `${index * STAGGER_MS}ms`,
                      } as React.CSSProperties}
                    />
                  </span>
                  <span className="stats__category-count">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {severityEntries.length > 0 && (
        <div className="stats__severities">
          {severityEntries.map(([severity, count]) => {
            const on = filter.severities.has(severity);
            return (
              <button
                key={severity}
                type="button"
                className={`severity-chip severity-chip--button${on ? " severity-chip--on" : ""}`}
                aria-pressed={on}
                title={`${count} in the last 7 days — click to ${on ? "stop filtering" : "filter"}`}
                // On the chip rather than the dot, so the pressed background
                // can tint toward this severity too.
                style={{ "--sev": SEVERITY_COLORS[severity] } as React.CSSProperties}
                onClick={() => onToggleSeverity(severity)}
              >
                <span className="severity-dot" aria-hidden />
                {SEVERITY_LABELS[severity]} {count}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function weekSummary(week: readonly { day: string; count: number }[]): string {
  const parts = week.map((d) => `${dayLetter(d.day)}: ${d.count}`);
  return `Alerts per day over the last 7 days — ${parts.join(", ")}`;
}
