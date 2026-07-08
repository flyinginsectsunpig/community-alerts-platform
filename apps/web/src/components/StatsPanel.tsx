"use client";

import { CATEGORY_LABELS, dayLetter, SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/format";
import type { AlertCategory, Severity, StatsResponse } from "@/lib/types";

const MAX_CATEGORY_ROWS = 6;

export default function StatsPanel({ stats }: { stats: StatsResponse | null }) {
  if (!stats) {
    return (
      <section className="stats" aria-label="7-day statistics">
        <h2>Last 7 days</h2>
        <p className="feed__empty">Loading statistics…</p>
      </section>
    );
  }

  const { total, byCategory, byDay, bySeverity } = stats.stats;

  const categoryRows = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_CATEGORY_ROWS);
  const maxCategoryCount = Math.max(1, ...categoryRows.map(([, count]) => count));
  const maxDayCount = Math.max(1, ...byDay.map((d) => d.count));

  const severityEntries = (Object.keys(SEVERITY_LABELS) as Severity[])
    .filter((severity) => (bySeverity[severity] ?? 0) > 0)
    .map((severity) => [severity, bySeverity[severity]] as const);

  return (
    <section className="stats" aria-label="7-day statistics">
      <div className="stats__header">
        <h2>Last 7 days</h2>
        <span className="stats__source">{stats.source === "cache" ? "live snapshot" : "database"}</span>
      </div>

      <div className="stats__hero">
        <span className="stats__hero-number">{total}</span>
        <span className="stats__hero-label">alerts reported</span>
      </div>

      {byDay.length > 0 && (
        <div className="stats__days" role="img" aria-label="Alerts per day">
          {byDay.map((day) => (
            <div className="stats__day" key={day.day} title={`${day.day}: ${day.count} alerts`}>
              <div
                className="stats__day-bar"
                style={{ height: `${Math.max(8, (day.count / maxDayCount) * 100)}%` }}
              />
              <span className="stats__day-label">{dayLetter(day.day)}</span>
            </div>
          ))}
        </div>
      )}

      {categoryRows.length > 0 && (
        <ul className="stats__categories">
          {categoryRows.map(([category, count]) => (
            <li key={category} className="stats__category" title={`${count} alerts`}>
              <span className="stats__category-label">
                {CATEGORY_LABELS[category as AlertCategory] ?? category}
              </span>
              <span className="stats__category-track">
                <span
                  className="stats__category-bar"
                  style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                />
              </span>
              <span className="stats__category-count">{count}</span>
            </li>
          ))}
        </ul>
      )}

      {severityEntries.length > 0 && (
        <div className="stats__severities">
          {severityEntries.map(([severity, count]) => (
            <span key={severity} className="severity-chip">
              <span
                className="severity-dot"
                style={{ background: SEVERITY_COLORS[severity] }}
                aria-hidden
              />
              {SEVERITY_LABELS[severity]} {count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
