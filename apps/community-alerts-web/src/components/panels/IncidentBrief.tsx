'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, SEVERITY_COLORS, SEVERITY_LABELS } from '@/lib/constants';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import { MapPin, Clock, Send, ShieldAlert, ChevronLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * IncidentBrief Component
 * Detailed view of an incident.
 */
export function IncidentBrief({ id }: { id: string | number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { incidents, updateIncident } = useStore();
  
  const incident = incidents.find(i => String(i.id) === String(id));
  const { comment, setComment, submitComment } = useIncidentComments(incident!, updateIncident);
  
  if (!incident) return (
    <div className="p-10 text-center font-mono text-xs text-text-dim">
      Intelligence for ID {id} not found in local cache.
    </div>
  );

  const isCritical = incident.severity === 5;
  const config = TYPE_CONFIG[incident.type];

  const goBack = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('incident');
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Critical Banner */}
      {isCritical && (
        <div className="bg-red px-6 py-2.5 flex items-center gap-3 animate-pulse">
          <ShieldAlert size={18} className="text-white" />
          <div className="flex flex-col">
            <span className="font-display font-black text-[11px] text-white uppercase tracking-tighter">CRITICAL INCIDENT</span>
            <span className="font-mono text-[9px] text-white/90">CONTACT SAPS 10111 IMMEDIATELY</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-6 pb-4 relative">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={goBack}
            className="flex items-center gap-1.5 font-mono text-[10px] text-text-dim hover:text-accent transition-colors uppercase tracking-widest"
          >
            <ChevronLeft size={14} />
            {searchParams.get('suburb') ? 'Back to Suburb' : 'Back to Feed'}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
           <div 
            className="px-2 py-0.5 rounded-sm border font-mono text-[9px] uppercase tracking-[0.15em] font-bold"
            style={{ color: config.color, borderColor: `${config.color}40`, backgroundColor: `${config.color}10` }}
          >
            {incident.type}
          </div>
        </div>

        <h1 className="font-display font-extrabold text-2xl text-text-primary leading-tight">
          {incident.title}
        </h1>

        <div className="flex items-center gap-4 mt-4 font-mono text-[10px] text-text-secondary uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-text-dim" />
            <span className="text-text-primary">{incident.suburb}</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-border pl-4">
            <Clock size={12} className="text-text-dim" />
            <span>{incident.time}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-y border-border bg-bg/40">
        <div className="flex justify-between items-center mb-2">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">Incident Severity</span>
          <span className="font-mono text-[10px] text-text-primary font-bold">{SEVERITY_LABELS[incident.severity]} {incident.severity}/5</span>
        </div>
        <div className="flex gap-1.5">
          {[1,2,3,4,5].map(n => (
            <div 
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= incident.severity ? '' : 'bg-surface2'}`}
              style={n <= incident.severity ? { backgroundColor: SEVERITY_COLORS[incident.severity] } : {}}
            />
          ))}
        </div>
      </div>

      <div className="p-6">
        <p className="font-body text-sm text-text-secondary leading-relaxed">
          {incident.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mt-6">
          {incident.tags.filter(t => t).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-surface2 border border-border rounded font-mono text-[9px] text-text-dim uppercase tracking-widest">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Intelligence Log (Comments) */}
      <div className="flex-1 border-t border-border flex flex-col bg-bg/20">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-mono text-[10px] text-text-dim uppercase tracking-[0.2em] font-bold">Intelligence Log</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {incident.comments.map((cm, i) => (
            <div key={i} className="flex gap-3 animate-fade-in">
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center font-mono text-[8px] text-accent flex-shrink-0 border border-accent/30">
                {cm.user.charAt(0)}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text-primary font-bold">{cm.user}</span>
                  <span className="font-mono text-[8px] text-text-dim uppercase">{cm.time}</span>
                </div>
                <p className="font-body text-[13px] text-text-secondary bg-surface rounded-r-lg rounded-bl-lg p-3 border border-border shadow-sm">
                  {cm.text}
                </p>
              </div>
            </div>
          ))}
          {incident.comments.length === 0 && (
            <div className="text-center py-10 flex flex-col items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center border border-border">
                  <Clock size={14} className="text-text-dim" />
               </div>
               <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">Waiting for field status...</span>
            </div>
          )}
        </div>

        {/* Comment Input */}
        <div className="p-4 bg-surface/80 border-t border-border backdrop-blur-sm">
          <div className="relative flex items-center">
            <input 
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitComment()}
              placeholder="Inject intelligence..."
              className="w-full bg-bg border border-border rounded-lg pl-4 pr-12 py-3 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all font-body"
            />
            <button 
              onClick={submitComment}
              className="absolute right-2 p-2 text-accent hover:text-orange-500 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
