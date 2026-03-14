'use client';

import { useStore } from '@/lib/store';
import { IncidentFeedCard } from '../alerts/IncidentFeedCard';
import { Skeleton } from '../ui/Skeleton';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

/**
 * ThreatFeed Component
 * Displays a sorted and filtered list of incidents.
 * Critical incidents (severity 5) are forced to the top.
 */
export function ThreatFeed() {
  const { incidents, backendConnected } = useStore();
  const [filter, setFilter] = useState('all');

  // Sorting: Severity 5 first, then by time/id
  const sortedIncidents = [...incidents].sort((a, b) => {
    if (a.severity === 5 && b.severity !== 5) return -1;
    if (a.severity !== 5 && b.severity === 5) return 1;
    return 0; // Maintain arrival order otherwise (assuming already sorted by time)
  });

  if (!backendConnected && incidents.length === 0) {
    return (
      <div className="flex flex-col">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-2.5 border-b border-border">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-surface2 flex items-center justify-center mb-4 border border-border">
          <Search size={20} className="text-text-dim" />
        </div>
        <h3 className="font-display font-bold text-sm text-text-primary">No incidents reported</h3>
        <p className="font-body text-xs text-text-dim mt-1">
          The threat environment is currently clear for your region.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Tightly packed list */}
      {sortedIncidents.map((incident) => (
        <IncidentFeedCard key={incident.id} incident={incident} />
      ))}
    </div>
  );
}
