'use client';

import { useStore } from '@/lib/store';
import { useSearchParams, useRouter } from 'next/navigation';
import { Activity, BarChart3 } from 'lucide-react';
import { ThreatFeed } from './ThreatFeed';
import { AnalyticsPanel } from './AnalyticsPanel';

/**
 * LeftPanel Component
 * Container for the Threat Feed and Analytics.
 * Handles mode switching and responsive layout.
 */
export function LeftPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { incidents } = useStore();
  
  const view = searchParams.get('view');
  const isAnalytics = view === 'analytics';
  const panel = searchParams.get('panel'); // For mobile bottom sheet state

  const setView = (v: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set('view', v);
    else params.delete('view');
    router.push(`/?${params.toString()}`);
  };

  return (
    <aside 
      className={`
        fixed left-0 top-12 bottom-9 w-[320px] bg-surface/92 border-r border-border z-30 flex flex-col
        transition-transform duration-380 md:translate-x-0
        ${panel ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
        bottom-0 md:bottom-9 h-[calc(100vh-48px-36px)] md:h-auto
        w-full md:w-[320px]
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="font-mono text-[10px] font-bold tracking-[0.2em] text-text-dim uppercase">
            {isAnalytics ? 'System Analytics' : 'Live Threat Feed'}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-display font-bold text-lg text-text-primary">
              {isAnalytics ? 'CAP DATA' : 'INCIDENTS'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-surface2 border border-border font-mono text-[10px] text-accent">
              {incidents.length}
            </span>
          </div>
        </div>

        <button 
          onClick={() => setView(isAnalytics ? null : 'analytics')}
          className="w-8 h-8 rounded-md bg-surface2 border border-border flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
        >
          {isAnalytics ? <Activity size={16} /> : <BarChart3 size={16} />}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {isAnalytics ? <AnalyticsPanel /> : <ThreatFeed />}
      </div>
      
      {/* Mobile Handle / Closer */}
      <div className="md:hidden h-1.5 w-12 bg-border rounded-full mx-auto my-2" />
    </aside>
  );
}
