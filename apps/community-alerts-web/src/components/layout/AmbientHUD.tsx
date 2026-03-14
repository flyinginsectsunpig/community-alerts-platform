'use client';

import { useStore } from '@/lib/store';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * AmbientHUD Component
 * Fixed at the bottom (36px). Small, muted data streams.
 * Desktop only (hidden on mobile as it's replaced by TabBar).
 */
export function AmbientHUD() {
  const router = useRouter();
  const { incidents, suburbs, backendConnected, mlConnected, notificationConnected } = useStore();
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const criticalCount = incidents.filter(i => i.severity === 5).length;
  const activeCount = incidents.length;
  
  // Find highest risk suburb
  const highestRisk = [...suburbs].sort((a, b) => b.weight - a.weight)[0];

  const getStatusColor = (connected: boolean) => connected ? 'bg-green' : 'bg-red';

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-9 bg-bg/80 border-t border-border z-10 px-4 hidden md:flex items-center justify-between pointer-events-auto">
      {/* Left: Counts */}
      <div className="flex items-center gap-4 font-mono text-[10px] tracking-wider">
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim uppercase">Active</span>
          <span className="text-text-primary font-bold">{activeCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim uppercase">Critical</span>
          <span className={criticalCount > 0 ? 'text-red font-bold' : 'text-text-dim'}>
            {criticalCount}
          </span>
        </div>
      </div>

      {/* Centre: Highest Risk */}
      {highestRisk && (
        <div 
          className="flex items-center gap-2 cursor-pointer hover:text-accent transition-colors group"
          onClick={() => router.push(`/?suburb=${highestRisk.id}`)}
        >
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Highest Risk:</span>
          <span className="font-mono text-[10px] text-text-primary group-hover:underline">{highestRisk.name.toUpperCase()}</span>
        </div>
      )}

      {/* Right: Clock + Status */}
      <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-wider">
        <div className="text-text-dim">
          Cape Town, ZA · <span className="text-text-secondary">{time}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className={`w-1 h-1 rounded-full ${getStatusColor(backendConnected)}`} />
            <span className="text-[8px] text-text-dim">API</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1 h-1 rounded-full ${getStatusColor(mlConnected)}`} />
            <span className="text-[8px] text-text-dim">ML</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1 h-1 rounded-full ${getStatusColor(notificationConnected)}`} />
            <span className="text-[8px] text-text-dim">SOC</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
