'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR } from '@/lib/constants';
import { useRouter } from 'next/navigation';

/**
 * AnalyticsPanel Component
 * Displays KPI metrics and suburb rankings.
 * Replaces the feed when ?view=analytics is set.
 */
export function AnalyticsPanel() {
  const router = useRouter();
  const { incidents, suburbs } = useStore();

  const total = incidents.length;
  const critical = incidents.filter(i => i.severity === 5).length;
  const avgSeverity = total > 0 ? (incidents.reduce((sum, i) => sum + i.severity, 0) / total).toFixed(1) : '0.0';

  const typeDistribution = Object.keys(TYPE_CONFIG).map(type => ({
    type,
    count: incidents.filter(i => i.type === type).length,
    color: TYPE_CONFIG[type as keyof typeof TYPE_CONFIG].color
  })).sort((a, b) => b.count - a.count);

  const topSuburbs = [...suburbs].sort((a, b) => b.weight - a.weight).slice(0, 10);

  return (
    <div className="flex flex-col p-4 gap-6 animate-fade-in">
      {/* KPI metrics stack */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-surface border border-border rounded-lg shadow-sm">
          <div className="font-mono text-[9px] text-text-dim uppercase tracking-widest">Total Alerts</div>
          <div className="font-mono text-xl font-bold text-text-primary mt-1">{total}</div>
        </div>
        <div className="p-3 bg-surface border border-border rounded-lg shadow-sm">
          <div className="font-mono text-[9px] text-text-dim uppercase tracking-widest">Critical</div>
          <div className="font-mono text-xl font-bold text-red mt-1">{critical}</div>
        </div>
        <div className="p-3 bg-surface border border-border rounded-lg shadow-sm">
          <div className="font-mono text-[9px] text-text-dim uppercase tracking-widest">Avg Severity</div>
          <div className="font-mono text-xl font-bold text-accent mt-1">{avgSeverity}</div>
        </div>
        <div className="p-3 bg-surface border border-border rounded-lg shadow-sm">
          <div className="font-mono text-[9px] text-text-dim uppercase tracking-widest">Active Suburbs</div>
          <div className="font-mono text-xl font-bold text-text-primary mt-1">{suburbs.length}</div>
        </div>
      </div>

      {/* Suburb heat ranking list */}
      <div className="flex flex-col gap-3">
        <h3 className="font-mono text-[10px] text-text-dim uppercase tracking-[0.2em] font-bold">Suburb Risk Grid</h3>
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {topSuburbs.map((sub, idx) => {
            const color = ALERT_LEVEL_COLOR[sub.alertLevel ?? 'GREEN'];
            const pct = Math.min(100, (sub.weight / 50) * 100);
            return (
              <div 
                key={sub.id} 
                onClick={() => router.push(`/?suburb=${sub.id}`)}
                className="flex items-center gap-3 p-2 hover:bg-surface border border-transparent hover:border-border rounded-md cursor-pointer group transition-all"
              >
                <div className="font-mono text-[9px] text-text-dim w-3">{idx + 1}</div>
                <span className="flex-1 font-body text-xs text-text-secondary truncate group-hover:text-text-primary">
                  {sub.name}
                </span>
                <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
                   <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <span className="font-mono text-[10px] text-text-dim w-6 text-right">
                  {sub.weight}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribution */}
      <div className="flex flex-col gap-3">
        <h3 className="font-mono text-[10px] text-text-dim uppercase tracking-[0.2em] font-bold">Intelligence Mix</h3>
        <div className="flex flex-col gap-4">
          {typeDistribution.map((item) => {
            const pct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.type} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center px-1">
                  <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest">{item.type}</span>
                  <span className="font-mono text-[9px] text-text-dim font-bold">{item.count}</span>
                </div>
                <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button 
         className="mt-6 w-full py-2.5 bg-surface2 hover:bg-border border border-border rounded-lg font-display font-bold text-[10px] text-text-secondary hover:text-accent transition-all uppercase tracking-[0.2em]"
      >
        Download Intelligence Log
      </button>
    </div>
  );
}
