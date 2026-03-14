'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { TYPE_CONFIG, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

// ─── KDE Heatmap Logic ────────────────────────────────────────────────────────

const GRID_W = 320;
const GRID_H = 220;
const BANDWIDTH = 0.07;

const TYPE_HEAT_WEIGHT: Record<string, number> = {
  crime: 5, fire: 4, suspicious: 3, accident: 2, power: 1, info: 1,
};

function gaussianKernel(sigma: number): Float32Array {
  const range = Math.ceil(sigma * 3);
  const size = range * 2 + 1;
  const k = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const d = i - range;
    k[i] = Math.exp(-(d * d) / (2 * sigma * sigma));
    sum += k[i];
  }
  for (let i = 0; i < size; i++) k[i] /= sum;
  return k;
}

function buildDensityGrid(incidents: any[], bounds: [[number, number], [number, number]]): Float32Array {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  const raw = new Float32Array(GRID_W * GRID_H);

  for (const inc of incidents) {
    if (inc.lat < minLat || inc.lat > maxLat || inc.lng < minLng || inc.lng > maxLng) continue;
    const gx = Math.min(GRID_W - 1, Math.floor(((inc.lng - minLng) / lngRange) * GRID_W));
    const gy = Math.min(GRID_H - 1, Math.floor(((1 - (inc.lat - minLat) / latRange)) * GRID_H));
    const typeWeight = TYPE_HEAT_WEIGHT[inc.type] ?? 1;
    raw[gy * GRID_W + gx] += (inc.severity ?? 3) * typeWeight;
  }

  const sigmaX = (BANDWIDTH / lngRange) * GRID_W;
  const sigmaY = (BANDWIDTH / latRange) * GRID_H;
  const kx = gaussianKernel(sigmaX), ky = gaussianKernel(sigmaY);
  const rx = (kx.length - 1) >> 1, ry = (ky.length - 1) >> 1;

  const temp = new Float32Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      let v = 0;
      for (let k = 0; k < kx.length; k++) {
        const sx = x + k - rx;
        if (sx >= 0 && sx < GRID_W) v += raw[y * GRID_W + sx] * kx[k];
      }
      temp[y * GRID_W + x] = v;
    }
  }

  const out = new Float32Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      let v = 0;
      for (let k = 0; k < ky.length; k++) {
        const sy = y + k - ry;
        if (sy >= 0 && sy < GRID_H) v += temp[sy * GRID_W + x] * ky[k];
      }
      out[y * GRID_W + x] = v;
    }
  }
  return out;
}

const COLOR_STOPS = [
  { t: 0.00, r: 34, g: 197, b: 94, a: 0 },
  { t: 0.08, r: 34, g: 197, b: 94, a: 35 },
  { t: 0.28, r: 132, g: 204, b: 22, a: 80 },
  { t: 0.50, r: 234, g: 179, b: 8, a: 120 },
  { t: 0.72, r: 249, g: 115, b: 22, a: 160 },
  { t: 1.00, r: 239, g: 68, b: 68, a: 210 },
];

function lerpColor(t: number) {
  const c = Math.max(0, Math.min(1, t));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i], b = COLOR_STOPS[i + 1];
    if (c <= b.t) {
      const f = (c - a.t) / (b.t - a.t);
      return {
        r: Math.round(a.r + f * (b.r - a.r)), g: Math.round(a.g + f * (b.g - a.g)),
        b: Math.round(a.b + f * (b.b - a.b)), a: Math.round(a.a + f * (b.a - a.a)),
      };
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1];
}

/**
 * CommandMap Component
 * Full-bleed Leaflet map (z-0) with Integrated KDE Heatmap.
 */
export function CommandMap() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mapIncidents, suburbs, activeFilters } = useStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const suburbsRef = useRef<any[]>([]);
  const heatRef = useRef<any>(null);

  const view = searchParams.get('view');
  const incidentId = searchParams.get('incident');
  const suburbId = searchParams.get('suburb');

  // Filter incidents locally for the map based on store filters
  const filteredIncidents = mapIncidents.filter(inc => activeFilters.has(inc.type));

  useEffect(() => {
    // StrictMode guard: if a map instance already exists on the ref, skip init.
    // StrictMode mounts->unmounts->remounts; the cleanup below removes the map
    // instance but the DOM node's _leaflet_id can persist. We handle both cases.
    if (mapRef.current) return;

    let cancelled = false;
    let localMap: any = null;

    const init = async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      // Clear any stale Leaflet instance left on the DOM node from a prior mount
      const el = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (el._leaflet_id) {
        delete el._leaflet_id;
      }

      const map = L.map(containerRef.current, {
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Map-level click clears all URL params (dismisses panels)
      map.on('click', () => { router.push('/'); });

      localMap = map;
      mapRef.current = map;
      LRef.current = L;

      renderSuburbs(L, map);
      syncView();
    };

    init();

    return () => {
      cancelled = true;
      if (localMap) {
        localMap.remove();
        localMap = null;
      }
      mapRef.current = null;
      LRef.current = null;
      // Clean up stale _leaflet_id so the next mount can reinitialise cleanly
      if (containerRef.current) {
        const el = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
        delete el._leaflet_id;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncView();
  }, [view, mapIncidents, activeFilters, incidentId, suburbId]);

  const syncView = () => {
    if (!mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;

    // Clear existing
    if (heatRef.current) { heatRef.current.remove(); heatRef.current = null; }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (view === 'analytics') {
      renderHeatmap(L, map);
    } else {
      renderIncidents(L, map);
    }
  };

  const renderHeatmap = (L: any, map: any) => {
    if (filteredIncidents.length === 0) return;
    const bounds: [[number, number], [number, number]] = [[-34.45, 18.2], [-33.35, 19.1]]; // CT Region
    const grid = buildDensityGrid(filteredIncidents, bounds);

    const nonZero = Array.from(grid).filter((v) => v > 0).sort((a, b) => a - b);
    const p98 = nonZero[Math.floor(nonZero.length * 0.98)] ?? 1;
    const maxVal = Math.max(p98, 0.001);

    const canvas = document.createElement('canvas');
    canvas.width = GRID_W; canvas.height = GRID_H;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(GRID_W, GRID_H);
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const { r, g, b, a } = lerpColor(Math.min(grid[i] / maxVal, 1));
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);

    const smooth = document.createElement('canvas');
    smooth.width = GRID_W; smooth.height = GRID_H;
    const sCtx = smooth.getContext('2d')!;
    sCtx.filter = 'blur(4px)';
    sCtx.drawImage(canvas, 0, 0);

    heatRef.current = L.imageOverlay(smooth.toDataURL(), bounds, { opacity: 0.8, zIndex: 200 }).addTo(map);
  };

  const renderSuburbs = (L: any, map: any) => {
    suburbsRef.current.forEach(m => m.remove());
    suburbsRef.current = [];
    suburbs.forEach(sub => {
      const dot = L.divIcon({
        className: 'suburb-centroid',
        html: `<div class="w-1.5 h-1.5 bg-text-dim/40 rounded-sm rotate-45 group relative">
                 <div class="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-[8px] text-text-dim/60 uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">\${sub.name}</div>
               </div>`,
        iconSize: [6, 6]
      });
      const marker = L.marker([sub.lat, sub.lng], { icon: dot })
        .addTo(map)
        .on('click', (e: any) => { L.DomEvent.stopPropagation(e); router.push(`/?suburb=\${sub.id}`); });
      suburbsRef.current.push(marker);
    });
  };

  const renderIncidents = (L: any, map: any) => {
    const visible = filteredIncidents.slice(0, 800);
    visible.forEach(inc => {
      const isSelected = String(inc.id) === String(incidentId);
      const cfg = TYPE_CONFIG[inc.type];
      const baseSize = 8 + (inc.severity ?? 3) * 2.5;
      const size = isSelected ? baseSize * 1.4 : baseSize;
      const isCritical = inc.severity === 5;

      const icon = L.divIcon({
        className: 'incident-pin',
        html: `<div class="relative flex items-center justify-center">
                 \${isCritical ? '<div class="absolute inset-0 rounded-full animate-pinHalo bg-red/30" style="width: 28px; height: 28px; margin: -14px 0 0 -14px;"></div>' : ''}
                 <div style="width: \${size}px; height: \${size}px; background: \${cfg.color}; border: \${isSelected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.4)'}; border-radius: 50%; box-shadow: 0 0 10px \${cfg.color}80;"></div>
               </div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker([inc.lat, inc.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 })
        .addTo(map)
        .on('click', (e: any) => { L.DomEvent.stopPropagation(e); router.push(`/?incident=\${inc.id}`); });
      markersRef.current.push(marker);
    });
  };

  return (
    <div className="fixed inset-0 z-0 bg-[#080a0f]">
      <div id="map-canvas" ref={containerRef} className="w-full h-full" />
    </div>
  );
}