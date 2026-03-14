'use client';

import { useStore } from '@/lib/store';
import { SEVERITY_COLORS } from '@/lib/constants';
import { MapPin, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Incident } from '@/lib/types';

/**
 * IncidentFeedCard Component
 * A dense card for the threat feed.
 * Left border reflects severity.
 */
export function IncidentFeedCard({ incident }: { incident: Incident }) {
  const router = useRouter();
  const isCritical = incident.severity === 5;
  
  return (
    <div 
      onClick={() => router.push(`/?incident=${incident.id}`)}
      className={`
        group relative flex flex-col p-2.5 bg-surface/50 border-b border-border 
        hover:bg-surface2 cursor-pointer transition-all duration-200
        ${isCritical ? 'animate-sev-critical border-l-4 border-l-red' : ''}
      `}
      style={!isCritical ? { borderLeft: `3px solid ${SEVERITY_COLORS[incident.severity]}` } : {}}
    >
      <div className="flex items-start justify-between gap-2 overflow-hidden">
        <h3 className="font-display font-bold text-xs text-text-primary leading-tight truncate group-hover:text-accent transition-colors">
          {incident.title}
        </h3>
        <span className="font-mono text-[9px] text-text-dim flex-shrink-0 uppercase">
          {incident.type}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-1.5 font-mono text-[9px] text-text-secondary uppercase tracking-wider">
        <div className="flex items-center gap-1">
          <MapPin size={10} className="text-text-dim" />
          <span className="truncate max-w-[80px]">{incident.suburb}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} className="text-text-dim" />
          <span>{incident.time}</span>
        </div>
      </div>
      
      {isCritical && (
        <div className="absolute top-0 right-0 p-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
        </div>
      )}
    </div>
  );
}
