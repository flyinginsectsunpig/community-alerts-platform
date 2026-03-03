'use client';

import { useEffect, useRef } from 'react';
import type { Incident, Suburb } from '@/lib/types';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/constants';

interface Props {
  incidents: Incident[];
  suburbs: Suburb[];
  onSelectIncident: (id: number | string) => void;
  selectedIncidentId: number | string | null;
}

export default function LeafletMap({ incidents, suburbs, onSelectIncident, selectedIncidentId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    let localMap: any = null;

    if (!containerRef.current || mapRef.current) return;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !containerRef.current) return;

      const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      // Hot reload/StrictMode can leave stale state on the DOM node.
      if (container._leaflet_id) {
        delete container._leaflet_id;
      }

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
      if (cancelled) {
        map.remove();
        return;
      }

      mapRef.current = map;

      // Initial render
      renderSuburbs(L, map, suburbs);
      renderIncidents(L, map, incidents, onSelectIncident);
    })();

    return () => {
      cancelled = true;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      circlesRef.current.forEach((c) => c.remove());
      circlesRef.current = [];

      if (localMap) {
        localMap.remove();
        localMap = null;
      } else if (mapRef.current) {
        mapRef.current.remove();
      }

      mapRef.current = null;

      const container = containerRef.current as (HTMLDivElement & { _leaflet_id?: number }) | null;
      if (container?._leaflet_id) delete container._leaflet_id;
    };
  }, []);

  // Update markers when incidents change
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      renderIncidents(L, mapRef.current, incidents, onSelectIncident);
    });
  }, [incidents, selectedIncidentId]);

  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      circlesRef.current.forEach((c) => c.remove());
      circlesRef.current = [];
      renderSuburbs(L, mapRef.current, suburbs);
    });
  }, [suburbs]);

  function renderSuburbs(L: any, map: any, subs: Suburb[]) {
    subs.forEach((suburb) => {
      const color = ALERT_LEVEL_COLOR[suburb.alertLevel ?? 'GREEN'];
      const radius = 600 + suburb.weight * 30;
      const circle = L.circle([suburb.lat, suburb.lng], {
        color,
        fillColor: color,
        fillOpacity: 0.08,
        weight: 1,
        opacity: 0.3,
        radius,
      }).addTo(map);

      circle.bindTooltip(
        `<div style="font-family:'Space Mono',monospace;font-size:11px;color:#eceef4">${suburb.name}<br/><span style="color:${color}">Heat: ${suburb.weight}</span></div>`,
        { sticky: true, className: 'custom-tooltip' }
      );

      circlesRef.current.push(circle);
    });
  }

  function renderIncidents(L: any, map: any, incs: Incident[], onSelect: (id: any) => void) {
    incs.forEach((incident) => {
      const cfg = TYPE_CONFIG[incident.type];
      const size = 8 + incident.severity * 3;
      const isSelected = incident.id === selectedIncidentId;

      const icon = L.divIcon({
        html: `<div style="
          width:${size}px;height:${size}px;
          background:${cfg.color};
          border-radius:50%;
          border:${isSelected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.3)'};
          box-shadow:0 0 ${isSelected ? '12px' : '6px'} ${cfg.color}80;
          transition:all 0.2s;
          cursor:pointer;
        "></div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([incident.lat, incident.lng], { icon })
        .addTo(map)
        .on('click', () => onSelect(incident.id));

      marker.bindTooltip(
        `<div style="font-family:'Space Mono',monospace;font-size:11px;color:#eceef4;max-width:180px">
          <div style="color:${cfg.color};font-size:10px;text-transform:uppercase;letter-spacing:0.05em">${cfg.label}</div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;margin-top:2px">${incident.title}</div>
          <div style="color:#8891a8;font-size:10px;margin-top:2px">${incident.time}</div>
        </div>`,
        { sticky: true }
      );

      markersRef.current.push(marker);
    });
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
