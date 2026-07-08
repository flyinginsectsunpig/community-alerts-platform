"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import AlertFeed from "./AlertFeed";
import AlertForm from "./AlertForm";
import StatsPanel from "./StatsPanel";
import WatchZonePanel from "./WatchZonePanel";
import { useLiveAlerts } from "@/hooks/useLiveAlerts";
import { api, ApiError } from "@/lib/api";
import type { Alert, Hotspot, LatLng, LiveEvent, StatsResponse, WatchZone } from "@/lib/types";

// Leaflet touches `window`, so the map only ever renders client-side.
const AlertMap = dynamic(() => import("./AlertMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
const INITIAL_RADIUS_M = 10000;
const REFRESH_INTERVAL_MS = 60_000;
const TOAST_DURATION_MS = 4_000;

type PanelMode = "report" | "zone" | null;

interface Toast {
  kind: "info" | "error";
  message: string;
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [showHotspots, setShowHotspots] = useState(true);
  const [pendingPoint, setPendingPoint] = useState<LatLng | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((kind: Toast["kind"], message: string) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const upsertAlert = useCallback((alert: Alert) => {
    setAlerts((current) => {
      const others = current.filter((a) => a.id !== alert.id);
      return [alert, ...others].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
  }, []);

  const connected = useLiveAlerts(
    useCallback((event: LiveEvent) => upsertAlert(event.alert), [upsertAlert]),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadEverything() {
      const [nearby, spots, summary] = await Promise.allSettled([
        api.fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, INITIAL_RADIUS_M),
        api.fetchHotspots(),
        api.fetchStats(),
      ]);
      if (cancelled) return;
      if (nearby.status === "fulfilled") {
        setAlerts(nearby.value);
      }
      if (spots.status === "fulfilled") {
        setHotspots(spots.value.hotspots);
      }
      if (summary.status === "fulfilled") {
        setStats(summary.value);
      }
      if (nearby.status === "rejected") {
        setToast({ kind: "error", message: "Could not reach the alerts API" });
      }
    }

    void loadEverything();
    const interval = window.setInterval(() => void loadEverything(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleMapClick = useCallback((point: LatLng) => {
    setPendingPoint(point);
    setPanelMode("report");
  }, []);

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setPendingPoint(null);
  }, []);

  function handleAlertCreated(alert: Alert) {
    upsertAlert(alert);
    closePanel();
    showToast("info", "Report submitted — severity scoring in progress");
  }

  function handleZoneCreated(zone: WatchZone) {
    closePanel();
    showToast("info", `Watch zone “${zone.name}” created — notifications will collect there`);
  }

  async function handleConfirm(alertId: string) {
    try {
      upsertAlert(await api.confirmAlert(alertId));
      showToast("info", "Thanks — confirmation recorded");
    } catch (e) {
      showToast("error", e instanceof ApiError ? e.message : "Could not record the confirmation");
    }
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo" aria-hidden>
            ⚠
          </span>
          <h1>Community Alerts</h1>
        </div>
        <label className="hotspot-toggle">
          <input
            type="checkbox"
            checked={showHotspots}
            onChange={(event) => setShowHotspots(event.target.checked)}
          />
          Hotspot layer
        </label>
      </header>

      <div className="dashboard__body">
        <aside className="sidebar">
          <p className="sidebar__hint">Click anywhere on the map to report an alert.</p>
          <StatsPanel stats={stats} />
          <AlertFeed
            alerts={alerts}
            connected={connected}
            onSelect={(alert) => setFocus({ lat: alert.lat, lng: alert.lng })}
          />
        </aside>

        <main className="map-wrap">
          <AlertMap
            alerts={alerts}
            hotspots={hotspots}
            showHotspots={showHotspots}
            pendingPoint={pendingPoint}
            focus={focus}
            onMapClick={handleMapClick}
            onConfirm={handleConfirm}
          />
        </main>
      </div>

      {panelMode === "report" && pendingPoint && (
        <AlertForm
          point={pendingPoint}
          onClose={closePanel}
          onCreated={handleAlertCreated}
          onSwitchToZone={() => setPanelMode("zone")}
        />
      )}
      {panelMode === "zone" && pendingPoint && (
        <WatchZonePanel point={pendingPoint} onClose={closePanel} onCreated={handleZoneCreated} />
      )}

      {toast && <div className={`toast toast--${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}
