'use client';

import { useStore } from '@/lib/store';
import { clsx } from 'clsx';

function Dot({ connected }: { connected: boolean }) {
  return (
    <span className={clsx(
      'inline-block w-1.5 h-1.5 rounded-full',
      connected ? 'bg-green animate-pulse' : 'bg-red/50'
    )} />
  );
}

export function StatusBar() {
  const { incidents, suburbs, backendConnected, mlConnected, notificationConnected } = useStore();

  const crimeCount = incidents.filter(i => i.type === 'crime').length;
  const criticalSuburbs = suburbs.filter(s => s.alertLevel === 'RED' || s.alertLevel === 'ORANGE').length;

  return (
    <div className="flex-shrink-0 h-7 bg-surface2/60 border-b border-border/50 flex items-center px-4 gap-4 overflow-x-auto scrollbar-hide">
      {/* Service status */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-dim uppercase tracking-wider">
          <Dot connected={backendConnected} />
          Java API
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-dim uppercase tracking-wider">
          <Dot connected={mlConnected} />
          ML Service
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-dim uppercase tracking-wider">
          <Dot connected={notificationConnected} />
          Notifications
        </span>
      </div>

      <div className="w-px h-3 bg-border flex-shrink-0" />

      {/* Live metrics */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
          <span className="text-text-secondary">{incidents.length}</span> active alerts
        </span>
        <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
          <span className="text-crime">{crimeCount}</span> crime incidents
        </span>
        <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
          <span className="text-accent">{criticalSuburbs}</span> elevated areas
        </span>
      </div>

      <div className="flex-1" />

      <span className="font-mono text-[10px] text-text-dim flex-shrink-0">
        Cape Town, ZA · {new Date().toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
    </div>
  );
}
