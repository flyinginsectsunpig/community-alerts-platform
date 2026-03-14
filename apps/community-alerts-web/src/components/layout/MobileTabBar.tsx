/**
 * MobileTabBar.tsx
 *
 * FIX tied to #8: The Feed tab now dispatches the LEFT_PANEL_EVENT custom
 * event (defined in LeftPanel.tsx) instead of setting a dead `?panel=feed`
 * URL param that nothing ever read. The Map tab clears panels and closes
 * the left panel sheet by dispatching the event when it's already open.
 * Analytics tab sets ?view=analytics which LeftPanel auto-opens for.
 */
'use client';

import { Bell, BarChart3, Map as MapIcon, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LEFT_PANEL_EVENT } from '@/components/panels/LeftPanel';

export function MobileTabBar() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const view         = searchParams.get('view');

  const isAnalytics  = view === 'analytics';

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[#0e1118]/96 border-t border-border z-20 flex md:hidden items-center justify-around px-2">

      {/* Feed */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent(LEFT_PANEL_EVENT))}
        className="flex flex-col items-center gap-0.5 py-1 text-text-dim hover:text-accent transition-colors"
      >
        <Bell size={20} strokeWidth={1.5} />
        <span className="font-mono text-[8px] uppercase tracking-wider">Feed</span>
      </button>

      {/* Analytics */}
      <button
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString());
          if (isAnalytics) {
            params.delete('view');
          } else {
            params.set('view', 'analytics');
          }
          const qs = params.toString();
          router.push(qs ? `/?${qs}` : '/');
        }}
        className={`flex flex-col items-center gap-0.5 py-1 transition-colors ${isAnalytics ? 'text-accent' : 'text-text-dim hover:text-accent'}`}
      >
        <BarChart3 size={20} strokeWidth={1.5} />
        <span className="font-mono text-[8px] uppercase tracking-wider">Stats</span>
      </button>

      {/* Map — clears all panels */}
      <button
        onClick={() => router.push('/')}
        className="flex flex-col items-center gap-0.5 py-1 text-text-dim hover:text-accent transition-colors"
      >
        <MapIcon size={20} strokeWidth={1.5} />
        <span className="font-mono text-[8px] uppercase tracking-wider">Map</span>
      </button>

      {/* Report — floating pill button */}
      <button
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('report', 'true');
          router.push(`/?${params.toString()}`);
        }}
        className="flex flex-col items-center justify-center -translate-y-3"
      >
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-glow-orange border-4 border-[#080a0f]">
          <Plus size={22} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-mono text-[8px] uppercase tracking-wider text-text-dim mt-0.5">Report</span>
      </button>
    </nav>
  );
}
