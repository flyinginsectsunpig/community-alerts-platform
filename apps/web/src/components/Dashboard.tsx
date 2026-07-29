"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AlertDetailPanel from "./AlertDetailPanel";
import AlertFeed from "./AlertFeed";
import AlertForm from "./AlertForm";
import AuthModal from "./AuthModal";
import LiveAnnouncer, { announcementFor } from "./LiveAnnouncer";
import MapHint from "./MapHint";
import ModalOverlay from "./ModalOverlay";
import MyZonesPanel from "./MyZonesPanel";
import Presence from "./Presence";
import StationStatsPanel from "./StationStatsPanel";
import StatsPanel from "./StatsPanel";
import Toast, { type ToastMessage } from "./Toast";
import WatchZonePanel from "./WatchZonePanel";
import { useBottomSheet } from "@/hooks/useBottomSheet";
import { useLiveAlerts } from "@/hooks/useLiveAlerts";
import { api, ApiError } from "@/lib/api";
import { applyFilter, EMPTY_FILTER, toggle, type AlertFilter } from "@/lib/filter";
import type { FocusTarget } from "./AlertMap";
import { clearSession, getSession, type AuthSession } from "@/lib/auth";
import type {
  Alert,
  AlertCategory,
  AlertComment,
  Hotspot,
  LatLng,
  LiveEvent,
  Severity,
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
// Long enough for the map pin's three ripples and the feed row's colour wash
// to finish; both durations live in globals.css.
const LIVE_HIGHLIGHT_MS = 6_000;
const HINT_KEY = "communityalerts.hintDismissed";

type PanelMode = "report" | null;

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
  const [zones, setZones] = useState<WatchZone[] | null>(null);
  const [showZonesPanel, setShowZonesPanel] = useState(false);
  const [editingZone, setEditingZone] = useState<WatchZone | null>(null);
  const [claimOffer, setClaimOffer] = useState<WatchZone[] | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [detailAlertId, setDetailAlertId] = useState<string | null>(null);
  const [liveComment, setLiveComment] = useState<AlertComment | null>(null);
  // Ids that arrived over the live stream; drives the feed row's wash and the
  // map pin's arrival ripple.
  const [liveIds, setLiveIds] = useState<ReadonlySet<string>>(new Set());
  // Hovered from either the feed or the map — the two surfaces share it, so
  // the pairing is visible from whichever end you started at.
  const [linkedId, setLinkedId] = useState<string | null>(null);
  // What a screen reader hears when an alert lands. CRITICAL goes to the
  // assertive region so it interrupts; everything else waits its turn.
  const [announcement, setAnnouncement] = useState<{ text: string; urgent: boolean } | null>(null);
  const [filter, setFilter] = useState<AlertFilter>(EMPTY_FILTER);

  const sheet = useBottomSheet();
  const searchRef = useRef<HTMLInputElement>(null);

  // The feed and the map must always agree about what is on screen, so both
  // read from the same filtered list.
  const visibleAlerts = useMemo(() => applyFilter(alerts, filter), [alerts, filter]);

  const toggleCategory = useCallback((category: AlertCategory) => {
    setFilter((current) => ({ ...current, categories: toggle(current.categories, category) }));
  }, []);

  const toggleSeverity = useCallback((severity: Severity) => {
    setFilter((current) => ({ ...current, severities: toggle(current.severities, severity) }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setFilter((current) => ({ ...current, query }));
  }, []);

  const clearFilter = useCallback(() => setFilter(EMPTY_FILTER), []);

  const announce = useCallback((alert: Alert) => {
    setAnnouncement({
      text: announcementFor(alert),
      urgent: alert.severity === "CRITICAL",
    });
    // Cleared so that two identical alerts in a row still read as two events —
    // a live region only speaks when its text actually changes.
    window.setTimeout(() => setAnnouncement(null), LIVE_HIGHLIGHT_MS);
  }, []);

  const markLive = useCallback((alertId: string) => {
    setLiveIds((ids) => new Set(ids).add(alertId));
    window.setTimeout(() => {
      setLiveIds((ids) => {
        const next = new Set(ids);
        next.delete(alertId);
        return next;
      });
    }, LIVE_HIGHLIGHT_MS);
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

  // One timer, restarted per toast. Without the reset a toast raised shortly
  // after another was cleared by the *first* one's timer, cutting it short.
  const toastTimer = useRef<number>();

  const showToast = useCallback((kind: ToastMessage["kind"], message: string) => {
    setToast({ kind, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

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
      // Closed alerts leave the map and feed immediately.
      if (alert.status === "RESOLVED" || alert.status === "EXPIRED") {
        return others;
      }
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
          announce(event.alert);
        }
      },
      [upsertAlert, markLive, announce],
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
        // Via showToast, so this one is on the dismiss timer like every other
        // toast — set directly it used to sit on screen indefinitely.
        showToast("error", "Could not reach the alerts API");
      }
    }

    void loadEverything();
    const interval = window.setInterval(() => void loadEverything(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [center, showToast]);

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
      if (!session) {
        // Pings are visible to everyone, so reporting needs an account.
        showToast("info", "Sign in to report an alert");
        setShowAuthModal(true);
        return;
      }
      setPendingPoint(point);
      setPanelMode("report");
    },
    [dismissHint, zoneActive, session, showToast],
  );

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setPendingPoint(null);
  }, []);

  const closeZone = useCallback(() => {
    setZoneDraft(null);
    setEditingZone(null);
  }, []);

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

  const loadZones = useCallback(async () => {
    try {
      setZones(await api.fetchWatchZones());
    } catch {
      setZones([]);
      showToast("error", "Could not load your watch zones");
    }
  }, [showToast]);

  function openZonesPanel() {
    setShowZonesPanel(true);
    setZones(null);
    void loadZones();
  }

  function handleZoneCreated(zone: WatchZone) {
    closeZone();
    setZones((current) => (current ? [zone, ...current] : current));
    showToast("info", `Watch zone “${zone.name}” created — manage it under “My zones”`);
  }

  function handleZoneUpdated(zone: WatchZone) {
    closeZone();
    setZones((current) =>
      current ? current.map((z) => (z.id === zone.id ? zone : z)) : current,
    );
    showToast("info", `Watch zone “${zone.name}” updated`);
  }

  function startEditZone(zone: WatchZone) {
    setShowZonesPanel(false);
    setEditingZone(zone);
    setZoneDraft({ center: { lat: zone.centerLat, lng: zone.centerLng }, radiusM: zone.radiusM });
    setFocus({ lat: zone.centerLat, lng: zone.centerLng });
  }

  async function handleDeleteZone(zone: WatchZone) {
    if (!window.confirm(`Delete watch zone “${zone.name}”? Its notification history goes with it.`)) {
      return;
    }
    setZones((current) => (current ? current.filter((z) => z.id !== zone.id) : current));
    try {
      await api.deleteWatchZone(zone.id);
      showToast("info", `Watch zone “${zone.name}” deleted`);
    } catch (e) {
      // Resync from the server rather than restoring a possibly stale snapshot.
      void loadZones();
      showToast("error", e instanceof ApiError ? e.message : "Could not delete the watch zone");
    }
  }

  function focusZone(zone: WatchZone) {
    // Rough zoom-to-fit: each zoom step halves the visible span. 10 km
    // radius ≈ zoom 11, 1 km ≈ zoom 14, 100 m ≈ zoom 17.
    const zoom = Math.round(Math.max(11, Math.min(17, 14 - Math.log2(zone.radiusM / 1000))));
    setFocus({ lat: zone.centerLat, lng: zone.centerLng, zoom });
  }

  async function offerClaim() {
    try {
      const claimable = await api.fetchClaimableZones();
      if (claimable.length > 0) setClaimOffer(claimable);
    } catch {
      // Claiming is a bonus flow — stay quiet if it can't be checked.
    }
  }

  async function handleClaim() {
    try {
      const adopted = await api.claimWatchZones();
      setClaimOffer(null);
      showToast(
        "info",
        `Added ${adopted.length} watch zone${adopted.length === 1 ? "" : "s"} to your account`,
      );
      if (zones !== null) void loadZones();
    } catch (e) {
      setClaimOffer(null);
      showToast("error", e instanceof ApiError ? e.message : "Could not claim your watch zones");
    }
  }

  async function handleConfirm(alertId: string) {
    if (!session) {
      showToast("info", "Sign in to confirm alerts");
      setShowAuthModal(true);
      return;
    }
    try {
      upsertAlert(await api.confirmAlert(alertId));
      showToast("info", "Thanks — confirmation recorded");
    } catch (e) {
      showToast("error", e instanceof ApiError ? e.message : "Could not record the confirmation");
    }
  }

  async function handleResolve(alertId: string) {
    try {
      upsertAlert(await api.resolveAlert(alertId));
      setDetailAlertId(null);
      showToast("info", "Alert marked as resolved");
    } catch (e) {
      showToast("error", e instanceof ApiError ? e.message : "Could not resolve the alert");
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

  // Deliberately resolved against the unfiltered list: narrowing the feed
  // should not slam shut a detail panel the user is reading.
  const detailAlert = detailAlertId
    ? alerts.find((alert) => alert.id === detailAlertId) ?? null
    : null;

  return (
    <div className={`dashboard${sidebarOpen ? "" : " dashboard--rail-closed"}`}>
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
        {/* Map controls and account are separate groups so that on a phone the
            account can sit beside the brand and the controls drop to their own
            row, instead of everything wrapping into three. */}
        <div className="topbar__controls">
          {/* The two layer toggles are one decision, so they read as one
              segmented control rather than two loose labels. */}
          <div className="layer-switches">
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
          </div>
          <button type="button" className="btn btn--small" onClick={openZonesPanel}>
            My zones
          </button>
        </div>

        <div className="topbar__account">
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
        <aside
          id="sidebar"
          className={`sidebar${sheet.dragging ? " sidebar--dragging" : ""}`}
          ref={sheet.sheetRef}
        >
          {/* Phones only: the rail becomes a sheet the user drags between
              peek, half and full. Hidden on desktop via CSS. */}
          <button
            type="button"
            className="sheet-handle"
            aria-label={`Alerts panel, ${sheet.snap}. Drag or press to resize.`}
            aria-expanded={sheet.snap !== "peek"}
            aria-controls="sidebar-inner"
            onClick={sheet.cycle}
            {...sheet.handlers}
          />
          <div className="sidebar__inner" id="sidebar-inner">
            <StatsPanel
              stats={stats}
              loading={!statsLoaded}
              filter={filter}
              onToggleCategory={toggleCategory}
              onToggleSeverity={toggleSeverity}
            />
            <AlertFeed
              alerts={visibleAlerts}
              totalCount={alerts.length}
              loading={!alertsLoaded}
              connected={connected}
              selectedId={detailAlertId}
              newIds={liveIds}
              linkedId={linkedId}
              filter={filter}
              searchRef={searchRef}
              onQueryChange={setQuery}
              onClearFilter={clearFilter}
              onSelect={openDetail}
              onHover={setLinkedId}
            />
          </div>
        </aside>

        {/* A panel docked over the right of the map shifts the hints left so
            they stay centred on what's still visible of it. */}
        <main
          className={`map-wrap${
            detailAlert || stationStats ? " map-wrap--docked-right" : ""
          }`}
        >
          <AlertMap
            alerts={visibleAlerts}
            hotspots={hotspots}
            showHotspots={showHotspots}
            showStations={showStations}
            onStationZoomGate={setStationsGated}
            onStationsError={handleStationsError}
            onOpenStationStats={openStationStats}
            pendingPoint={pendingPoint}
            focus={focus}
            zoneDraft={zoneDraft}
            zones={showZonesPanel && !zoneDraft ? zones : null}
            newIds={liveIds}
            selectedId={detailAlertId}
            linkedId={linkedId}
            onZoneMove={handleZoneMove}
            onMapClick={handleMapClick}
            onConfirm={handleConfirm}
            onOpenDetail={openDetail}
            onHover={setLinkedId}
          />
          {/* Each panel stays mounted for the length of its exit animation,
              so closing one is as deliberate as opening it. */}
          <Presence when={zoneDraft !== null}>
            {zoneDraft && (
              <WatchZonePanel
                draft={zoneDraft}
                editing={editingZone}
                session={session}
                onRadiusChange={handleZoneRadius}
                onClose={closeZone}
                onCreated={handleZoneCreated}
                onUpdated={handleZoneUpdated}
              />
            )}
          </Presence>
          <Presence when={showZonesPanel && !zoneDraft}>
            <MyZonesPanel
              zones={zones}
              session={session}
              onClose={() => setShowZonesPanel(false)}
              onEdit={startEditZone}
              onDelete={(zone) => void handleDeleteZone(zone)}
              onFocus={focusZone}
            />
          </Presence>
          <div className="map-hints">
            <Presence when={showHint}>
              <MapHint onDismiss={dismissHint}>
                Click anywhere on the map to report an alert.
              </MapHint>
            </Presence>
            <Presence when={showStations && stationsGated}>
              <MapHint>Zoom in to see police stations.</MapHint>
            </Presence>
          </div>
          <Presence when={stationStats !== null}>
            {stationStats && (
              <StationStatsPanel stats={stationStats} onClose={() => setStationStats(null)} />
            )}
          </Presence>
          <Presence when={detailAlert !== null}>
            {detailAlert && (
              <AlertDetailPanel
                alert={detailAlert}
                session={session}
                liveComment={liveComment}
                onClose={() => setDetailAlertId(null)}
                onConfirm={handleConfirm}
                onResolve={(alertId) => void handleResolve(alertId)}
                onRequestAuth={() => setShowAuthModal(true)}
              />
            )}
          </Presence>
        </main>
      </div>

      <Presence when={panelMode === "report" && pendingPoint !== null}>
        {pendingPoint && (
          <AlertForm
            point={pendingPoint}
            onClose={closePanel}
            onCreated={handleAlertCreated}
            onSwitchToZone={handleSwitchToZone}
          />
        )}
      </Presence>

      <Presence when={showAuthModal}>
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthed={(authed) => {
            setSession(authed);
            setShowAuthModal(false);
            showToast("info", `Welcome, ${authed.displayName}`);
            void offerClaim();
          }}
        />
      </Presence>

      <Presence when={claimOffer !== null}>
        {claimOffer && (
          <ModalOverlay
            label="Add your watch zones to this account"
            onClose={() => setClaimOffer(null)}
          >
            <div className="panel">
              <div className="panel__header">
                <h2>Watch zones on this device</h2>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setClaimOffer(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className="panel__hint">
                You have {claimOffer.length} watch zone{claimOffer.length === 1 ? "" : "s"} created
                on this device. Add {claimOffer.length === 1 ? "it" : "them"} to your account so you
                can manage {claimOffer.length === 1 ? "it" : "them"} from anywhere?
              </p>
              <div className="panel__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void handleClaim()}
                >
                  Add to my account
                </button>
                <button type="button" className="btn" onClick={() => setClaimOffer(null)}>
                  Not now
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </Presence>

      <Presence when={toast !== null}>{toast && <Toast toast={toast} />}</Presence>

      <LiveAnnouncer
        polite={announcement && !announcement.urgent ? announcement.text : null}
        assertive={announcement?.urgent ? announcement.text : null}
      />
    </div>
  );
}
