"use client";

import { CheckIcon } from "./icons";
import CategoryMark from "./CategoryMark";
import SeverityBadge from "./SeverityBadge";
import { activityLabels, CATEGORY_LABELS, SEVERITY_COLORS, timeAgo } from "@/lib/format";
import { isFiltered, type AlertFilter } from "@/lib/filter";
import type { Alert } from "@/lib/types";

interface AlertFeedProps {
  /** Already filtered — what the user should actually see. */
  alerts: Alert[];
  /** How many there are before filtering, for the "3 of 10" summary. */
  totalCount: number;
  loading: boolean;
  /** The last fetch failed, so what is on screen (or isn't) can't be trusted. */
  loadFailed: boolean;
  onRetry: () => void;
  connected: boolean;
  selectedId: string | null;
  /** Ids that just arrived over the live stream — get the "new" animation. */
  newIds: ReadonlySet<string>;
  /** Id whose map pin is hovered, so the matching row can light up too. */
  linkedId: string | null;
  filter: AlertFilter;
  onClearFilter: () => void;
  onSelect: (alert: Alert) => void;
  onHover: (alertId: string | null) => void;
}

export default function AlertFeed({
  alerts,
  totalCount,
  loading,
  loadFailed,
  onRetry,
  connected,
  selectedId,
  newIds,
  linkedId,
  filter,
  onClearFilter,
  onSelect,
  onHover,
}: AlertFeedProps) {
  const filtered = isFiltered(filter);

  return (
    <section className="feed" aria-label="Live alert feed">
      <div className="feed__header">
        <h2>Live feed</h2>
        {/* Losing the stream is only signalled visually by the dot going
            still, so the state change is announced too. */}
        <span
          className={`live-indicator${connected ? " live-indicator--on" : ""}`}
          role="status"
        >
          <span className="live-indicator__dot" aria-hidden />
          {connected ? "Live" : "Reconnecting"}
          <span className="sr-only">
            {connected ? " — receiving alerts" : " — not receiving alerts"}
          </span>
        </span>
      </div>

      {/* Only shown while something is actually narrowed, so the default view
          carries no extra chrome. */}
      {filtered && (
        <div className="feed__filter-bar">
          <span aria-live="polite">
            Showing {alerts.length} of {totalCount}
          </span>
          <button type="button" className="link-button" onClick={onClearFilter}>
            Clear filters
          </button>
        </div>
      )}

      {/* Older alerts are still worth showing when a refresh fails, as long
          as nobody takes them for the current picture. */}
      {loadFailed && !loading && totalCount > 0 && (
        <div className="feed__stale" role="status">
          <span>Couldn&rsquo;t refresh. These may be out of date.</span>
          <button type="button" className="link-button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div className="feed-skeleton" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton feed-skeleton__item" />
          ))}
        </div>
      ) : loadFailed && totalCount === 0 ? (
        <div className="feed__empty-state" role="alert">
          <p className="feed__empty">Alerts couldn&rsquo;t be loaded.</p>
          <p className="panel__hint">
            This doesn&rsquo;t mean your area is clear. Check your connection and try again.
          </p>
          <button type="button" className="btn btn--small" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : alerts.length === 0 ? (
        filtered ? (
          <div className="feed__empty-state">
            <p className="feed__empty">
              {totalCount === 0
                ? "No alerts in this area yet."
                : `None of the ${totalCount} alerts here match this filter.`}
            </p>
            <button type="button" className="btn btn--small" onClick={onClearFilter}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="feed__empty-state">
            <p className="feed__empty">
              Nothing reported around here yet — which is good news.
            </p>
            <p className="panel__hint">
              Click or tap the map to report something you have seen. Reports show up here
              instantly for everyone nearby.
            </p>
          </div>
        )
      ) : (
        <ul className="feed__list fade-in">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <button
                type="button"
                className={
                  "feed-item" +
                  (alert.id === selectedId ? " feed-item--active" : "") +
                  (alert.id === linkedId ? " feed-item--linked" : "") +
                  (newIds.has(alert.id) ? " feed-item--new" : "")
                }
                // The arrival wash tints itself from the row's own severity.
                style={{ "--sev": SEVERITY_COLORS[alert.severity] } as React.CSSProperties}
                aria-current={alert.id === selectedId || undefined}
                onClick={() => onSelect(alert)}
                onMouseEnter={() => onHover(alert.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(alert.id)}
                onBlur={() => onHover(null)}
              >
                <CategoryMark category={alert.category} severity={alert.severity} />
                <div className="feed-item__body">
                  <div className="feed-item__top">
                    <strong>{CATEGORY_LABELS[alert.category]}</strong>
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <p className="feed-item__description">{alert.description}</p>
                  <div className="feed-item__meta">
                    {alert.status === "VERIFIED" && (
                      <span className="verified-chip">
                        <CheckIcon size={12} /> Verified
                      </span>
                    )}
                    <span>{timeAgo(alert.createdAt)}</span>
                    {activityLabels(alert.confirmationCount, alert.commentCount).map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
