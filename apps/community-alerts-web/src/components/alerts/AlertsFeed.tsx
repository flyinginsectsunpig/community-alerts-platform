'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TYPE_CONFIG } from '@/lib/constants';
import type { IncidentType } from '@/lib/types';
import { clsx } from 'clsx';
import { Search, ArrowUpDown } from 'lucide-react';
import { IncidentCard } from './IncidentCard';
import { IncidentDetailPane } from './IncidentDetailPane';

type SortKey = 'newest' | 'oldest' | 'severity' | 'type';

export function AlertsFeed() {
  const { incidents, suburbs, updateIncident } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<IncidentType | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [selectedId, setSelectedId] = useState<number | string | null>(null);

  const filtered = incidents
    .filter((i) => typeFilter === 'all' || i.type === typeFilter)
    .filter((i) => !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'severity') return b.severity - a.severity;
      if (sortKey === 'type') return a.type.localeCompare(b.type);
      if (sortKey === 'oldest') return (a.id > b.id ? 1 : -1);
      return (b.id > a.id ? 1 : -1); // newest
    });

  const selected = filtered.find((i) => i.id === selectedId) ?? null;
  const selectedSuburb = selected ? suburbs.find((s) => s.id === selected.suburb) : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Feed */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-border bg-surface flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              className="form-input pl-8 text-xs"
              placeholder="Search incidents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(['all', ...(Object.keys(TYPE_CONFIG) as IncidentType[])] as Array<'all' | IncidentType>).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={clsx(
                  'font-mono text-[10px] px-2.5 py-1 rounded-full border transition-all',
                  typeFilter === type
                    ? type === 'all'
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'border-opacity-40'
                    : 'text-text-dim border-border hover:text-text-secondary',
                )}
                style={typeFilter === type && type !== 'all'
                  ? { color: TYPE_CONFIG[type as IncidentType].color, borderColor: `${TYPE_CONFIG[type as IncidentType].color}50`, background: `${TYPE_CONFIG[type as IncidentType].color}15` }
                  : undefined}
              >
                {type === 'all' ? 'All' : TYPE_CONFIG[type as IncidentType].emoji}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 border border-border rounded-lg px-2 py-1 bg-surface2">
            <ArrowUpDown size={11} className="text-text-dim" />
            <select
              className="bg-transparent text-xs text-text-secondary font-mono cursor-pointer focus:outline-none"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="severity">Severity</option>
              <option value="type">Type</option>
            </select>
          </div>

          <span className="font-mono text-[10px] text-text-dim ml-auto flex-shrink-0">
            {filtered.length} incidents
          </span>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-w-4xl">
            {filtered.map((incident) => {
              const suburb = suburbs.find((s) => s.id === incident.suburb);
              return (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  suburbName={suburb?.name ?? 'Unknown'}
                  selected={incident.id === selectedId}
                  onSelect={() => setSelectedId(incident.id === selectedId ? null : incident.id)}
                />
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-16 text-text-dim font-mono text-sm">
                No incidents match your filters
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail pane */}
      {selected && (
        <IncidentDetailPane
          incident={selected}
          suburbName={selectedSuburb?.name ?? 'Unknown'}
          onClose={() => setSelectedId(null)}
          onUpdateIncident={updateIncident}
          width="w-96"
          tagLabel="Suspect / Vehicle Details"
        />
      )}
    </div>
  );
}
