"use client";

import { useEffect, useState } from "react";

import { OPEN_MODAL, useExiting } from "./Presence";
import { useFocusCapture } from "@/hooks/useFocusCapture";
import { api, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/auth";
import { CATEGORY_LABELS, timeAgo } from "@/lib/format";
import {
  disablePush,
  enablePush,
  getPushSubscription,
  needsInstallForPush,
  pushSupported,
} from "@/lib/push";
import type { DigestFrequency, WatchZone, ZoneNotification } from "@/lib/types";

type PushState = "unsupported" | "needs-install" | "off" | "on" | "busy";

interface MyZonesPanelProps {
  /** null while the list is loading. */
  zones: WatchZone[] | null;
  session: AuthSession | null;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (zone: WatchZone) => void;
  onDelete: (zone: WatchZone) => void;
  onFocus: (zone: WatchZone) => void;
}

export default function MyZonesPanel({
  zones,
  session,
  onClose,
  onCreate,
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
  const exiting = useExiting();
  const panelRef = useFocusCapture<HTMLElement>({ active: !exiting, trap: false });

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
    if (!pushSupported()) {
      if (needsInstallForPush()) setPushState("needs-install");
      return;
    }
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
    if (exiting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(OPEN_MODAL)) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, exiting]);

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
    <aside
      ref={panelRef}
      className={`zone-panel${exiting ? " zone-panel--exiting" : ""}`}
      aria-label="My watch zones"
      data-autofocus
      tabIndex={-1}
    >
      <div className="panel__header">
        <h2>My watch zones</h2>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {/* The zones are why the panel was opened, so they come first and the
          notification settings sit below them — previously both wore the same
          treatment and the settings pushed the list off the top. */}
      {zones === null ? (
        <div className="zone-skeleton" aria-hidden>
          <div className="skeleton zone-skeleton__item" />
          <div className="skeleton zone-skeleton__item" />
        </div>
      ) : zones.length === 0 ? (
        <div className="zone-empty">
          <p className="zone-empty__lead">You are not watching anywhere yet.</p>
          <p className="panel__hint">
            A watch zone is a circle on the map. When an alert lands inside one, you hear about
            it — on this device, by email, or both. Most people draw one around home.
          </p>
          <button type="button" className="btn btn--primary btn--small" onClick={onCreate}>
            Draw a zone here
          </button>
        </div>
      ) : (
        <ul className="zone-list">
          {zones.map((zone) => (
            <li key={zone.id} className="zone-card">
              <div className="zone-card__head">
                <button type="button" className="zone-card__name" onClick={() => onFocus(zone)}>
                  {zone.name}
                </button>
                <span className="zone-card__radius">{(zone.radiusM / 1000).toFixed(1)} km</span>
              </div>
              <p className="zone-card__categories">
                {zone.categories.length === 0
                  ? "All categories"
                  : zone.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}
              </p>
              <div className="zone-card__actions">
                <button type="button" className="btn btn--small" onClick={() => onEdit(zone)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => void toggleNotifications(zone.id)}
                  aria-expanded={openZoneId === zone.id}
                >
                  {openZoneId === zone.id ? "Hide activity" : "Activity"}
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--danger"
                  onClick={() => onDelete(zone)}
                >
                  Delete
                </button>
              </div>
              {openZoneId === zone.id && (
                <ul className="zone-notifications">
                  {notifErrors[zone.id] && <li className="form-error">{notifErrors[zone.id]}</li>}
                  {!notifErrors[zone.id] && !notifications[zone.id] && <li>Loading…</li>}
                  {notifications[zone.id]?.length === 0 && (
                    <li className="zone-notifications__empty">
                      Nothing has happened in this zone yet.
                    </li>
                  )}
                  {notifications[zone.id]?.map((n) => (
                    <li key={n.id}>
                      {n.message} <span className="panel__hint">{timeAgo(n.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {zones !== null && zones.length > 0 && (
        <button type="button" className="btn btn--small" onClick={onCreate}>
          Add another zone
        </button>
      )}

      <div className="zone-settings">
        <h3 className="zone-settings__title">How you hear about it</h3>

        {pushState === "needs-install" && (
          <p className="panel__hint">
            To get alerts on this device, add Community Alerts to your home screen — tap Share,
            then “Add to Home Screen”, and open it from there. iOS only allows notifications for
            installed apps.
          </p>
        )}

        {pushState !== "unsupported" && pushState !== "needs-install" && (
          <div className="zone-setting">
            <p className="panel__hint">
              {pushState === "on"
                ? "This device gets a notification when an alert lands in your zones."
                : "Get a notification on this device when an alert lands in your zones."}
            </p>
            <button
              type="button"
              className="btn btn--small"
              disabled={pushState === "busy"}
              onClick={() => void togglePush()}
            >
              {pushState === "busy"
                ? "Working…"
                : pushState === "on"
                  ? "Turn off on this device"
                  : "Notify this device"}
            </button>
            {pushError && <p className="form-error">{pushError}</p>}
          </div>
        )}

        <div className="zone-setting">
          {session ? (
            <label className="field">
              <span>Email digest</span>
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
      </div>
    </aside>
  );
}
