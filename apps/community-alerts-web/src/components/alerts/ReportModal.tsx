'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TYPE_CONFIG, SEVERITY_LABELS, SEVERITY_COLORS } from '@/lib/constants';
import { useRouter, useSearchParams } from 'next/navigation';
import type { IncidentType } from '@/lib/types';
import { X, MapPin, AlertTriangle, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * ReportModal Component
 * Replaces the old report flow with a more SOC-aligned interface.
 * Centered on desktop, bottom-sheet on mobile.
 */
export function ReportModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addIncident, suburbs } = useStore();
  
  const [type, setType] = useState<IncidentType>('crime');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
  const [suburbId, setSuburbId] = useState('obs');
  const [submitting, setSubmitting] = useState(false);

  const open = searchParams.get('report') === 'true';

  if (!open) return null;

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('report');
    router.push(`/?${params.toString()}`);
  };

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
    setTitle('');
    setDescription('');
    setSeverity(3);
    setSubmitting(false);
    close();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={close} />
      
      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Severity Warning Header */}
        {severity === 5 && (
          <div className="bg-red px-6 py-2 flex items-center gap-2 animate-pulse">
            <ShieldAlert size={14} className="text-white" />
            <span className="font-mono text-[9px] text-white font-bold uppercase tracking-widest">CRITICAL: Emergency Services (10111) Recommended</span>
          </div>
        )}

        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-[0.2em]">New Response</span>
            <h2 className="font-display font-bold text-xl text-text-primary">SUBMIT REPORT</h2>
          </div>
          <button onClick={close} className="text-text-dim hover:text-text-primary p-2">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Type Grid */}
          <div>
            <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-3">Incident Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_CONFIG) as [IncidentType, any][]).map(([t, c]) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={clsx(
                    'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                    type === t ? 'bg-surface2' : 'bg-transparent border-border opacity-50 hover:opacity-100'
                  )}
                  style={type === t ? { borderColor: c.color, color: c.color } : {}}
                >
                  <span className="text-lg">{c.emoji}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 text-center">
               <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest bg-surface2 px-2 py-0.5 rounded border border-border">
                  Selected: {cfg.label}
               </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Brief Title</label>
              <input
                className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-dim/50 focus:outline-none focus:border-accent/50"
                placeholder="Briefly state what happened..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Intelligence Details</label>
              <textarea
                className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-dim/50 focus:outline-none focus:border-accent/50 min-h-[100px]"
                placeholder="Additional details for the SOC..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Location</label>
                <select
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-xs text-text-secondary outline-none appearance-none"
                  value={suburbId}
                  onChange={(e) => setSuburbId(e.target.value)}
                >
                  {suburbs.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Severity</label>
                <div className="flex gap-1 h-9 items-center px-1">
                   {[1,2,3,4,5].map(n => (
                     <button
                        key={n}
                        onClick={() => setSeverity(n)}
                        className={clsx(
                          'flex-1 h-6 rounded flex items-center justify-center font-mono text-[10px] font-bold transition-all',
                          severity === n ? 'text-white translate-y-[-2px] shadow-lg' : 'bg-surface2 text-text-dim'
                        )}
                        style={severity === n ? { backgroundColor: SEVERITY_COLORS[n] } : {}}
                     >
                       {n}
                     </button>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="flex-1 bg-accent hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-accent text-white font-display font-bold py-3 px-4 rounded-xl shadow-glow-orange transition-all flex items-center justify-center gap-2"
          >
            {submitting ? 'TRANSMITTING...' : 'BROADCAST ALERT'}
          </button>
        </div>
      </div>
    </div>
  );
}
