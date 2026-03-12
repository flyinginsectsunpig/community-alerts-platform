'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { communityApi, mlApi, notificationApi } from '@/lib/api';
import { mapSuburb, mapIncident, mapMapIncident } from '@/lib/mappers';

// ─── Module-level flag ────────────────────────────────────────────────────────
// React StrictMode (enabled by default in Next.js dev) intentionally mounts →
// unmounts → remounts every component, causing useEffect([]) to fire TWICE.
// A module-level variable survives the simulated unmount, so the second mount
// sees `bootstrapStarted = true` and bails out immediately — preventing a
// second in-flight fetch from racing against the first and overwriting the
// store with stale / partial data.
let bootstrapStarted = false;

// ─── Component ────────────────────────────────────────────────────────────────

export function BackendBootstrap() {
  const { setIncidents, setMapIncidents, setSuburbs, setBackendConnected, setMlConnected, setNotificationConnected } =
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

    // ── Retry helper ──────────────────────────────────────────────────────────
    // Spring Boot can take 30–60 s to start (JVM cold start + Hibernate DDL +
    // DataSeeder). If the page loads while Java is still booting the first
    // fetch fails and the light stays red forever. This helper retries with
    // exponential back-off (2 s → 4 s → 8 s → … capped at 30 s) for up to
    // 3 minutes before giving up.
    async function withRetry<T>(
      fn: () => Promise<T>,
      label: string,
      maxMs = 180_000,
    ): Promise<T> {
      const start = Date.now();
      let delay = 2_000;
      let attempt = 0;
      while (true) {
        try {
          return await fn();
        } catch (err) {
          attempt++;
          const elapsed = Date.now() - start;
          if (cancelled || elapsed + delay > maxMs) throw err;
          console.info(
            `[bootstrap] ${label} not ready (attempt ${attempt}), retrying in ${delay / 1000}s…`,
          );
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 2, 30_000);
        }
      }
    }

    async function bootstrap() {
      // ── Java backend ────────────────────────────────────────────────────────
      try {
        const [suburbsRaw, incidentsRaw] = await Promise.all([
          withRetry(() => communityApi.getSuburbs() as Promise<any[]>, 'Java API'),
          withRetry(() => communityApi.getIncidents(200) as Promise<any>, 'Java API'),
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

        // Pull map points in pages to avoid a single heavy 100k payload.
        const mapIncidents: import('@/lib/types').IncidentMapDTO[] = [];
        const pageSize = 10000;
        let page = 0;
        let totalPages = 1;

        while (!cancelled && page < totalPages) {
          const mapPage = (await communityApi.getMapData(pageSize, page)) as any;
          const rows = (mapPage?.content ?? []) as any[];
          if (rows.length > 0) {
            mapIncidents.push(...rows.map(mapMapIncident));
          }

          totalPages = Math.max(1, Number(mapPage?.totalPages ?? 1));
          page += 1;

          // Yield between pages so UI stays responsive during large imports.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        if (!cancelled && mapIncidents.length) {
          setMapIncidents(mapIncidents);
        }
      } catch {
        // Backend unreachable after all retries — store stays empty, UI shows empty state.
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

      // ── Notification service (.NET) ──────────────────────────────────────────
      if (cancelled) return;
      try {
        await notificationApi.getHealth();
        if (!cancelled) setNotificationConnected(true);
      } catch {
        if (!cancelled) setNotificationConnected(false);
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
  }, [setBackendConnected, setIncidents, setMapIncidents, setMlConnected, setNotificationConnected, setSuburbs]);

  return null;
}