"use client";

import { useEffect, useMemo } from "react";

import { OPEN_MODAL, OPEN_ZONE_PANEL, useExiting } from "./Presence";
import type { StationStats } from "@/lib/types";

interface StationStatsPanelProps {
  stats: StationStats;
  onClose: () => void;
}

/** SAPS quarter windows in calendar order; labels use en dashes exactly. */
const QUARTER_WINDOWS = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];

interface QuarterPoint {
  label: string;
  value: number;
}

interface CategoryRow {
  category: string;
  latest: number | null;
  prevYear: number | null;
  series: QuarterPoint[];
}

interface PanelModel {
  quarterLabel: string | null;
  total: number | null;
  totalPrevYear: number | null;
  totalSeries: QuarterPoint[];
  rows: CategoryRow[];
  maxLatest: number;
}

export default function StationStatsPanel({ stats, onClose }: StationStatsPanelProps) {
  const exiting = useExiting();

  // Escape closes the panel, matching AlertDetailPanel.
  useEffect(() => {
    if (exiting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(`${OPEN_MODAL}, ${OPEN_ZONE_PANEL}`)) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, exiting]);

  const model = useMemo(() => buildModel(stats), [stats]);
  const years = useMemo(() => collectYears(stats), [stats]);
  const hasData = model.rows.length > 0;

  return (
    <aside
      className={`detail-panel station-stats-panel${exiting ? " detail-panel--exiting" : ""}`}
      aria-label="Official station crime statistics"
    >
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

      {hasData && model.quarterLabel && model.total !== null && (
        <section className="station-quarter" aria-label={`Latest quarter, ${model.quarterLabel}`}>
          <span className="station-quarter__label">{model.quarterLabel} · serious crimes reported</span>
          <div className="station-quarter__row">
            <span className="station-quarter__value">{model.total.toLocaleString()}</span>
            <Delta current={model.total} previous={model.totalPrevYear} showPercent />
          </div>
          <Sparkline
            points={model.totalSeries}
            width={316}
            height={44}
            ariaLabel={trendLabel("All serious crimes", model.totalSeries)}
          />
          {model.totalSeries.length >= 2 && (
            <span className="station-quarter__caption">
              Quarterly totals since {model.totalSeries[0].label}
            </span>
          )}
        </section>
      )}

      {hasData ? (
        <section aria-label="Crime categories: latest quarter and multi-year trend">
          <h3 className="station-section-title">By category</h3>
          <ul className="station-cat-list">
            {model.rows.map((row) => (
              <li className="station-cat" key={row.category}>
                <div className="station-cat__head">
                  <span className="station-cat__name" title={row.category}>
                    {row.category}
                  </span>
                  {row.latest !== null && <Delta current={row.latest} previous={row.prevYear} />}
                </div>
                <div className="station-cat__viz">
                  <span
                    className="station-cat__track"
                    title={`${row.latest ?? 0} in ${model.quarterLabel ?? "latest quarter"}`}
                  >
                    <span
                      className="station-cat__bar"
                      style={{ width: `${((row.latest ?? 0) / model.maxLatest) * 100}%` }}
                    />
                  </span>
                  <span className="station-cat__count">
                    {row.latest !== null ? row.latest.toLocaleString() : "–"}
                  </span>
                  <span className="station-cat__spark">
                    <Sparkline
                      points={row.series}
                      width={64}
                      height={22}
                      ariaLabel={trendLabel(row.category, row.series)}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="station-stats-empty">
          No quarterly statistics have been imported for this station yet. Figures arrive with each
          SAPS quarterly release.
        </p>
      )}

      {hasData && (
        <details className="station-table-details">
          <summary>Full data table</summary>
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
        </details>
      )}

      <p className="station-stats-source">
        Source: SAPS quarterly crime statistics — official counts, independent of alerts reported
        here.
      </p>
    </aside>
  );
}

/** Signed year-on-year change; direction is carried by arrow + sign, never color alone. */
function Delta({
  current,
  previous,
  showPercent = false,
}: {
  current: number;
  previous: number | null;
  showPercent?: boolean;
}) {
  if (previous === null) {
    return (
      <span className="delta delta--na" title="No figure for the same quarter last year">
        —
      </span>
    );
  }
  const diff = current - previous;
  const title = `${previous.toLocaleString()} in the same quarter last year`;
  if (diff === 0) {
    return (
      <span className="delta delta--flat" title={title}>
        ±0
      </span>
    );
  }
  const worse = diff > 0;
  const percent = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : 0;
  // A change that rounds to 0% still reads as the absolute count, never "0%".
  const amount =
    showPercent && percent > 0 ? `${percent}%` : Math.abs(diff).toLocaleString();
  return (
    <span
      className={worse ? "delta delta--worse" : "delta delta--better"}
      role="img"
      aria-label={`${worse ? "Up" : "Down"} ${amount} versus the same quarter last year`}
      title={title}
    >
      {worse ? "▲" : "▼"} {amount}
    </span>
  );
}

/** Quarterly trend line: de-emphasis gray line, current quarter as an accent end-dot. */
function Sparkline({
  points,
  width,
  height,
  ariaLabel,
}: {
  points: QuarterPoint[];
  width: number;
  height: number;
  ariaLabel: string;
}) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padX = 5;
  const padY = 6;
  const stepX = (width - padX * 2) / (points.length - 1);
  const coords = points.map((point, index) => ({
    x: padX + index * stepX,
    y: height - padY - ((point.value - min) / span) * (height - padY * 2),
  }));
  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(" ");
  const end = coords[coords.length - 1];
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <path className="spark__line" d={path} />
      <circle className="spark__dot-ring" cx={end.x} cy={end.y} r={5} />
      <circle className="spark__dot" cx={end.x} cy={end.y} r={3} />
    </svg>
  );
}

function trendLabel(name: string, series: QuarterPoint[]): string {
  if (series.length < 2) return name;
  const first = series[0];
  const last = series[series.length - 1];
  return `${name}: ${first.value} in ${first.label} to ${last.value} in ${last.label}`;
}

function buildModel(stats: StationStats): PanelModel {
  // Chronological quarter axis across everything present in the data.
  const quarterKeys = new Set<string>();
  const totals = new Map<string, number>();
  for (const category of stats.categories) {
    for (const period of category.periods) {
      for (const [year, value] of Object.entries(period.totals)) {
        const key = `${year}|${period.months}`;
        quarterKeys.add(key);
        totals.set(key, (totals.get(key) ?? 0) + value);
      }
    }
  }
  const quarters = Array.from(quarterKeys)
    .map((key) => {
      const [year, months] = key.split("|");
      return { year, months };
    })
    .sort(
      (a, b) =>
        a.year.localeCompare(b.year) ||
        QUARTER_WINDOWS.indexOf(a.months) - QUARTER_WINDOWS.indexOf(b.months),
    );

  const latest =
    parseQuarterLabel(stats.latestQuarter?.label) ?? quarters[quarters.length - 1] ?? null;
  const prevYearKey = latest ? `${Number(latest.year) - 1}|${latest.months}` : null;

  const rows: CategoryRow[] = stats.categories.map((category) => {
    const byKey = new Map<string, number>();
    for (const period of category.periods) {
      for (const [year, value] of Object.entries(period.totals)) {
        byKey.set(`${year}|${period.months}`, value);
      }
    }
    const series: QuarterPoint[] = [];
    for (const { year, months } of quarters) {
      const value = byKey.get(`${year}|${months}`);
      if (value !== undefined) series.push({ label: `${months} ${year}`, value });
    }
    return {
      category: category.category,
      latest: latest ? byKey.get(`${latest.year}|${latest.months}`) ?? null : null,
      prevYear: prevYearKey ? byKey.get(prevYearKey) ?? null : null,
      series,
    };
  });
  rows.sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1) || a.category.localeCompare(b.category));

  const totalSeries: QuarterPoint[] = quarters.map(({ year, months }) => ({
    label: `${months} ${year}`,
    value: totals.get(`${year}|${months}`) ?? 0,
  }));

  return {
    quarterLabel:
      stats.latestQuarter?.label ?? (latest ? `${latest.months} ${latest.year}` : null),
    total:
      stats.latestQuarter?.totalSerious ??
      (latest ? totals.get(`${latest.year}|${latest.months}`) ?? null : null),
    totalPrevYear:
      stats.latestQuarter?.totalSeriousPrevYear ??
      (prevYearKey ? totals.get(prevYearKey) ?? null : null),
    totalSeries,
    rows,
    maxLatest: Math.max(1, ...rows.map((row) => row.latest ?? 0)),
  };
}

function parseQuarterLabel(label: string | undefined): { year: string; months: string } | null {
  if (!label) return null;
  const match = label.match(/^(.+) (\d{4})$/);
  if (!match || !QUARTER_WINDOWS.includes(match[1])) return null;
  return { months: match[1], year: match[2] };
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
