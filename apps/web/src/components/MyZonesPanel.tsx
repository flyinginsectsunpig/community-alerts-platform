"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { CATEGORY_LABELS, timeAgo } from "@/lib/format";
import type { WatchZone, ZoneNotification } from "@/lib/types";

interface MyZonesPanelProps {
  /** null while the list is loading. */
  zones: WatchZone[] | null;
  onClose: () => void;
  onEdit: (zone: WatchZone) => void;
  onDelete: (zone: WatchZone) => void;
  onFocus: (zone: WatchZone) => void;
}

export default function MyZonesPanel({ zones, onClose, onEdit, onDelete, onFocus }: MyZonesPanelProps) {
  const [openZoneId, setOpenZoneId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Record<string, ZoneNotification[]>>({});
  const [notifError, setNotifError] = useState<string | null>(null);

  // Escape closes the panel, unless a modal dialog is stacked above it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".panel-overlay")) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function toggleNotifications(zoneId: string) {
    if (openZoneId === zoneId) {
      setOpenZoneId(null);
      return;
    }
    setOpenZoneId(zoneId);
    setNotifError(null);
    if (!notifications[zoneId]) {
      try {
        const items = await api.fetchZoneNotifications(zoneId);
        setNotifications((current) => ({ ...current, [zoneId]: items }));
      } catch (e) {
        setNotifError(e instanceof ApiError ? e.message : "Could not load notifications");
      }
    }
  }

  return (
    <aside className="zone-panel" aria-label="My watch zones">
      <div className="panel__header">
        <h2>My watch zones</h2>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {zones === null && <p className="panel__hint">Loading…</p>}
      {zones?.length === 0 && (
        <p className="panel__hint">
          No watch zones yet — click the map, then “watch this area” to create one.
        </p>
      )}

      {zones?.map((zone) => (
        <div key={zone.id} className="zone-item">
          <button type="button" className="link-button" onClick={() => onFocus(zone)}>
            {zone.name}
          </button>
          <p className="panel__hint">
            {(zone.radiusM / 1000).toFixed(1)} km ·{" "}
            {zone.categories.length === 0
              ? "All categories"
              : zone.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}
          </p>
          <div className="panel__actions">
            <button type="button" className="btn btn--small" onClick={() => onEdit(zone)}>
              Edit
            </button>
            <button type="button" className="btn btn--small" onClick={() => onDelete(zone)}>
              Delete
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => void toggleNotifications(zone.id)}
            >
              {openZoneId === zone.id ? "Hide notifications" : "Notifications"}
            </button>
          </div>
          {openZoneId === zone.id && (
            <ul className="zone-notifications">
              {notifError && <li className="form-error">{notifError}</li>}
              {!notifError && !notifications[zone.id] && <li>Loading…</li>}
              {notifications[zone.id]?.length === 0 && <li>No notifications yet.</li>}
              {notifications[zone.id]?.map((n) => (
                <li key={n.id}>
                  {n.message} <span className="panel__hint">{timeAgo(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </aside>
  );
}
