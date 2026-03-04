'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { communityApi } from '@/lib/api';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR, SEVERITY_COLORS } from '@/lib/constants';
import { clsx } from 'clsx';
import { X, MapPin, Filter } from 'lucide-react';
import type { Incident, IncidentType } from '@/lib/types';

// Leaflet must be loaded client-side only
const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false, loading: () => (
  <div className="flex-1 bg-bg flex items-center justify-center">
    <div className="text-text-dim font-mono text-sm animate-pulse">Loading map...</div>
  </div>
) });

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

function IncidentPanel({
  incident,
  suburbName,
  onClose,
  onUpdateIncident,
}: {
  incident: Incident;
  suburbName: string;
  onClose: () => void;
  onUpdateIncident: (id: number | string, updater: (current: Incident) => Incident) => void;
}) {
  const cfg = TYPE_CONFIG[incident.type];
  const [comment, setComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (!incident.isFromBackend || incident.comments.length > 0 || incident.commentCount === 0) return;
    if (typeof incident.id !== 'number') return;

    let cancelled = false;
    setLoadingComments(true);
    communityApi.getIncidentComments(incident.id)
      .then((rows: any) => {
        if (cancelled) return;
        const comments = (Array.isArray(rows) ? rows : []).map((row: any) => ({
          user: row.username ?? 'Resident',
          avatar: '#3b82f6',
          time: row.createdAt ? new Date(row.createdAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown',
          text: row.text ?? '',
        }));
        onUpdateIncident(incident.id, (current) => ({
          ...current,
          comments,
          commentCount: Math.max(current.commentCount, comments.length),
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [incident.id, incident.isFromBackend, incident.commentCount, incident.comments.length, onUpdateIncident]);

  async function submitComment() {
    const text = comment.trim();
    if (!text) return;

    onUpdateIncident(incident.id, (current) => ({
      ...current,
      comments: [...current.comments, { user: 'You', avatar: '#3b82f6', time: 'Just now', text }],
      commentCount: current.commentCount + 1,
    }));
    setComment('');

    if (!incident.isFromBackend || typeof incident.id !== 'number') return;
    try {
      await communityApi.addIncidentComment(incident.id, {
        username: 'You',
        text,
        descriptionMatch: false,
      });
    } catch {
      // Keep optimistic update in UI even if backend write fails.
    }
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-surface flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div
            className="text-xs px-2 py-0.5 rounded border font-mono uppercase tracking-wider"
            style={{ color: cfg.color, borderColor: `${cfg.color}40`, background: `${cfg.color}15` }}
          >
            {cfg.emoji} {cfg.label}
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text-primary transition-colors">
            <X size={14} />
          </button>
        </div>
        <h2 className="font-display font-bold text-base mt-2 leading-tight">{incident.title}</h2>
        <div className="flex items-center gap-2 mt-1.5 text-text-dim font-mono text-[10px]">
          <MapPin size={10} />
          <span>{suburbName}</span>
          <span>·</span>
          <span>{incident.time}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="form-label">Description</div>
          <p className="font-body text-sm text-text-secondary leading-relaxed">{incident.description}</p>
        </div>

        {incident.tags.length > 0 && (
          <div>
            <div className="form-label">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {incident.tags.map((tag) => (
                <span key={tag} className="badge-mono text-[10px]">{tag}</span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="form-label">Severity</div>
          <div className="flex items-center gap-2">
            {[1,2,3,4,5].map((n) => (
              <div
                key={n}
                className="h-1.5 rounded-full flex-1 transition-all"
                style={{ background: n <= incident.severity ? SEVERITY_COLORS[incident.severity] : '#222636' }}
              />
            ))}
            <span className="font-mono text-[10px] text-text-dim ml-1">{incident.severity}/5</span>
          </div>
        </div>

        <div>
          <div className="form-label">Community Updates ({incident.commentCount})</div>
          {loadingComments && (
            <div className="text-text-dim font-mono text-xs text-center py-4 border border-dashed border-border rounded-lg">
              Loading updates...
            </div>
          )}
          {!loadingComments && incident.commentCount === 0 && incident.comments.length === 0 && (
            <div className="text-text-dim font-mono text-xs text-center py-4 border border-dashed border-border rounded-lg">No updates yet</div>
          )}
          {!loadingComments && incident.commentCount > 0 && incident.comments.length === 0 && (
            <div className="text-text-dim font-mono text-xs text-center py-4 border border-dashed border-border rounded-lg">
              {incident.commentCount} update{incident.commentCount === 1 ? '' : 's'} recorded
            </div>
          )}
          <div className="space-y-2">
            {incident.comments.map((c, i) => (
              <div key={i} className="bg-surface2 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: c.avatar }}>
                    {c.user[0]}
                  </div>
                  <span className="font-mono text-[10px] text-text-secondary">{c.user}</span>
                  <span className="font-mono text-[10px] text-text-dim">{c.time}</span>
                </div>
                <p className="font-body text-xs text-text-secondary">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment input */}
      <div className="p-3 border-t border-border flex gap-2">
        <input
          className="form-input text-xs flex-1"
          placeholder="Add sighting or update..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitComment();
            }
          }}
        />
        <button className="btn-primary px-3 text-xs" onClick={submitComment}>↑</button>
      </div>
    </div>
  );
}

export function MapView() {
  const {
    incidents,
    suburbs,
    activeFilters,
    toggleFilter,
    selectedIncidentId,
    setSelectedIncident,
    updateIncident,
    backendConnected,
  } = useStore();
  const [showFilters, setShowFilters] = useState(false);

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) ?? null;
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
        {/* Sidebar */}
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
            incidents={incidents.filter((i) => activeFilters.has(i.type))}
            suburbs={suburbs}
            onSelectIncident={setSelectedIncident}
            selectedIncidentId={selectedIncidentId}
          />
        </div>

        {/* Incident panel */}
        {selectedIncident && (
          <IncidentPanel
            incident={selectedIncident}
            suburbName={selectedSuburb?.name ?? 'Unknown'}
            onClose={() => setSelectedIncident(null)}
            onUpdateIncident={updateIncident}
          />
        )}
      </div>
    </div>
  );
}