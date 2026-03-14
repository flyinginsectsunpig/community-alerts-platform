/**
 * IncidentFeedCard.tsx
 *
 * FIX #7: `incident.suburb` is a suburb ID string (e.g. "obs"), not a display
 * name. We now look up the suburb name from the Zustand store. Falls back to
 * the raw ID during cold start before suburbs have loaded.
 *
 * The card layout is deliberately dense — no description preview, just:
 * left severity border | type label | title | suburb + time
 * Severity-5 cards animate with the sevCritical keyframe ring.
 */
'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, SEVERITY_COLORS } from '@/lib/constants';
import { MapPin, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Incident } from '@/lib/types';

interface Props {
  incident: Incident;
  /** Whether this is the first card (receives feedFlash on new incident) */
  isFirst?: boolean;
}

export function IncidentFeedCard({ incident, isFirst }: Props) {
  const router     = useRouter();
  const { suburbs } = useStore();
  const isCritical  = incident.severity === 5;
  const cfg         = TYPE_CONFIG[incident.type];
  const sevColor    = SEVERITY_COLORS[incident.severity];

  // FIX #7: look up display name from suburbs store
  const suburbName = suburbs.find(s => s.id === incident.suburb)?.name ?? incident.suburb;

  return (
    <div
      onClick={() => router.push(`/?incident=${incident.id}`)}
      className={[
        'group relative flex flex-col px-3 py-2.5',
        'border-b border-border bg-surface/50',
        'hover:bg-surface2 cursor-pointer transition-colors duration-150',
        isCritical ? 'sev-critical-card' : '',
        isFirst ? 'animate-feed-flash' : '',
      ].join(' ')}
      style={
        !isCritical
          ? { borderLeft: `3px solid ${sevColor}` }
          : undefined
      }
    >
      {/* Row 1: title + type label */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-bold text-xs text-text-primary leading-tight truncate group-hover:text-accent transition-colors flex-1">
          {incident.title}
        </h3>
        <span
          className="font-mono text-[9px] uppercase tracking-wider flex-shrink-0 mt-0.5"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Row 2: suburb + time */}
      <div className="flex items-center gap-3 mt-1 font-mono text-[9px] text-text-dim uppercase tracking-wider">
        <span className="flex items-center gap-1 truncate">
          <MapPin size={9} className="flex-shrink-0" />
          <span className="truncate max-w-[90px]">{suburbName}</span>
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          <Clock size={9} />
          {incident.time}
        </span>
      </div>

      {/* Critical pulse dot */}
      {isCritical && (
        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
      )}
    </div>
  );
}
