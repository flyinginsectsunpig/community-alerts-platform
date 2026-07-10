"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import AlertDetailPanel from "./AlertDetailPanel";
import AlertFeed from "./AlertFeed";
import AlertForm from "./AlertForm";
import AuthModal from "./AuthModal";
import StationStatsPanel from "./StationStatsPanel";
import StatsPanel from "./StatsPanel";
import WatchZonePanel from "./WatchZonePanel";
import { useLiveAlerts } from "@/hooks/useLiveAlerts";
import { api, ApiError } from "@/lib/api";
import type { FocusTarget } from "./AlertMap";
import { clearSession, getSession, type AuthSession } from "@/lib/auth";
import type {
  Alert,
  AlertComment,
  Hotspot,
  LatLng,
  LiveEvent,
  StationStats,
  StatsResponse,
  WatchZone,
  ZoneDraft,
} from "@/lib/types";

// Leaflet touches `window`, so the map only ever renders client-side.
const AlertMap = dynamic(() => import("./AlertMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
const INITIAL_RADIUS_M = 10000;
const REFRESH_INTERVAL_MS = 60_000;
const TOAST_DURATION_MS = 4_000;
const HINT_KEY = "communityalerts.hintDismissed";

type PanelMode = "report" | null;

interface Toast {
  kind: "info" | "error";
  message: string;
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showStations, setShowStations] = useState(false);
  const [stationsGated, setStationsGated] = useState(false);
  const [stationStats, setStationStats] = useState<StationStats | null>(null);
  const [pendingPoint, setPendingPoint] = useState<LatLng | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [detailAlertId, setDetailAlertId] = useState<string | null>(null);
  const [liveComment, setLiveComment] = useState<AlertComment | null>(null);
  // Ids that arrived over the live stream; drives the feed's "new" animation.
  const [liveIds, setLiveIds] = useState<ReadonlySet<string>>(new Set());

  const markLive = useCallback((alertId: string) => {
    setLiveIds((ids) => new Set(ids).add(alertId));
    window.setTimeout(() => {
      setLiveIds((ids) => {
        const next = new Set(ids);
        next.delete(alertId);
        return next;
      });
    }, 2000);
  }, []);

  // Session comes from localStorage, so it must be read client-side only.
  useEffect(() => {
    setSession(getSession());
  }, []);

  // The teaching hint shows until dismissed once — then never again.
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setShowHint(window.localStorage.getItem(HINT_KEY) !== "1");
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    window.localStorage.setItem(HINT_KEY, "1");
  }, []);

  const showToast = useCallback((kind: Toast["kind"], message: string) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  // Open on the user's neighbourhood when they allow it; stay on the default
  // city otherwise. Alert fetches recenter along with the map.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const located = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCenter(located);
        setFocus({ ...located, zoom: 16 });
      },
      () => showToast("info", "Showing central London — location unavailable"),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [showToast]);

  const upsertAlert = useCallback((alert: Alert) => {
    setAlerts((current) => {
      const others = current.filter((a) => a.id !== alert.id);
      return [alert, ...others].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
  }, []);

  const connected = useLiveAlerts(
    useCallback(
      (event: LiveEvent) => {
        if (event.type === "comment.created") {
          setAlerts((current) =>
            current.map((alert) =>
              alert.id === event.alertId
                ? { ...alert, commentCount: event.commentCount }
                : alert,
            ),
          );
          setLiveComment(event.comment);
        } else {
          upsertAlert(event.alert);
          markLive(event.alert.id);
        }
      },
      [upsertAlert, markLive],
    ),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadEverything() {
      const [nearby, spots, summary] = await Promise.allSettled([
        api.fetchNearby(center.lat, center.lng, INITIAL_RADIUS_M),
        api.fetchHotspots(),
        api.fetchStats(),
      ]);
      if (cancelled) return;
      if (nearby.status === "fulfilled") {
        setAlerts(nearby.value);
      }
      setAlertsLoaded(true);
      if (spots.status === "fulfilled") {
        setHotspots(spots.value.hotspots);
      }
      if (summary.status === "fulfilled") {
        setStats(summary.value);
      }
      setStatsLoaded(true);
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
  }, [center]);

  const zoneActive = zoneDraft !== null;

  const handleMapClick = useCallback(
    (point: LatLng) => {
      dismissHint(); // the hint has done its job
      if (zoneActive) {
        // While shaping a zone, map clicks reposition it instead of
        // opening the report form.
        setZoneDraft((draft) => (draft ? { ...draft, center: point } : draft));
        return;
      }
      setPendingPoint(point);
      setPanelMode("report");
    },
    [dismissHint, zoneActive],
  );

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setPendingPoint(null);
  }, []);

  const closeZone = useCallback(() => setZoneDraft(null), []);

  const handleZoneRadius = useCallback((radiusM: number) => {
    setZoneDraft((draft) => (draft ? { ...draft, radiusM } : draft));
  }, []);

  const handleZoneMove = useCallback((center: LatLng) => {
    setZoneDraft((draft) => (draft ? { ...draft, center } : draft));
  }, []);

  function handleSwitchToZone() {
    if (!pendingPoint) return;
    setZoneDraft({ center: pendingPoint, radiusM: 1000 });
    closePanel();
  }

  function handleAlertCreated(alert: Alert) {
    upsertAlert(alert);
    closePanel();
    showToast("info", "Report submitted — severity scoring in progress");
  }

  function handleZoneCreated(zone: WatchZone) {
    closeZone();
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

  function handleSignOut() {
    clearSession();
    setSession(null);
    showToast("info", "Signed out");
  }

  const openDetail = useCallback((alert: Alert) => {
    setStationStats(null);
    setDetailAlertId(alert.id);
    setFocus({ lat: alert.lat, lng: alert.lng });
  }, []);

  const handleStationsError = useCallback(
    () => showToast("error", "Could not load police stations"),
    [showToast],
  );

  const openStationStats = useCallback((stats: StationStats) => {
    setDetailAlertId(null);
    setStationStats(stats);
  }, []);

  const detailAlert = detailAlertId
    ? alerts.find((alert) => alert.id === detailAlertId) ?? null
    : null;

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar__brand">
          <button
            type="button"
            className="btn-icon panel-toggle"
            aria-expanded={sidebarOpen}
            aria-controls="sidebar"
            aria-label={sidebarOpen ? "Hide panel" : "Show panel"}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" />
              <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" />
            </svg>
          </button>
          <span className="topbar__logo" aria-hidden>
            ⚠
          </span>
          <h1>Community Alerts</h1>
        </div>
        <div className="topbar__controls">
          <label className="hotspot-toggle">
            <input
              type="checkbox"
              className="switch__input"
              checked={showHotspots}
              onChange={(event) => setShowHotspots(event.target.checked)}
            />
            <span className="switch" aria-hidden />
            Hotspots
          </label>
          <label className="hotspot-toggle">
            <input
              type="checkbox"
              className="switch__input"
              checked={showStations}
              onChange={(event) => setShowStations(event.target.checked)}
            />
            <span className="switch" aria-hidden />
            Stations
          </label>
          {session ? (
            <div className="user-chip">
              <span className="user-chip__name">{session.displayName}</span>
              <button type="button" className="link-button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--small" onClick={() => setShowAuthModal(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <div className="dashboard__body">
        <aside id="sidebar" className={`sidebar${sidebarOpen ? "" : " sidebar--closed"}`}>
          <StatsPanel stats={stats} loading={!statsLoaded} />
          <AlertFeed
            alerts={alerts}
            loading={!alertsLoaded}
            connected={connected}
            selectedId={detailAlertId}
            newIds={liveIds}
            onSelect={openDetail}
          />
        </aside>

        <main className="map-wrap">
          <AlertMap
            alerts={alerts}
            hotspots={hotspots}
            showHotspots={showHotspots}
            showStations={showStations}
            onStationZoomGate={setStationsGated}
            onStationsError={handleStationsError}
            onOpenStationStats={openStationStats}
            pendingPoint={pendingPoint}
            focus={focus}
            zoneDraft={zoneDraft}
            onZoneMove={handleZoneMove}
            onMapClick={handleMapClick}
            onConfirm={handleConfirm}
            onOpenDetail={openDetail}
          />
          {zoneDraft && (
            <WatchZonePanel
              draft={zoneDraft}
              onRadiusChange={handleZoneRadius}
              onClose={closeZone}
              onCreated={handleZoneCreated}
            />
          )}
          {showHint && (
            <div className="map-hint" role="note">
              Click anywhere on the map to report an alert.
              <button
                type="button"
                className="btn-icon"
                onClick={dismissHint}
                aria-label="Dismiss hint"
              >
                ×
              </button>
            </div>
          )}
          {showStations && stationsGated && (
            <div className="map-hint" role="note">
              Zoom in to see police stations.
            </div>
          )}
          {stationStats && (
            <StationStatsPanel stats={stationStats} onClose={() => setStationStats(null)} />
          )}
          {detailAlert && (
            <AlertDetailPanel
              alert={detailAlert}
              session={session}
              liveComment={liveComment}
              onClose={() => setDetailAlertId(null)}
              onConfirm={handleConfirm}
              onRequestAuth={() => setShowAuthModal(true)}
            />
          )}
        </main>
      </div>

      {panelMode === "report" && pendingPoint && (
        <AlertForm
          point={pendingPoint}
          onClose={closePanel}
          onCreated={handleAlertCreated}
          onSwitchToZone={handleSwitchToZone}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthed={(authed) => {
            setSession(authed);
            setShowAuthModal(false);
            showToast("info", `Welcome, ${authed.displayName}`);
          }}
        />
      )}

      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
