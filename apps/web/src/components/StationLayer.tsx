"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";

import { api } from "@/lib/api";
import type { PoliceStation, StationLatestQuarter, StationStats } from "@/lib/types";

export const STATION_MIN_ZOOM = 10;
const FETCH_DEBOUNCE_MS = 300;

// Shield glyph as a DivIcon: no image assets (they don't survive bundling —
// see ZONE_HANDLE_ICON in AlertMap) and no clustering dependency.
const STATION_ICON = L.divIcon({
  className: "station-marker",
  html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"/></svg>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

type StatsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; stats: StationStats };

interface StationLayerProps {
  onZoomGateChange: (gated: boolean) => void;
  onFetchError: () => void;
  onOpenStats: (stats: StationStats) => void;
}

export default function StationLayer({
  onZoomGateChange,
  onFetchError,
  onOpenStats,
}: StationLayerProps) {
  const map = useMap();
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [statsById, setStatsById] = useState<Record<number, StatsState>>({});
  const debounceRef = useRef<number | undefined>(undefined);
  const lastBoundsKeyRef = useRef("");
  // Invalidates in-flight fetch responses: bumped whenever the zoom gate
  // flips, a newer viewport supersedes the pending one, or the layer
  // unmounts, so a late-resolving fetch can't repopulate stale markers.
  const fetchEpochRef = useRef(0);

  const refresh = useCallback(() => {
    const epoch = ++fetchEpochRef.current;
    const gated = map.getZoom() < STATION_MIN_ZOOM;
    onZoomGateChange(gated);
    if (gated) {
      // Cancel any pending fetch scheduled before the zoom-out, or it would
      // fire after the gate closes and repopulate markers on a gated map.
      window.clearTimeout(debounceRef.current);
      setStations([]);
      lastBoundsKeyRef.current = "";
      return;
    }
    const b = map.getBounds();
    const bounds = {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    };
    // Two decimals ≈ 1 km: dedupes tiny pans and aligns with the API cache key.
    const key = [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng]
      .map((v) => v.toFixed(2))
      .join(":");
    if (key === lastBoundsKeyRef.current) return;

    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const result = await api.fetchStations(bounds);
        if (epoch !== fetchEpochRef.current) return;
        lastBoundsKeyRef.current = key;
        setStations(result);
      } catch {
        if (epoch !== fetchEpochRef.current) return;
        onFetchError();
      }
    }, FETCH_DEBOUNCE_MS);
  }, [map, onZoomGateChange, onFetchError]);

  useMapEvents({ moveend: refresh, zoomend: refresh });

  useEffect(() => {
    refresh();
    return () => {
      window.clearTimeout(debounceRef.current);
      fetchEpochRef.current += 1;
    };
  }, [refresh]);

  // Mirror the latest stats state so loadStats can guard the fetch itself —
  // bailing out inside a setState updater can't stop the request below it,
  // so every popup reopen would refire the same fetch.
  const statsByIdRef = useRef(statsById);
  statsByIdRef.current = statsById;

  const loadStats = useCallback((stationId: number) => {
    const existing = statsByIdRef.current[stationId];
    if (existing && existing.status !== "error") return;
    setStatsById((current) => ({ ...current, [stationId]: { status: "loading" } }));
    api
      .fetchStationStats(stationId)
      .then((stats) =>
        setStatsById((current) => ({ ...current, [stationId]: { status: "ready", stats } })),
      )
      .catch(() =>
        setStatsById((current) => ({ ...current, [stationId]: { status: "error" } })),
      );
  }, []);

  return (
    <>
      {stations.map((station) => {
        const state = statsById[station.id];
        return (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={STATION_ICON}
            eventHandlers={{ click: () => loadStats(station.id) }}
          >
            <Popup>
              <div className="map-popup">
                <div className="map-popup__header">
                  <strong>{station.name} SAPS</strong>
                </div>
                <p className="map-popup__description">
                  {station.district} · {station.province}
                </p>
                {state?.status === "ready" && state.stats.latestQuarter ? (
                  <StationHeadline
                    latest={state.stats.latestQuarter}
                    onView={() => onOpenStats(state.stats)}
                  />
                ) : state?.status === "ready" ? (
                  <p className="map-popup__description">No official stats for this station yet.</p>
                ) : state?.status === "error" ? (
                  <p className="map-popup__description">Could not load official stats.</p>
                ) : (
                  <p className="map-popup__description">Loading official stats…</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function trendArrow(current: number, previous: number | null): string {
  if (previous === null || current === previous) return "→";
  return current > previous ? "↑" : "↓";
}

function StationHeadline({
  latest,
  onView,
}: {
  latest: StationLatestQuarter;
  onView: () => void;
}) {
  return (
    <>
      <div className="map-popup__meta">
        <span>
          {latest.label}: {latest.totalSerious} serious crimes{" "}
          {trendArrow(latest.totalSerious, latest.totalSeriousPrevYear)}
        </span>
      </div>
      <ul className="station-popup__categories">
        {latest.topCategories.map((entry) => (
          <li key={entry.category}>
            {entry.category}: {entry.count} {trendArrow(entry.count, entry.prevYearCount)}
          </li>
        ))}
      </ul>
      <div className="map-popup__actions">
        <button type="button" className="btn btn--small" onClick={onView}>
          Full stats
        </button>
      </div>
    </>
  );
}
