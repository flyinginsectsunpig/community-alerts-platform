'use client';

import { TYPE_CONFIG } from '@/lib/constants';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import { SeverityBar } from '@/components/shared/SeverityBar';
import type { Incident } from '@/lib/types';
import { X, MapPin, Clock } from 'lucide-react';

interface Props {
  incident: Incident;
  suburbName: string;
  onClose: () => void;
  onUpdateIncident: (id: number | string, updater: (current: Incident) => Incident) => void;
  /** Tailwind width class applied to the outer wrapper. Defaults to 'w-96'. */
  width?: string;
  /** Label shown above the tags section. Defaults to 'Tags'. */
  tagLabel?: string;
}

export function IncidentDetailPane({
  incident,
  suburbName,
  onClose,
  onUpdateIncident,
  width = 'w-96',
  tagLabel = 'Tags',
}: Props) {
  const cfg = TYPE_CONFIG[incident.type];
  const { comment, setComment, loadingComments, submitComment } = useIncidentComments(incident, onUpdateIncident);

  return (
    <div className={`${width} flex-shrink-0 border-l border-border bg-surface flex flex-col animate-slide-in-right`}>
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
          <SeverityBar severity={incident.severity} size="lg" showLabel />
        </div>

        {incident.tags.length > 0 && (
          <div>
            <div className="form-label">{tagLabel}</div>
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
