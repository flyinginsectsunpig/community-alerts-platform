'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { communityApi, mlApi } from '@/lib/api';
import type { Suburb, Incident } from '@/lib/types';
import { BACKEND_TO_UI_TYPE } from '@/lib/constants';
import { FALLBACK_SUBURBS, SEED_INCIDENTS } from '@/lib/data/fallback';

// ─── Module-level flag ────────────────────────────────────────────────────────
// React StrictMode (enabled by default in Next.js dev) intentionally mounts →
// unmounts → remounts every component, causing useEffect([]) to fire TWICE.
// A module-level variable survives the simulated unmount, so the second mount
// sees `bootstrapStarted = true` and bails out immediately — preventing a
// second in-flight fetch from racing against the first and overwriting the
// store with stale / partial data.
let bootstrapStarted = false;

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function mapSuburb(raw: any): Suburb {
  return {
    id: raw.id,
    name: raw.name,
    lat: raw.latitude ?? raw.lat,
    lng: raw.longitude ?? raw.lng,
    weight: raw.heatScore ?? raw.weight ?? 0,
    alertLevel: raw.alertLevel,
  };
}

export function mapIncident(raw: any): Incident {
  return {
    id: raw.id,
    suburb: raw.suburbId ?? raw.suburb,
    type: BACKEND_TO_UI_TYPE[raw.type] ?? 'info',
    title: raw.title,
    description: raw.description,
    tags: raw.tags ?? [],
    time: raw.createdAt
      ? new Date(raw.createdAt).toLocaleTimeString()
      : 'Unknown',
    createdAt: raw.createdAt,
    lat: raw.latitude ?? raw.lat,
    lng: raw.longitude ?? raw.lng,
    severity: raw.severity ?? 3,
    comments: [],
    commentCount: raw.commentCount ?? 0,
    isFromBackend: true,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BackendBootstrap() {
  const { setIncidents, setSuburbs, setBackendConnected, setMlConnected } =
    useStore();

  useEffect(() => {
    // ── StrictMode guard ──────────────────────────────────────────────────────
    // If bootstrap has already started (second StrictMode invocation), skip.
    if (bootstrapStarted) return;
    bootstrapStarted = true;

    // ── Cancellation flag ─────────────────────────────────────────────────────
    // Set to true by the cleanup function.  Every await point checks this so
    // that a response arriving after an unmount can never write to the store.
    let cancelled = false;

    async function bootstrap() {
      // ── Java backend ────────────────────────────────────────────────────────
      try {
        const [suburbsRaw, incidentsRaw] = await Promise.all([
          communityApi.getSuburbs() as Promise<any[]>,
          communityApi.getIncidents(200) as Promise<any>,
        ]);

        // If the component unmounted while the fetch was in flight, stop here.
        if (cancelled) return;

        const suburbs = (suburbsRaw ?? []).map(mapSuburb);
        const incidents = (incidentsRaw?.content ?? incidentsRaw ?? []).map(
          mapIncident,
        );

        if (suburbs.length) setSuburbs(suburbs);
        if (incidents.length) setIncidents(incidents);
        setBackendConnected(true);
      } catch {
        // Backend unreachable — store stays empty, UI shows empty state.
        if (!cancelled) setBackendConnected(false);
      }

      // ── ML service ──────────────────────────────────────────────────────────
      if (cancelled) return;
      try {
        const health = (await mlApi.getHealth()) as any;
        if (!cancelled) {
          setMlConnected(
            health?.status === 'ok' || health?.status === 'initialising',
          );
        }
      } catch {
        if (!cancelled) setMlConnected(false);
      }
    }

    bootstrap();

    // Cleanup: mark any outstanding fetch as stale so it can't touch the store.
    // Also reset the guard so that if the component is genuinely remounted (e.g.
    // after navigating away and back), the bootstrap runs again with fresh data.
    return () => {
      cancelled = true;
      bootstrapStarted = false;
    };
  }, []);

  return null;
}