/**
 * IncidentBrief.tsx
 *
 * FIX #6: useIncidentComments is now called unconditionally (React rules of
 * hooks require this). The hook receives `incident` which may be undefined;
 * the hook itself handles the undefined case. The `!` non-null assertion was
 * removed — it provided no runtime safety.
 *
 * FIX #7: `incident.suburb` is a suburb ID string ("obs"), not a display name.
 * We now look up the suburb name from the store's `suburbs` array. Falls back
 * to the raw ID if not found (e.g. during cold start).
 */
'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, SEVERITY_COLORS, SEVERITY_LABELS } from '@/lib/constants';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import { MapPin, Clock, Send, ShieldAlert, ChevronLeft, Phone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export function IncidentBrief({ id }: { id: string | number }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { incidents, suburbs, updateIncident } = useStore();

  const incident     = incidents.find(i => String(i.id) === String(id));
  // FIX #7: look up display name
  const suburbName   = suburbs.find(s => s.id === incident?.suburb)?.name ?? incident?.suburb ?? '—';

  // FIX #6: hook called unconditionally, before any early return
  const { comment, setComment, submitComment } =
    useIncidentComments(incident as any, updateIncident);

  if (!incident) {
    return (
      <div className="p-10 text-center font-mono text-xs text-text-dim">
        <div className="mb-2 text-text-secondary">
          Intelligence ID {id} not found in local cache — it may have been reported before this session.
        </div>
      </div>
    );
  }

  const isCritical = incident.severity === 5;
  const config     = TYPE_CONFIG[incident.type];
  const sevColor   = SEVERITY_COLORS[incident.severity];
  const sevLabel   = SEVERITY_LABELS[incident.severity];

  const fromSuburb = searchParams.get('suburb');

  const goBack = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('incident');
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  return (
    <div className="flex flex-col min-h-full bg-[#0e1118]">

      {/* Critical banner */}
      {isCritical && (
        <div className="bg-red/90 px-5 py-2.5 flex items-center gap-3 border-b border-red/50">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
          <div>
            <div className="font-mono text-[10px] text-white font-bold uppercase tracking-widest">
              Critical Incident
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-white/80 mt-0.5">
              <Phone size={9} /> Contact SAPS 10111 immediately
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        {/* Back breadcrumb */}
        <button
          onClick={goBack}
          className="flex items-center gap-1 font-mono text-[9px] text-text-dim hover:text-accent transition-colors uppercase tracking-widest mb-3"
        >
          <ChevronLeft size={12} />
          {fromSuburb ? `Back to ${suburbName}` : 'Back to Feed'}
        </button>

        {/* Type badge */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider mb-3"
          style={{ color: config.color, borderColor: `${config.color}40`, background: `${config.color}12` }}
        >
          {config.emoji} {config.label}
        </div>

        {/* Title */}
        <h1 className="font-display font-extrabold text-xl text-text-primary leading-tight">
          {incident.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-2 font-mono text-[10px] text-text-dim">
          <span className="flex items-center gap-1">
            <MapPin size={10} /> {suburbName}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} /> {incident.time}
          </span>
        </div>
      </div>

      {/* Severity bar */}
      <div className="px-5 py-3 border-y border-border bg-[#080a0f]/50">
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-mono text-[9px] text-text-dim uppercase tracking-wider">Severity</span>
          <span className="font-mono text-[10px] font-bold" style={{ color: sevColor }}>
            {sevLabel} {incident.severity}/5
          </span>
        </div>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => (
            <div
              key={n}
              className="h-1.5 flex-1 rounded-full transition-all"
              style={{ background: n <= incident.severity ? sevColor : '#222636' }}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-4">
        <p className="font-body text-sm text-text-secondary leading-relaxed">
          {incident.description}
        </p>
        {incident.tags.filter(Boolean).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {incident.tags.filter(Boolean).map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-surface2 border border-border rounded font-mono text-[9px] text-text-dim uppercase tracking-wider"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Intelligence Log */}
      <div className="flex-1 border-t border-border flex flex-col">
        <div className="px-5 py-3 border-b border-border">
          <div className="font-mono text-[10px] text-text-dim uppercase tracking-[0.2em]">
            Intelligence Log
            {incident.commentCount > 0 && (
              <span className="ml-2 text-text-secondary">({incident.commentCount})</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[120px]">
          {incident.comments.map((cm, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[9px] font-bold text-white flex-shrink-0 border border-white/10"
                style={{ background: cm.avatar }}
              >
                {cm.user[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-text-primary font-bold">{cm.user}</span>
                  <span className="font-mono text-[9px] text-text-dim">{cm.time}</span>
                </div>
                <p className="font-body text-xs text-text-secondary bg-surface rounded-lg p-3 border border-border leading-relaxed">
                  {cm.text}
                </p>
              </div>
            </div>
          ))}
          {incident.comments.length === 0 && (
            <div className="text-center py-8">
              <div className="font-mono text-[10px] text-text-dim uppercase tracking-widest">
                Awaiting field reports…
              </div>
            </div>
          )}
        </div>

        {/* Comment input */}
        <div className="p-4 border-t border-border flex gap-2">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
            placeholder="Inject intelligence…"
            className="flex-1 bg-[#080a0f] border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 transition-all font-body"
          />
          <button
            onClick={submitComment}
            disabled={!comment.trim()}
            className="px-3 py-2 bg-accent hover:bg-orange-500 disabled:opacity-40 text-white rounded-lg transition-all flex-shrink-0"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
