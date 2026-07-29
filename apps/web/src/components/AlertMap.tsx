"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import SeverityBadge from "./SeverityBadge";
import StationLayer from "./StationLayer";
import { categoryDivIcon } from "@/lib/categoryIcons";
import { ageFraction, CATEGORY_LABELS, timeAgo } from "@/lib/format";
import type {
  Alert,
  AlertCategory,
  Hotspot,
  LatLng,
  StationStats,
  WatchZone,
  ZoneDraft,
} from "@/lib/types";

export const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
const DEFAULT_ZOOM = 13;

/** A point the map should fly to, optionally at a specific zoom. */
export type FocusTarget = LatLng & { zoom?: number };

// Hotspots wear violet — deliberately distinct from every severity status
// color so density never impersonates severity.
const HOTSPOT_COLOR = "#a376e9";

// Zone drafts wear the accent: an action of yours in progress, not data.
const ZONE_COLOR = "#24abe8";

// Styled via .zone-handle in globals.css; a DivIcon avoids Leaflet's default
// marker sprite (whose assets don't survive bundling).
const ZONE_HANDLE_ICON = L.divIcon({
  className: "zone-handle",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface AlertMapProps {
  alerts: Alert[];
  hotspots: Hotspot[];
  showHotspots: boolean;
  showStations: boolean;
  onStationZoomGate: (gated: boolean) => void;
  onStationsError: () => void;
  onOpenStationStats: (stats: StationStats) => void;
  pendingPoint: LatLng | null;
  focus: FocusTarget | null;
  zoneDraft: ZoneDraft | null;
  /** Saved zones to display (My Zones panel open); null hides them. */
  zones: WatchZone[] | null;
  /** Ids that just arrived over the live stream — their pins ripple. */
  newIds: ReadonlySet<string>;
  /** Currently open in the detail panel. */
  selectedId: string | null;
  /** Hovered from either end of the feed/map pairing. */
  linkedId: string | null;
  onZoneMove: (center: LatLng) => void;
  onMapClick: (point: LatLng) => void;
  onConfirm: (alertId: string) => void;
  onOpenDetail: (alert: Alert) => void;
  onHover: (alertId: string | null) => void;
}

// Leaflet only watches window resizes; the sidebar collapse resizes the
// container, so tiles must be revalidated by hand.
function MapResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ClickCapture({ onMapClick }: { onMapClick: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function FlyTo({ focus }: { focus: FocusTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) {
      return;
    }
    // A non-finite coordinate must never crash the map (and with it the whole
    // dashboard, since react-leaflet throws from inside render).
    if (!Number.isFinite(focus.lat) || !Number.isFinite(focus.lng)) {
      console.warn("FlyTo ignoring non-finite focus", focus);
      return;
    }
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? Math.max(map.getZoom(), 15), {
      duration: 0.8,
    });
  }, [focus, map]);
  return null;
}

export default function AlertMap({
  alerts,
  hotspots,
  showHotspots,
  showStations,
  onStationZoomGate,
  onStationsError,
  onOpenStationStats,
  pendingPoint,
  focus,
  zoneDraft,
  zones,
  newIds,
  selectedId,
  linkedId,
  onZoneMove,
  onMapClick,
  onConfirm,
  onOpenDetail,
  onHover,
}: AlertMapProps) {
  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      className="alert-map"
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <MapResize />
      <ClickCapture onMapClick={onMapClick} />
      <FlyTo focus={focus} />

      {showStations && (
        <StationLayer
          onZoomGateChange={onStationZoomGate}
          onFetchError={onStationsError}
          onOpenStats={onOpenStationStats}
        />
      )}

      {showHotspots &&
        hotspots.map((hotspot, index) => (
          <Circle
            key={`hotspot-${index}`}
            center={[hotspot.centerLat, hotspot.centerLng]}
            radius={hotspot.radiusM}
            pathOptions={{
              color: HOTSPOT_COLOR,
              weight: 1,
              // Official station baselines wear a dashed ring so they read
              // as background statistics, not live activity.
              dashArray: hotspot.source === "STATIONS" ? "4 6" : undefined,
              fillColor: HOTSPOT_COLOR,
              fillOpacity: 0.1 + 0.25 * hotspot.intensity,
            }}
          >
            <Tooltip sticky>
              {hotspot.source === "STATIONS"
                ? `${hotspot.count} incidents last quarter (SAPS) · mostly ${hotspot.dominantCategory.toLowerCase()}`
                : `${hotspot.count} alerts · mostly ${(
                    CATEGORY_LABELS[hotspot.dominantCategory as AlertCategory] ??
                    hotspot.dominantCategory
                  ).toLowerCase()}`}
            </Tooltip>
          </Circle>
        ))}

      {alerts.map((alert) => (
        <Marker
          key={alert.id}
          position={[alert.lat, alert.lng]}
          icon={categoryDivIcon({
            category: alert.category,
            severity: alert.severity,
            age: ageFraction(alert.createdAt),
            isNew: newIds.has(alert.id),
            isLinked: alert.id === linkedId,
            isSelected: alert.id === selectedId,
          })}
          // Hovering a pin lights up its row in the feed, and vice versa —
          // one piece of state, so the link reads from either end.
          eventHandlers={{
            mouseover: () => onHover(alert.id),
            mouseout: () => onHover(null),
          }}
        >
          <Tooltip>
            {CATEGORY_LABELS[alert.category]} · {timeAgo(alert.createdAt)}
          </Tooltip>
          <Popup>
            <div className="map-popup">
              <div className="map-popup__header">
                <strong>{CATEGORY_LABELS[alert.category]}</strong>
                <SeverityBadge severity={alert.severity} />
              </div>
              <p className="map-popup__description">{alert.description}</p>
              <div className="map-popup__meta">
                {alert.status === "VERIFIED" && <span className="verified-chip">✓ Verified</span>}
                <span>{timeAgo(alert.createdAt)}</span>
                {alert.riskScore !== null && <span>risk {(alert.riskScore * 100).toFixed(0)}%</span>}
                <span>
                  {alert.confirmationCount} confirmation{alert.confirmationCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="map-popup__actions">
                <button type="button" className="btn btn--small" onClick={() => onConfirm(alert.id)}>
                  I saw this too
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => onOpenDetail(alert)}
                >
                  Updates ({alert.commentCount})
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {pendingPoint && (
        <CircleMarker
          center={[pendingPoint.lat, pendingPoint.lng]}
          radius={11}
          // The dashes creep anticlockwise while the report form is open, so
          // the spot you picked stays obviously "in progress".
          className="pending-pin"
          pathOptions={{
            color: "#f6f7f8",
            weight: 2,
            dashArray: "4 4",
            fillColor: "#f6f7f8",
            fillOpacity: 0.15,
          }}
        />
      )}

      {zones?.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.centerLat, zone.centerLng]}
          radius={zone.radiusM}
          pathOptions={{
            color: ZONE_COLOR,
            weight: 2,
            fillColor: ZONE_COLOR,
            fillOpacity: 0.06,
          }}
        >
          <Tooltip sticky>{zone.name}</Tooltip>
        </Circle>
      ))}

      {zoneDraft && (
        <>
          <Circle
            center={[zoneDraft.center.lat, zoneDraft.center.lng]}
            radius={zoneDraft.radiusM}
            pathOptions={{
              color: ZONE_COLOR,
              weight: 2,
              dashArray: "6 6",
              fillColor: ZONE_COLOR,
              fillOpacity: 0.08,
            }}
          />
          <Marker
            position={[zoneDraft.center.lat, zoneDraft.center.lng]}
            icon={ZONE_HANDLE_ICON}
            draggable
            eventHandlers={{
              drag: (event) => onZoneMove((event.target as L.Marker).getLatLng()),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              Drag to move the zone
            </Tooltip>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
