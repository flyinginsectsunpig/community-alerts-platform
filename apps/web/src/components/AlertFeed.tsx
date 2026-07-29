"use client";

import SeverityBadge from "./SeverityBadge";
import { CATEGORY_LABELS, SEVERITY_COLORS, timeAgo } from "@/lib/format";
import type { Alert } from "@/lib/types";

interface AlertFeedProps {
  alerts: Alert[];
  loading: boolean;
  connected: boolean;
  selectedId: string | null;
  /** Ids that just arrived over the live stream — get the "new" animation. */
  newIds: ReadonlySet<string>;
  /** Id whose map pin is hovered, so the matching row can light up too. */
  linkedId: string | null;
  onSelect: (alert: Alert) => void;
  onHover: (alertId: string | null) => void;
}

export default function AlertFeed({
  alerts,
  loading,
  connected,
  selectedId,
  newIds,
  linkedId,
  onSelect,
  onHover,
}: AlertFeedProps) {
  return (
    <section className="feed" aria-label="Live alert feed">
      <div className="feed__header">
        <h2>Live feed</h2>
        <span className={`live-indicator${connected ? " live-indicator--on" : ""}`}>
          <span className="live-indicator__dot" aria-hidden />
          {connected ? "Live" : "Reconnecting"}
        </span>
      </div>

      {loading && alerts.length === 0 ? (
        <div className="feed-skeleton" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton feed-skeleton__item" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <p className="feed__empty">No alerts in this area yet. Click the map to report one.</p>
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
                <div className="feed-item__top">
                  <strong>{CATEGORY_LABELS[alert.category]}</strong>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <p className="feed-item__description">{alert.description}</p>
                <div className="feed-item__meta">
                  {alert.status === "VERIFIED" && <span className="verified-chip">✓ Verified</span>}
                  <span>{timeAgo(alert.createdAt)}</span>
                  <span>
                    {alert.confirmationCount} confirmation{alert.confirmationCount === 1 ? "" : "s"}
                  </span>
                  <span>
                    {alert.commentCount} update{alert.commentCount === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
