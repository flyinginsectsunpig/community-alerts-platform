"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/auth";
import { CATEGORY_LABELS, timeAgo } from "@/lib/format";
import { disablePush, enablePush, getPushSubscription, pushSupported } from "@/lib/push";
import type { DigestFrequency, WatchZone, ZoneNotification } from "@/lib/types";

type PushState = "unsupported" | "off" | "on" | "busy";

interface MyZonesPanelProps {
  /** null while the list is loading. */
  zones: WatchZone[] | null;
  session: AuthSession | null;
  onClose: () => void;
  onEdit: (zone: WatchZone) => void;
  onDelete: (zone: WatchZone) => void;
  onFocus: (zone: WatchZone) => void;
}

export default function MyZonesPanel({
  zones,
  session,
  onClose,
  onEdit,
  onDelete,
  onFocus,
}: MyZonesPanelProps) {
  const [openZoneId, setOpenZoneId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Record<string, ZoneNotification[]>>({});
  const [notifErrors, setNotifErrors] = useState<Record<string, string>>({});
  const [pushState, setPushState] = useState<PushState>("unsupported");
  const [pushError, setPushError] = useState<string | null>(null);
  // null while loading; the control stays disabled until the profile arrives.
  const [digest, setDigest] = useState<DigestFrequency | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    api
      .fetchProfile()
      .then((profile) => {
        if (!cancelled) setDigest(profile.digestFrequency);
      })
      .catch(() => {
        if (!cancelled) setDigestError("Could not load your digest setting.");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function changeDigest(frequency: DigestFrequency) {
    const previous = digest;
    setDigest(frequency);
    setDigestBusy(true);
    setDigestError(null);
    try {
      await api.updateDigestFrequency(frequency);
    } catch (e) {
      setDigest(previous);
      setDigestError(
        e instanceof ApiError ? e.message : "Could not update the digest setting — try again.",
      );
    } finally {
      setDigestBusy(false);
    }
  }

  useEffect(() => {
    if (!pushSupported()) return;
    let cancelled = false;
    getPushSubscription().then((subscription) => {
      if (!cancelled) setPushState(subscription ? "on" : "off");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePush() {
    const wasOn = pushState === "on";
    setPushState("busy");
    setPushError(null);
    try {
      if (wasOn) {
        await disablePush();
        setPushState("off");
      } else if (await enablePush()) {
        setPushState("on");
      } else {
        setPushState("off");
        setPushError("Notifications are blocked for this site in your browser settings.");
      }
    } catch {
      setPushState(wasOn ? "on" : "off");
      setPushError("Could not update notifications for this device — try again.");
    }
  }

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
    if (!notifications[zoneId]) {
      setNotifErrors((current) => {
        const next = { ...current };
        delete next[zoneId];
        return next;
      });
      try {
        const items = await api.fetchZoneNotifications(zoneId);
        setNotifications((current) => ({ ...current, [zoneId]: items }));
      } catch (e) {
        setNotifErrors((current) => ({
          ...current,
          [zoneId]: e instanceof ApiError ? e.message : "Could not load notifications",
        }));
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

      {pushState !== "unsupported" && (
        <div className="zone-item">
          <p className="panel__hint">
            {pushState === "on"
              ? "This device gets a notification when an alert lands in your zones."
              : "Get a notification on this device when an alert lands in your zones."}
          </p>
          <div className="panel__actions">
            <button
              type="button"
              className="btn btn--small"
              disabled={pushState === "busy"}
              onClick={() => void togglePush()}
            >
              {pushState === "busy"
                ? "Working…"
                : pushState === "on"
                  ? "Disable device notifications"
                  : "Notify this device"}
            </button>
          </div>
          {pushError && <p className="form-error">{pushError}</p>}
        </div>
      )}

      <div className="zone-item">
        {session ? (
          <label className="field">
            <span>Email digest of your zones</span>
            <select
              value={digest ?? "OFF"}
              disabled={digest === null || digestBusy}
              onChange={(event) => void changeDigest(event.target.value as DigestFrequency)}
            >
              <option value="OFF">Off</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </label>
        ) : (
          <p className="panel__hint">Sign in to get email summaries of your zones.</p>
        )}
        {digestError && <p className="form-error">{digestError}</p>}
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
              {notifErrors[zone.id] && <li className="form-error">{notifErrors[zone.id]}</li>}
              {!notifErrors[zone.id] && !notifications[zone.id] && <li>Loading…</li>}
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
