'use client';

import { TYPE_CONFIG } from '@/lib/constants';
import { SeverityBar } from '@/components/shared/SeverityBar';
import type { Incident } from '@/lib/types';
import { clsx } from 'clsx';
import { MapPin, Clock } from 'lucide-react';

interface Props {
  incident: Incident;
  suburbName: string;
  onSelect: () => void;
  selected: boolean;
}

export function IncidentCard({ incident, suburbName, onSelect, selected }: Props) {
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
          <div className="mt-2">
            <SeverityBar severity={incident.severity} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
