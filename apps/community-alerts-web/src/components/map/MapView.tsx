'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { communityApi } from '@/lib/api';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR } from '@/lib/constants';
import { clsx } from 'clsx';
import { X, MapPin, Filter } from 'lucide-react';
import type { Incident, IncidentType } from '@/lib/types';
import { mapIncident } from '@/lib/mappers';
import { IncidentDetailPane } from '@/components/alerts/IncidentDetailPane';

// Leaflet must be loaded client-side only
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false, loading: () => (
    <div className="flex-1 bg-bg flex items-center justify-center">
      <div className="text-text-dim font-mono text-sm animate-pulse">Loading map...</div>
    </div>
  )
});

function FilterPill({ type, active, onToggle }: { type: IncidentType; active: boolean; onToggle: () => void }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <button
      onClick={onToggle}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-[11px] transition-all',
        active
          ? 'text-text-primary border-opacity-40'
          : 'text-text-dim border-border bg-surface2 opacity-50',
      )}
      style={active ? { borderColor: `${cfg.color}60`, background: `${cfg.color}15`, color: cfg.color } : undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={active ? { background: cfg.color } : { background: '#4b5468' }} />
      {cfg.label}
    </button>
  );
}

export function MapView() {
  const {
    incidents,
    mapIncidents,
    suburbs,
    activeFilters,
    toggleFilter,
    selectedIncidentId,
    setSelectedIncident,
    updateIncident,
  } = useStore();
  const [showFilters, setShowFilters] = useState(false);
  const [fetchedIncident, setFetchedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (!selectedIncidentId) {
      setFetchedIncident(null);
      return;
    }

    // Fast path: it's in the recent 200 cache
    const cached = incidents.find((i) => i.id === selectedIncidentId);
    if (cached) {
      setFetchedIncident(cached);
      return;
    }

    // Slow path: user clicked an older map pin that was only loaded as a map item
    let cancelled = false;
    communityApi.getIncident(selectedIncidentId)
      .then((data: any) => {
        if (!cancelled) setFetchedIncident(mapIncident(data));
      })
      .catch((err) => console.error(err));

    return () => { cancelled = true; };
  }, [selectedIncidentId, incidents]);

  const selectedIncident = fetchedIncident;
  const selectedSuburb = selectedIncident ? suburbs.find((s) => s.id === selectedIncident.suburb) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-surface border-b border-border flex items-center gap-3 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx('btn-ghost text-xs flex-shrink-0', showFilters && 'text-accent border-accent/30')}
        >
          <Filter size={12} /> Filters
        </button>
        <div className="flex items-center gap-2">
          {(Object.keys(TYPE_CONFIG) as IncidentType[]).map((type) => (
            <FilterPill
              key={type}
              type={type}
              active={activeFilters.has(type)}
              onToggle={() => toggleFilter(type)}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Suburb heat sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-y-auto">
          <div className="px-3 py-2 border-b border-border">
            <div className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Suburb Heat</div>
          </div>
          <div className="flex-1 py-1">
            {[...suburbs].sort((a, b) => b.weight - a.weight).map((suburb) => {
              const color = ALERT_LEVEL_COLOR[suburb.alertLevel ?? 'GREEN'];
              const pct = Math.min(100, (suburb.weight / 50) * 100);
              return (
                <div
                  key={suburb.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface2 cursor-pointer transition-colors group"
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="font-body text-xs text-text-secondary flex-1 truncate group-hover:text-text-primary">{suburb.name}</span>
                  <div className="w-12 h-0.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <LeafletMap
            incidents={mapIncidents.filter((i) => activeFilters.has(i.type))}
            suburbs={suburbs}
            onSelectIncident={setSelectedIncident}
            selectedIncidentId={selectedIncidentId}
          />
        </div>

        {/* Incident detail pane */}
        {selectedIncident && (
          <IncidentDetailPane
            incident={selectedIncident}
            suburbName={selectedSuburb?.name ?? 'Unknown'}
            onClose={() => setSelectedIncident(null)}
            onUpdateIncident={updateIncident}
            width="w-80"
            tagLabel="Tags"
          />
        )}
      </div>
    </div>
  );
}