// ─── KDE Heatmap + zoom-based individual markers ─────────────────────────────
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Incident } from '@/lib/types';
import { TYPE_CONFIG, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Cape Town bounding box for the heatmap image overlay */
const CT_BOUNDS: [[number, number], [number, number]] = [
  [-34.45, 18.20],
  [-33.35, 19.10],
];

/**
 * Zoom threshold.
 * Below  → KDE haze covering all of Cape Town (green → red)
 * At/above → individual incident markers pop into view
 */
const DETAIL_ZOOM = 13;

/** KDE grid resolution */
const GRID_W = 280;
const GRID_H = 200;

/** Gaussian kernel bandwidth in degrees (~7 km spread) */
const BANDWIDTH = 0.07;

// ─── KDE Computation ──────────────────────────────────────────────────────────

function buildDensityGrid(incidents: Incident[]): Float32Array {
  const [sw, ne] = CT_BOUNDS;
  const minLat = sw[0], maxLat = ne[0];
  const minLng = sw[1], maxLng = ne[1];

  const grid = new Float32Array(GRID_W * GRID_H);

  const sigmaX = (BANDWIDTH / (maxLng - minLng)) * GRID_W;
  const sigmaY = (BANDWIDTH / (maxLat - minLat)) * GRID_H;
  const rangeX = Math.ceil(sigmaX * 3);
  const rangeY = Math.ceil(sigmaY * 3);

  for (const inc of incidents) {
    const gx = ((inc.lng - minLng) / (maxLng - minLng)) * GRID_W;
    const gy = (1 - (inc.lat - minLat) / (maxLat - minLat)) * GRID_H;
    const weight = inc.severity;

    const x0 = Math.round(gx);
    const y0 = Math.round(gy);

    for (let dy = -rangeY; dy <= rangeY; dy++) {
      for (let dx = -rangeX; dx <= rangeX; dx++) {
        const cx = x0 + dx;
        const cy = y0 + dy;
        if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) continue;
        const kx = (dx * dx) / (2 * sigmaX * sigmaX);
        const ky = (dy * dy) / (2 * sigmaY * sigmaY);
        grid[cy * GRID_W + cx] += Math.exp(-(kx + ky)) * weight;
      }
    }
  }

  return grid;
}

// ─── Canvas Rendering ─────────────────────────────────────────────────────────

const COLOR_STOPS = [
  { t: 0.00, r: 34,  g: 197, b: 94,  a: 0   },
  { t: 0.08, r: 34,  g: 197, b: 94,  a: 35  },
  { t: 0.28, r: 132, g: 204, b: 22,  a: 80  },
  { t: 0.50, r: 234, g: 179, b: 8,   a: 120 },
  { t: 0.72, r: 249, g: 115, b: 22,  a: 160 },
  { t: 1.00, r: 239, g: 68,  b: 68,  a: 210 },
];

function lerpColor(t: number) {
  const c = Math.max(0, Math.min(1, t));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i], b = COLOR_STOPS[i + 1];
    if (c <= b.t) {
      const f = (c - a.t) / (b.t - a.t);
      return {
        r: Math.round(a.r + f * (b.r - a.r)),
        g: Math.round(a.g + f * (b.g - a.g)),
        b: Math.round(a.b + f * (b.b - a.b)),
        a: Math.round(a.a + f * (b.a - a.a)),
      };
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1];
}

function buildHeatmapDataURL(incidents: Incident[]): string {
  const grid = buildDensityGrid(incidents);

  // 98th-percentile cap prevents a single hot-spot from washing out the gradient
  const nonZero = Array.from(grid).filter((v) => v > 0).sort((a, b) => a - b);
  const p98    = nonZero[Math.floor(nonZero.length * 0.98)] ?? 1;
  const maxVal = Math.max(p98, 0.001);

  const canvas = document.createElement('canvas');
  canvas.width = GRID_W; canvas.height = GRID_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(GRID_W, GRID_H);
  const px  = img.data;

  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const t = Math.min(grid[i] / maxVal, 1);
    const { r, g, b, a } = lerpColor(t);
    px[i * 4]     = r;
    px[i * 4 + 1] = g;
    px[i * 4 + 2] = b;
    px[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);

  // Blur smooths grid artefacts into a natural-looking haze
  const smooth = document.createElement('canvas');
  smooth.width = GRID_W; smooth.height = GRID_H;
  const sCtx = smooth.getContext('2d')!;
  sCtx.filter = 'blur(5px)';
  sCtx.drawImage(canvas, 0, 0);

  return smooth.toDataURL('image/png');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  incidents: Incident[];
  suburbs: any[];
  onSelectIncident: (id: number | string) => void;
  selectedIncidentId: number | string | null;
}

export default function LeafletMap({ incidents, onSelectIncident, selectedIncidentId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markersRef   = useRef<any[]>([]);
  const heatRef      = useRef<any>(null);
  const LRef         = useRef<any>(null);

  // Stable refs so event callbacks always see the latest props
  const incidentsRef = useRef(incidents);
  const onSelectRef  = useRef(onSelectIncident);
  const selectedRef  = useRef(selectedIncidentId);
  useEffect(() => { incidentsRef.current = incidents; }, [incidents]);
  useEffect(() => { onSelectRef.current  = onSelectIncident; }, [onSelectIncident]);
  useEffect(() => { selectedRef.current  = selectedIncidentId; }, [selectedIncidentId]);

  const [showHint, setShowHint] = useState(true);

  // ── Layer helpers ─────────────────────────────────────────────────────────

  function clearMarkers() {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }

  function clearHeat() {
    if (heatRef.current) { heatRef.current.remove(); heatRef.current = null; }
  }

  function showHeatmap(L: any, map: any, incs: Incident[]) {
    clearMarkers();
    if (heatRef.current) return;
    if (incs.length === 0) return;
    const url = buildHeatmapDataURL(incs);
    heatRef.current = L.imageOverlay(url, CT_BOUNDS, { opacity: 0.82, zIndex: 200 }).addTo(map);
    setShowHint(true);
  }

  function showMarkers(L: any, map: any, incs: Incident[]) {
    clearHeat();
    clearMarkers();
    setShowHint(false);

    const selId = selectedRef.current;
    incs.forEach((incident) => {
      const cfg   = TYPE_CONFIG[incident.type];
      const size  = 8 + incident.severity * 3;
      const isSel = incident.id === selId;

      const icon = L.divIcon({
        html: `<div style="
          width:${size}px;height:${size}px;
          background:${cfg.color};border-radius:50%;
          border:${isSel ? '2px solid white' : '1.5px solid rgba(255,255,255,0.3)'};
          box-shadow:0 0 ${isSel ? '14px' : '7px'} ${cfg.color}90;
          transition:all 0.2s;cursor:pointer;
        "></div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([incident.lat, incident.lng], { icon })
        .addTo(map)
        .on('click', () => onSelectRef.current(incident.id));

      marker.bindTooltip(
        `<div style="font-family:'Space Mono',monospace;font-size:11px;color:#eceef4;max-width:180px">
          <div style="color:${cfg.color};font-size:10px;text-transform:uppercase;letter-spacing:0.05em">${cfg.label}</div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;margin-top:2px">${incident.title}</div>
          <div style="color:#8891a8;font-size:10px;margin-top:2px">${incident.time}</div>
        </div>`,
        { sticky: true },
      );

      markersRef.current.push(marker);
    });
  }

  function syncToZoom(L: any, map: any, incs: Incident[]) {
    if (map.getZoom() < DETAIL_ZOOM) showHeatmap(L, map, incs);
    else showMarkers(L, map, incs);
  }

  // ── Map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    let localMap: any = null;

    if (!containerRef.current || mapRef.current) return;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) delete container._leaflet_id;

      const map = L.map(container, {
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © Carto',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      localMap = map;
      if (cancelled) { map.remove(); return; }

      mapRef.current = map;
      LRef.current   = L;

      map.on('zoomend', () => syncToZoom(L, map, incidentsRef.current));
      syncToZoom(L, map, incidentsRef.current);
    })();

    return () => {
      cancelled = true;
      clearMarkers();
      clearHeat();
      if (localMap) { localMap.remove(); localMap = null; }
      else if (mapRef.current) { mapRef.current.remove(); }
      mapRef.current = null;
      LRef.current   = null;
      const c = containerRef.current as (HTMLDivElement & { _leaflet_id?: number }) | null;
      if (c?._leaflet_id) delete c._leaflet_id;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-render when data changes ───────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !LRef.current) return;
    syncToZoom(LRef.current, mapRef.current, incidents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, selectedIncidentId]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Zoom-in hint */}
      {showHint && incidents.length > 0 && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-none"
          style={{
            background: 'rgba(15,18,28,0.82)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '999px',
            padding: '6px 18px',
            fontFamily: "'Space Mono', monospace",
            fontSize: '11px',
            color: '#8891a8',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
          }}
        >
          🔍 Zoom past level {DETAIL_ZOOM} to see individual incidents
        </div>
      )}

      {/* Density legend */}
      {showHint && incidents.length > 0 && (
        <div
          className="absolute top-4 right-4 z-[500]"
          style={{
            background: 'rgba(15,18,28,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontFamily: "'Space Mono', monospace",
            fontSize: '10px',
            color: '#8891a8',
            backdropFilter: 'blur(8px)',
            minWidth: '132px',
          }}
        >
          <div style={{ color: '#eceef4', fontWeight: 700, marginBottom: 8, fontSize: 11 }}>
            Crime Density
          </div>
          {([
            ['#ef4444', 'Very High'],
            ['#f97316', 'High'],
            ['#eab308', 'Moderate'],
            ['#84cc16', 'Low'],
            ['#22c55e', 'Minimal'],
          ] as [string, string][]).map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{
                width: 28, height: 10, borderRadius: 3,
                background: color, opacity: 0.85, flexShrink: 0,
              }} />
              <span>{label}</span>
            </div>
          ))}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: 8, paddingTop: 8,
            color: '#6b7280', fontSize: 9,
          }}>
            KDE · {incidents.length} incidents
          </div>
        </div>
      )}
    </div>
  );
}