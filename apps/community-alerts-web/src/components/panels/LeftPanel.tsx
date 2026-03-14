/**
 * LeftPanel.tsx
 *
 * FIX #8: The original code used `?panel=feed` URL param to control the mobile
 * bottom sheet, but nothing in the app ever set that param. The sheet never
 * opened on mobile. Fixed by:
 *   1. Using a local `mobileOpen` boolean state driven by the MobileTabBar's
 *      click — the Feed tab now dispatches a custom event which this component
 *      listens to. This avoids polluting the URL with transient UI state.
 *   2. Alternatively (simpler, chosen here): expose a global Zustand action
 *      `setLeftPanelOpen` and read it here. Since we can't change the store
 *      shape, we use a module-level event bus (a tiny CustomEvent) instead.
 *
 * The mobile sheet slides up from the bottom covering 70% of the screen.
 * A drag handle at the top gives a visual affordance to dismiss it.
 * Tapping the backdrop also closes it.
 */
'use client';

import { useStore } from '@/lib/store';
import { useSearchParams, useRouter } from 'next/navigation';
import { Activity, BarChart3, X } from 'lucide-react';
import { ThreatFeed } from './ThreatFeed';
import { AnalyticsPanel } from './AnalyticsPanel';
import { useEffect, useState } from 'react';

// Module-level event bus — avoids store shape changes
// MobileTabBar dispatches 'toggle-left-panel'; LeftPanel listens.
export const LEFT_PANEL_EVENT = 'toggle-left-panel';

export function LeftPanel() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { incidents } = useStore();

  const view        = searchParams.get('view');
  const isAnalytics = view === 'analytics';

  // Mobile bottom sheet open state
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMobileOpen(v => !v);
    window.addEventListener(LEFT_PANEL_EVENT, handler);
    return () => window.removeEventListener(LEFT_PANEL_EVENT, handler);
  }, []);

  // Close mobile sheet when navigating to analytics (panel swaps content)
  useEffect(() => {
    if (isAnalytics) setMobileOpen(true);
  }, [isAnalytics]);

  const setView = (v: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set('view', v);
    else params.delete('view');
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[29] bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          // Desktop: fixed left column, always visible
          'fixed left-0 top-12 z-30 flex flex-col',
          'bg-[#0e1118]/96 border-r border-border',

          // Desktop sizing
          'md:w-[320px] md:bottom-9 md:translate-y-0 md:translate-x-0',

          // Mobile: full-width bottom sheet, slides up
          'w-full bottom-0',
          // Height: 70vh on mobile
          'h-[70vh] md:h-auto',

          // Mobile slide animation
          'transition-transform duration-300',
          // Mobile: hidden by default (translate down), shown when mobileOpen
          mobileOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0',
        ].join(' ')}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>

        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <div className="font-mono text-[9px] text-text-dim uppercase tracking-[0.18em]">
              {isAnalytics ? 'System Analytics' : 'Live Threat Feed'}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-display font-bold text-sm text-text-primary">
                {isAnalytics ? 'DATA VIEW' : 'INCIDENTS'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface2 border border-border font-mono text-[9px] text-accent tabular">
                {incidents.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle lens */}
            <button
              onClick={() => setView(isAnalytics ? null : 'analytics')}
              className="w-7 h-7 rounded-md bg-surface2 border border-border flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
              title={isAnalytics ? 'Switch to Live Feed' : 'Switch to Analytics'}
            >
              {isAnalytics ? <Activity size={14} /> : <BarChart3 size={14} />}
            </button>
            {/* Mobile close */}
            <button
              className="md:hidden w-7 h-7 rounded-md bg-surface2 border border-border flex items-center justify-center text-text-dim hover:text-text-primary transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {isAnalytics ? <AnalyticsPanel /> : <ThreatFeed />}
        </div>
      </aside>
    </>
  );
}
