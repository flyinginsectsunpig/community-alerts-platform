"use client";

import { useEffect } from "react";

import type { StationStats } from "@/lib/types";

interface StationStatsPanelProps {
  stats: StationStats;
  onClose: () => void;
}

export default function StationStatsPanel({ stats, onClose }: StationStatsPanelProps) {
  // Escape closes the panel, matching AlertDetailPanel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".panel-overlay, .zone-panel")) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const years = collectYears(stats);

  return (
    <aside className="detail-panel station-stats-panel" aria-label="Official station crime statistics">
      <div className="detail-panel__header">
        <div>
          <strong>{stats.station.name} SAPS</strong>
          <div className="detail-panel__badges">
            <span>
              {stats.station.district} · {stats.station.province}
            </span>
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close station stats">
          ×
        </button>
      </div>

      {stats.latestQuarter && (
        <p className="detail-panel__description">
          {stats.latestQuarter.label}: {stats.latestQuarter.totalSerious} community-reported serious
          crimes
          {stats.latestQuarter.totalSeriousPrevYear !== null &&
            ` (${stats.latestQuarter.totalSeriousPrevYear} same quarter last year)`}
        </p>
      )}

      <div className="station-stats-table-wrap">
        <table className="station-stats-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Months</th>
              {years.map((year) => (
                <th key={year}>{year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.categories.flatMap((category) =>
              category.periods.map((period) => (
                <tr key={`${category.category}-${period.months}`}>
                  <td>{category.category}</td>
                  <td>{period.months}</td>
                  {years.map((year) => (
                    <td key={year}>{period.totals[year] ?? "–"}</td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <p className="station-stats-source">
        Source: SAPS quarterly crime statistics — official counts, independent of alerts reported
        here.
      </p>
    </aside>
  );
}

function collectYears(stats: StationStats): string[] {
  const years = new Set<string>();
  for (const category of stats.categories) {
    for (const period of category.periods) {
      for (const year of Object.keys(period.totals)) years.add(year);
    }
  }
  return Array.from(years).sort();
}
