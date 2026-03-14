'use client';

import { Bell, BarChart3, Map as MapIcon, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * MobileTabBar Component
 * Replaces the AmbientHUD on small screens.
 * Fixed to bottom, 56px tall.
 */
export function MobileTabBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const panel = searchParams.get('panel'); // Helper to track if left panel is 'open' on mobile
  
  const isActive = (v: string | null) => view === v;

  const navigate = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    router.push(`/?${params.toString()}`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-surface/95 border-t border-border z-20 flex md:hidden items-center justify-around px-2">
      <button 
        onClick={() => navigate({ view: null, panel: 'feed' })}
        className={`flex flex-col items-center gap-1 transition-colors ${!view && panel === 'feed' ? 'text-accent' : 'text-text-dim'}`}
      >
        <Bell size={20} />
        <span className="font-mono text-[9px] uppercase tracking-tighter">Feed</span>
      </button>

      <button 
        onClick={() => navigate({ view: 'analytics', panel: 'analytics' })}
        className={`flex flex-col items-center gap-1 transition-colors ${isActive('analytics') ? 'text-accent' : 'text-text-dim'}`}
      >
        <BarChart3 size={20} />
        <span className="font-mono text-[9px] uppercase tracking-tighter">Stats</span>
      </button>

      <button 
        onClick={() => router.push('/')}
        className={`flex flex-col items-center gap-1 transition-colors ${!view && !panel ? 'text-accent' : 'text-text-dim'}`}
      >
        <MapIcon size={20} />
        <span className="font-mono text-[9px] uppercase tracking-tighter">Map</span>
      </button>

      <button 
        onClick={() => navigate({ report: 'true' })}
        className="flex flex-col items-center justify-center -translate-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-glow-orange border-4 border-bg">
          <Plus size={24} className="text-white" />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-tighter text-text-dim mt-1">Report</span>
      </button>
    </nav>
  );
}
