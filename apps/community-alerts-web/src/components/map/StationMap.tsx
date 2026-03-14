'use client';

/**
 * StationMap — SAPS Police Station intelligence layer
 *
 * Renders 1 173 police stations across South Africa as clickable markers.
 * Each marker is sized & coloured by total crime volume for Q3 2025.
 * Clicking a station opens the StationDetailPanel sidebar.
 *
 * At zoom < 7 markers are clustered (simple grid-cell aggregation drawn
 * as a single bubble so the map stays readable nationally).
 * At zoom ≥ 7 every station is drawn individually.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StationCrime {
  category: string;
  count: number;
  prev: number;
}

export interface StationData {
  station: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  total_q3_2025: number;
  total_q3_2024: number;
  change_pct: number;
  severity: number;           // 1-5 derived from relative crime volume
  top_crimes: StationCrime[];
}

// ─── Colour scale ─────────────────────────────────────────────────────────────

/** Returns a hex colour for a normalised value 0-1. */
function crimeColor(t: number): string {
  // green → amber → red
  const stops: [number, string][] = [
    [0.00, '#22c55e'],
    [0.25, '#84cc16'],
    [0.50, '#eab308'],
    [0.75, '#f97316'],
    [1.00, '#ef4444'],
  ];
  const c = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [ta, ca] = stops[i];
    const [tb, cb] = stops[i + 1];
    if (c <= tb) {
      const f = (c - ta) / (tb - ta);
      const parse = (hex: string) => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      const [r1, g1, b1] = parse(ca);
      const [r2, g2, b2] = parse(cb);
      const r = Math.round(r1 + f * (r2 - r1)).toString(16).padStart(2, '0');
      const g = Math.round(g1 + f * (g2 - g1)).toString(16).padStart(2, '0');
      const b = Math.round(b1 + f * (b2 - b1)).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }
  return '#ef4444';
}

// ─── Cluster helper ───────────────────────────────────────────────────────────

interface Cluster {
  lat: number;
  lng: number;
  count: number;
  total: number;
  stations: StationData[];
}

function buildClusters(stations: StationData[], cellDeg: number): Cluster[] {
  const map = new Map<string, Cluster>();
  for (const s of stations) {
    const key = `${Math.floor(s.lat / cellDeg)},${Math.floor(s.lng / cellDeg)}`;
    if (!map.has(key)) {
      map.set(key, { lat: s.lat, lng: s.lng, count: 0, total: 0, stations: [] });
    }
    const c = map.get(key)!;
    c.count++;
    c.total += s.total_q3_2025;
    c.lat = (c.lat * (c.count - 1) + s.lat) / c.count;   // running mean
    c.lng = (c.lng * (c.count - 1) + s.lng) / c.count;
    c.stations.push(s);
  }
  return Array.from(map.values());
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onSelectStation?: (station: StationData | null) => void;
  selectedStation?: StationData | null;
}

const SA_CENTER: [number, number] = [-28.5, 25.5];
const SA_ZOOM = 6;

export default function StationMap({ onSelectStation, selectedStation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const stationsRef = useRef<StationData[]>([]);
  const onSelectRef = useRef(onSelectStation);
  const selectedRef = useRef(selectedStation);

  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(SA_ZOOM);

  useEffect(() => { onSelectRef.current = onSelectStation; }, [onSelectStation]);
  useEffect(() => { selectedRef.current = selectedStation; }, [selectedStation]);

  // ── Load station data ────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/stations_data.json')
      .then((r) => r.json())
      .then((data: StationData[]) => {
        setStations(data);
        stationsRef.current = data;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Render markers ───────────────────────────────────────────────────────

  const renderMarkers = useCallback(
    (L: any, map: any, data: StationData[], currentZoom: number) => {
      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (data.length === 0) return;

      const maxCrimes = Math.max(...data.map((s) => s.total_q3_2025));
      const selStation = selectedRef.current;

      if (currentZoom < 7) {
        // ── Cluster mode ─────────────────────────────────────────────────
        const clusters = buildClusters(data, 2.5);
        const maxClusterTotal = Math.max(...clusters.map((c) => c.total));

        for (const cluster of clusters) {
          const t = cluster.total / maxClusterTotal;
          const color = crimeColor(t);
          const size = 24 + Math.round(t * 38);
          const isSel = selStation
            ? cluster.stations.some((s) => s.station === selStation.station)
            : false;

          const icon = L.divIcon({
            html: `<div style="
              width:${size}px;height:${size}px;
              background:${color}22;
              border:2px solid ${color}88;
              border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              ${isSel ? `box-shadow:0 0 0 3px ${color},0 0 18px ${color}80;` : ''}
              cursor:pointer;
              transition:all 0.15s;
            ">
              <span style="
                font-family:'Space Mono',monospace;
                font-size:${size < 36 ? 9 : 10}px;
                color:${color};
                font-weight:700;
                text-shadow:0 0 6px #000a;
              ">${cluster.count}</span>
            </div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });

          const marker = L.marker([cluster.lat, cluster.lng], { icon })
            .addTo(map)
            .on('click', () => {
              // Pick the highest-crime station in cluster
              const top = cluster.stations.reduce((a, b) =>
                a.total_q3_2025 > b.total_q3_2025 ? a : b,
              );
              onSelectRef.current?.(top);
            });

          const provinceNames = [...new Set(cluster.stations.map((s) => s.province))].join(', ');
          marker.bindTooltip(
            `<div style="font-family:'Space Mono',monospace;font-size:10px;color:#eceef4">
              <div style="color:${color};font-weight:700">${cluster.count} stations</div>
              <div style="color:#8891a8;margin-top:2px">${provinceNames}</div>
              <div style="color:#6b7280;font-size:9px;margin-top:2px">${cluster.total.toLocaleString()} total incidents Q3 2025</div>
            </div>`,
            { sticky: true },
          );
          markersRef.current.push(marker);
        }
      } else {
        // ── Individual station mode ───────────────────────────────────────
        const bounds = map.getBounds();
        const visible = data.filter((s) =>
          bounds.contains([s.lat, s.lng]),
        );

        for (const s of visible) {
          const t = s.total_q3_2025 / maxCrimes;
          const color = crimeColor(t);
          const isSel = selStation?.station === s.station;
          const size = isSel ? 16 : Math.max(7, 5 + Math.round(t * 14));

          const icon = L.divIcon({
            html: `<div style="
              width:${size}px;height:${size}px;
              background:${color};
              border-radius:50%;
              border:${isSel ? `2.5px solid #fff` : `1.5px solid ${color}60`};
              box-shadow:0 0 ${isSel ? 16 : 6}px ${color}${isSel ? 'cc' : '60'};
              cursor:pointer;
              transition:all 0.12s;
            "></div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });

          const direction = s.change_pct > 5 ? '▲' : s.change_pct < -5 ? '▼' : '→';
          const dirColor = s.change_pct > 5 ? '#ef4444' : s.change_pct < -5 ? '#22c55e' : '#eab308';

          const marker = L.marker([s.lat, s.lng], { icon })
            .addTo(map)
            .on('click', () => onSelectRef.current?.(s));

          marker.bindTooltip(
            `<div style="font-family:'Space Mono',monospace;font-size:10px;color:#eceef4;min-width:160px">
              <div style="color:${color};font-size:11px;font-weight:700">🚔 ${s.station}</div>
              <div style="color:#8891a8;margin-top:3px;font-size:9px">${s.district}</div>
              <div style="display:flex;justify-content:space-between;margin-top:5px;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px">
                <span style="color:#eceef4">${s.total_q3_2025.toLocaleString()} incidents</span>
                <span style="color:${dirColor}">${direction} ${Math.abs(s.change_pct)}%</span>
              </div>
            </div>`,
            { sticky: true },
          );
          markersRef.current.push(marker);
        }
      }
    },
    [],
  );

  // ── Map init ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const containerEl = containerRef.current;
    if (!containerEl || mapRef.current) return;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerEl) return;

      const container = containerEl as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) delete container._leaflet_id;

      const map = L.map(container, {
        center: SA_CENTER,
        zoom: SA_ZOOM,
        zoomControl: true,
        minZoom: 5,
        maxZoom: 18,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © Carto',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      LRef.current = L;

      map.on('zoomend', () => {
        const z = map.getZoom();
        setZoom(z);
        renderMarkers(L, map, stationsRef.current, z);
      });
      map.on('moveend', () => {
        const z = map.getZoom();
        if (z >= 7) renderMarkers(L, map, stationsRef.current, z);
      });

      if (stationsRef.current.length > 0) {
        renderMarkers(L, map, stationsRef.current, SA_ZOOM);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      LRef.current = null;
      const c = containerEl as (HTMLDivElement & { _leaflet_id?: number }) | null;
      if (c?._leaflet_id) delete c._leaflet_id;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-render when stations or selection changes ──────────────────────────

  useEffect(() => {
    if (!mapRef.current || !LRef.current || stations.length === 0) return;
    stationsRef.current = stations;
    const z = mapRef.current.getZoom();
    renderMarkers(LRef.current, mapRef.current, stations, z);
  }, [stations, renderMarkers]);

  useEffect(() => {
    if (!mapRef.current || !LRef.current || stations.length === 0) return;
    const z = mapRef.current.getZoom();
    renderMarkers(LRef.current, mapRef.current, stations, z);

    // Pan to selected station
    if (selectedStation && mapRef.current) {
      const targetZoom = Math.max(mapRef.current.getZoom(), 9);
      mapRef.current.flyTo([selectedStation.lat, selectedStation.lng], targetZoom, {
        duration: 0.8,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading indicator */}
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center z-[600] pointer-events-none"
          style={{ background: 'rgba(10,13,20,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            color: '#8891a8',
            letterSpacing: '0.1em',
          }}>
            ⚙ Loading station intelligence…
          </div>
        </div>
      )}

      {/* Legend */}
      {!loading && (
        <div
          className="absolute top-4 right-4 z-[500]"
          style={{
            background: 'rgba(10,13,20,0.88)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '10px 14px',
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            color: '#8891a8',
            backdropFilter: 'blur(10px)',
            minWidth: 160,
          }}
        >
          <div style={{ color: '#eceef4', fontWeight: 700, marginBottom: 8, fontSize: 11 }}>
            🚔 Station Crime Load
          </div>
          {([
            ['#ef4444', 'Critical (10 000+)'],
            ['#f97316', 'High (5 000–10 000)'],
            ['#eab308', 'Moderate (2 000–5 000)'],
            ['#84cc16', 'Low (500–2 000)'],
            ['#22c55e', 'Minimal (<500)'],
          ] as [string, string][]).map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color, flexShrink: 0,
              }} />
              <span>{label}</span>
            </div>
          ))}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: 8, paddingTop: 8,
            color: '#6b7280', fontSize: 9, lineHeight: 1.6,
          }}>
            <div>Q3 2025 · {stations.length.toLocaleString()} stations</div>
            <div style={{ marginTop: 2 }}>
              {zoom < 7 ? 'Clustered — zoom in for detail' : 'Click a station for breakdown'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
