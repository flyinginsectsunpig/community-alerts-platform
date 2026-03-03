'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TYPE_CONFIG, UI_TO_BACKEND_TYPE } from '@/lib/constants';
import type { IncidentType } from '@/lib/types';
import { X, MapPin, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReportModal({ open, onClose }: Props) {
  const { addIncident, suburbs, backendConnected, setBackendConnected } = useStore();
  const [type, setType] = useState<IncidentType>('crime');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
  const [suburbId, setSuburbId] = useState('obs');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const cfg = TYPE_CONFIG[type];
  const suburb = suburbs.find((s) => s.id === suburbId);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);

    const newIncident = {
      id: Date.now(),
      suburb: suburbId,
      type,
      title: title.trim(),
      description: description.trim() || 'Community alert — details pending.',
      tags: [],
      time: 'Just now',
      lat: suburb?.lat ?? -33.96,
      lng: suburb?.lng ?? 18.55,
      severity: severity as 1 | 2 | 3 | 4 | 5,
      comments: [],
      commentCount: 0,
    };

    addIncident(newIncident);

    // Reset
    setTitle('');
    setDescription('');
    setSeverity(3);
    setSubmitting(false);
    onClose();
  }

  const SEVERITY_LABELS = ['', 'Minor', 'Low', 'Moderate', 'High', 'Critical'];
  const SEVERITY_COLORS = ['', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="badge-mono mb-1">New Report</div>
            <div className="font-display font-bold text-lg">Report an Incident</div>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text-primary w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Type selector */}
          <div>
            <label className="form-label">Incident Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_CONFIG) as [IncidentType, any][]).map(([t, c]) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={clsx(
                    'flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-center transition-all',
                    type === t
                      ? 'border-opacity-60'
                      : 'border-border bg-surface2 text-text-dim hover:text-text-secondary hover:border-border',
                  )}
                  style={type === t ? { borderColor: `${c.color}60`, background: `${c.color}15` } : undefined}
                >
                  <span className="text-xl">{c.icon}</span>
                  <span className="font-mono text-[10px] leading-tight" style={type === t ? { color: c.color } : undefined}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="form-label">Title *</label>
            <input
              className="form-input"
              placeholder={`e.g. ${cfg.emoji} Armed robbery at Shell garage`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description / Details</label>
            <textarea
              className="form-input resize-none"
              rows={3}
              placeholder="Describe what happened. For crime: include clothing, direction of flight, vehicle..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Suburb */}
          <div>
            <label className="form-label">Location</label>
            <div className="relative">
              <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <select
                className="form-input pl-8 cursor-pointer"
                value={suburbId}
                onChange={(e) => setSuburbId(e.target.value)}
              >
                {suburbs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Severity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Severity</label>
              <span className="font-mono text-xs" style={{ color: SEVERITY_COLORS[severity] }}>
                {SEVERITY_LABELS[severity]}
              </span>
            </div>
            <input
              type="range" min={1} max={5} value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between mt-1">
              {[1,2,3,4,5].map((n) => (
                <div key={n} className="h-1 w-1 rounded-full" style={{ background: n <= severity ? SEVERITY_COLORS[severity] : '#222636' }} />
              ))}
            </div>
          </div>

          {severity === 5 && (
            <div className="flex items-center gap-2 bg-red/10 border border-red/20 rounded-lg p-3 text-xs text-red font-mono">
              <AlertTriangle size={12} />
              Critical severity — please contact SAPS 10111 immediately
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center py-2">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className={clsx('btn-primary flex-1 justify-center py-2', (!title.trim() || submitting) && 'opacity-50 cursor-not-allowed')}
          >
            {submitting ? 'Submitting...' : `${cfg.emoji} Report Alert`}
          </button>
        </div>
      </div>
    </div>
  );
}
