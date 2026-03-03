'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { communityApi, mlApi } from '@/lib/api';
import type { Suburb, Incident } from '@/lib/types';
import { BACKEND_TO_UI_TYPE } from '@/lib/constants';

function mapSuburb(raw: any): Suburb {
  return {
    id: raw.id,
    name: raw.name,
    lat: raw.latitude ?? raw.lat,
    lng: raw.longitude ?? raw.lng,
    weight: raw.heatScore ?? raw.weight ?? 0,
    alertLevel: raw.alertLevel,
  };
}

function mapIncident(raw: any): Incident {
  return {
    id: raw.id,
    suburb: raw.suburbId ?? raw.suburb,
    type: BACKEND_TO_UI_TYPE[raw.type] ?? 'info',
    title: raw.title,
    description: raw.description,
    tags: raw.tags ?? [],
    time: raw.createdAt ? new Date(raw.createdAt).toLocaleTimeString() : 'Unknown',
    createdAt: raw.createdAt,
    lat: raw.latitude ?? raw.lat,
    lng: raw.longitude ?? raw.lng,
    severity: raw.severity ?? 3,
    comments: [],
    commentCount: raw.commentCount ?? 0,
    isFromBackend: true,
  };
}

export function BackendBootstrap() {
  const { setIncidents, setSuburbs, setBackendConnected, setMlConnected } = useStore();

  useEffect(() => {
    async function bootstrap() {
      // Java backend
      try {
        const [suburbsRaw, incidentsRaw] = await Promise.all([
          communityApi.getSuburbs() as Promise<any[]>,
          communityApi.getAllIncidents(200) as Promise<any>,
        ]);

        const suburbs = suburbsRaw.map(mapSuburb);
        const incidents = (incidentsRaw.content ?? incidentsRaw).map(mapIncident);

        if (suburbs.length) setSuburbs(suburbs);
        if (incidents.length) setIncidents(incidents);
        setBackendConnected(true);
      } catch {
        // Uses fallback data from store initial state
        setBackendConnected(false);
      }

      // ML service
      try {
        const health = await mlApi.getHealth() as any;
        setMlConnected(health?.status === 'ok' || health?.status === 'initialising');
      } catch {
        setMlConnected(false);
      }
    }

    bootstrap();
  }, []);

  return null;
}
