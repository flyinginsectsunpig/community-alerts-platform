'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { communityApi } from '@/lib/api';
import { TYPE_CONFIG, SEVERITY_COLORS, ALERT_LEVEL_COLOR } from '@/lib/constants';
import type { Incident, IncidentType } from '@/lib/types';
import { clsx } from 'clsx';
import { Search, SlidersHorizontal, X, MapPin, Clock, ChevronDown, ArrowUpDown } from 'lucide-react';

type SortKey = 'newest' | 'oldest' | 'severity' | 'type';

function IncidentCard({ incident, suburbName, onSelect, selected }: {
  incident: Incident;
  suburbName: string;
  onSelect: () => void;
  selected: boolean;
}) {
  const cfg = TYPE_CONFIG[incident.type];
  return (
    <div
      onClick={onSelect}
      className={clsx(
        'card p-4 cursor-pointer transition-all hover:-translate-y-0.5',
        selected ? 'border-accent/40 bg-accent/5' : 'hover:border-border hover:bg-surface2',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base border"
          style={{ background: `${cfg.color}18`, borderColor: `${cfg.color}33` }}
        >
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className="font-mono text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ color: cfg.color, background: `${cfg.color}18` }}
            >
              {cfg.label}
            </span>
            <span className="font-mono text-[10px] text-text-dim flex items-center gap-1">
              <Clock size={9} /> {incident.time}
            </span>
            {incident.severity >= 4 && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-red/10 text-red border border-red/20">
                SEV {incident.severity}
              </span>
            )}
          </div>
          <h3 className="font-display font-bold text-sm text-text-primary leading-tight">{incident.title}</h3>
          <p className="font-body text-xs text-text-dim mt-1 line-clamp-2 leading-relaxed">{incident.description}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="font-mono text-[10px] text-text-dim flex items-center gap-1">
              <MapPin size={9} /> {suburbName}
            </span>
            {incident.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="badge-mono text-[9px]">{tag}</span>
            ))}
          </div>
          {/* Severity bar */}
          <div className="flex gap-0.5 mt-2">
            {[1,2,3,4,5].map((n) => (
              <div
                key={n}
                className="h-0.5 flex-1 rounded-full"
                style={{ background: n <= incident.severity ? SEVERITY_COLORS[incident.severity] : '#222636' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailPane({
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

    const newComment = {
      user: 'You',
      avatar: '#3b82f6',
      time: 'Just now',
      text,
    };

    onUpdateIncident(incident.id, (current) => ({
      ...current,
      comments: [...current.comments, newComment],
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
    <div className="flex flex-col h-full border-l border-border bg-surface animate-slide-in-right">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div
            className="text-xs px-2 py-0.5 rounded border font-mono uppercase tracking-wider"
            style={{ color: cfg.color, borderColor: `${cfg.color}40`, background: `${cfg.color}15` }}
          >
            {cfg.emoji} {cfg.label}
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
        <h2 className="font-display font-bold text-lg mt-2 leading-tight">{incident.title}</h2>
        <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-text-dim">
          <MapPin size={10} />{suburbName}
          <span>·</span>
          <Clock size={10} />{incident.time}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <div className="form-label">Description</div>
          <p className="font-body text-sm text-text-secondary leading-relaxed">{incident.description}</p>
        </div>

        <div>
          <div className="form-label">Severity</div>
          <div className="flex items-center gap-2">
            {[1,2,3,4,5].map((n) => (
              <div key={n} className="h-2 rounded-full flex-1" style={{ background: n <= incident.severity ? SEVERITY_COLORS[incident.severity] : '#222636' }} />
            ))}
            <span className="font-mono text-[10px] text-text-dim">{incident.severity}/5</span>
          </div>
        </div>

        {incident.tags.length > 0 && (
          <div>
            <div className="form-label">Suspect / Vehicle Details</div>
            <div className="flex flex-wrap gap-1.5">
              {incident.tags.map((tag) => <span key={tag} className="badge-mono">{tag}</span>)}
            </div>
          </div>
        )}

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
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: c.avatar }}>
                    {c.user[0]}
                  </div>
                  <span className="font-mono text-[11px] text-text-secondary">{c.user}</span>
                  <span className="font-mono text-[10px] text-text-dim ml-auto">{c.time}</span>
                </div>
                <p className="font-body text-xs text-text-secondary">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <input
          className="form-input text-xs flex-1"
          placeholder="Add a sighting or update..."
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
        <div className="w-96 flex-shrink-0">
          <DetailPane
            incident={selected}
            suburbName={selectedSuburb?.name ?? 'Unknown'}
            onClose={() => setSelectedId(null)}
            onUpdateIncident={updateIncident}
          />
        </div>
      )}
    </div>
  );
}
